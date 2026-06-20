from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date
from typing import List, Optional
import random
import secrets

from app.db.session import get_db
from app.db.models import (
    User,
    FoodItem,
    Order,
    OrderItem,
    WalletTransaction,
    StockAuditLog,
    RestaurantFloor,
    RestaurantTable,
    TableSession,
    LoyaltyAccount,
)
from app.models.schemas import CashierCheckout, FoodItemResponse, TableResponse, TableSessionResponse, OrderResponse
from app.routes.auth import require_role
from app.routes.websockets import manager
from app.services.pos_billing import calculate_bill_breakdown, get_coupon_or_none

router = APIRouter(prefix="/cashier", tags=["cashier"])

operational_dependency = Depends(require_role(["cashier", "admin", "superadmin"]))
inventory_dependency = Depends(require_role(["cashier", "inventory_manager", "admin", "superadmin"]))
management_dependency = Depends(require_role(["admin", "superadmin"]))

@router.get("/dashboard-stats", dependencies=[operational_dependency])
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Recent orders, total cash collected today, total UPI today
    today_start = datetime.combine(date.today(), datetime.min.time())
    orders_today = db.query(Order).filter(
        Order.created_at >= today_start, 
        Order.payment_status == "completed"
    ).all()
    
    total_sales = sum(o.total_amount for o in orders_today)
    total_cash = sum(o.total_amount for o in orders_today if o.payment_method == "cash")
    total_upi = sum(o.total_amount for o in orders_today if o.payment_method == "upi")
    total_wallet = sum(o.total_amount for o in orders_today if o.payment_method == "wallet")
    
    recent_transactions = db.query(Order).order_by(Order.created_at.desc()).limit(10).all()
    
    return {
        "total_sales": float(total_sales),
        "total_cash": float(total_cash),
        "total_upi": float(total_upi),
        "total_wallet": float(total_wallet),
        "recent_transactions": [
            {
                "bill_number": o.bill_number,
                "total_amount": float(o.total_amount),
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "created_at": o.created_at
            }
            for o in recent_transactions
        ]
    }

@router.get("/search-user", dependencies=[operational_dependency])
def search_user(query: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.roll_no == query) | 
        (User.email == query) | 
        (User.phone_no == query)
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "id": user.id,
        "roll_no": user.roll_no,
        "email": user.email,
        "phone_no": user.phone_no,
        "wallet_balance": user.get_balance()
    }

@router.post("/recharge-wallet", dependencies=[management_dependency])
def recharge_wallet(user_id: int, amount: float, cashier: User = Depends(require_role(["admin", "superadmin"])), db: Session = Depends(get_db)):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Recharge amount must be greater than zero")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    current_bal = user.get_balance()
    new_bal = current_bal + amount
    user.set_balance(new_bal)
    
    # Log wallet transaction
    tx = WalletTransaction(
        user_id=user.id,
        transaction_type="credit",
        amount=Decimal(f"{amount:.2f}"),
        description="Cashier wallet recharge",
        performed_by=cashier.id
    )
    db.add(tx)
    db.commit()
    
    return {"success": True, "new_balance": new_bal}

def generate_cashier_bill_number(db: Session) -> str:
    date_str = datetime.utcnow().strftime("%y%m%d")
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    formatted_counter = f"{count + 1:04d}"
    rand_suffix = f"{random.randint(10, 99)}"
    return f"C1{date_str}{formatted_counter}{rand_suffix}"


def generate_session_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def generate_session_token(table_id: int) -> str:
    return f"tbl-{table_id}-{secrets.token_hex(8)}"


def _get_walkin_customer(db: Session) -> User:
    customer = db.query(User).filter(User.roll_no == "WALKIN").first()
    if customer:
        return customer

    customer = User(
        roll_no="WALKIN",
        display_name="Walk-in Guest",
        email="walkin@cafe.local",
        phone_no="6666666666",
        password=secrets.token_hex(16),
        role="customer",
        user_type="customer",
        email_verified=True,
        bulk_order_enabled=False,
        favourites=[],
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _broadcast_pos_sync(table_id: Optional[int] = None, order_id: Optional[int] = None, event: str = "pos_sync"):
    payload = {"event": event}
    if table_id is not None:
        payload["table_id"] = table_id
    if order_id is not None:
        payload["order_id"] = order_id
    return manager.broadcast_all(payload)


@router.get("/floors", dependencies=[operational_dependency])
def get_floors(db: Session = Depends(get_db)):
    floors = db.query(RestaurantFloor).filter(RestaurantFloor.is_active == True).order_by(RestaurantFloor.sort_order.asc()).all()
    payload = []
    for floor in floors:
        tables = db.query(RestaurantTable).filter(
            RestaurantTable.floor_id == floor.id,
            RestaurantTable.is_active == True,
        ).order_by(RestaurantTable.table_number.asc()).all()
        payload.append({
            "id": floor.id,
            "name": floor.name,
            "sort_order": floor.sort_order,
            "tables": [
                {
                    "id": table.id,
                    "floor_id": table.floor_id,
                    "table_number": table.table_number,
                    "seats": table.seats,
                    "status": table.status,
                    "is_active": table.is_active,
                    "active_cashier_id": table.active_cashier_id,
                    "active_order_id": table.active_order_id,
                }
                for table in tables
            ],
        })
    return payload


@router.post("/tables/{table_id}/open", dependencies=[operational_dependency])
async def open_table(table_id: int, cashier: User = Depends(require_role(["cashier", "admin", "superadmin"])), db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    session = db.query(TableSession).filter(TableSession.table_id == table_id, TableSession.status == "active").first()
    if not session:
        session = TableSession(
            table_id=table_id,
            cashier_id=cashier.id,
            session_pin=generate_session_pin(),
            session_token=generate_session_token(table_id),
            status="active",
        )
        db.add(session)
        db.flush()

    table.status = "occupied"
    table.active_cashier_id = cashier.id
    db.commit()
    db.refresh(session)

    await manager.broadcast_all({
        "event": "table_status_changed",
        "table_id": table.id,
        "status": table.status,
        "active_cashier_id": table.active_cashier_id,
    })

    return {
        "table_id": table.id,
        "table_number": table.table_number,
        "floor_id": table.floor_id,
        "session": TableSessionResponse.model_validate(session).model_dump(),
    }


@router.get("/tables/{table_id}/order", dependencies=[operational_dependency])
def get_table_order(table_id: int, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    active_order = None
    if table.active_order_id:
        active_order = db.query(Order).filter(Order.id == table.active_order_id).first()

    return {
        "table": {
            "id": table.id,
            "table_number": table.table_number,
            "floor_id": table.floor_id,
            "status": table.status,
            "active_cashier_id": table.active_cashier_id,
        },
        "order": OrderResponse.model_validate(active_order).model_dump() if active_order else None,
    }


@router.post("/tables/{table_id}/order", dependencies=[operational_dependency])
async def create_or_get_table_order(table_id: int, cashier: User = Depends(require_role(["cashier", "admin", "superadmin"])), db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    active_order = None
    if table.active_order_id:
        active_order = db.query(Order).filter(Order.id == table.active_order_id).first()

    if active_order is None:
        bill_number = generate_cashier_bill_number(db)
        active_order = Order(
            user_id=cashier.id,
            cashier_id=cashier.id,
            floor_id=table.floor_id,
            table_id=table.id,
            bill_number=bill_number,
            total_amount=Decimal("0.00"),
            subtotal_amount=Decimal("0.00"),
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            payment_method="cash",
            payment_status="pending",
            order_status="draft",
            kitchen_status="to_cook",
            items={},
        )
        db.add(active_order)
        db.flush()
        table.active_order_id = active_order.id
        table.status = "occupied"
        table.active_cashier_id = cashier.id
        db.commit()
        db.refresh(active_order)

    await manager.broadcast_all({
        "event": "order_opened",
        "table_id": table.id,
        "order_id": active_order.id,
        "status": table.status,
    })
    return OrderResponse.model_validate(active_order).model_dump()


@router.post("/orders/{order_id}/items", dependencies=[operational_dependency])
async def add_order_items(order_id: int, payload: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    item_ids = payload.get("items", [])
    if not item_ids:
        raise HTTPException(status_code=400, detail="No items provided")

    current_items = dict(order.items or {})
    for item_payload in item_ids:
        item_id = item_payload.get("id")
        quantity = int(item_payload.get("quantity", 1))
        food_item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
        if not food_item or not food_item.is_active:
            raise HTTPException(status_code=400, detail=f"Item {item_id} unavailable")

        key = str(item_id)
        current_item = current_items.get(key, {
            "id": food_item.id,
            "name": food_item.name,
            "quantity": 0,
            "rate": f"{food_item.price:.2f}",
            "status": "pending",
        })
        current_item["quantity"] += quantity
        current_items[key] = current_item

        existing_order_item = db.query(OrderItem).filter(OrderItem.order_id == order.id, OrderItem.food_item_id == food_item.id).first()
        if existing_order_item:
            existing_order_item.quantity += quantity
        else:
            db.add(OrderItem(
                order_id=order.id,
                food_item_id=food_item.id,
                quantity=quantity,
                price=food_item.price,
                status="pending",
                kitchen_status="to_cook",
            ))

    order.items = current_items
    order.subtotal_amount = sum(Decimal(details["rate"]) * details["quantity"] for details in current_items.values())
    order.total_amount = order.subtotal_amount + (order.tax_amount or Decimal("0.00")) - (order.discount_amount or Decimal("0.00"))
    db.commit()
    db.refresh(order)

    await _broadcast_pos_sync(table_id=order.table_id, order_id=order.id, event="order_items_updated")
    return OrderResponse.model_validate(order).model_dump()


@router.post("/orders/{order_id}/send-to-kitchen", dependencies=[operational_dependency])
async def send_order_to_kitchen(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    if not order_items:
        raise HTTPException(status_code=400, detail="Order has no items")

    for order_item in order_items:
        if order_item.status in ["sent", "preparing", "completed"]:
            continue
        food_item = db.query(FoodItem).filter(FoodItem.id == order_item.food_item_id).first()
        if not food_item:
            raise HTTPException(status_code=400, detail="Item missing from menu")
        if food_item.quantity_available < order_item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {food_item.name}")

        food_item.quantity_available -= order_item.quantity
        food_item.reserved_quantity += order_item.quantity
        food_item.last_reserved_at = datetime.utcnow()
        order_item.status = "sent"
        order_item.kitchen_status = "to_cook"
        order_item.sent_to_kitchen_at = datetime.utcnow()

    order.order_status = "sent"
    order.kitchen_status = "to_cook"
    db.commit()
    db.refresh(order)

    await manager.broadcast_all({
        "event": "order_sent_to_kitchen",
        "order_id": order.id,
        "table_id": order.table_id,
        "bill_number": order.bill_number,
    })
    await _broadcast_pos_sync(table_id=order.table_id, order_id=order.id, event="order_status_changed")

    return OrderResponse.model_validate(order).model_dump()


@router.get("/orders/{order_id}/bill-summary", dependencies=[operational_dependency])
def bill_summary(
    order_id: int,
    coupon_code: Optional[str] = None,
    redeem_points: int = 0,
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    customer = db.query(User).filter(User.id == order.user_id).first()
    return calculate_bill_breakdown(db, order, coupon_code=coupon_code, redeem_points=redeem_points, customer=customer)


@router.post("/orders/{order_id}/payment", dependencies=[operational_dependency])
async def complete_order_payment(
    order_id: int,
    payment_method: str,
    coupon_code: Optional[str] = None,
    redeem_points: int = 0,
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if payment_method not in ["cash", "card", "upi", "digital", "wallet"]:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    customer = db.query(User).filter(User.id == order.user_id).first()
    breakdown = calculate_bill_breakdown(db, order, coupon_code=coupon_code, redeem_points=redeem_points, customer=customer)
    order.discount_amount = Decimal(str(breakdown["total_discount"]))
    order.total_amount = Decimal(str(breakdown["total_amount"]))
    order.subtotal_amount = Decimal(str(breakdown["subtotal"]))
    order.tax_amount = Decimal(str(breakdown["tax"]))
    order.coupon_code = breakdown["coupon_code"]
    order.loyalty_points_earned = breakdown["loyalty_points_earned"]

    if customer:
        customer.loyalty_points = (customer.loyalty_points or 0) + breakdown["loyalty_points_earned"] - breakdown["loyalty_points_redeemed"]
        customer.loyalty_points = max(0, customer.loyalty_points)
        loyalty_account = db.query(LoyaltyAccount).filter(LoyaltyAccount.user_id == customer.id).first()
        if not loyalty_account:
            loyalty_account = LoyaltyAccount(user_id=customer.id, total_points=0, lifetime_spend=Decimal("0.00"))
            db.add(loyalty_account)
        loyalty_account.total_points = (loyalty_account.total_points or 0) + breakdown["loyalty_points_earned"] - breakdown["loyalty_points_redeemed"]
        loyalty_account.total_points = max(0, loyalty_account.total_points)
        loyalty_account.lifetime_spend = (loyalty_account.lifetime_spend or Decimal("0.00")) + Decimal(str(breakdown["total_amount"]))

    order.payment_method = payment_method
    order.payment_status = "completed"
    order.order_status = "completed"
    order.closed_at = datetime.utcnow()

    table = None
    if order.table_id:
        table = db.query(RestaurantTable).filter(RestaurantTable.id == order.table_id).first()
        if table:
            table.status = "available"
            table.active_order_id = None
            table.active_cashier_id = None

    session = None
    if order.session_id:
        session = db.query(TableSession).filter(TableSession.id == order.session_id).first()
        if session:
            session.status = "closed"
            session.closed_at = datetime.utcnow()

    db.commit()
    db.refresh(order)

    await manager.broadcast_all({
        "event": "order_paid",
        "order_id": order.id,
        "table_id": order.table_id,
        "bill_number": order.bill_number,
        "payment_status": order.payment_status,
    })
    if table:
        await manager.broadcast_all({
            "event": "table_status_changed",
            "table_id": table.id,
            "status": table.status,
        })
    await _broadcast_pos_sync(table_id=order.table_id, order_id=order.id, event="payment_completed")

    payload = OrderResponse.model_validate(order).model_dump()
    payload["billing_breakdown"] = breakdown
    return payload


@router.get("/orders", dependencies=[operational_dependency])
def list_cashier_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(100).all()
    return [OrderResponse.model_validate(order).model_dump() for order in orders]

@router.post("/checkout", dependencies=[operational_dependency])
async def cashier_checkout(checkout_in: CashierCheckout, cashier: User = Depends(require_role(["cashier", "admin", "superadmin"])), db: Session = Depends(get_db)):
    # Find customer user
    customer = None
    if checkout_in.customer_roll != "WALKIN":
        customer = db.query(User).filter(
            (User.roll_no == checkout_in.customer_roll) |
            (User.email == checkout_in.customer_roll) |
            (User.phone_no == checkout_in.customer_roll)
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
            
    # Calculate total
    total_amount = Decimal("0.00")
    order_items_payload = {}
    db_items_to_update = []
    
    for item in checkout_in.items:
        food_item = db.query(FoodItem).filter(FoodItem.id == item.id).first()
        if not food_item or not food_item.is_active:
            raise HTTPException(status_code=400, detail=f"Item {item.name} not active")
            
        if food_item.quantity_available < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {food_item.name}")
            
        price_to_use = food_item.cash_price if (checkout_in.payment_method == "cash" and food_item.cash_price is not None) else food_item.price
        item_total = price_to_use * item.quantity
        total_amount += item_total
        
        order_items_payload[food_item.name] = {
            "quantity": item.quantity,
            "rate": f"{price_to_use:.2f}",
            "total": float(item_total)
        }
        db_items_to_update.append((food_item, item.quantity))

    bill_number = generate_cashier_bill_number(db)
    
    # Handle wallet payment if applicable
    if checkout_in.payment_method == "wallet":
        if not customer:
            raise HTTPException(status_code=400, detail="Wallet payments require a registered user")
        balance = customer.get_balance()
        if balance < float(total_amount):
            raise HTTPException(status_code=400, detail="Insufficient user wallet balance")
            
        customer.set_balance(balance - float(total_amount))
        
        # Log credit transaction
        tx = WalletTransaction(
            user_id=customer.id,
            transaction_type="debit",
            amount=total_amount,
            description="Counter purchase (Wallet)",
            performed_by=cashier.id
        )
        db.add(tx)

    # Perform updates & insert order
    for food_item, qty in db_items_to_update:
        food_item.quantity_available -= qty
        
    customer_id = customer.id if customer else _get_walkin_customer(db).id
    
    new_order = Order(
        user_id=customer_id,
        bill_number=bill_number,
        total_amount=total_amount,
        items=order_items_payload,
        payment_method=checkout_in.payment_method,
        payment_status="completed",
        bill_printed=True,
        print_status="printed",
        printed_at=datetime.utcnow()
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Trigger websocket updates
    await manager.broadcast_all({
        "event": "order_created",
        "bill_number": bill_number,
        "total_amount": float(total_amount)
    })
    
    # Return details
    change = float(checkout_in.amount_received - total_amount) if checkout_in.payment_method == "cash" else 0.0
    return {
        "success": True,
        "bill_number": bill_number,
        "total_amount": float(total_amount),
        "change_amount": max(0.0, change)
    }

@router.get("/stock-report", response_model=List[FoodItemResponse], dependencies=[operational_dependency])
def get_stock_report(db: Session = Depends(get_db)):
    return db.query(FoodItem).all()

@router.post("/update-stock", dependencies=[inventory_dependency])
async def update_stock(item_id: int, quantity: int, cashier: User = Depends(require_role(["cashier", "inventory_manager", "admin", "superadmin"])), db: Session = Depends(get_db)):
    food_item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not food_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    before_qty = food_item.quantity_available
    food_item.quantity_available = quantity
    food_item.last_stock_update = datetime.utcnow()
    
    # Log stock change
    log = StockAuditLog(
        actor_id=cashier.id,
        actor_roll_no=cashier.roll_no,
        actor_role=cashier.role,
        action="update",
        food_item_id=food_item.id,
        food_item_name=food_item.name,
        before_quantity=before_qty,
        after_quantity=quantity,
        change_amount=quantity - before_qty
    )
    db.add(log)
    db.commit()
    
    # Broadcast to websocket client types (cashiers / students)
    await manager.broadcast_all({
        "event": "stock_updated",
        "item_id": item_id,
        "quantity": quantity
    })
    
    return {"success": True, "new_quantity": quantity}
