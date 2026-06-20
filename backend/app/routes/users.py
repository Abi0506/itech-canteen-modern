from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date
import random
import json
from typing import List

from app.db.session import get_db
from app.db.models import User, Category, FoodItem, Order, OrderItem, Idea, IdeaUpvote, WalletTransaction
from app.models.schemas import UserResponse, CategoryResponse, FoodItemResponse, UserCheckout, OrderResponse, IdeaCreate, IdeaResponse
from app.routes.auth import get_current_user
from app.routes.websockets import manager

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        roll_no=current_user.roll_no,
        display_name=current_user.display_name,
        email=current_user.email,
        phone_no=current_user.phone_no,
        role=current_user.role,
        user_type=current_user.user_type,
        wallet_balance=current_user.get_balance(),
        email_verified=current_user.email_verified,
        favourites=current_user.favourites or [],
        bulk_order_enabled=current_user.bulk_order_enabled,
        loyalty_points=current_user.loyalty_points or 0,
        created_at=current_user.created_at
    )

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).filter(Category.is_active == True).all()
    result = []
    for cat in categories:
        items = db.query(FoodItem).filter(
            FoodItem.category_id == cat.id, 
            FoodItem.is_active == True
        ).all()
        result.append({
            "id": cat.id,
            "name": cat.name,
            "items": [FoodItemResponse.from_orm(item) for item in items]
        })
    return result

@router.post("/favourites/toggle")
def toggle_favourite(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify item exists
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    favs = list(current_user.favourites or [])
    if item_id in favs:
        favs.remove(item_id)
        is_fav = False
    else:
        favs.append(item_id)
        is_fav = True
        
    current_user.favourites = favs
    db.commit()
    return {"is_favourite": is_fav, "favourites": favs}

def generate_bill_number(db: Session) -> str:
    # Format: C1 + ymd + 4-digit sequence + 2-digit random
    date_str = datetime.utcnow().strftime("%y%m%d")
    # Count orders today
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(Order).filter(Order.created_at >= today_start).count()
    formatted_counter = f"{count + 1:04d}"
    rand_suffix = f"{random.randint(10, 99)}"
    return f"C1{date_str}{formatted_counter}{rand_suffix}"

@router.post("/checkout")
async def checkout(checkout_in: UserCheckout, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not checkout_in.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    total_amount = Decimal("0.00")
    order_items_payload = {}
    db_items_to_update = []
    
    # Verify stock and calculate price
    for item in checkout_in.items:
        food_item = db.query(FoodItem).filter(FoodItem.id == item.food_item_id).first()
        if not food_item or not food_item.is_active:
            raise HTTPException(status_code=400, detail=f"Item {item.food_item_id} is no longer available.")
            
        if food_item.quantity_available < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {food_item.name}. Available: {food_item.quantity_available}")
            
        item_total = food_item.price * item.quantity
        total_amount += item_total
        
        # Build items JSON for order
        order_items_payload[food_item.name] = {
            "quantity": item.quantity,
            "rate": f"{food_item.price:.2f}",
            "total": float(item_total)
        }
        
        db_items_to_update.append((food_item, item.quantity))

    bill_number = generate_bill_number(db)
    
    if checkout_in.payment_method == "wallet":
        balance = current_user.get_balance()
        if balance < float(total_amount):
            raise HTTPException(status_code=400, detail="Insufficient wallet balance.")
            
        # Deduct balance
        new_balance = balance - float(total_amount)
        current_user.set_balance(new_balance)
        
        # Create order
        new_order = Order(
            user_id=current_user.id,
            bill_number=bill_number,
            total_amount=total_amount,
            items=order_items_payload,
            payment_method="wallet",
            payment_status="completed",
            wallet_amount=total_amount
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        
        # Create transaction log
        tx = WalletTransaction(
            user_id=current_user.id,
            transaction_type="debit",
            amount=total_amount,
            description="Order payment",
            order_id=new_order.id
        )
        db.add(tx)
        
        # Deduct food item stock
        for food_item, qty in db_items_to_update:
            food_item.quantity_available -= qty
            
        db.commit()
        
        # Notify WebSocket channels (admin/cashier monitors)
        await manager.broadcast_all({
            "event": "order_created",
            "bill_number": bill_number,
            "total_amount": float(total_amount)
        })
        
        return {
            "success": True, 
            "payment_status": "completed", 
            "bill_number": bill_number, 
            "order_id": new_order.id
        }

    elif checkout_in.payment_method == "razorpay":
        # Create pending order
        # Simulate Razorpay order creation
        razorpay_order_id = f"order_{uuid_mock()}"
        new_order = Order(
            user_id=current_user.id,
            bill_number=bill_number,
            total_amount=total_amount,
            items=order_items_payload,
            payment_method="razorpay",
            payment_status="pending",
            razorpay_order_id=razorpay_order_id,
            online_amount=total_amount
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        
        return {
            "success": True,
            "payment_status": "pending",
            "bill_number": bill_number,
            "order_id": new_order.id,
            "razorpay_order_id": razorpay_order_id,
            "amount": float(total_amount)
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid payment method")

def uuid_mock() -> str:
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(random.choice(chars) for _ in range(14))

@router.post("/razorpay/verify")
async def verify_payment(order_id: int, payment_id: str, signature: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Standard Razorpay verification (mock for testing/simplicity or real implementation)
    # We mark payment completed and deduct stock here
    order.payment_status = "completed"
    order.razorpay_payment_id = payment_id
    
    # Deduct stock of items
    for item_name, details in order.items.items():
        food_item = db.query(FoodItem).filter(FoodItem.name == item_name).first()
        if food_item:
            qty = details.get("quantity", 0)
            if food_item.quantity_available >= qty:
                food_item.quantity_available -= qty
                
    # Notify live monitor
    await manager.broadcast_all({
        "event": "order_created",
        "bill_number": order.bill_number,
        "total_amount": float(order.total_amount)
    })
    
    return {"success": True, "bill_number": order.bill_number}

@router.get("/orders", response_model=List[OrderResponse])
def get_orders(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.user_id == current_user.id).order_by(Order.created_at.desc()).all()
    return orders

# ── Idea Board ─────────────────────────────────────────────────────────────
@router.get("/ideas", response_model=List[IdeaResponse])
def get_ideas(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ideas = db.query(Idea).filter(Idea.status == "approved").order_by(Idea.upvotes.desc()).all()
    result = []
    for idea in ideas:
        is_upvoted = db.query(IdeaUpvote).filter(
            IdeaUpvote.idea_id == idea.id, 
            IdeaUpvote.user_id == current_user.id
        ).first() is not None
        
        result.append(IdeaResponse(
            id=idea.id,
            user_id=idea.user_id,
            title=idea.title,
            description=idea.description,
            upvotes=idea.upvotes,
            status=idea.status,
            created_at=idea.created_at,
            is_upvoted=is_upvoted
        ))
    return result

@router.post("/ideas", response_model=IdeaResponse)
def create_idea(idea_in: IdeaCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_idea = Idea(
        user_id=current_user.id,
        title=idea_in.title,
        description=idea_in.description,
        status="approved" # Auto approve for demo/testing or standard PHP defaults
    )
    db.add(new_idea)
    db.commit()
    db.refresh(new_idea)
    return IdeaResponse(
        id=new_idea.id,
        user_id=new_idea.user_id,
        title=new_idea.title,
        description=new_idea.description,
        upvotes=new_idea.upvotes,
        status=new_idea.status,
        created_at=new_idea.created_at,
        is_upvoted=False
    )

@router.post("/ideas/{idea_id}/upvote")
def upvote_idea(idea_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
        
    upvote = db.query(IdeaUpvote).filter(
        IdeaUpvote.idea_id == idea_id, 
        IdeaUpvote.user_id == current_user.id
    ).first()
    
    if upvote:
        # Undo upvote
        db.delete(upvote)
        idea.upvotes -= 1
        is_upvoted = False
    else:
        # Create upvote
        new_upvote = IdeaUpvote(idea_id=idea_id, user_id=current_user.id)
        db.add(new_upvote)
        idea.upvotes += 1
        is_upvoted = True
        
    db.commit()
    return {"upvotes": idea.upvotes, "is_upvoted": is_upvoted}

# ── Wrapped Summary (Recap) ──────────────────────────────────────────────────
@router.get("/wrapped")
def get_wrapped(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Total spent, total orders, favorite item
    orders = db.query(Order).filter(Order.user_id == current_user.id, Order.payment_status == "completed").all()
    total_orders = len(orders)
    total_spent = sum(float(o.total_amount) for o in orders)
    
    # Calculate favorite item
    item_counts = {}
    for o in orders:
        for item_name, details in o.items.items():
            qty = details.get("quantity", 0)
            item_counts[item_name] = item_counts.get(item_name, 0) + qty
            
    fav_item = max(item_counts, key=item_counts.get) if item_counts else None
    fav_qty = item_counts.get(fav_item, 0) if fav_item else 0
    
    return {
        "total_orders": total_orders,
        "total_spent": total_spent,
        "favorite_item": fav_item,
        "favorite_quantity": fav_qty
    }
