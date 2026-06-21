from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func, or_
from decimal import Decimal
from datetime import datetime, date
import razorpay
import random
import re
from typing import List, Optional, Dict, Any

from app.core.config import settings
from app.db.session import get_db
from app.db.models import (
    User,
    Coupon,
    TableMaster,
    Order,
    OrderItem,
    Product,
    InventoryItem,
    StockMovement,
    Customer,
    PosSession,
    Payment,
    PaymentMethod,
    TableSession,
    LoyaltyCredit,
    LoyaltyTransaction,
    VenueSetting
)
from app.models.schemas import OrderCreate, OrderResponse, CustomerSignup, CustomerResolve, CustomerResponse, OrderItemCreate
from app.routes.auth import require_role
from app.routes.websockets import manager
from app.services.email import send_table_release_email, send_receipt_email
from app.services.pricing import recalculate_order_totals
from app.routes.loyalty import award_loyalty_points
from pydantic import BaseModel

router = APIRouter(prefix="/cashier", tags=["cashier"])

cashier_dependency = Depends(require_role(["cashier", "superadmin"]))
ACTIVE_TABLE_ORDER_STATUSES = ("draft", "sent_to_kitchen")


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "").strip()


def _is_valid_phone(phone: str) -> bool:
    cleaned = _normalize_phone(phone)
    return 10 <= len(cleaned) <= 15


def _generate_customer_name(phone: str) -> str:
    suffix = phone[-4:] if len(phone) >= 4 else phone
    return f"Customer {suffix}" if suffix else "Cashier Customer"


def _upsert_customer(
    db: Session,
    *,
    name: Optional[str],
    mobile_number: str,
    email: Optional[str] = None,
    require_complete_profile: bool = False,
) -> Customer:
    phone = _normalize_phone(mobile_number)
    if not _is_valid_phone(phone):
        raise HTTPException(status_code=400, detail="Please enter a valid phone number (10-15 digits).")

    existing = (
        db.query(Customer)
        .filter(
            Customer.mobile_number == phone
        )
        .first()
    )
    if existing:
        updated = False
        cleaned_name = name.strip() if name else None
        if cleaned_name and existing.name != cleaned_name and existing.is_guest:
            existing.name = cleaned_name
            updated = True
        if email is not None and existing.email != email:
            existing.email = email
            updated = True
        if updated:
            db.commit()
            db.refresh(existing)
        return existing

    cleaned_name = name.strip() if name and name.strip() else None
    cleaned_email = email.strip() if email and email.strip() else None
    if require_complete_profile and not cleaned_name:
        raise HTTPException(status_code=400, detail="Name and phone number are required to add a new customer.")

    cleaned_name = cleaned_name or _generate_customer_name(phone)

    new_customer = Customer(
        name=cleaned_name,
        mobile_number=phone,
        email=cleaned_email,
        is_guest=False,
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


def _require_customer_id(customer_id: Optional[int], *, context: str) -> int:
    if customer_id is None:
        raise HTTPException(status_code=400, detail=f"Customer mobile number is required {context}.")
    return int(customer_id)


def _get_active_table_orders(db: Session, table_id: int) -> list[Order]:
    return (
        db.query(Order)
        .filter(Order.table_id == table_id, Order.status.in_(ACTIVE_TABLE_ORDER_STATUSES))
        .order_by(Order.created_at.asc(), Order.id.asc())
        .all()
    )


def _get_payment_method_by_type(db: Session, method_type: str) -> PaymentMethod:
    method = db.query(PaymentMethod).filter(PaymentMethod.type == method_type).first()
    if not method or not method.is_enabled:
        raise HTTPException(status_code=400, detail="Invalid/disabled payment method")
    return method


def _get_razorpay_client(db: Session) -> razorpay.Client:
    venue_setting = db.query(VenueSetting).first()
    key_id = venue_setting.razorpay_key_id if venue_setting and venue_setting.razorpay_key_id else settings.RAZORPAY_KEY_ID
    key_secret = venue_setting.razorpay_key_secret if venue_setting and venue_setting.razorpay_key_secret else settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured. Please contact the administrator.",
        )
    return razorpay.Client(auth=(key_id, key_secret))


def _get_or_create_walk_in_customer_id(db: Session) -> int:
    guest = (
        db.query(Customer)
        .filter(Customer.is_guest == True)  # noqa: E712
        .order_by(Customer.id.asc())
        .first()
    )
    if guest:
        return guest.id

    guest = Customer(
        name="Walk-in Customer",
        mobile_number="0000000000",
        email=None,
        password_hash=None,
        is_guest=True,
    )
    db.add(guest)
    db.flush()
    return guest.id


def _serialize_order_item(item: OrderItem) -> dict[str, Any]:
    return {
        "id": item.id,
        "order_id": item.order_id,
        "product_id": item.product_id,
        "product_name": item.product.name if item.product else None,
        "quantity": float(item.quantity),
        "unit_price": float(item.unit_price),
        "line_discount": float(item.line_discount),
        "line_total": float(item.line_total),
        "kitchen_status": item.kitchen_status,
        "notes": item.notes,
        "claimed_by": item.claimed_by,
        "claimed_at": item.claimed_at,
        "completed_at": item.completed_at,
    }


def _serialize_order(order: Order, db: Session) -> dict[str, Any]:
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

    coupon_code = None
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if coupon:
            coupon_code = coupon.code

    return {
        "id": order.id,
        "order_number": order.order_number,
        "source": order.source,
        "table_id": order.table_id,
        "customer_id": order.customer_id,
        "customer": customer,
        "status": order.status,
        "subtotal": float(order.subtotal),
        "tax_total": float(order.tax_total),
        "discount_total": float(order.discount_total),
        "total": float(order.total),
        "notes": order.notes,
        "coupon_code": coupon_code,
        "applied_promotions": getattr(order, "applied_promotions", []),
        "created_at": order.created_at,
        "updated_at": order.updated_at,
        "items": [_serialize_order_item(item) for item in order.items],
    }


def _serialize_payment(payment: Payment, db: Session) -> dict[str, Any]:
    method = db.query(PaymentMethod).filter(PaymentMethod.id == payment.payment_method_id).first()
    return {
        "id": payment.id,
        "order_id": payment.order_id,
        "payment_method_id": payment.payment_method_id,
        "payment_method_type": method.type if method else None,
        "amount": float(payment.amount or 0),
        "amount_received": float(payment.amount_received or 0) if payment.amount_received is not None else None,
        "change_due": float(payment.change_due or 0) if payment.change_due is not None else None,
        "reference_code": payment.reference_code,
        "status": payment.status,
        "received_by": payment.received_by,
        "created_at": payment.created_at,
    }


def _append_items_to_order(db: Session, order: Order, items_in: List[OrderItemCreate], current_user: User) -> None:
    for item in items_in:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod or not prod.is_active:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} not available")

        quantity = Decimal(str(item.quantity))
        line_total = prod.price * quantity

        inv = db.query(InventoryItem).filter(InventoryItem.product_id == item.product_id).first()
        if inv:
            if inv.current_stock < quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product {item.product_id}.")
            inv.current_stock -= quantity
            db.add(
                StockMovement(
                    inventory_item_id=inv.id,
                    movement_type="sale_out",
                    quantity=quantity,
                    reference_order_id=order.id,
                    performed_by=current_user.id,
                    note=f"Sale order {order.order_number}",
                )
            )

        existing_item = db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.product_id == item.product_id,
            OrderItem.kitchen_status == "to_cook"
        ).first()

        if existing_item:
            existing_item.quantity += quantity
            existing_item.line_total += line_total
            if item.notes:
                existing_item.notes = f"{existing_item.notes} | {item.notes}" if existing_item.notes else item.notes
        else:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=item.product_id,
                    quantity=quantity,
                    unit_price=prod.price,
                    line_discount=Decimal("0.00"),
                    line_total=line_total,
                    kitchen_status="to_cook",
                    notes=item.notes,
                )
            )

    db.flush()
    db.refresh(order)
    _, _, _, _, applied_promotions = recalculate_order_totals(db, order)
    order.applied_promotions = applied_promotions
    coupon_code = None
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if coupon:
            coupon_code = coupon.code
    order.coupon_code = coupon_code


def _send_order_to_kitchen(order: Order, db: Session, current_user: User) -> None:
    if order.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft orders can be sent to the kitchen.")

    order.status = "sent_to_kitchen"


def _settle_table_orders(
    db: Session,
    *,
    table_id: int,
    payment_method_id: int,
    amount_received: Optional[Decimal],
    reference_code: Optional[str],
    current_user: User,
) -> dict[str, Any]:
    orders = _get_active_table_orders(db, table_id)
    if not orders:
        raise HTTPException(status_code=404, detail="No active draft orders found for this table.")

    method = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    if not method or not method.is_enabled:
        raise HTTPException(status_code=400, detail="Invalid/disabled payment method")

    for order in orders:
        _send_order_to_kitchen(order, db, current_user)

    table_total = sum((Decimal(str(order.total)) for order in orders), Decimal("0.00"))
    received = Decimal(str(amount_received)) if amount_received is not None else table_total
    if method.type == "cash" and received < table_total:
        raise HTTPException(status_code=400, detail="Received amount is less than table total")

    change_due = received - table_total if received > table_total else Decimal("0.00")
    remaining_received = received

    for index, order in enumerate(orders, start=1):
        order_received = min(Decimal(str(order.total)), remaining_received)
        if index == len(orders) and received > table_total:
            order_received = Decimal(str(order.total)) + change_due
        payment = Payment(
            order_id=order.id,
            payment_method_id=payment_method_id,
            amount=order.total,
            amount_received=order_received,
            change_due=change_due if index == len(orders) else Decimal("0.00"),
            reference_code=reference_code,
            status="completed",
            received_by=current_user.id,
        )
        db.add(payment)
        remaining_received -= Decimal(str(order.total))

        order.status = "paid"

    table = db.query(TableMaster).filter(TableMaster.id == table_id).first()
    if table:
        table.current_status = "available"
        table.current_order_id = None
        table.current_waiter_id = None

    # Award loyalty points for each order in the table settlement
    loyalty_points_total = 0
    for order in orders:
        if order.customer_id:
            loyalty_points_total += award_loyalty_points(db, order.customer_id, order.id, float(order.total))

    db.commit()

    return {
        "success": True,
        "table_id": table_id,
        "orders_paid": len(orders),
        "table_total": float(table_total),
        "amount_received": float(received),
        "change_due": float(change_due),
        "order_ids": [order.id for order in orders],
        "loyalty_points_awarded": loyalty_points_total,
    }


def _finalize_order_payment(
    db: Session,
    *,
    order: Order,
    payment_method_id: int,
    amount_received: Optional[Decimal],
    reference_code: Optional[str],
    current_user: User,
) -> dict[str, Any]:
    method = db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()
    if not method or not method.is_enabled:
        raise HTTPException(status_code=400, detail="Invalid/disabled payment method")

    if order.status == "draft":
        order.status = "sent_to_kitchen"

    received = Decimal(str(amount_received)) if amount_received is not None else Decimal(str(order.total))
    if method.type == "cash" and received < Decimal(str(order.total)):
        raise HTTPException(status_code=400, detail="Received amount is less than order total")

    change = received - Decimal(str(order.total))
    payment = Payment(
        order_id=order.id,
        payment_method_id=payment_method_id,
        amount=order.total,
        amount_received=received,
        change_due=change if change > 0 else Decimal("0.00"),
        reference_code=reference_code,
        status="completed",
        received_by=current_user.id,
    )
    db.add(payment)

    order.status = "paid"
    table = None
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            if order.table_session_id:
                session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
                if session and session.status == 'active':
                    session.status = 'closed'
                    session.closed_at = datetime.utcnow()
                table.current_status = "available"
                table.current_order_id = None
                table.current_waiter_id = None
            else:
                table.current_status = "reserved"
                table.current_waiter_id = current_user.id if current_user else table.current_waiter_id
                table.current_order_id = order.id

    # Award loyalty points based on order total
    loyalty_points_awarded = 0
    if order.customer_id:
        loyalty_points_awarded = award_loyalty_points(db, order.customer_id, order.id, float(order.total))

    db.commit()
    db.refresh(order)

    if order.table_id:
        manager.broadcast_sync({
            "event": "payment_completed",
            "order_id": order.id,
            "table_id": order.table_id,
            "total": float(order.total),
            "change_due": float(payment.change_due or 0),
        })
        manager.broadcast_sync({
            "event": "table_status_changed",
            "table_id": order.table_id,
            "status": table.current_status if table else "reserved",
        })

    # Send Receipt Email
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer and customer.email:
            # Build items
            items_list = []
            for itm in order.items:
                product = db.query(Product).filter(Product.id == itm.product_id).first()
                if product:
                    items_list.append({
                        "name": product.name,
                        "quantity": itm.quantity,
                        "price": itm.unit_price
                    })
            table_name = table.table_number if table else None
            
            # Since tax/discount are not explicitly fields in Order right now, we infer or just pass 0 if not tracked.
            # Usually order.total is grand_total. 
            # We'll just pass 0 for tax/discount if not available on the model, or calculate them if they are.
            # Looking at schemas, tax and discount are not in Order model by default in this codebase (total is stored).
            
            send_receipt_email(
                to_email=customer.email,
                customer_name=customer.name,
                order_number=order.order_number,
                table_name=table_name,
                items=items_list,
                subtotal=order.total,
                tax=0,
                discount=0,
                grand_total=order.total,
            )

    return {
        "success": True,
        "order_id": order.id,
        "status": order.status,
        "change_due": float(payment.change_due or 0),
        "loyalty_points_awarded": loyalty_points_awarded,
    }


def _create_razorpay_checkout_order(
    db: Session,
    *,
    order: Order,
    current_user: User,
) -> dict[str, Any]:
    method = _get_payment_method_by_type(db, "upi")
    client = _get_razorpay_client(db)

    if order.status == "draft":
        _send_order_to_kitchen(order, db, current_user)
        db.commit()

    amount_paise = int((Decimal(str(order.total)) * Decimal("100")).to_integral_value())
    try:
        razorpay_order = client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": order.order_number,
                "payment_capture": 1,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Razorpay checkout could not be created. {str(exc)}",
        )

    return {
        "success": True,
        "payment_provider": "razorpay",
        "order_id": order.id,
        "order_number": order.order_number,
        "razorpay_order_id": razorpay_order["id"],
        "amount": float(order.total),
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": client.auth[0],
        "payment_method_id": method.id,
    }


def generate_order_number(db: Session, source: str) -> str:
    prefix = "C" if source == "cashier" else "S"
    now = datetime.utcnow()
    date_str = now.strftime("%y%m%d")
    # count orders today (UTC)
    today_start = datetime.combine(now.date(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    return f"{prefix}{date_str}{count + 1:04d}"

@router.get("/tables", dependencies=[cashier_dependency])
def list_tables(db: Session = Depends(get_db)):
    tables = db.query(TableMaster).filter(TableMaster.is_active == True).all()
    result = []
    for t in tables:
        waiter_name = None
        if t.current_waiter_id:
            waiter = db.query(User).filter(User.id == t.current_waiter_id).first()
            if waiter:
                waiter_name = waiter.name
        floor_name = t.floor.name if t.floor else None
        active_orders = _get_active_table_orders(db, t.id)
        result.append({
            "id": t.id,
            "table_number": t.table_number,
            "floor_id": t.floor_id,
            "floor_name": floor_name,
            "seats": t.seats,
            "is_active": t.is_active,
            "current_status": t.current_status,
            "current_waiter_id": t.current_waiter_id,
            "waiter_name": waiter_name,
            "current_order_id": t.current_order_id,
            "active_order_count": len(active_orders),
            "active_order_total": float(sum((Decimal(str(order.total)) for order in active_orders), Decimal("0.00"))),
        })
    return result

@router.get("/tables/{table_id}", dependencies=[cashier_dependency])
def get_table(table_id: int, db: Session = Depends(get_db)):
    t = db.query(TableMaster).filter(TableMaster.id == table_id, TableMaster.is_active == True).first()
    if not t:
        raise HTTPException(status_code=404, detail="Table not found")
    return {
        "id": t.id,
        "table_number": t.table_number,
        "floor_id": t.floor_id,
        "floor_name": t.floor.name if t.floor else None,
        "seats": t.seats,
        "current_status": t.current_status,
    }



@router.post("/tables/{table_id}/release", dependencies=[cashier_dependency])
def release_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(TableMaster).filter(TableMaster.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    active_orders = _get_active_table_orders(db, table_id)
    for order in active_orders:
        items_count = db.query(OrderItem).filter(OrderItem.order_id == order.id).count()
        if items_count == 0 and order.status == "draft":
            if table.current_order_id == order.id:
                table.current_order_id = None
            db.delete(order)
            db.flush()
        else:
            raise HTTPException(status_code=400, detail="Settle all drafts for this table before releasing it.")

    table_session = (
        db.query(TableSession)
        .filter(TableSession.table_id == table_id, TableSession.status == "active")
        .order_by(TableSession.opened_at.desc())
        .first()
    )

    order_scope = []
    if table_session:
        order_scope = (
            db.query(Order)
            .filter(Order.table_session_id == table_session.id)
            .order_by(Order.created_at.asc(), Order.id.asc())
            .all()
        )
    elif table.current_order_id:
        order_scope = (
            db.query(Order)
            .filter(Order.id == table.current_order_id)
            .order_by(Order.created_at.asc(), Order.id.asc())
            .all()
        )
    else:
        order_scope = (
            db.query(Order)
            .filter(Order.table_id == table_id)
            .order_by(Order.created_at.asc(), Order.id.asc())
            .all()
        )
    all_orders = order_scope
    cumulative_total = sum((Decimal(str(order.total or 0)) for order in all_orders), Decimal("0.00"))

    email_error = None
    try:
        send_table_release_email(
            table_number=table.table_number,
            table_id=table.id,
            orders=[{"order_number": order.order_number, "status": order.status, "total": order.total} for order in all_orders],
            grand_total=cumulative_total,
        )
    except Exception as exc:
        email_error = str(exc)
        
    table.current_status = 'available'
    table.current_waiter_id = None
    table.current_order_id = None
    if table_session:
        table_session.status = "closed"
        table_session.closed_at = datetime.utcnow()
    db.commit()
    
    # Broadcast to websocket
    manager.broadcast_sync({
        "event": "table_released",
        "table_id": table_id
    })
    
    response = {"success": True, "message": "Table released successfully"}
    if email_error:
        response["email_warning"] = email_error
    return response

@router.get("/orders", response_model=List[OrderResponse], dependencies=[cashier_dependency])
def get_cashier_orders(db: Session = Depends(get_db)):
    # Find orders in open POS sessions
    open_sessions = db.query(PosSession).filter(PosSession.status == 'open').all()
    session_ids = [s.id for s in open_sessions]
    if not session_ids:
        return []
    orders = db.query(Order).filter(Order.pos_session_id.in_(session_ids)).order_by(Order.created_at.desc()).all()
    for o in orders:
        _, _, _, _, applied_promotions = recalculate_order_totals(db, o)
        o.applied_promotions = applied_promotions
        coupon_code = None
        if o.coupon_id:
            coupon = db.query(Coupon).filter(Coupon.id == o.coupon_id).first()
            if coupon:
                coupon_code = coupon.code
        o.coupon_code = coupon_code
    return orders


@router.post("/orders/{order_id}/apply-coupon", response_model=OrderResponse, dependencies=[cashier_dependency])
def apply_coupon(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")
        
    code = str(payload.get("code", "")).strip().upper()
    coupon = db.query(Coupon).filter(func.upper(Coupon.code) == code).first()
    if not coupon or not coupon.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")
        
    order.coupon_id = coupon.id
    db.commit()
    db.refresh(order)
    _, _, _, _, applied_promotions = recalculate_order_totals(db, order)
    order.applied_promotions = applied_promotions
    order.coupon_code = coupon.code
    return order

@router.post("/orders/{order_id}/remove-coupon", response_model=OrderResponse, dependencies=[cashier_dependency])
def remove_coupon(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")
        
    order.coupon_id = None
    db.commit()
    db.refresh(order)
    _, _, _, _, applied_promotions = recalculate_order_totals(db, order)
    order.applied_promotions = applied_promotions
    order.coupon_code = None
    return order

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

    table = None
    active_order = None
    if order_in.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order_in.table_id).first()
        if table and table.current_order_id:
            active_order = db.query(Order).filter(
                Order.id == table.current_order_id,
                Order.status.in_(["draft", "sent_to_kitchen"]),
            ).first()

    if active_order is None:
        customer_id = order_in.customer_id if order_in.customer_id is not None else _get_or_create_walk_in_customer_id(db)
        if order_in.customer_id is not None:
            customer = db.query(Customer).filter(Customer.id == int(order_in.customer_id)).first()
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
        try:
            order_num = generate_order_number(db, "cashier")
            active_order = Order(
                order_number=order_num,
                source="cashier",
                table_id=order_in.table_id,
                customer_id=customer_id,
                pos_session_id=pos_session.id,
                placed_by_user_id=current_user.id,
                waiter_id=current_user.id if order_in.table_id else None,
                status="draft",
                subtotal=Decimal("0.00"),
                tax_total=Decimal("0.00"),
                discount_total=Decimal("0.00"),
                total=Decimal("0.00"),
                notes=order_in.notes,
            )
            db.add(active_order)
            db.flush()
            if table:
                table.current_order_id = active_order.id
                table.current_status = "occupied"
                table.current_waiter_id = current_user.id
            db.commit()
        except Exception:
            db.rollback()
            active_order = None
            if table:
                db.refresh(table)
                if table.current_order_id:
                    active_order = db.query(Order).filter(Order.id == table.current_order_id).first()
            if not active_order:
                raise HTTPException(status_code=500, detail="Failed to create order due to concurrent access.")
    else:
        if order_in.notes:
            active_order.notes = order_in.notes
        if order_in.customer_id:
            active_order.customer_id = order_in.customer_id
        elif not active_order.customer_id:
            active_order.customer_id = _get_or_create_walk_in_customer_id(db)

    _append_items_to_order(db, active_order, order_in.items, current_user)
    if order_in.table_id:
        active_order.status = "sent_to_kitchen"
    db.commit()
    db.refresh(active_order)

    if table:
        table.current_order_id = active_order.id
        table.current_waiter_id = current_user.id
        table.current_status = "reserved"
        db.commit()

    await manager.broadcast_all({
        "event": "cart_updated",
        "table_id": order_in.table_id,
        "order_id": active_order.id,
        "items": [{"name": i.product.name, "quantity": float(i.quantity), "price": float(i.unit_price)} for i in active_order.items],
        "subtotal": float(active_order.subtotal),
        "tax_total": float(active_order.tax_total),
        "total": float(active_order.total)
    })

    return active_order

@router.put("/orders/{order_id}/items", response_model=OrderResponse)
async def update_cashier_order_items(
    order_id: int,
    items_in: List[OrderItemCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["cashier", "superadmin"])),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == 'paid':
        raise HTTPException(status_code=400, detail="Cannot modify a paid order")

    _append_items_to_order(db, order, items_in, current_user)
    db.commit()
    db.refresh(order)
    
    # Broadcast to CFD
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

@router.post("/orders/{order_id}/send-to-kitchen", response_model=Dict[str, Any], dependencies=[cashier_dependency])
async def send_order_to_kitchen(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "draft":
        _send_order_to_kitchen(order, db, current_user)
    elif order.status != "sent_to_kitchen":
        raise HTTPException(status_code=400, detail="Only active table orders can be sent to the kitchen.")
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table.current_status = "reserved"
            table.current_order_id = order.id
            table.current_waiter_id = current_user.id
    db.commit()
    db.refresh(order)
    await manager.broadcast_all({
        "event": "order_sent_to_kitchen",
        "order_id": order.id,
        "table_id": order.table_id,
    })
    return {
        "success": True,
        "order_id": order.id,
        "table_id": order.table_id,
        "status": order.status,
    }


@router.patch("/orders/{order_id}/customer", dependencies=[cashier_dependency])
def assign_order_customer(order_id: int, payload: Dict[str, Any], db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    customer_id = payload.get("customer_id")
    if customer_id is None:
        order.customer_id = None
    else:
        customer = db.query(Customer).filter(Customer.id == int(customer_id)).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        order.customer_id = customer.id

    db.commit()
    db.refresh(order)
    return _serialize_order(order, db)

@router.get("/tables/{table_id}/orders", response_model=List[OrderResponse], dependencies=[cashier_dependency])
def get_table_orders(table_id: int, db: Session = Depends(get_db)):
    return _get_active_table_orders(db, table_id)


@router.get("/tables/{table_id}/current-order")
def get_current_table_order(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["cashier", "superadmin"])),
):
    table = db.query(TableMaster).filter(TableMaster.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    order = None
    if table.current_order_id:
        order = db.query(Order).filter(Order.id == table.current_order_id).first()
    if order is None and table.current_status != 'available':
        order = (
            db.query(Order)
            .filter(Order.table_id == table_id, Order.status.in_(["draft", "sent_to_kitchen"]))
            .order_by(Order.created_at.desc())
            .first()
        )
    if order is None:
        raise HTTPException(status_code=404, detail="No active order for this table")

    return _serialize_order(order, db)


@router.get("/orders/{order_id}/bill-summary", dependencies=[cashier_dependency])
def get_bill_summary(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payments = (
        db.query(Payment)
        .filter(Payment.order_id == order.id, Payment.status == "completed")
        .order_by(Payment.created_at.asc(), Payment.id.asc())
        .all()
    )
    total_paid = sum((Decimal(str(payment.amount or 0)) for payment in payments), Decimal("0.00"))
    balance_due = max(Decimal(str(order.total or 0)) - total_paid, Decimal("0.00"))

    return {
        "order": _serialize_order(order, db),
        "payments": [_serialize_payment(payment, db) for payment in payments],
        "total_paid": float(total_paid),
        "balance_due": float(balance_due),
    }

@router.post("/tables/{table_id}/pay-all", response_model=Dict[str, Any], dependencies=[cashier_dependency])
async def pay_all_table_orders(
    table_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["cashier", "superadmin"])),
):
    summary = _settle_table_orders(
        db,
        table_id=table_id,
        payment_method_id=int(payload.get("payment_method_id")),
        amount_received=Decimal(str(payload["amount_received"])) if payload.get("amount_received") is not None else None,
        reference_code=payload.get("reference_code"),
        current_user=current_user,
    )
    await manager.broadcast_all({
        "event": "payment_completed",
        "table_id": table_id,
        "total": summary["table_total"],
        "change_due": summary["change_due"],
        "order_ids": summary["order_ids"],
    })
    return summary

@router.post("/orders/{order_id}/pay-and-send", response_model=Dict[str, Any])
async def pay_and_send(order_id: int, payment_payload: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment_method_id = int(payment_payload.get("payment_method_id") or 0)
    method = _get_payment_method_by_type(db, "upi") if payment_method_id == 3 else _get_payment_method_by_type(db, "cash")

    if method.type == "upi":
        return _create_razorpay_checkout_order(db, order=order, current_user=current_user)

    if order.status == 'draft':
        _send_order_to_kitchen(order, db, current_user)
        db.commit()

    result = _finalize_order_payment(
        db,
        order=order,
        payment_method_id=int(payment_payload.get("payment_method_id")),
        amount_received=Decimal(str(payment_payload.get("amount_received", order.total))) if payment_payload.get("amount_received") is not None else None,
        reference_code=payment_payload.get("reference_code"),
        current_user=current_user,
    )
    return {**_serialize_order(order, db), **result}


@router.post("/orders/{order_id}/razorpay/verify", response_model=Dict[str, Any])
async def verify_razorpay_payment(
    order_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["cashier", "superadmin"])),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return {"success": True, "order_id": order.id, "status": order.status}

    razorpay_order_id = payload.get("razorpay_order_id")
    razorpay_payment_id = payload.get("razorpay_payment_id")
    razorpay_signature = payload.get("razorpay_signature")
    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay payment details")

    client = _get_razorpay_client(db)
    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Razorpay signature verification failed")

    result = _finalize_order_payment(
        db,
        order=order,
        payment_method_id=_get_payment_method_by_type(db, "upi").id,
        amount_received=Decimal(str(order.total)),
        reference_code=razorpay_payment_id,
        current_user=current_user,
    )
    return {
        **result,
        "payment_provider": "razorpay",
        "razorpay_order_id": razorpay_order_id,
        "razorpay_payment_id": razorpay_payment_id,
    }

@router.get("/customers/search", dependencies=[cashier_dependency])
def search_customer(q: str, db: Session = Depends(get_db)):
    query = q.strip()
    normalized_phone = _normalize_phone(query)
    
    customers = []
    staff_users = []
    
    if not query:
        return []
        
    if query.isdigit() or normalized_phone == query:
        customers = (
            db.query(Customer)
            .filter(Customer.is_guest == False, Customer.mobile_number.like(f"%{normalized_phone}%"))  # noqa: E712
            .all()
        )
        staff_users = (
            db.query(User)
            .filter(User.deleted_at == None, User.mobile_number.like(f"%{normalized_phone}%"))
            .all()
        )
    elif normalized_phone:
        customers = (
            db.query(Customer)
            .filter(
                Customer.is_guest == False,  # noqa: E712
                or_(
                    Customer.name.like(f"%{query}%"),
                    Customer.mobile_number.like(f"%{normalized_phone}%"),
                ),
            )
            .all()
        )
        staff_users = (
            db.query(User)
            .filter(
                User.deleted_at == None,
                or_(
                    User.name.like(f"%{query}%"),
                    User.mobile_number.like(f"%{normalized_phone}%"),
                ),
            )
            .all()
        )
    else:
        customers = (
            db.query(Customer)
            .filter(Customer.is_guest == False, Customer.name.like(f"%{query}%"))  # noqa: E712
            .all()
        )
        staff_users = (
            db.query(User)
            .filter(User.deleted_at == None, User.name.like(f"%{query}%"))
            .all()
        )

    # Auto-create customer profile for matching staff users
    staff_customers = []
    if staff_users:
        for u in staff_users:
            c = db.query(Customer).filter(Customer.mobile_number == u.mobile_number).first()
            if not c:
                c = Customer(
                    name=u.name,
                    mobile_number=u.mobile_number,
                    email=u.email,
                    is_guest=False
                )
                db.add(c)
                db.flush()
            staff_customers.append(c)
        db.commit()

    # Merge lists using dict to prevent duplicates
    merged = {c.id: c for c in customers}
    for sc in staff_customers:
        merged[sc.id] = sc

    from app.db.models import LoyaltyCredit
    results = []
    for c in merged.values():
        loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == c.id).first()
        results.append({
            "id": c.id,
            "name": c.name,
            "mobile_number": c.mobile_number,
            "email": c.email,
            "is_guest": bool(c.is_guest),
            "loyalty_points": loyalty.total_credits if loyalty else 0,
            "can_claim_reward": (loyalty.total_credits if loyalty else 0) >= 50,
        })
    return results


@router.get("/customers/{customer_id}", response_model=CustomerResponse, dependencies=[cashier_dependency])
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.post("/customers/resolve", response_model=CustomerResponse, dependencies=[cashier_dependency])
def resolve_customer(cust_in: CustomerResolve, db: Session = Depends(get_db)):
    return _upsert_customer(
        db,
        name=cust_in.name,
        mobile_number=cust_in.mobile_number,
        email=cust_in.email,
        require_complete_profile=True,
    )


@router.post("/customers", response_model=CustomerResponse, dependencies=[cashier_dependency])
def register_customer(cust_in: CustomerSignup, db: Session = Depends(get_db)):
    return _upsert_customer(
        db,
        name=cust_in.name,
        mobile_number=cust_in.mobile_number,
        email=cust_in.email,
        require_complete_profile=True,
    )


@router.get("/customers/{customer_id}/loyalty", dependencies=[cashier_dependency])
def get_customer_loyalty(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    txs = (
        db.query(LoyaltyTransaction)
        .filter(LoyaltyTransaction.customer_id == customer_id)
        .order_by(LoyaltyTransaction.created_at.desc())
        .limit(10)
        .all()
    )

    total_points = loyalty.total_credits if loyalty else 0
    return {
        "customer_id": customer_id,
        "name": customer.name,
        "mobile_number": customer.mobile_number,
        "loyalty_points": total_points,
        "can_claim_reward": total_points >= 50,
        "reward_threshold": 50,
        "free_drink_name": "Signature Drink",
        "recent_transactions": [
            {"type": t.type, "amount": t.amount, "created_at": t.created_at}
            for t in txs
        ],
    }


class CFDTableRequest(BaseModel):
    table_id: int | None


class CFDSyncRequest(BaseModel):
    table_id: int
    cart: list
    order_items: list
    customer: dict | None
    totals: dict


@router.post("/cfd/set-table", dependencies=[cashier_dependency])
async def set_cfd_table(payload: CFDTableRequest):
    """Broadcasts to CFD clients to switch to a specific table or show the idle screen."""
    await manager.broadcast_all({
        "event": "cfd_table_changed",
        "table_id": payload.table_id
    })
    return {"success": True, "table_id": payload.table_id}


@router.post("/cfd/sync", dependencies=[cashier_dependency])
async def sync_cfd_state(payload: CFDSyncRequest):
    """Proxies live UI state from Cashier to CFD Mirror."""
    await manager.broadcast_all({
        "event": "cfd_sync",
        "data": payload.dict()
    })
    return {"success": True}
