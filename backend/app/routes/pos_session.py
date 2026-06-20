from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any

from app.db.session import get_db
from app.db.models import User, PosSession
from app.routes.auth import require_role

router = APIRouter(prefix="/pos/session", tags=["pos_session"])

session_dependency = Depends(require_role(["cashier", "superadmin"]))

@router.get("/current")
def get_current_session(db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    session = db.query(PosSession).filter(PosSession.user_id == current_user.id, PosSession.status == 'open').first()
    if not session:
        return {"open": False}
    return {
        "open": True,
        "session_id": session.id,
        "opening_cash": float(session.opening_cash),
        "opened_at": session.opened_at
    }

@router.post("/open")
def open_session(payload: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    existing = db.query(PosSession).filter(PosSession.user_id == current_user.id, PosSession.status == 'open').first()
    if existing:
        raise HTTPException(status_code=400, detail="A session is already open for this user")
        
    cash = Decimal(str(payload.get("opening_cash", "0.00")))
    session = PosSession(
        user_id=current_user.id,
        status='open',
        opening_cash=cash,
        opened_at=datetime.utcnow()
    )
    db.add(session)
    db.commit()
    return {"success": True, "session_id": session.id}

@router.post("/close")
def close_session(payload: Dict[str, Any], db: Session = Depends(get_db), current_user: User = Depends(require_role(["cashier", "superadmin"]))):
    session = db.query(PosSession).filter(PosSession.user_id == current_user.id, PosSession.status == 'open').first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session found to close")
        
    cash = Decimal(str(payload.get("closing_cash", "0.00")))
    session.status = 'closed'
    session.closing_cash = cash
    session.notes = payload.get("notes")
    session.closed_at = datetime.utcnow()
    db.commit()
    return {"success": True}
