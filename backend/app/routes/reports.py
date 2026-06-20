from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

from app.db.session import get_db
from app.db.models import Order, OrderItem, Product, Category, Payment
from app.routes.auth import require_role

router = APIRouter(prefix="/reports", tags=["reports"])

admin_dependency = Depends(require_role(["superadmin"]))


def _date_range(date_from: Optional[str], date_to: Optional[str]):
    """Return (start_dt, end_dt) from optional ISO date strings."""
    if date_from:
        start = datetime.combine(date.fromisoformat(date_from), datetime.min.time())
    else:
        start = datetime.combine(date.today() - timedelta(days=6), datetime.min.time())
    if date_to:
        end = datetime.combine(date.fromisoformat(date_to), datetime.max.time())
    else:
        end = datetime.combine(date.today(), datetime.max.time())
    return start, end


@router.get("/dashboard", dependencies=[admin_dependency])
def get_reports_dashboard(db: Session = Depends(get_db)):
    paid_orders = db.query(Order).filter(Order.status == 'paid').all()
    total_revenue = sum(o.total for o in paid_orders)
    total_orders = len(paid_orders)
    avg_order_value = total_revenue / total_orders if total_orders > 0 else Decimal("0.00")

    start_of_month = date.today().replace(day=1)
    month_orders = db.query(Order).filter(Order.status == 'paid', Order.created_at >= start_of_month).all()
    month_revenue = sum(o.total for o in month_orders)

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())
    today_paid_orders = db.query(Order).filter(
        Order.status == 'paid',
        Order.created_at >= today_start,
        Order.created_at <= today_end
    ).all()

    return {
        "all_time_revenue": float(total_revenue),
        "all_time_orders": total_orders,
        "avg_order_value": float(avg_order_value),
        "month_revenue": float(month_revenue),
        "today_revenue": float(sum((o.total for o in today_paid_orders), Decimal("0.00"))),
        "today_orders": len(today_paid_orders),
        "today_customers": len({o.customer_id for o in today_paid_orders if o.customer_id}),
    }


@router.get("/sales-trend", dependencies=[admin_dependency])
def get_sales_trend(db: Session = Depends(get_db)):
    today = date.today()
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        orders = db.query(Order).filter(
            Order.status == 'paid',
            Order.created_at >= day_start,
            Order.created_at <= day_end,
        ).all()
        day_revenue = sum(o.total for o in orders)
        trend.append({
            "date": day.strftime("%Y-%m-%d"),
            "revenue": float(day_revenue),
            "orders": len(orders),
            "customers": len({o.customer_id for o in orders if o.customer_id}),
        })
    return trend


@router.get("/top-products", dependencies=[admin_dependency])
def get_top_products(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    start, end = _date_range(date_from, date_to)
    items = (
        db.query(
            Product.name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.line_total).label("total_revenue"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status == 'paid', Order.created_at >= start, Order.created_at <= end)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )
    return [
        {"name": row[0], "quantity": float(row[1] or 0), "revenue": float(row[2] or 0)}
        for row in items
    ]


@router.get("/top-categories", dependencies=[admin_dependency])
def get_top_categories(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    start, end = _date_range(date_from, date_to)
    categories = (
        db.query(
            Category.name,
            func.sum(OrderItem.line_total).label("total_revenue"),
        )
        .join(Product, Product.category_id == Category.id)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status == 'paid', Order.created_at >= start, Order.created_at <= end)
        .group_by(Category.id, Category.name)
        .order_by(func.sum(OrderItem.line_total).desc())
        .all()
    )
    return [{"name": row[0], "revenue": float(row[1] or 0)} for row in categories]


@router.get("/item-sales", dependencies=[admin_dependency])
def get_item_sales(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """All items with their revenue and sales count for the given date range."""
    start, end = _date_range(date_from, date_to)
    rows = (
        db.query(
            Product.name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.line_total).label("total_revenue"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status == 'paid', Order.created_at >= start, Order.created_at <= end)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.line_total).desc())
        .all()
    )
    return [
        {"name": row[0], "quantity": float(row[1] or 0), "revenue": float(row[2] or 0)}
        for row in rows
    ]


@router.get("/day-wise-summary", dependencies=[admin_dependency])
def get_day_wise_summary(db: Session = Depends(get_db)):
    today = date.today()
    summary = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        orders = db.query(Order).filter(
            Order.status == 'paid',
            Order.created_at >= day_start,
            Order.created_at <= day_end,
        ).all()
        summary.append({
            "date": day.strftime("%Y-%m-%d"),
            "label": day.strftime("%d %b"),
            "revenue": float(sum((o.total for o in orders), Decimal("0.00"))),
            "orders": len(orders),
            "customers": len({o.customer_id for o in orders if o.customer_id}),
        })
    return summary
