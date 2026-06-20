from decimal import Decimal
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Tuple

from app.db.models import Order, Promotion, Coupon, CouponTarget

TAX_RATE = Decimal("0.05")

def _is_promotion_valid(promotion: Promotion) -> bool:
    if not promotion.is_active:
        return False
    now = date.today()
    if promotion.valid_from and promotion.valid_from > now:
        return False
    if promotion.valid_until and promotion.valid_until < now:
        return False
    return True

def _is_coupon_valid_for_customer(db: Session, coupon: Coupon, customer_id: int | None) -> bool:
    targets = db.query(CouponTarget).filter(CouponTarget.coupon_id == coupon.id).all()
    if not targets:
        return True # Global coupon
    if not customer_id:
        return False # Targeted coupon but no customer
    
    target_ids = [t.customer_id for t in targets]
    return customer_id in target_ids

def recalculate_order_totals(db: Session, order: Order) -> Tuple[Decimal, Decimal, Decimal, Decimal, List[str]]:
    """
    Recalculates the order's subtotal, tax, discount, and total.
    Returns (subtotal, tax_total, discount_total, total, applied_promotions)
    It does not commit to the database, but it updates the order object's fields.
    """
    subtotal = sum((Decimal(str(item.line_total)) for item in order.items), Decimal("0.00"))
    
    # Calculate Promotion Discounts
    promotions = db.query(Promotion).all()
    promo_discount = Decimal("0.00")
    applied_promotions = []
    
    for promo in promotions:
        if not _is_promotion_valid(promo):
            continue
            
        discount_amount = Decimal("0.00")
        
        if promo.scope == "order":
            if promo.min_order_amount and subtotal >= Decimal(str(promo.min_order_amount)):
                if promo.discount_type == "percent":
                    discount_amount = subtotal * (Decimal(str(promo.value)) / Decimal("100"))
                else:
                    discount_amount = Decimal(str(promo.value))
                    
        elif promo.scope == "product" and promo.product_id:
            # Find matching items
            matching_items = [item for item in order.items if item.product_id == promo.product_id]
            total_qty = sum(Decimal(str(item.quantity)) for item in matching_items)
            
            if promo.min_quantity and total_qty >= Decimal(str(promo.min_quantity)):
                # Calculate discount based on items' value
                item_total = sum(Decimal(str(item.line_total)) for item in matching_items)
                if promo.discount_type == "percent":
                    discount_amount = item_total * (Decimal(str(promo.value)) / Decimal("100"))
                else:
                    # Flat discount applied once if conditions met
                    discount_amount = Decimal(str(promo.value))
                    
        if discount_amount > 0:
            promo_discount += discount_amount
            applied_promotions.append(promo.name)
            
    # Calculate Coupon Discount
    coupon_discount = Decimal("0.00")
    if order.coupon_id:
        coupon = db.query(Coupon).filter(Coupon.id == order.coupon_id).first()
        if coupon and coupon.is_active:
            now = date.today()
            is_valid_date = True
            if coupon.valid_from and coupon.valid_from > now:
                is_valid_date = False
            if coupon.valid_until and coupon.valid_until < now:
                is_valid_date = False
                
            is_valid_uses = True
            if coupon.max_uses and coupon.used_count >= coupon.max_uses:
                is_valid_uses = False
                
            is_eligible = _is_coupon_valid_for_customer(db, coupon, order.customer_id)
            
            if is_valid_date and is_valid_uses and is_eligible:
                if coupon.discount_type == "percent":
                    coupon_discount = subtotal * (Decimal(str(coupon.value)) / Decimal("100"))
                else:
                    coupon_discount = Decimal(str(coupon.value))
            else:
                # If coupon became invalid, maybe clear it or leave it 0
                pass

    total_discount = min(subtotal, promo_discount + coupon_discount)
    tax_total = subtotal * TAX_RATE
    total = max(Decimal("0.00"), subtotal + tax_total - total_discount)
    
    order.subtotal = subtotal
    order.tax_total = tax_total
    order.discount_total = total_discount
    order.total = total
    
    # Return values in case caller wants to know applied promotions
    return subtotal, tax_total, total_discount, total, applied_promotions
