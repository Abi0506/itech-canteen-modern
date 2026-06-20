from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date
import random

from app.db.session import get_db
from app.db.models import User, FoodItem, Order, OrderItem, WalletTransaction, StockAuditLog
from app.models.schemas import CashierCheckout, FoodItemResponse
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/cashier", tags=["cashier"])

# Enforce cashier or admin roles
cashier_dependency = Depends(require_role(["cashier", "admin"]))

@router.get("/dashboard-stats", dependencies=[cashier_dependency])
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

@router.get("/search-user", dependencies=[cashier_dependency])
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

@router.post("/recharge-wallet", dependencies=[cashier_dependency])
def recharge_wallet(user_id: int, amount: float, cashier: User = Depends(require_role(["cashier", "admin"])), db: Session = Depends(get_db)):
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

@router.post("/checkout", dependencies=[cashier_dependency])
async def cashier_checkout(checkout_in: CashierCheckout, cashier: User = Depends(require_role(["cashier", "admin"])), db: Session = Depends(get_db)):
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
        
    customer_id = customer.id if customer else 92 # Map to WALKIN user ID (92 or similar placeholder from backup script)
    
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

@router.get("/stock-report", response_model=List[FoodItemResponse], dependencies=[cashier_dependency])
def get_stock_report(db: Session = Depends(get_db)):
    return db.query(FoodItem).all()

@router.post("/update-stock", dependencies=[cashier_dependency])
async def update_stock(item_id: int, quantity: int, cashier: User = Depends(require_role(["cashier", "admin"])), db: Session = Depends(get_db)):
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
