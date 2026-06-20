from decimal import Decimal
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Coupon, LoyaltyAccount, Order, Promotion, User

LOYALTY_EARN_THRESHOLD = Decimal("100.00")
LOYALTY_REDEMPTION_POINTS = 100
LOYALTY_REDEMPTION_VALUE = Decimal("50.00")


def _promotion_active(promotion: Promotion, now: datetime | None = None) -> bool:
    current_time = now or datetime.utcnow()
    if promotion.starts_at and promotion.starts_at > current_time:
        return False
    if promotion.ends_at and promotion.ends_at < current_time:
        return False
    return promotion.is_active


def get_coupon_or_none(db: Session, coupon_code: str | None) -> Coupon | None:
    if not coupon_code:
        return None
    return db.query(Coupon).filter(Coupon.code == coupon_code.upper(), Coupon.is_active == True).first()


def calculate_coupon_discount(subtotal: Decimal, coupon: Coupon | None) -> Decimal:
    if not coupon:
        return Decimal("0.00")
    if coupon.minimum_order_amount and subtotal < coupon.minimum_order_amount:
        return Decimal("0.00")

    if coupon.discount_type == "percentage":
        discount = subtotal * (Decimal(coupon.discount_value) / Decimal("100"))
        if coupon.maximum_discount_amount is not None:
            discount = min(discount, Decimal(coupon.maximum_discount_amount))
    else:
        discount = Decimal(coupon.discount_value)
    return min(discount, subtotal)


def calculate_promotion_discount(order: Order, db: Session) -> Decimal:
    subtotal = Decimal(order.subtotal_amount or Decimal("0.00"))
    order_items = order.items or {}
    discounts = Decimal("0.00")

    promotions = db.query(Promotion).filter(Promotion.is_active == True).all()
    for promotion in promotions:
        if not _promotion_active(promotion):
            continue

        if promotion.target_type == "order":
            if promotion.minimum_order_amount and subtotal < promotion.minimum_order_amount:
                continue
            if promotion.discount_type == "percentage":
                discounts += subtotal * (Decimal(promotion.discount_value) / Decimal("100"))
            else:
                discounts += Decimal(promotion.discount_value)
            continue

        if promotion.target_type == "product" and promotion.target_id:
            item_payload = order_items.get(str(promotion.target_id))
            if not item_payload:
                continue
            quantity = Decimal(item_payload.get("quantity", 0))
            if promotion.minimum_quantity and quantity < promotion.minimum_quantity:
                continue
            line_total = Decimal(item_payload.get("rate", "0.00")) * quantity
            if promotion.discount_type == "percentage":
                discounts += line_total * (Decimal(promotion.discount_value) / Decimal("100"))
            else:
                discounts += Decimal(promotion.discount_value) * quantity

    return min(discounts, subtotal)


def calculate_loyalty_redeem_discount(customer: User, redeem_points: int, subtotal: Decimal) -> tuple[Decimal, int]:
    if redeem_points <= 0:
        return Decimal("0.00"), 0

    available_points = int(customer.loyalty_points or 0)
    redeemable_points = min(redeem_points, available_points)
    redeemable_points -= redeemable_points % LOYALTY_REDEMPTION_POINTS
    if redeemable_points <= 0:
        return Decimal("0.00"), 0

    discount_units = redeemable_points // LOYALTY_REDEMPTION_POINTS
    discount = Decimal(discount_units) * LOYALTY_REDEMPTION_VALUE
    return min(discount, subtotal), redeemable_points


def calculate_bill_breakdown(
    db: Session,
    order: Order,
    coupon_code: str | None = None,
    redeem_points: int = 0,
    customer: User | None = None,
) -> dict:
    subtotal = Decimal(order.subtotal_amount or Decimal("0.00"))
    tax = Decimal(order.tax_amount or Decimal("0.00"))
    coupon = get_coupon_or_none(db, coupon_code or order.coupon_code)
    coupon_discount = calculate_coupon_discount(subtotal, coupon)
    promotion_discount = calculate_promotion_discount(order, db)

    loyalty_discount = Decimal("0.00")
    points_redeemed = 0
    if customer is not None:
        loyalty_discount, points_redeemed = calculate_loyalty_redeem_discount(customer, redeem_points, subtotal - coupon_discount - promotion_discount)

    total_discount = min(subtotal, coupon_discount + promotion_discount + loyalty_discount)
    bill_total = max(Decimal("0.00"), subtotal + tax - total_discount)
    points_earned = int(bill_total // LOYALTY_EARN_THRESHOLD)

    return {
        "subtotal": float(subtotal),
        "tax": float(tax),
        "coupon_code": coupon.code if coupon else None,
        "coupon_discount": float(coupon_discount),
        "promotion_discount": float(promotion_discount),
        "loyalty_discount": float(loyalty_discount),
        "total_discount": float(total_discount),
        "total_amount": float(bill_total),
        "loyalty_points_earned": points_earned,
        "loyalty_points_redeemed": points_redeemed,
        "loyalty_redeem_value": float(LOYALTY_REDEMPTION_VALUE),
    }

