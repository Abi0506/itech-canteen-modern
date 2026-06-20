from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Order, OrderItem, Product, TableMaster, User
from app.db.session import get_db
from app.models.schemas import KDSTicket
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/kds", tags=["kds"])

chef_dependency = Depends(require_role(["chef", "superadmin", "employee"]))


def _active_kds_orders(db: Session) -> list[Order]:
    return db.query(Order).filter(Order.status == "sent_to_kitchen").order_by(Order.created_at.asc()).all()


def _active_kds_items(db: Session, order_id: int) -> list[OrderItem]:
    return (
        db.query(OrderItem)
        .join(Product)
        .filter(
            OrderItem.order_id == order_id,
            Product.kds_visible == True,
            OrderItem.kitchen_status.in_(["to_cook", "preparing"]),
        )
        .order_by(OrderItem.id.asc())
        .all()
    )


@router.get("/tickets", response_model=List[KDSTicket], dependencies=[chef_dependency])
def get_kds_tickets(db: Session = Depends(get_db)):
    tickets = []
    for order in _active_kds_orders(db):
        items = _active_kds_items(db, order.id)
        if not items:
            continue

        table_num = None
        if order.table_id:
            table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
            table_num = table.table_number if table else None

        ticket_items = []
        for item in items:
            chef_name = None
            if item.claimed_by:
                chef = db.query(User).filter(User.id == item.claimed_by).first()
                chef_name = chef.name if chef else None

            ticket_items.append(
                {
                    "id": item.id,
                    "product_name": item.product.name,
                    "quantity": item.quantity,
                    "kitchen_status": item.kitchen_status,
                    "notes": item.notes,
                    "claimed_by_name": chef_name,
                    "claimed_at": item.claimed_at,
                }
            )

        tickets.append(
            {
                "order_id": order.id,
                "order_number": order.order_number,
                "table_number": table_num,
                "source": order.source,
                "created_at": order.created_at,
                "items": ticket_items,
            }
        )
    return tickets


@router.get("/orders", dependencies=[chef_dependency])
def get_kds_orders(db: Session = Depends(get_db)):
    orders = []
    for order in _active_kds_orders(db):
        items = _active_kds_items(db, order.id)
        if not items:
            continue

        order_items = {}
        for item in items:
            order_items[str(item.id)] = {
                "id": item.id,
                "name": item.product.name,
                "quantity": float(item.quantity),
                "rate": float(item.unit_price),
                "status": item.kitchen_status,
            }

        orders.append(
            {
                "id": order.id,
                "bill_number": order.order_number,
                "table_id": order.table_id,
                "kitchen_status": "active",
                "items": order_items,
            }
        )
    return orders


@router.post("/items/{item_id}/claim")
async def claim_kds_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["chef", "superadmin", "employee"])),
):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.kitchen_status != "to_cook":
        raise HTTPException(status_code=400, detail="Item is already claimed or completed")

    item.kitchen_status = "preparing"
    item.claimed_by = current_user.id
    item.claimed_at = datetime.utcnow()
    db.commit()

    await manager.broadcast_all(
        {
            "event": "item_claimed",
            "item_id": item_id,
            "claimed_by": current_user.id,
            "claimed_by_name": current_user.name,
        }
    )
    return {"success": True, "status": "preparing"}


@router.post("/items/{item_id}/complete")
async def complete_kds_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["chef", "superadmin", "employee"])),
):
    item = db.query(OrderItem).filter(OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.kitchen_status == "completed":
        raise HTTPException(status_code=400, detail="Item is already completed")

    item.kitchen_status = "completed"
    item.completed_at = datetime.utcnow()
    db.commit()

    await manager.broadcast_all({"event": "item_completed", "item_id": item_id, "order_id": item.order_id})
    return {"success": True, "status": "completed"}


@router.post("/orders/{order_id}/items/{item_id}/start")
async def start_kds_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["chef", "superadmin", "employee"])),
):
    return await claim_kds_item(item_id, db, current_user)


@router.post("/orders/{order_id}/items/{item_id}/complete")
async def complete_kds_order_item(
    order_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["chef", "superadmin", "employee"])),
):
    return await complete_kds_item(item_id, db, current_user)
