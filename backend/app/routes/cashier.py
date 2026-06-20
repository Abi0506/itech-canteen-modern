from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date
import random
from typing import List, Optional, Dict, Any

from app.db.session import get_db
from app.db.models import User, TableMaster, Order, OrderItem, Product, InventoryItem, StockMovement, Customer, PosSession, Payment, PaymentMethod
from app.models.schemas import OrderCreate, OrderResponse, CustomerSignup, CustomerResponse, OrderItemCreate
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/cashier", tags=["cashier"])

cashier_dependency = Depends(require_role(["cashier", "superadmin"]))

def generate_order_number(db: Session, source: str) -> str:
    prefix = "C" if source == "cashier" else "S"
    date_str = datetime.utcnow().strftime("%y%m%d")
    # count orders today
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    return f"{prefix}{date_str}{count + 1:04d}"

@router.get("/tables", dependencies=[cashier_dependency])
def list_tables(db: Session = Depends(get_db)):
    tables = db.query(TableMaster).all()
    result = []
    for t in tables:
        waiter_name = None
        if t.current_waiter_id:
            waiter = db.query(User).filter(User.id == t.current_waiter_id).first()
            if waiter:
                waiter_name = waiter.name
        result.append({
            "id": t.id,
            "table_number": t.table_number,
            "seats": t.seats,
            "is_active": t.is_active,
            "current_status": t.current_status,
            "current_waiter_id": t.current_waiter_id,
            "waiter_name": waiter_name,
            "current_order_id": t.current_order_id
        })
    return result

@router.post("/tables/{table_id}/release", dependencies=[cashier_dependency])
def release_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(TableMaster).filter(TableMaster.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    table.current_status = 'available'
    table.current_waiter_id = None
    table.current_order_id = None
    db.commit()
    
    # Broadcast to websocket
    manager.broadcast_sync({
        "event": "table_released",
        "table_id": table_id
    })
    
    return {"success": True, "message": "Table released successfully"}

@router.get("/orders", response_model=List[OrderResponse], dependencies=[cashier_dependency])
def get_cashier_orders(db: Session = Depends(get_db)):
    # Find orders in open POS sessions
    open_sessions = db.query(PosSession).filter(PosSession.status == 'open').all()
    session_ids = [s.id for s in open_sessions]
    if not session_ids:
        return []
    return db.query(Order).filter(Order.pos_session_id.in_(session_ids)).order_by(Order.created_at.desc()).all()

@router.post("/orders", response_model=OrderResponse)
async def create_cashier_order(order_in: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    # Find open POS session
    pos_session = db.query(PosSession).filter(PosSession.user_id == current_user.id, PosSession.status == 'open').first()
    if not pos_session:
        # Create a default POS session if none exists
        pos_session = PosSession(
            user_id=current_user.id,
            status='open',
            opening_cash=Decimal("0.00")
        )
        db.add(pos_session)
        db.commit()
        db.refresh(pos_session)
        
    order_num = generate_order_number(db, "cashier")
    
    # Calculate totals
    subtotal = Decimal("0.00")
    for item in order_in.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod or not prod.is_active:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not available")
        subtotal += prod.price * item.quantity
        
    # Standard 5% tax or get venue tax settings
    tax_total = subtotal * Decimal("0.05")
    total = subtotal + tax_total

    new_order = Order(
        order_number=order_num,
        source="cashier",
        table_id=order_in.table_id,
        customer_id=order_in.customer_id,
        pos_session_id=pos_session.id,
        placed_by_user_id=current_user.id,
        waiter_id=current_user.id if order_in.table_id else None,
        status="draft",
        subtotal=subtotal,
        tax_total=tax_total,
        discount_total=Decimal("0.00"),
        total=total,
        notes=order_in.notes
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Add order items
    for item in order_in.items:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        line_total = prod.price * item.quantity
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=prod.price,
            line_discount=Decimal("0.00"),
            line_total=line_total,
            kitchen_status="pending",
            notes=item.notes
        )
        db.add(order_item)
        
    db.commit()
    db.refresh(new_order)
    
    # Associate table with active order
    if order_in.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order_in.table_id).first()
        if table:
            table.current_status = 'occupied'
            table.current_waiter_id = current_user.id
            table.current_order_id = new_order.id
            db.commit()
            
    # Send WebSocket update to CFD channel
    if order_in.table_id:
        await manager.broadcast_all({
            "event": "cart_updated",
            "table_id": order_in.table_id,
            "order_id": new_order.id,
            "items": [{"name": i.product.name, "quantity": float(i.quantity), "price": float(i.unit_price)} for i in new_order.items],
            "subtotal": float(new_order.subtotal),
            "tax_total": float(new_order.tax_total),
            "total": float(new_order.total)
        })

    return new_order

@router.put("/orders/{order_id}/items", response_model=OrderResponse)
async def update_cashier_order_items(order_id: int, items_in: List[OrderItemCreate], db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != 'draft':
        raise HTTPException(status_code=400, detail="Cannot modify non-draft order")
        
    # Clear existing items
    db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
    
    subtotal = Decimal("0.00")
    for item in items_in:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod or not prod.is_active:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not available")
            
        line_total = prod.price * item.quantity
        subtotal += line_total
        
        order_item = OrderItem(
            order_id=order_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=prod.price,
            line_discount=Decimal("0.00"),
            line_total=line_total,
            kitchen_status="pending",
            notes=item.notes
        )
        db.add(order_item)
        
    tax_total = subtotal * Decimal("0.05")
    order.subtotal = subtotal
    order.tax_total = tax_total
    order.total = subtotal + tax_total - order.discount_total
    db.commit()
    db.refresh(order)
    
    # Broadcast to CFD
    if order.table_id:
        await manager.broadcast_all({
            "event": "cart_updated",
            "table_id": order.table_id,
            "order_id": order.id,
            "items": [{"name": i.product.name, "quantity": float(i.quantity), "price": float(i.unit_price)} for i in order.items],
            "subtotal": float(order.subtotal),
            "tax_total": float(order.tax_total),
            "total": float(order.total)
        })
        
    return order

@router.post("/orders/{order_id}/pay-and-send", response_model=OrderResponse)
async def pay_and_send(order_id: int, payment_payload: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != 'draft':
        raise HTTPException(status_code=400, detail="Order already processed")
        
    method_id = payment_payload.get("payment_method_id")
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method or not method.is_enabled:
        raise HTTPException(status_code=400, detail="Invalid/disabled payment method")
        
    # Record payment
    received = Decimal(str(payment_payload.get("amount_received", order.total)))
    change = received - order.total
    
    payment = Payment(
        order_id=order.id,
        payment_method_id=method_id,
        amount=order.total,
        amount_received=received,
        change_due=change if change > 0 else Decimal("0.00"),
        reference_code=payment_payload.get("reference_code"),
        status="completed",
        received_by=current_user.id
    )
    db.add(payment)
    
    # Deduct Stock immediately
    for item in order.items:
        inv = db.query(InventoryItem).filter(InventoryItem.product_id == item.product_id).first()
        if inv:
            inv.current_stock -= item.quantity
            # Record stock movement
            mvt = StockMovement(
                inventory_item_id=inv.id,
                movement_type="sale_out",
                quantity=item.quantity,
                reference_order_id=order.id,
                performed_by=current_user.id,
                note=f"Sale order {order.order_number}"
            )
            db.add(mvt)
            
    # Update order status
    order.status = "sent_to_kitchen"
    db.commit()
    db.refresh(order)
    
    # Update table status
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table.current_status = 'reserved'
            db.commit()
            
    # Send WebSocket events
    await manager.broadcast_all({
        "event": "payment_completed",
        "order_id": order.id,
        "table_id": order.table_id,
        "total": float(order.total),
        "change_due": float(payment.change_due or 0)
    })
    
    await manager.broadcast_all({
        "event": "order_sent_to_kitchen",
        "order_id": order.id,
        "table_id": order.table_id
    })
    
    return order

@router.get("/customers/search")
def search_customer(q: str, db: Session = Depends(get_db)):
    customers = db.query(Customer).filter(
        (Customer.name.like(f"%{q}%")) | (Customer.mobile_number.like(f"%{q}%"))
    ).all()
    return [{"id": c.id, "name": c.name, "mobile_number": c.mobile_number, "email": c.email} for c in customers]

@router.post("/customers", response_model=CustomerResponse)
def register_customer(cust_in: CustomerSignup, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.mobile_number == cust_in.mobile_number).first()
    if existing:
        return existing
        
    new_cust = Customer(
        name=cust_in.name,
        mobile_number=cust_in.mobile_number,
        email=cust_in.email,
        is_guest=False
    )
    db.add(new_cust)
    db.commit()
    db.refresh(new_cust)
    return new_cust
