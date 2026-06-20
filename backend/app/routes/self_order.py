from decimal import Decimal
from datetime import date, datetime
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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

router = APIRouter(prefix="/self-order", tags=["self_order"])

TAX_RATE = Decimal("0.05")


def _generate_order_number(db: Session) -> str:
    date_str = datetime.utcnow().strftime("%y%m%d")
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    return f"S{date_str}{count + 1:04d}"


def _generate_session_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def _get_table(db: Session, table_id: int) -> TableMaster:
    table = db.query(TableMaster).filter(TableMaster.id == table_id, TableMaster.is_active == True).first()
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
    }


def _recalculate_order(order: Order) -> None:
    subtotal = sum((item.line_total for item in order.items), Decimal("0.00"))
    order.subtotal = subtotal
    order.tax_total = subtotal * TAX_RATE
    order.discount_total = min(order.discount_total or Decimal("0.00"), subtotal)
    order.total = max(Decimal("0.00"), order.subtotal + order.tax_total - order.discount_total)


def _get_or_create_customer(db: Session, payload: dict) -> Customer:
    mobile_number = payload.get("mobile_number") or payload.get("phone_no")
    name = (payload.get("name") or "Guest").strip()
    if not mobile_number:
        raise HTTPException(status_code=400, detail="Phone number is required")

    customer = db.query(Customer).filter(Customer.mobile_number == mobile_number).first()
    if customer:
        customer.name = name or customer.name
        customer.email = payload.get("email") or customer.email
        customer.is_guest = False
        return customer

    customer = Customer(name=name, mobile_number=mobile_number, email=payload.get("email") or None, is_guest=False)
    db.add(customer)
    db.flush()
    return customer


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
            pending_line = next((line for line in lines if line.kitchen_status == "pending"), None)
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
                        kitchen_status="pending",
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
    _recalculate_order(order)


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
def get_menu(table_id: int, db: Session = Depends(get_db)):
    table = _get_table(db, table_id)
    session = _get_active_session(db, table.id)
    return {
        "table": _serialize_table(table),
        "session_active": session is not None,
        "menu": _build_menu(db),
    }


@router.post("/tables/{table_id}/start")
async def start_table_session(table_id: int, payload: dict, db: Session = Depends(get_db)):
    venue = db.query(VenueSetting).first()
    if venue and not venue.self_ordering_enabled:
        raise HTTPException(status_code=400, detail="Self-ordering is currently disabled")

    table = _get_table(db, table_id)
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

    table.current_status = "occupied"
    order = _get_or_create_order(db, table, session, customer.id)
    db.commit()
    db.refresh(order)

    await manager.broadcast_all({"event": "table_session_started", "table_id": table.id, "order_id": order.id})
    return {"table": _serialize_table(table), "session": _serialize_session(session), "order": _serialize_order(db, order)}


@router.post("/tables/{table_id}/join")
def join_table_session(table_id: int, payload: dict, db: Session = Depends(get_db)):
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
                if order_item.product_id == product.id and order_item.kitchen_status == "pending"
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
                    kitchen_status="pending",
                )
            )

    db.flush()
    db.refresh(order)
    _recalculate_order(order)
    if order.table_session_id:
        session = db.query(TableSession).filter(TableSession.id == order.table_session_id).first()
        if session:
            session.last_activity_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    await manager.broadcast_all({"event": "cart_updated", "table_id": order.table_id, "order_id": order.id})
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


@router.post("/orders/{order_id}/coupon")
def apply_coupon(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot apply coupon to a paid order")

    code = str(payload.get("code", "")).strip().upper()
    coupon = db.query(Coupon).filter(Coupon.code == code, Coupon.is_active == True).first()
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")

    today = date.today()
    if coupon.valid_from and coupon.valid_from > today:
        raise HTTPException(status_code=400, detail="Coupon is not active yet")
    if coupon.valid_until and coupon.valid_until < today:
        raise HTTPException(status_code=400, detail="Coupon has expired")
    if coupon.max_uses and coupon.used_count >= coupon.max_uses and order.coupon_id != coupon.id:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")

    discount = order.subtotal * (coupon.value / Decimal("100.00")) if coupon.discount_type == "percent" else coupon.value

    if order.coupon_id and order.coupon_id != coupon.id:
        previous_coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if previous_coupon and previous_coupon.used_count > 0:
            previous_coupon.used_count -= 1

    if order.coupon_id != coupon.id:
        coupon.used_count += 1

    order.coupon_id = coupon.id
    order.discount_total = min(discount, order.subtotal)
    _recalculate_order(order)
    db.commit()
    db.refresh(order)
    return _serialize_order(db, order)


@router.post("/orders/{order_id}/pay")
async def pay_order(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == "paid":
        return _serialize_order(db, order)

    payment_type = str(payload.get("payment_method", "upi")).lower()
    if payment_type == "cash":
        raise HTTPException(status_code=400, detail="Cash payments must be handled by the cashier")

    method = db.query(PaymentMethod).filter(PaymentMethod.type == payment_type, PaymentMethod.is_enabled == True).first()
    if not method:
        raise HTTPException(status_code=400, detail="Payment method is unavailable")

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
            reference_code=payload.get("reference_code"),
            status="completed",
            received_by=receiver.id,
        )
    )

    order.status = "paid"
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

    db.commit()
    db.refresh(order)
    await manager.broadcast_all({
        "event": "payment_completed",
        "table_id": order.table_id,
        "order_id": order.id,
        "table_status": "available",
    })
    return _serialize_order(db, order)
