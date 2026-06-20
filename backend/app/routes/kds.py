from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.db.session import get_db
from app.db.models import User, Order, OrderItem, Product, TableMaster
from app.models.schemas import KDSTicket
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/kds", tags=["kds"])

chef_dependency = Depends(require_role(["chef", "superadmin", "employee"]))

@router.get("/tickets", response_model=List[KDSTicket], dependencies=[chef_dependency])
def get_kds_tickets(db: Session = Depends(get_db)):
    active_orders = db.query(Order).filter(Order.status.in_(['sent_to_kitchen'])).all()
    
    tickets = []
    for order in active_orders:
        items = db.query(OrderItem).join(Product).filter(
            OrderItem.order_id == order.id,
            Product.kds_visible == True,
            OrderItem.kitchen_status.in_(['to_cook', 'preparing'])
        ).all()
        
        if not items:
            continue
            
        ticket_items = []
        for i in items:
            chef_name = None
            if i.claimed_by:
                chef = db.query(User).filter(User.id == i.claimed_by).first()
                if chef:
                    chef_name = chef.name
            ticket_items.append({
                "id": i.id,
                "product_name": i.product.name,
                "quantity": i.quantity,
                "kitchen_status": i.kitchen_status,
                "notes": i.notes,
                "claimed_by_name": chef_name,
                "claimed_at": i.claimed_at
            })
            
        table_num = None
        if order.table_id:
            table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
            if table:
                table_num = table.table_number
                
        tickets.append({
            "order_id": order.id,
            "order_number": order.order_number,
            "table_number": table_num,
            "source": order.source,
            "created_at": order.created_at,
            "items": ticket_items
        })
    return tickets

@router.post("/items/{item_id}/claim")
async def claim_kds_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["chef", "superadmin", "employee"]))):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
        
    if item.kitchen_status != 'to_cook':
        raise HTTPException(status_code=400, detail="Item is already claimed or completed")
        
    item.kitchen_status = 'preparing'
    item.claimed_by = current_user.id
    item.claimed_at = datetime.utcnow()
    db.commit()
    
    # Broadcast to KDS and waiter channels
    await manager.broadcast_all({
        "event": "item_claimed",
        "item_id": item_id,
        "claimed_by": current_user.id,
        "claimed_by_name": current_user.name
    })
    
    return {"success": True, "status": "preparing"}

@router.post("/items/{item_id}/complete")
async def complete_kds_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["chef", "superadmin", "employee"]))):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
        
    if item.kitchen_status == 'completed':
        raise HTTPException(status_code=400, detail="Item is already completed")
        
    item.kitchen_status = 'completed'
    item.completed_at = datetime.utcnow()
    db.commit()
    
    # Broadcast to KDS and waiter channels
    await manager.broadcast_all({
        "event": "item_completed",
        "item_id": item_id,
        "order_id": item.order_id
    })
    
    return {"success": True, "status": "completed"}
