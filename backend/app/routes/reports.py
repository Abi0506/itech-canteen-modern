from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from datetime import datetime, date, timedelta
from io import BytesIO
from typing import List, Dict, Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak

from app.db.session import get_db
from app.db.models import Order, OrderItem, Product, Category, Payment, PaymentMethod, Customer, User, TableMaster
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


def _transaction_range(report_date: Optional[str]):
    if report_date:
        start = datetime.combine(date.fromisoformat(report_date), datetime.min.time())
        end = datetime.combine(date.fromisoformat(report_date), datetime.max.time())
        return start, end
    return _date_range(None, None)


def _serialize_transaction(order: Order, db: Session) -> dict[str, Any]:
    customer = None
    if order.customer_id:
        customer_row = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer_row:
            customer = {
                "id": customer_row.id,
                "name": customer_row.name,
                "mobile_number": customer_row.mobile_number,
                "email": customer_row.email,
                "is_guest": bool(customer_row.is_guest),
            }

    cashier = None
    if order.placed_by_user_id:
        cashier_row = db.query(User).filter(User.id == order.placed_by_user_id).first()
        if cashier_row:
            cashier = {
                "id": cashier_row.id,
                "name": cashier_row.name,
                "email": cashier_row.email,
                "role_id": cashier_row.role_id,
            }

    waiter = None
    if order.waiter_id:
        waiter_row = db.query(User).filter(User.id == order.waiter_id).first()
        if waiter_row:
            waiter = {
                "id": waiter_row.id,
                "name": waiter_row.name,
                "email": waiter_row.email,
                "role_id": waiter_row.role_id,
            }

    table = None
    if order.table_id:
        table_row = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table_row:
            table = {
                "id": table_row.id,
                "table_number": table_row.table_number,
                "current_status": table_row.current_status,
            }

    payment = (
        db.query(Payment)
        .filter(Payment.order_id == order.id, Payment.status == "completed")
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .first()
    )
    payment_method = None
    if payment:
        method_row = db.query(PaymentMethod).filter(PaymentMethod.id == payment.payment_method_id).first()
        if method_row:
            payment_method = {
                "id": method_row.id,
                "type": method_row.type,
                "display_name": method_row.display_name,
            }

    item_rows = []
    for item in order.items:
        item_rows.append({
            "name": item.product.name if item.product else None,
            "quantity": float(item.quantity or 0),
            "unit_price": float(item.unit_price or 0),
            "line_total": float(item.line_total or 0),
        })

    return {
        "id": order.id,
        "order_number": order.order_number,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "table": table,
        "customer": customer,
        "cashier": cashier,
        "waiter": waiter,
        "status": order.status,
        "subtotal": float(order.subtotal or 0),
        "tax_total": float(order.tax_total or 0),
        "discount_total": float(order.discount_total or 0),
        "total": float(order.total or 0),
        "payment": {
            "id": payment.id if payment else None,
            "method": payment_method,
            "amount": float(payment.amount or 0) if payment else 0,
            "amount_received": float(payment.amount_received or 0) if payment and payment.amount_received is not None else None,
            "change_due": float(payment.change_due or 0) if payment and payment.change_due is not None else None,
            "reference_code": payment.reference_code if payment else None,
            "received_by": payment.received_by if payment else None,
            "created_at": payment.created_at.isoformat() if payment and payment.created_at else None,
        },
        "items": item_rows,
    }


def _get_transactions(db: Session, start: datetime, end: datetime) -> list[dict[str, Any]]:
    orders = (
        db.query(Order)
        .filter(Order.status == "paid", Order.created_at >= start, Order.created_at <= end)
        .order_by(Order.created_at.asc(), Order.id.asc())
        .all()
    )
    return [_serialize_transaction(order, db) for order in orders]


def _build_transactions_pdf(report_date: date, transactions: list[dict[str, Any]]) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Cafe Odoo Transaction History", styles["Title"]))
    story.append(Paragraph(f"Date: {report_date.isoformat()}", styles["Normal"]))
    story.append(Spacer(1, 6 * mm))

    summary_data = [["Metric", "Value"]]
    summary_data.extend([
        ["Orders", str(len(transactions))],
        ["Revenue", f"Rs.{sum(t['total'] for t in transactions):.2f}"],
        ["Customers", str(len({t['customer']['id'] for t in transactions if t.get('customer')}))],
    ])
    summary_table = Table(summary_data, colWidths=[55 * mm, 55 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b44d2c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#faf7f2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))

    for idx, transaction in enumerate(transactions, start=1):
        customer = transaction.get("customer") or {}
        cashier = transaction.get("cashier") or {}
        payment = transaction.get("payment") or {}
        payment_method = payment.get("method") or {}
        table = transaction.get("table") or {}

        data = [["Field", "Value"]]
        data.extend([
            ["Order", transaction.get("order_number") or "-"],
            ["Time", transaction.get("created_at") or "-"],
            ["Table", table.get("table_number") or "-"],
            ["Customer", customer.get("name") or "Walk-in"],
            ["Customer Mobile", customer.get("mobile_number") or "-"],
            ["Cashier", cashier.get("name") or "-"],
            ["Payment Method", payment_method.get("display_name") or payment_method.get("type") or "-"],
            ["Subtotal", f"Rs.{transaction.get('subtotal', 0):.2f}"],
            ["Tax", f"Rs.{transaction.get('tax_total', 0):.2f}"],
            ["Discount", f"Rs.{transaction.get('discount_total', 0):.2f}"],
            ["Total", f"Rs.{transaction.get('total', 0):.2f}"],
            ["Paid Amount", f"Rs.{payment.get('amount', 0):.2f}"],
            ["Received", f"Rs.{payment.get('amount_received'):.2f}" if payment.get('amount_received') is not None else "-"],
            ["Change Due", f"Rs.{payment.get('change_due'):.2f}" if payment.get('change_due') is not None else "-"],
            ["Reference", payment.get("reference_code") or "-"],
            ["Waiter", (transaction.get("waiter") or {}).get("name") or "-"],
        ])

        story.append(Paragraph(f"Transaction {idx}: {transaction.get('order_number')}", styles["Heading2"]))
        detail_table = Table(data, colWidths=[42 * mm, 120 * mm])
        detail_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3e3dc")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ]))
        story.append(detail_table)

        item_data = [["Item", "Qty", "Unit Price", "Line Total"]]
        for item in transaction.get("items", []):
            item_data.append([
                item.get("name") or "-",
                f"{item.get('quantity', 0):.2f}",
                f"Rs.{item.get('unit_price', 0):.2f}",
                f"Rs.{item.get('line_total', 0):.2f}",
            ])
        item_table = Table(item_data, colWidths=[85 * mm, 20 * mm, 30 * mm, 30 * mm])
        item_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b44d2c")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(Spacer(1, 3 * mm))
        story.append(item_table)

        if idx < len(transactions):
            story.append(PageBreak())

    doc.build(story)
    buffer.seek(0)
    return buffer


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


@router.get("/transactions", dependencies=[admin_dependency])
def get_transactions(
    report_date: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if report_date:
        start, end = _transaction_range(report_date)
    else:
        start, end = _date_range(date_from, date_to)

    transactions = _get_transactions(db, start, end)
    return {
        "date_from": start.date().isoformat(),
        "date_to": end.date().isoformat(),
        "total_orders": len(transactions),
        "total_revenue": float(sum(t["total"] for t in transactions)),
        "transactions": transactions,
    }


@router.get("/transactions/pdf", dependencies=[admin_dependency])
def download_transactions_pdf(
    report_date: str = Query(...),
    db: Session = Depends(get_db),
):
    day = date.fromisoformat(report_date)
    start = datetime.combine(day, datetime.min.time())
    end = datetime.combine(day, datetime.max.time())
    transactions = _get_transactions(db, start, end)
    pdf_buffer = _build_transactions_pdf(day, transactions)

    filename = f"transaction-history-{day.isoformat()}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)
