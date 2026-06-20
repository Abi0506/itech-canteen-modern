from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.db.models import Order, OrderItem, FoodItem
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/kds", tags=["kds"])

chef_dependency = Depends(require_role(["chef", "admin", "superadmin"]))


def _sync_order_state(order: Order, db: Session):
    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    pending = any(item.status != "completed" for item in order_items)
    any_preparing = any(item.status == "preparing" for item in order_items)
    if pending and any_preparing:
        order.order_status = "preparing"
        order.kitchen_status = "preparing"
    elif pending:
        order.order_status = "sent"
        order.kitchen_status = "to_cook"
    else:
        order.order_status = "completed"
        order.kitchen_status = "completed"


@router.get("/orders", dependencies=[chef_dependency])
def list_kds_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.payment_status != "completed").order_by(Order.created_at.desc()).all()
    return [
        {
            "id": order.id,
            "bill_number": order.bill_number,
            "table_id": order.table_id,
            "floor_id": order.floor_id,
            "items": order.items,
            "order_status": order.order_status,
            "kitchen_status": order.kitchen_status,
            "payment_status": order.payment_status,
            "created_at": order.created_at,
        }
        for order in orders
    ]


@router.post("/orders/{order_id}/items/{food_item_id}/start", dependencies=[chef_dependency])
async def start_item(order_id: int, food_item_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_item = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.food_item_id == food_item_id,
    ).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    if order_item.status == "completed":
        return {"success": True}

    order_item.status = "preparing"
    order_item.kitchen_status = "preparing"
    _sync_order_state(order, db)
    db.commit()

    await manager.broadcast_all({
        "event": "kds_item_started",
        "order_id": order.id,
        "food_item_id": food_item_id,
        "table_id": order.table_id,
    })
    return {"success": True}


@router.post("/orders/{order_id}/items/{food_item_id}/complete", dependencies=[chef_dependency])
async def complete_item(order_id: int, food_item_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_item = db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.food_item_id == food_item_id,
    ).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    if order_item.status == "completed":
        return {"success": True}

    food_item = db.query(FoodItem).filter(FoodItem.id == food_item_id).first()
    if not food_item:
        raise HTTPException(status_code=404, detail="Food item not found")

    completed_qty = order_item.quantity
    food_item.reserved_quantity = max(0, (food_item.reserved_quantity or 0) - completed_qty)
    order_item.status = "completed"
    order_item.kitchen_status = "completed"
    order_item.completed_at = datetime.utcnow()

    order_payload = dict(order.items or {})
    item_payload = order_payload.get(str(food_item_id))
    if item_payload:
        item_payload["status"] = "completed"
        order_payload[str(food_item_id)] = item_payload
    order.items = order_payload
    _sync_order_state(order, db)
    db.commit()

    await manager.broadcast_all({
        "event": "kds_item_completed",
        "order_id": order.id,
        "food_item_id": food_item_id,
        "table_id": order.table_id,
    })
    return {"success": True}
