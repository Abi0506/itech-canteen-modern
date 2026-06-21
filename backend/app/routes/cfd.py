from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Order, TableMaster
from app.db.session import get_db
from app.routes.cashier import _serialize_order

router = APIRouter(prefix="/cfd", tags=["cfd"])


@router.get("/tables/{table_id}/order")
def get_cfd_table_order(table_id: int, db: Session = Depends(get_db)):
    """Public endpoint to fetch the current active order for a table to be displayed on CFD."""
    table = db.query(TableMaster).filter(TableMaster.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    order = None
    if table.current_order_id:
        order = db.query(Order).filter(Order.id == table.current_order_id).first()
    if order is None and table.current_status != "available":
        order = (
            db.query(Order)
            .filter(Order.table_id == table_id, Order.status.in_(["draft", "sent_to_kitchen"]))
            .order_by(Order.created_at.desc())
            .first()
        )
    if order is None:
        raise HTTPException(status_code=404, detail="No active order for this table")

    return _serialize_order(order, db)
