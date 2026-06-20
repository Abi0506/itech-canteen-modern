from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime, date
from typing import Dict, Any

from app.db.session import get_db
from app.db.models import Order, Payment, PaymentMethod, User, TableMaster, Coupon, LoyaltyCredit, LoyaltyTransaction, TableSession
from app.routes.auth import require_role
from app.routes.websockets import manager

router = APIRouter(prefix="/payments", tags=["payments"])

payment_dependency = Depends(require_role(["cashier", "superadmin"]))

@router.post("/process")
async def process_payment(payload: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    order_id = payload.get("order_id")
    method_id = payload.get("payment_method_id")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == 'paid':
        raise HTTPException(status_code=400, detail="Order is already paid")
        
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method or not method.is_enabled:
        raise HTTPException(status_code=400, detail="Invalid or disabled payment method")
        
    received = Decimal(str(payload.get("amount_received", order.total)))
    change = received - order.total
    if change < 0 and method.type == 'cash':
         raise HTTPException(status_code=400, detail="Received amount is less than order total")
         
    # Create payment record
    payment = Payment(
        order_id=order.id,
        payment_method_id=method_id,
        amount=order.total,
        amount_received=received,
        change_due=change if change > 0 else Decimal("0.00"),
        reference_code=payload.get("reference_code"),
        status="success",
        received_by=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(payment)
    
    # Update order
    order.status = "paid"
    db.commit()
    
    # Reserve the table
    if order.table_id:
        table = db.query(TableMaster).filter(TableMaster.id == order.table_id).first()
        if table:
            table.current_status = 'reserved'
            db.commit()
            
    # Calculate Loyalty Credits: 1 point per Rs.10 spent
    if order.customer_id:
        points_earned = int(order.total // 10)
        if points_earned > 0:
            loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == order.customer_id).first()
            if not loyalty:
                loyalty = LoyaltyCredit(
                    customer_id=order.customer_id,
                    credits_earned=points_earned,
                    total_credits=points_earned,
                    last_visit_at=datetime.utcnow()
                )
                db.add(loyalty)
            else:
                loyalty.credits_earned += points_earned
                loyalty.total_credits += points_earned
                loyalty.last_visit_at = datetime.utcnow()
                
            db.commit()
            
            # Record ledger transaction
            tx = LoyaltyTransaction(
                customer_id=order.customer_id,
                order_id=order.id,
                type='earn',
                amount=points_earned,
                created_at=datetime.utcnow()
            )
            db.add(tx)
            db.commit()
            
    # Broadcast to frontend
    await manager.broadcast_all({
        "event": "payment_completed",
        "order_id": order.id,
        "table_id": order.table_id,
        "total": float(order.total)
    })
    
    return {
        "success": True,
        "order_id": order.id,
        "status": order.status,
        "change_due": float(payment.change_due)
    }

@router.post("/apply-coupon")
def apply_coupon(payload: Dict[str, Any], db: Session = Depends(get_db)):
    order_id = payload.get("order_id")
    code = payload.get("code", "").upper().strip()
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    coupon = db.query(Coupon).filter(Coupon.code == code, Coupon.is_active == True).first()
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")

    if coupon.discount_type == "percent" and coupon.value > Decimal("100"):
        raise HTTPException(status_code=400, detail="Coupon configuration is invalid: percentage discount cannot exceed 100")
        
    # Check valid dates
    today = date.today()
    if coupon.valid_from and coupon.valid_from > today:
        raise HTTPException(status_code=400, detail="Coupon is not yet active")
    if coupon.valid_until and coupon.valid_until < today:
        raise HTTPException(status_code=400, detail="Coupon has expired")
        
    # Check max uses
    same_coupon_already_applied = order.coupon_id == coupon.id
    if coupon.max_uses and coupon.used_count >= coupon.max_uses and not same_coupon_already_applied:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
        
    # Apply discount
    discount = Decimal("0.00")
    if coupon.discount_type == 'percent':
        discount = order.subtotal * (coupon.value / Decimal("100.00"))
    else:
        discount = coupon.value
        
    # Limit discount to subtotal
    if discount > order.subtotal:
        discount = order.subtotal
        
    # Keep usage counts consistent when replacing coupon on an order.
    if order.coupon_id and order.coupon_id != coupon.id:
        previous_coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if previous_coupon and previous_coupon.used_count > 0:
            previous_coupon.used_count -= 1

    order.coupon_id = coupon.id
    order.discount_total = discount
    order.total = order.subtotal + order.tax_total - discount
    if not same_coupon_already_applied:
        coupon.used_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "coupon_code": coupon.code,
        "discount_amount": float(discount),
        "new_total": float(order.total)
    }
