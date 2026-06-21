from decimal import Decimal
from datetime import date, datetime
import random
import re
import razorpay

from fastapi import APIRouter, Depends, HTTPException
from app.core.config import settings
from sqlalchemy.orm import Session
from sqlalchemy.sql import or_, func

from app.db.models import (
    Category,
    Coupon,
    Customer,
    InventoryItem,
    Order,
    OrderItem,
    Payment,
    PaymentMethod,
    Product,
    StockMovement,
    StockReservation,
    TableMaster,
    TableSession,
    User,
    VenueSetting,
)
from app.db.session import get_db
from app.routes.websockets import manager
from app.routes.loyalty import award_loyalty_points
from app.services.email import send_receipt_email
from app.db.models import LoyaltyCredit
from app.services.pricing import recalculate_order_totals
from app.models.schemas import ApplyCouponRequest

router = APIRouter(prefix="/self-order", tags=["self_order"])

TAX_RATE = Decimal("0.05")

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



def _generate_order_number(db: Session) -> str:
    date_str = datetime.utcnow().strftime("%y%m%d")
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    return f"S{date_str}{count + 1:04d}"


def _generate_session_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def _normalize_phone(phone: str | None) -> str:
    return re.sub(r"\D+", "", phone or "").strip()


def _get_table(db: Session, table_identifier: str) -> TableMaster:
    parts = table_identifier.rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        table_id = int(parts[1])
        table = db.query(TableMaster).filter(TableMaster.id == table_id, TableMaster.is_active == True).first()
        if table:
            return table

    table = db.query(TableMaster).filter(TableMaster.table_number == table_identifier, TableMaster.is_active == True).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table


def _get_active_session(db: Session, table_id: int) -> TableSession | None:
    return (
        db.query(TableSession)
        .filter(TableSession.table_id == table_id, TableSession.status == "active")
        .order_by(TableSession.opened_at.desc())
        .first()
    )


def _get_active_order(db: Session, table_id: int, session_id: int | None = None) -> Order | None:
    query = db.query(Order).filter(Order.table_id == table_id, Order.status.in_(["draft", "sent_to_kitchen"]))
    if session_id is not None:
        query = query.filter(Order.table_session_id == session_id)
    return query.order_by(Order.created_at.desc()).first()


def _serialize_table(table: TableMaster) -> dict:
    return {
        "id": table.id,
        "table_number": table.table_number,
        "seats": table.seats,
        "status": table.current_status,
        "current_order_id": table.current_order_id,
    }


def _serialize_session(session: TableSession | None) -> dict | None:
    if not session:
        return None
    return {
        "id": session.id,
        "session_pin": session.pin_code,
        "status": session.status,
        "lock_mode": "pin" if session.lock_mode == "locked" else "none",
    }


def _serialize_order(db: Session, order: Order | None) -> dict | None:
    if not order:
        return None

    coupon_code = None
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        coupon_code = coupon.code if coupon else None

    items = {}
    for item in order.items:
        confirmed_quantity = (
            db.query(StockReservation)
            .filter(
                StockReservation.order_item_id == item.id,
                StockReservation.status.in_(["reserved", "finalized"]),
            )
            .with_entities(StockReservation.quantity)
            .scalar()
            or Decimal("0.00")
        )
        items[str(item.id)] = {
            "id": item.id,
            "product_id": item.product_id,
            "name": item.product.name if item.product else f"Product {item.product_id}",
            "quantity": float(item.quantity),
            "confirmed_quantity": float(confirmed_quantity),
            "rate": float(item.unit_price),
            "total": float(item.line_total),
            "status": item.kitchen_status,
        }

    customer_info = None
    loyalty_info = None
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            customer_info = {
                "id": customer.id,
                "name": customer.name,
                "mobile_number": customer.mobile_number,
                "email": customer.email,
                "is_guest": customer.is_guest,
            }
            if not customer.is_guest:
                loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer.id).first()
                total_points = loyalty.total_credits if loyalty else 0
                loyalty_info = {
                    "total_points": total_points,
                    "can_claim_reward": total_points >= 50,
                }

    return {
        "id": order.id,
        "bill_number": order.order_number,
        "status": order.status,
        "coupon_code": coupon_code,
        "items": items,
        "subtotal_amount": float(order.subtotal or 0),
        "tax_amount": float(order.tax_total or 0),
        "discount_amount": float(order.discount_total or 0),
        "total_amount": float(order.total or 0),
        "customer": customer_info,
        "loyalty": loyalty_info,
        "applied_promotions": getattr(order, "applied_promotions_temp", []),
    }



def _all_order_items_done(order: Order) -> bool:
    items = list(order.items or [])
    if not items:
        return False
    return all(item.kitchen_status == "completed" for item in items)


def _recalculate_order(db: Session, order: Order) -> None:
    _, _, _, _, applied_promotions = recalculate_order_totals(db, order)
    order.applied_promotions_temp = applied_promotions


def _get_or_create_customer(db: Session, payload: dict) -> Customer:
    mobile_number = _normalize_phone(payload.get("mobile_number") or payload.get("phone_no"))
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip() or None
    if not mobile_number:
        raise HTTPException(status_code=400, detail="Phone number is required")

    customer = (
        db.query(Customer)
        .filter(
            Customer.mobile_number == mobile_number
        )
        .first()
    )
    if customer:
        if name:
            customer.name = name
        if email:
            customer.email = email
        customer.is_guest = False
        return customer

    if not name:
        raise HTTPException(status_code=400, detail="Name is required for a new customer")

    customer = Customer(name=name, mobile_number=mobile_number, email=email, is_guest=False)
    db.add(customer)
    db.flush()
    return customer


@router.get("/customers/resolve")
def resolve_customer(phone_number: str, db: Session = Depends(get_db)):
    mobile_number = _normalize_phone(phone_number)
    if not mobile_number:
        raise HTTPException(status_code=400, detail="Phone number is required")

    customer = (
        db.query(Customer)
        .filter(
            Customer.mobile_number == mobile_number
        )
        .first()
    )
    if not customer:
        return {"exists": False}

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer.id).first()
    loyalty_points = loyalty.total_credits if loyalty else 0

    return {
        "exists": True,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "mobile_number": customer.mobile_number,
        },
        "loyalty": {
            "total_points": loyalty_points,
            "can_claim_reward": loyalty_points >= 50,
        },
    }


def _get_or_create_order(db: Session, table: TableMaster, session: TableSession, customer_id: int | None = None) -> Order:
    order = _get_active_order(db, table.id, session.id)
    if order:
        if customer_id and not order.customer_id:
            order.customer_id = customer_id
        return order

    order = Order(
        order_number=_generate_order_number(db),
        source="self_order",
        table_id=table.id,
        table_session_id=session.id,
        customer_id=customer_id,
        status="draft",
        subtotal=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        discount_total=Decimal("0.00"),
        total=Decimal("0.00"),
    )
    db.add(order)
    db.flush()
    table.current_order_id = order.id
    return order


def _get_confirmed_quantity(db: Session, order_item_id: int) -> Decimal:
    quantity = (
        db.query(StockReservation.quantity)
        .filter(
            StockReservation.order_item_id == order_item_id,
            StockReservation.status.in_(["reserved", "finalized"]),
        )
        .scalar()
    )
    return Decimal(str(quantity or 0))


def _sync_order_items(db: Session, order: Order, requested_items: list[dict]) -> None:
    desired_by_product: dict[int, Decimal] = {}
    for requested in requested_items:
        product_id = int(requested.get("product_id") or requested.get("id") or 0)
        quantity = Decimal(str(requested.get("quantity", 0)))
        if not product_id or quantity < 0:
            raise HTTPException(status_code=400, detail="Invalid product or quantity")
        desired_by_product[product_id] = desired_by_product.get(product_id, Decimal("0.00")) + quantity

    desired_by_product = {
        product_id: quantity
        for product_id, quantity in desired_by_product.items()
        if quantity > 0
    }
    if not desired_by_product:
        raise HTTPException(status_code=400, detail="Add at least one item before confirming")

    existing_by_product: dict[int, list[OrderItem]] = {}
    confirmed_by_product: dict[int, Decimal] = {}
    for order_item in list(order.items):
        existing_by_product.setdefault(order_item.product_id, []).append(order_item)
        confirmed_by_product[order_item.product_id] = (
            confirmed_by_product.get(order_item.product_id, Decimal("0.00"))
            + _get_confirmed_quantity(db, order_item.id)
        )

    for product_id, confirmed_quantity in confirmed_by_product.items():
        if desired_by_product.get(product_id, Decimal("0.00")) < confirmed_quantity:
            raise HTTPException(
                status_code=400,
                detail="Confirmed item quantities cannot be reduced",
            )

    all_product_ids = set(existing_by_product) | set(desired_by_product)
    for product_id in all_product_ids:
        product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {product_id} is not available")

        lines = existing_by_product.get(product_id, [])
        current_quantity = sum((line.quantity for line in lines), Decimal("0.00"))
        desired_quantity = desired_by_product.get(product_id, Decimal("0.00"))

        if desired_quantity > current_quantity:
            increase = desired_quantity - current_quantity
            pending_line = next((line for line in lines if line.kitchen_status == "to_cook"), None)
            if pending_line:
                pending_line.quantity += increase
                pending_line.line_total = pending_line.unit_price * pending_line.quantity
            else:
                db.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        quantity=increase,
                        unit_price=product.price,
                        line_discount=Decimal("0.00"),
                        line_total=product.price * increase,
                        kitchen_status="to_cook",
                    )
                )
        elif desired_quantity < current_quantity:
            reduction = current_quantity - desired_quantity
            for line in reversed(lines):
                if reduction <= 0:
                    break
                confirmed_quantity = _get_confirmed_quantity(db, line.id)
                reducible = max(Decimal("0.00"), line.quantity - confirmed_quantity)
                amount = min(reduction, reducible)
                if amount <= 0:
                    continue
                line.quantity -= amount
                reduction -= amount
                if line.quantity == 0:
                    db.delete(line)
                else:
                    line.line_total = line.unit_price * line.quantity
            if reduction > 0:
                raise HTTPException(status_code=400, detail="Confirmed item quantities cannot be reduced")

    db.flush()
    db.refresh(order)
    _recalculate_order(db, order)


def _deduct_newly_confirmed_stock(db: Session, order: Order) -> None:
    inventory_actor = db.query(User).filter(User.is_active == True).order_by(User.id.asc()).first()

    for item in order.items:
        confirmed_quantity = _get_confirmed_quantity(db, item.id)
        quantity_to_confirm = item.quantity - confirmed_quantity
        if quantity_to_confirm < 0:
            raise HTTPException(status_code=400, detail="Confirmed item quantities cannot be reduced")
        if quantity_to_confirm == 0:
            continue

        inventory_item = (
            db.query(InventoryItem)
            .filter(InventoryItem.product_id == item.product_id)
            .with_for_update()
            .first()
        )
        if inventory_item:
            if inventory_item.current_stock < quantity_to_confirm:
                product_name = item.product.name if item.product else f"Product {item.product_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"Only {inventory_item.current_stock} of {product_name} is available",
                )
            inventory_item.current_stock -= quantity_to_confirm
            if inventory_actor:
                db.add(
                    StockMovement(
                        inventory_item_id=inventory_item.id,
                        movement_type="sale_out",
                        quantity=quantity_to_confirm,
                        reference_order_id=order.id,
                        performed_by=inventory_actor.id,
                        note=f"Self-order confirmation {order.order_number}",
                    )
                )

        reservation = (
            db.query(StockReservation)
            .filter(
                StockReservation.order_item_id == item.id,
                StockReservation.status.in_(["reserved", "finalized"]),
            )
            .first()
        )
        if reservation:
            reservation.quantity = item.quantity
            reservation.status = "finalized"
        else:
            db.add(
                StockReservation(
                    order_item_id=item.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    status="finalized",
                )
            )
def _build_menu(db: Session) -> list[dict]:
    categories = db.query(Category).filter(Category.is_active == True).order_by(Category.display_order).all()
    menu = []
    for category in categories:
        products = (
            db.query(Product)
            .filter(Product.category_id == category.id, Product.is_active == True)
            .order_by(Product.name)
            .all()
        )
        menu.append(
            {
                "id": category.id,
                "name": category.name,
                "color": category.color_hex,
                "items": [
                    {
                        "id": product.id,
                        "category_id": product.category_id,
                        "name": product.name,
                        "description": product.description,
                        "price": float(product.price),
                        "uom": product.uom,
                        "quantity_available": float(product.inventory_item.current_stock)
                        if product.inventory_item
                        else 999,
                    }
                    for product in products
                ],
            }
        )
    return menu


@router.get("/menu")
def get_menu(table_id: str, db: Session = Depends(get_db)):
    table = _get_table(db, table_id)
    session = _get_active_session(db, table.id)
    return {
        "table": _serialize_table(table),
        "session_active": session is not None,
        "table_blocked": table.current_status == "reserved",
        "menu": _build_menu(db),
    }


@router.post("/tables/{table_id}/start")
async def start_table_session(table_id: str, payload: dict, db: Session = Depends(get_db)):
    venue = db.query(VenueSetting).first()
    if venue and not venue.self_ordering_enabled:
        raise HTTPException(status_code=400, detail="Self-ordering is currently disabled")

    table = _get_table(db, table_id)

    if table.current_status == "reserved":
        raise HTTPException(status_code=400, detail="This table is currently blocked by the cashier. Please ask staff for help.")

    customer = _get_or_create_customer(db, payload)

    session = _get_active_session(db, table.id)
    if session:
        raise HTTPException(status_code=400, detail="This table already has an active order. Join it with the table PIN.")

    session = TableSession(
        table_id=table.id,
        status="active",
        lock_mode="locked",
        pin_code=_generate_session_pin(),
        opened_at=datetime.utcnow(),
        last_activity_at=datetime.utcnow(),
    )
    db.add(session)
    db.flush()

    order = _get_or_create_order(db, table, session, customer.id)
    db.commit()
    db.refresh(order)

    await manager.broadcast_all({"event": "table_session_started", "table_id": table.id, "order_id": order.id})
    return {"table": _serialize_table(table), "session": _serialize_session(session), "order": _serialize_order(db, order)}


@router.post("/tables/{table_id}/join")
def join_table_session(table_id: str, payload: dict, db: Session = Depends(get_db)):
    table = _get_table(db, table_id)
    session = _get_active_session(db, table.id)
    if not session:
        raise HTTPException(status_code=400, detail="No active session for this table")
    if session.pin_code != str(payload.get("session_pin", "")).strip():
        raise HTTPException(status_code=400, detail="Invalid session PIN")

    order = _get_or_create_order(db, table, session)
    db.commit()
    db.refresh(order)
    return {"table": _serialize_table(table), "session": _serialize_session(session), "order": _serialize_order(db, order)}


@router.post("/orders/{order_id}/items")
async def add_order_items(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")

    for item in payload.get("items", []):
        product_id = item.get("product_id") or item.get("id")
        quantity = Decimal(str(item.get("quantity", 1)))
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

        product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {product_id} is not available")

        existing = next(
            (
                order_item
                for order_item in order.items
                if order_item.product_id == product.id and order_item.kitchen_status == "to_cook"
            ),
            None,
        )
        if existing:
            existing.quantity += quantity
            existing.line_total = existing.unit_price * existing.quantity - (existing.line_discount or Decimal("0.00"))
        else:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=product.price,
                    line_discount=Decimal("0.00"),
                    line_total=product.price * quantity,
                    kitchen_status="to_cook",
                )
            )

    db.flush()
    db.refresh(order)
    _recalculate_order(db, order)
    if order.table_session_id:
        session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
        if session:
            session.last_activity_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    await manager.broadcast_all({"event": "cart_updated", "table_id": order.table_id, "order_id": order.id})
    return _serialize_order(db, order)

@router.post("/orders/{order_id}/apply-coupon")
async def apply_coupon(order_id: int, payload: ApplyCouponRequest, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")
        
    coupon = db.query(Coupon).filter(func.upper(Coupon.code) == payload.code.upper().strip()).first()
    if not coupon or not coupon.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")
        
    order.coupon_id = coupon.id
    db.commit()
    db.refresh(order)
    _recalculate_order(db, order)
    return _serialize_order(db, order)

@router.post("/orders/{order_id}/remove-coupon")
async def remove_coupon(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")
        
    order.coupon_id = None
    db.commit()
    db.refresh(order)
    _recalculate_order(db, order)
    return _serialize_order(db, order)


@router.post("/orders/{order_id}/send")
async def send_order_to_kitchen(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.items:
        raise HTTPException(status_code=400, detail="Add at least one item before sending")
    if order.status == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid")

    _deduct_newly_confirmed_stock(db, order)
    order.status = "sent_to_kitchen"

    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table and table.current_status != "occupied":
            table.current_status = "occupied"

    db.commit()
    db.refresh(order)
    await manager.broadcast_all({"event": "order_sent_to_kitchen", "table_id": order.table_id, "order_id": order.id})
    return _serialize_order(db, order)


@router.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in {"paid", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot modify a closed order")

    is_add_on = any(_get_confirmed_quantity(db, item.id) > 0 for item in order.items)
    _sync_order_items(db, order, payload.get("items", []))
    _deduct_newly_confirmed_stock(db, order)
    order.status = "sent_to_kitchen"

    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table and table.current_status != "occupied":
            table.current_status = "occupied"

    if order.table_session_id:
        session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
        if session:
            session.last_activity_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    await manager.broadcast_all(
        {
            "event": "order_sent_to_kitchen",
            "table_id": order.table_id,
            "order_id": order.id,
            "is_add_on": is_add_on,
        }
    )
    return _serialize_order(db, order)


@router.get("/orders/{order_id}")
def get_order_status(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order": _serialize_order(db, order),
        "all_items_done": _all_order_items_done(order),
    }



@router.post("/orders/{order_id}/pay")
async def pay_order(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return _serialize_order(db, order)
    if not _all_order_items_done(order):
        raise HTTPException(status_code=400, detail="Please wait until all items are completed by the chef before payment")

    payment_type = str(payload.get("payment_method", "upi")).lower()
    db_payment_type = "upi" if payment_type == "razorpay" else payment_type

    if db_payment_type == "cash":
        raise HTTPException(status_code=400, detail="Cash payments must be handled by the cashier")

    method = db.query(PaymentMethod).filter(PaymentMethod.type == db_payment_type, PaymentMethod.is_enabled == True).first()
    if not method:
        raise HTTPException(status_code=400, detail="Payment method is unavailable")

    receiver = db.query(User).filter(User.role_id.in_([1, 2]), User.is_active == True).order_by(User.id.asc()).first()
    if not receiver:
        raise HTTPException(status_code=400, detail="No active cashier or admin user is available to receive payment")

    if payment_type == "upi" or payment_type == "razorpay" or payment_type == "card":
        client = _get_razorpay_client(db)
        amount_paise = int((Decimal(str(order.total)) * Decimal("100")).to_integral_value())
        razorpay_order = client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": order.order_number,
                "payment_capture": 1,
            }
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
            "key_id": client.auth[0], # The Key ID
            "payment_method_id": method.id,
        }

    db.add(
        Payment(
            order_id=order.id,
            payment_method_id=method.id,
            amount=order.total,
            amount_received=order.total,
            change_due=Decimal("0.00"),
            reference_code=payload.get("reference_code"),
            status="completed",
            received_by=receiver.id,
        )
    )

    order.status = "paid"
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if coupon:
            coupon.used_count += 1
            
    if order.table_session_id:
        session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
        if session:
            session.status = "closed"
            session.closed_at = datetime.utcnow()
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table.current_status = "available"
            table.current_order_id = None
            table.current_waiter_id = None

    # Award loyalty points based on order total
    loyalty_points_awarded = 0
    if order.customer_id:
        loyalty_points_awarded = award_loyalty_points(db, order.customer_id, order.id, float(order.total))

    db.commit()
    db.refresh(order)
    serialized = _serialize_order(db, order)
    serialized["loyalty_points_awarded"] = loyalty_points_awarded
    await manager.broadcast_all({
        "event": "payment_completed",
        "table_id": order.table_id,
        "order_id": order.id,
        "table_status": "available",
    })
    return serialized

import hmac
import hashlib

@router.post("/orders/{order_id}/razorpay/verify")
async def verify_razorpay_payment(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    razorpay_order_id = payload.get("razorpay_order_id")
    razorpay_payment_id = payload.get("razorpay_payment_id")
    razorpay_signature = payload.get("razorpay_signature")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        raise HTTPException(status_code=400, detail="Missing Razorpay verification details")

    venue_setting = db.query(VenueSetting).first()
    secret = venue_setting.razorpay_key_secret if venue_setting and venue_setting.razorpay_key_secret else settings.RAZORPAY_KEY_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")

    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    generated_signature = hmac.new(
        secret.encode(),
        msg.encode(),
        hashlib.sha256
    ).hexdigest()

    if generated_signature != razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid Razorpay signature")

    method = db.query(PaymentMethod).filter(PaymentMethod.type == "upi", PaymentMethod.is_enabled == True).first()
    if not method:
        raise HTTPException(status_code=400, detail="UPI payment method unavailable")

    receiver = db.query(User).filter(User.role_id.in_([1, 2]), User.is_active == True).order_by(User.id.asc()).first()
    if not receiver:
        raise HTTPException(status_code=400, detail="No active cashier or admin user is available to receive payment")

    db.add(
        Payment(
            order_id=order.id,
            payment_method_id=method.id,
            amount=order.total,
            amount_received=order.total,
            change_due=Decimal("0.00"),
            reference_code=razorpay_payment_id,
            status="completed",
            received_by=receiver.id,
        )
    )

    order.status = "paid"
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if coupon:
            coupon.used_count += 1

    if order.table_session_id:
        session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
        if session:
            session.status = "closed"
            session.closed_at = datetime.utcnow()
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table.current_status = "available"
            table.current_order_id = None
            table.current_waiter_id = None

    loyalty_points_awarded = 0
    if order.customer_id:
        loyalty_points_awarded = award_loyalty_points(db, order.customer_id, order.id, float(order.total))

    db.commit()
    db.refresh(order)

    # Send Receipt Email
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer and customer.email:
            items_list = []
            for itm in order.items:
                product = db.query(Product).filter(Product.id == itm.product_id).first()
                if product:
                    items_list.append({
                        "name": product.name,
                        "quantity": itm.quantity,
                        "price": itm.unit_price
                    })
            table_name = table.table_number if ('table' in locals() and table) else None
            
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

    serialized = _serialize_order(db, order)
    serialized["loyalty_points_awarded"] = loyalty_points_awarded
    await manager.broadcast_all({
        "event": "payment_completed",
        "table_id": order.table_id,
        "order_id": order.id,
        "table_status": "available",
    })
    return serialized


@router.post("/orders/{order_id}/send-email")
async def send_order_email(order_id: int, payload: dict = None, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    to_email = None
    if payload:
        to_email = payload.get("email")

    if not to_email and order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            to_email = customer.email

    if not to_email:
        raise HTTPException(status_code=400, detail="No email address available to send receipt")

    items_list = []
    for itm in order.items:
        product = db.query(Product).filter(Product.id == itm.product_id).first()
        if product:
            items_list.append({
                "name": product.name,
                "quantity": itm.quantity,
                "price": itm.unit_price
            })

    table_name = None
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table_name = table.table_number

    customer_name = "Customer"
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            customer_name = customer.name

    try:
        send_receipt_email(
            to_email=to_email,
            customer_name=customer_name,
            order_number=order.order_number,
            table_name=table_name,
            items=items_list,
            subtotal=order.total,
            tax=0,
            discount=0,
            grand_total=order.total,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    return {"success": True, "message": f"Receipt email sent to {to_email}"}

