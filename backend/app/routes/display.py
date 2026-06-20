from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import RestaurantTable, Order, TableSession

router = APIRouter(prefix="/display", tags=["display"])


@router.get("/tables/{table_id}")
def get_table_display(table_id: int, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    active_order = None
    if table.active_order_id:
        active_order = db.query(Order).filter(Order.id == table.active_order_id).first()

    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == "active",
    ).first()

    return {
        "table": {
            "id": table.id,
            "floor_id": table.floor_id,
            "table_number": table.table_number,
            "seats": table.seats,
            "status": table.status,
            "is_active": table.is_active,
        },
        "session": {
            "id": active_session.id,
            "session_pin": active_session.session_pin,
            "status": active_session.status,
        } if active_session else None,
        "order": {
            "id": active_order.id,
            "bill_number": active_order.bill_number,
            "items": active_order.items,
            "total_amount": float(active_order.total_amount),
            "subtotal_amount": float(active_order.subtotal_amount or 0),
            "tax_amount": float(active_order.tax_amount or 0),
            "discount_amount": float(active_order.discount_amount or 0),
            "payment_status": active_order.payment_status,
            "order_status": active_order.order_status,
            "kitchen_status": active_order.kitchen_status,
        } if active_order else None,
    }
