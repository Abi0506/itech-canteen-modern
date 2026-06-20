from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
import math

from app.db.session import get_db
from app.db.models import LoyaltyCredit, LoyaltyTransaction, Customer
from app.routes.auth import require_role

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

# Points configuration
POINTS_PER_100 = 1          # 1 point per Rs. 100
REWARD_THRESHOLD = 50       # 50 points to claim reward
FREE_DRINK_NAME = "Signature Drink"  # Name of the free drink reward


def _get_or_create_loyalty(db: Session, customer_id: int) -> LoyaltyCredit:
    """Get or create loyalty record for a customer."""
    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    if not loyalty:
        loyalty = LoyaltyCredit(
            customer_id=customer_id,
            credits_earned=0,
            credits_redeemed=0,
            total_credits=0,
        )
        db.add(loyalty)
        db.flush()
    return loyalty


def award_loyalty_points(db: Session, customer_id: int, order_id: int, order_total: float) -> int:
    """
    Award loyalty points based on order total.
    1 point per Rs. 100. Returns number of points awarded.
    Only awards points if customer is not a guest.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer or customer.is_guest:
        return 0

    points = int(float(order_total) // 100)  # 1 point per Rs. 100
    if points <= 0:
        return 0

    loyalty = _get_or_create_loyalty(db, customer_id)
    loyalty.credits_earned += points
    loyalty.total_credits += points
    loyalty.last_visit_at = datetime.utcnow()

    tx = LoyaltyTransaction(
        customer_id=customer_id,
        order_id=order_id,
        type='earn',
        amount=points,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    return points


def _serialize_loyalty(loyalty: LoyaltyCredit, customer: Customer) -> Dict[str, Any]:
    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "mobile_number": customer.mobile_number,
            "email": customer.email,
        },
        "points": {
            "total": loyalty.total_credits if loyalty else 0,
            "earned": loyalty.credits_earned if loyalty else 0,
            "redeemed": loyalty.credits_redeemed if loyalty else 0,
            "last_visit_at": loyalty.last_visit_at if loyalty else None,
        },
        "can_claim_reward": (loyalty.total_credits if loyalty else 0) >= REWARD_THRESHOLD,
        "reward_threshold": REWARD_THRESHOLD,
        "free_drink_name": FREE_DRINK_NAME,
        "points_per_100": POINTS_PER_100,
    }


@router.get("/info")
def get_loyalty_info(customer_id: int, db: Session = Depends(get_db)):
    """Get loyalty info for a customer by ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    txs = (
        db.query(LoyaltyTransaction)
        .filter(LoyaltyTransaction.customer_id == customer_id)
        .order_by(LoyaltyTransaction.created_at.desc())
        .limit(20)
        .all()
    )
    tx_list = [
        {
            "id": t.id,
            "order_id": t.order_id,
            "type": t.type,
            "amount": t.amount,
            "created_at": t.created_at,
        }
        for t in txs
    ]

    return {
        **_serialize_loyalty(loyalty, customer),
        "transactions": tx_list,
    }


@router.get("/by-phone")
def get_loyalty_by_phone(phone: str, db: Session = Depends(get_db)):
    """Get loyalty info by phone number (used during ordering flow)."""
    import re
    cleaned = re.sub(r"\D+", "", phone or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Phone number is required")

    from sqlalchemy.sql import or_
    customer = (
        db.query(Customer)
        .filter(
            Customer.mobile_number == cleaned,
            Customer.is_guest == False,  # noqa: E712
        )
        .first()
    )
    if not customer:
        return {"found": False, "points": 0, "can_claim_reward": False}

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer.id).first()
    return {
        "found": True,
        **_serialize_loyalty(loyalty, customer),
    }


@router.post("/{customer_id}/claim-reward")
def claim_loyalty_reward(customer_id: int, db: Session = Depends(get_db)):
    """
    Claim the loyalty reward when customer has >= 50 points.
    Points reset to 0 after claiming. Returns free drink details.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    if not loyalty or loyalty.total_credits < REWARD_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient loyalty points. Need {REWARD_THRESHOLD} points to claim reward.",
        )

    points_before = loyalty.total_credits
    loyalty.credits_redeemed += REWARD_THRESHOLD
    loyalty.total_credits -= REWARD_THRESHOLD

    tx = LoyaltyTransaction(
        customer_id=customer_id,
        order_id=None,
        type='redeem',
        amount=REWARD_THRESHOLD,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    db.commit()
    db.refresh(loyalty)

    return {
        "success": True,
        "message": f"Reward claimed! {customer.name} gets a free {FREE_DRINK_NAME}.",
        "free_drink": FREE_DRINK_NAME,
        "points_used": REWARD_THRESHOLD,
        "remaining_points": loyalty.total_credits,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "mobile_number": customer.mobile_number,
        },
    }


@router.post("/{customer_id}/redeem")
def redeem_loyalty_credits(
    customer_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """Legacy redeem endpoint - partial redemption."""
    points = int(payload.get("points", 0))
    if points <= 0:
        raise HTTPException(status_code=400, detail="Points to redeem must be greater than zero")

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    if not loyalty or loyalty.total_credits < points:
        raise HTTPException(status_code=400, detail="Insufficient loyalty credits")

    loyalty.credits_redeemed += points
    loyalty.total_credits -= points

    tx = LoyaltyTransaction(
        customer_id=customer_id,
        type='redeem',
        amount=points,
        created_at=datetime.utcnow(),
    )
    db.add(tx)
    db.commit()

    return {
        "success": True,
        "remaining_credits": loyalty.total_credits,
    }


# Keep old endpoint for backward compatibility
@router.get("/{customer_id}")
def get_loyalty_info_by_id(customer_id: int, db: Session = Depends(get_db)):
    """Get loyalty info by customer ID (legacy endpoint)."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    credits = {
        "earned": loyalty.credits_earned if loyalty else 0,
        "redeemed": loyalty.credits_redeemed if loyalty else 0,
        "total": loyalty.total_credits if loyalty else 0,
        "last_visit_at": loyalty.last_visit_at if loyalty else None,
    }

    txs = (
        db.query(LoyaltyTransaction)
        .filter(LoyaltyTransaction.customer_id == customer_id)
        .order_by(LoyaltyTransaction.created_at.desc())
        .all()
    )
    tx_list = [
        {
            "id": t.id,
            "order_id": t.order_id,
            "type": t.type,
            "amount": t.amount,
            "created_at": t.created_at,
        }
        for t in txs
    ]

    return {
        "customer": {"id": customer.id, "name": customer.name, "mobile_number": customer.mobile_number},
        "loyalty": credits,
        "transactions": tx_list,
    }
