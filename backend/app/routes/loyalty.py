from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any

from app.db.session import get_db
from app.db.models import LoyaltyCredit, LoyaltyTransaction, Customer
from app.routes.auth import require_role

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

@router.get("/{customer_id}")
def get_loyalty_info(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    credits = {
        "earned": loyalty.credits_earned if loyalty else 0,
        "redeemed": loyalty.credits_redeemed if loyalty else 0,
        "total": loyalty.total_credits if loyalty else 0,
        "last_visit_at": loyalty.last_visit_at if loyalty else None
    }
    
    txs = db.query(LoyaltyTransaction).filter(LoyaltyTransaction.customer_id == customer_id).order_by(LoyaltyTransaction.created_at.desc()).all()
    tx_list = [
        {
            "id": t.id,
            "order_id": t.order_id,
            "type": t.type,
            "amount": t.amount,
            "created_at": t.created_at
        }
        for t in txs
    ]
    
    return {
        "customer": {"id": customer.id, "name": customer.name, "mobile_number": customer.mobile_number},
        "loyalty": credits,
        "transactions": tx_list
    }

@router.post("/{customer_id}/redeem")
def redeem_loyalty_credits(customer_id: int, points: int, db: Session = Depends(get_db)):
    if points <= 0:
        raise HTTPException(status_code=400, detail="Points to redeem must be greater than zero")
        
    loyalty = db.query(LoyaltyCredit).filter(LoyaltyCredit.customer_id == customer_id).first()
    if not loyalty or loyalty.total_credits < points:
        raise HTTPException(status_code=400, detail="Insufficient loyalty credits")
        
    loyalty.credits_redeemed += points
    loyalty.total_credits -= points
    db.commit()
    
    tx = LoyaltyTransaction(
        customer_id=customer_id,
        type='redeem',
        amount=points,
        created_at=datetime.utcnow()
    )
    db.add(tx)
    db.commit()
    
    return {
        "success": True,
        "remaining_credits": loyalty.total_credits
    }
