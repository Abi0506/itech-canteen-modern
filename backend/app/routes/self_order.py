from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime
import random
import secrets

from app.db.session import get_db
from app.db.models import (
    User,
    Category,
    FoodItem,
    Order,
    OrderItem,
    Coupon,
    RestaurantTable,
    TableSession,
    LoyaltyAccount,
)
from app.models.schemas import (
    SelfOrderSignup,
    SessionJoin,
    SelfOrderItemsPayload,
    CouponApplyPayload,
    SelfOrderPaymentPayload,
    OrderResponse,
)
from app.routes.websockets import manager
from app.services.pos_billing import calculate_bill_breakdown

router = APIRouter(prefix="/self-order", tags=["self-order"])


def generate_session_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def generate_session_token(table_id: int) -> str:
    return f"self-{table_id}-{secrets.token_hex(8)}"


def _get_or_create_customer(payload: SelfOrderSignup, db: Session) -> User:
    phone = payload.phone_no.strip()
    existing = db.query(User).filter(User.phone_no == phone).first()
    if existing:
        if payload.name and not existing.display_name:
            existing.display_name = payload.name
        if payload.email and payload.email != existing.email:
            existing.email = payload.email
        db.commit()
        db.refresh(existing)
        return existing

    email = payload.email or f"{phone}@guest.local"
    base_roll_no = f"cust-{phone}"
    roll_no = base_roll_no[:50]
    suffix = 1
    while db.query(User).filter(User.roll_no == roll_no).first() is not None:
        roll_no = f"{base_roll_no[:45]}-{suffix}"[:50]
        suffix += 1

    customer = User(
        roll_no=roll_no,
        display_name=payload.name,
        email=email,
        phone_no=phone,
        password=secrets.token_hex(16),
        role="customer",
        user_type="customer",
        email_verified=bool(payload.email),
        bulk_order_enabled=False,
        favourites=[],
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    customer.set_balance(0.00)
    db.commit()
    db.refresh(customer)
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == customer.id).first()
    if not loyalty:
        loyalty = LoyaltyAccount(user_id=customer.id, total_points=0, lifetime_spend=Decimal("0.00"))
        db.add(loyalty)
        db.commit()
        db.refresh(loyalty)
    return customer


def _get_active_session(table_id: int, db: Session):
    return db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.status == "active",
    ).first()


def _get_or_create_order(table: RestaurantTable, session: TableSession, customer: User, db: Session) -> Order:
    if table.active_order_id:
        existing = db.query(Order).filter(Order.id == table.active_order_id).first()
        if existing:
            return existing

    bill_number = f"S{datetime.utcnow().strftime('%y%m%d')}{random.randint(1000, 9999)}"
    order = Order(
        user_id=customer.id,
        cashier_id=None,
        floor_id=table.floor_id,
        table_id=table.id,
        session_id=session.id,
        bill_number=bill_number,
        total_amount=Decimal("0.00"),
        subtotal_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        payment_method="upi",
        payment_status="pending",
        order_status="draft",
        kitchen_status="to_cook",
        items={},
    )
    db.add(order)
    db.flush()
    table.active_order_id = order.id
    table.status = "reserved"
    session.customer_id = customer.id
    db.commit()
    db.refresh(order)
    return order


def _serialize_menu(db: Session):
    categories = db.query(Category).filter(Category.is_active == True).all()
    return [
        {
            "id": category.id,
            "name": category.name,
            "color": category.color,
            "items": [
                {
                    "id": item.id,
                    "category_id": item.category_id,
                    "name": item.name,
                    "description": item.description,
                    "price": float(item.price),
                    "cash_price": float(item.cash_price) if item.cash_price is not None else None,
                    "unit_of_measure": item.unit_of_measure,
                    "tax_rate": float(item.tax_rate or 0),
                    "quantity_available": item.quantity_available,
                    "reserved_quantity": item.reserved_quantity,
                    "is_active": item.is_active,
                }
                for item in db.query(FoodItem).filter(FoodItem.category_id == category.id, FoodItem.is_active == True).all()
            ],
        }
        for category in categories
    ]


@router.get("/menu")
def menu(table_id: int, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    session = _get_active_session(table_id, db)
    order = db.query(Order).filter(Order.id == table.active_order_id).first() if table.active_order_id else None
    return {
        "table": {
            "id": table.id,
            "table_number": table.table_number,
            "status": table.status,
        },
        "session": {
            "id": session.id,
            "session_pin": session.session_pin,
            "session_token": session.session_token,
        } if session else None,
        "order": OrderResponse.model_validate(order).model_dump() if order else None,
        "menu": _serialize_menu(db),
    }


@router.post("/tables/{table_id}/start")
async def start_session(table_id: int, payload: SelfOrderSignup, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    customer = _get_or_create_customer(payload, db)
    session = _get_active_session(table_id, db)
    if not session:
        session = TableSession(
            table_id=table.id,
            customer_id=customer.id,
            session_pin=generate_session_pin(),
            session_token=generate_session_token(table.id),
            status="active",
        )
        db.add(session)
        db.flush()

    order = _get_or_create_order(table, session, customer, db)
    db.commit()
    db.refresh(session)
    db.refresh(order)
    await manager.broadcast_all({
        "event": "table_status_changed",
        "table_id": table.id,
        "status": table.status,
    })
    return {
        "session": {
            "id": session.id,
            "session_pin": session.session_pin,
            "session_token": session.session_token,
            "status": session.status,
        },
        "order": OrderResponse.model_validate(order).model_dump(),
    }


@router.post("/tables/{table_id}/join")
async def join_session(table_id: int, payload: SessionJoin, db: Session = Depends(get_db)):
    session = _get_active_session(table_id, db)
    if not session or session.session_pin != payload.session_pin:
        raise HTTPException(status_code=400, detail="Invalid session PIN")

    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    order = db.query(Order).filter(Order.id == table.active_order_id).first() if table.active_order_id else None
    await manager.broadcast_all({
        "event": "table_status_changed",
        "table_id": table.id,
        "status": table.status,
    })
    return {
        "session": {
            "id": session.id,
            "session_pin": session.session_pin,
            "session_token": session.session_token,
            "status": session.status,
        },
        "order": OrderResponse.model_validate(order).model_dump() if order else None,
    }


@router.post("/orders/{order_id}/items")
async def add_items(order_id: int, payload: SelfOrderItemsPayload, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    current_items = dict(order.items or {})
    for item_payload in payload.items:
        food_item = db.query(FoodItem).filter(FoodItem.id == item_payload.id).first()
        if not food_item or not food_item.is_active:
            raise HTTPException(status_code=400, detail=f"Item {item_payload.id} unavailable")

        key = str(food_item.id)
        current_item = current_items.get(key, {
            "id": food_item.id,
            "name": food_item.name,
            "quantity": 0,
            "rate": f"{food_item.price:.2f}",
            "status": "pending",
        })
        current_item["quantity"] += item_payload.quantity
        current_items[key] = current_item

        existing_order_item = db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.food_item_id == food_item.id,
        ).first()
        if existing_order_item:
            existing_order_item.quantity += item_payload.quantity
        else:
            db.add(OrderItem(
                order_id=order.id,
                food_item_id=food_item.id,
                quantity=item_payload.quantity,
                price=food_item.price,
                status="pending",
                kitchen_status="to_cook",
            ))

    order.items = current_items
    order.subtotal_amount = sum(Decimal(details["rate"]) * details["quantity"] for details in current_items.values())
    order.total_amount = order.subtotal_amount + (order.tax_amount or Decimal("0.00")) - (order.discount_amount or Decimal("0.00"))
    db.commit()
    db.refresh(order)
    await manager.broadcast_all({
        "event": "order_items_updated",
        "order_id": order.id,
        "table_id": order.table_id,
    })
    return OrderResponse.model_validate(order).model_dump()


@router.post("/orders/{order_id}/send")
async def send_to_kitchen(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    for order_item in order_items:
        if order_item.status in ["sent", "preparing", "completed"]:
            continue
        food_item = db.query(FoodItem).filter(FoodItem.id == order_item.food_item_id).first()
        if not food_item or food_item.quantity_available < order_item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {order_item.food_item_id}")
        food_item.quantity_available -= order_item.quantity
        food_item.reserved_quantity += order_item.quantity
        food_item.last_reserved_at = datetime.utcnow()
        order_item.status = "sent"
        order_item.kitchen_status = "to_cook"

    order.order_status = "sent"
    order.kitchen_status = "to_cook"
    db.commit()
    db.refresh(order)

    await manager.broadcast_all({
        "event": "self_order_sent",
        "order_id": order.id,
        "table_id": order.table_id,
        "bill_number": order.bill_number,
    })
    await manager.broadcast_all({
        "event": "order_status_changed",
        "order_id": order.id,
        "table_id": order.table_id,
        "status": order.order_status,
    })
    return OrderResponse.model_validate(order).model_dump()


@router.post("/orders/{order_id}/coupon")
def apply_coupon(order_id: int, payload: CouponApplyPayload, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    coupon = db.query(Coupon).filter(Coupon.code == payload.code.upper(), Coupon.is_active == True).first()
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")
    if coupon.minimum_order_amount and order.subtotal_amount < coupon.minimum_order_amount:
        raise HTTPException(status_code=400, detail="Order amount does not meet coupon minimum")

    discount = Decimal("0.00")
    if coupon.discount_type == "percentage":
        discount = order.subtotal_amount * (Decimal(coupon.discount_value) / Decimal("100"))
        if coupon.maximum_discount_amount is not None:
            discount = min(discount, Decimal(coupon.maximum_discount_amount))
    else:
        discount = Decimal(coupon.discount_value)

    discount = min(discount, order.subtotal_amount)
    order.coupon_code = coupon.code
    order.discount_amount = discount
    order.total_amount = order.subtotal_amount + (order.tax_amount or Decimal("0.00")) - discount
    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order).model_dump()


@router.post("/orders/{order_id}/pay")
async def pay(order_id: int, payload: SelfOrderPaymentPayload, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.payment_method == "cash":
        raise HTTPException(status_code=400, detail="Cash is not allowed for self-ordering")
    if payload.payment_method not in ["upi", "card", "digital"]:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    customer = db.query(User).filter(User.id == order.user_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    breakdown = calculate_bill_breakdown(
        db,
        order,
        coupon_code=payload.coupon_code or order.coupon_code,
        redeem_points=payload.redeem_points,
        customer=customer,
    )
    order.discount_amount = Decimal(str(breakdown["total_discount"]))
    order.total_amount = Decimal(str(breakdown["total_amount"]))
    order.subtotal_amount = Decimal(str(breakdown["subtotal"]))
    order.tax_amount = Decimal(str(breakdown["tax"]))
    order.coupon_code = breakdown["coupon_code"]
    order.loyalty_points_earned = breakdown["loyalty_points_earned"]

    customer.loyalty_points = (customer.loyalty_points or 0) + breakdown["loyalty_points_earned"] - breakdown["loyalty_points_redeemed"]
    customer.loyalty_points = max(0, customer.loyalty_points)
    loyalty = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == customer.id).first()
    if not loyalty:
        loyalty = LoyaltyAccount(user_id=customer.id, total_points=0, lifetime_spend=Decimal("0.00"))
        db.add(loyalty)
    loyalty.total_points = (loyalty.total_points or 0) + breakdown["loyalty_points_earned"] - breakdown["loyalty_points_redeemed"]
    loyalty.total_points = max(0, loyalty.total_points)
    loyalty.lifetime_spend = (loyalty.lifetime_spend or Decimal("0.00")) + Decimal(str(breakdown["total_amount"]))

    order.payment_method = payload.payment_method
    order.payment_status = "completed"
    order.order_status = "completed"
    order.kitchen_status = "completed"
    order.closed_at = datetime.utcnow()

    table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
    if table:
        table.status = "available"
        table.active_order_id = None
        table.active_cashier_id = None

    session = db.query(TableSession).filter(TableSession.id == order.session_id).first()
    if session:
        session.status = "closed"
        session.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    await manager.broadcast_all({
        "event": "self_order_paid",
        "order_id": order.id,
        "table_id": order.table_id,
        "bill_number": order.bill_number,
        "payment_status": order.payment_status,
    })
    await manager.broadcast_all({
        "event": "table_status_changed",
        "table_id": order.table_id,
        "status": "available",
    })
    payload = OrderResponse.model_validate(order).model_dump()
    payload["billing_breakdown"] = breakdown
    return payload
