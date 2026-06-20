from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.exc import IntegrityError, OperationalError
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any

from app.db.session import get_db
from app.db.models import User, Role, Customer, Coupon, Promotion, TableMaster, Floor, Order, OrderItem, Payment, AuditLog, VenueSetting
from app.models.schemas import UserResponse, UserRegister, CouponCreate, CouponResponse, PromotionCreate, PromotionResponse, TableResponse, FloorResponse, FloorCreate, TableCreate
from app.routes.auth import require_role
from app.core.security import get_password_hash
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])

admin_dependency = Depends(require_role(["superadmin"]))


def _validate_coupon_payload(coupon_in: CouponCreate) -> Dict[str, Any]:
    code = coupon_in.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code is required")
    if len(code) > 30:
        raise HTTPException(status_code=400, detail="Coupon code must be 30 characters or less")

    discount_type = (coupon_in.discount_type or "").strip().lower()
    if discount_type not in {"percent", "fixed"}:
        raise HTTPException(status_code=400, detail="Discount type must be either 'percent' or 'fixed'")

    try:
        value = Decimal(str(coupon_in.value))
    except Exception:
        raise HTTPException(status_code=400, detail="Coupon value must be a valid number")

    if value <= 0:
        raise HTTPException(status_code=400, detail="Coupon value must be greater than 0")

    if discount_type == "percent" and value > Decimal("100"):
        raise HTTPException(status_code=400, detail="Percentage discount cannot be greater than 100")

    if coupon_in.max_uses is not None and coupon_in.max_uses <= 0:
        raise HTTPException(status_code=400, detail="Max uses must be greater than 0")

    if coupon_in.valid_from and coupon_in.valid_until and coupon_in.valid_until < coupon_in.valid_from:
        raise HTTPException(status_code=400, detail="Valid until date cannot be earlier than valid from date")

    return {
        "code": code,
        "discount_type": discount_type,
        "value": value,
        "max_uses": coupon_in.max_uses,
        "valid_from": coupon_in.valid_from,
        "valid_until": coupon_in.valid_until,
    }

@router.get("/dashboard-stats", dependencies=[admin_dependency])
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_staff = db.query(User).filter(User.deleted_at == None).count()
    total_customers = db.query(Customer).count()
    
    # Active orders today
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_orders = db.query(Order).filter(Order.created_at >= today_start).all()
    
    today_revenue = sum((o.total for o in today_orders if o.status == "paid"), Decimal("0.00"))
    paid_orders_count = sum(1 for o in today_orders if o.status == "paid")
    
    occupied_tables = db.query(TableMaster).filter(TableMaster.current_status == 'occupied').count()
    total_tables = db.query(TableMaster).count()
    
    return {
        "total_staff": total_staff,
        "total_customers": total_customers,
        "today_revenue": float(today_revenue),
        "paid_orders_count": paid_orders_count,
        "table_occupancy": f"{occupied_tables}/{total_tables}",
        "occupied_tables_count": occupied_tables
    }

# ── User & Staff Management ──────────────────────────────────────────────────
@router.get("/users", dependencies=[admin_dependency])
def list_users(db: Session = Depends(get_db)):
    # Staff list
    users = db.query(User).filter(User.deleted_at == None).all()
    roles = {r.id: r.name for r in db.query(Role).all()}
    
    staff_list = []
    for u in users:
        staff_list.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "mobile_number": u.mobile_number,
            "role_id": u.role_id,
            "role_name": roles.get(u.role_id, "unknown"),
            "is_active": u.is_active,
            "created_at": u.created_at,
            "type": "staff"
        })
        
    # Customer list
    customers = db.query(Customer).all()
    cust_list = []
    for c in customers:
        cust_list.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "mobile_number": c.mobile_number,
            "is_guest": c.is_guest,
            "created_at": c.created_at,
            "type": "customer"
        })
        
    return {
        "staff": staff_list,
        "customers": cust_list
    }

@router.post("/users", response_model=UserResponse, dependencies=[admin_dependency])
def create_staff(user_in: UserRegister, db: Session = Depends(get_db)):
    role = db.query(Role).filter(Role.id == user_in.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role ID")
        
    existing = db.query(User).filter(
        (User.email == user_in.email) | (User.mobile_number == user_in.mobile_number)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with email or mobile number already exists")
        
    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        mobile_number=user_in.mobile_number,
        password_hash=hashed_pw,
        role_id=user_in.role_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/users/{user_id}/role", dependencies=[admin_dependency])
def update_user_role(user_id: int, role_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role ID")
        
    user.role_id = role_id
    db.commit()
    return {"success": True, "new_role_id": role_id, "new_role_name": role.name}

@router.put("/users/{user_id}/password", dependencies=[admin_dependency])
def reset_user_password(user_id: int, password_in: Dict[str, str], db: Session = Depends(get_db)):
    # Wait, Dict[str, str] needs to be imported or we can use body parameters. Let's just read the dict directly
    new_password = password_in.get("password")
    if not new_password or len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = get_password_hash(new_password)
    db.commit()
    return {"success": True, "message": "Password updated successfully"}

@router.post("/users/{user_id}/archive", dependencies=[admin_dependency])
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.deleted_at == None).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = not user.is_active
    db.commit()
    return {"success": True, "is_active": user.is_active}

@router.delete("/users/{user_id}", dependencies=[admin_dependency])
def hard_delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if user has orders
    order_exists = db.query(Order).filter(
        (Order.placed_by_user_id == user_id) | (Order.waiter_id == user_id)
    ).first()
    if order_exists:
        # Perform soft delete instead of hard delete
        user.deleted_at = func.now()
        user.is_active = False
        db.commit()
        return {"success": True, "message": "User soft-deleted due to order references"}
        
    db.delete(user)
    db.commit()
    return {"success": True, "message": "User permanently deleted"}

# ── Coupon Management ────────────────────────────────────────────────────────
@router.get("/coupons", response_model=List[CouponResponse], dependencies=[admin_dependency])
def list_coupons(db: Session = Depends(get_db)):
    return db.query(Coupon).all()

@router.post("/coupons", response_model=CouponResponse)
def create_coupon(coupon_in: CouponCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["superadmin"]))):
    payload = _validate_coupon_payload(coupon_in)
    existing = db.query(Coupon).filter(func.upper(Coupon.code) == payload["code"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
        
    new_coupon = Coupon(
        code=payload["code"],
        discount_type=payload["discount_type"],
        value=payload["value"],
        max_uses=payload["max_uses"],
        valid_from=payload["valid_from"],
        valid_until=payload["valid_until"],
        created_by=current_user.id,
        is_active=True
    )
    db.add(new_coupon)
    try:
        db.commit()
    except (IntegrityError, OperationalError):
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid coupon data. For percentage discounts, value must be between 0 and 100")
    db.refresh(new_coupon)
    return new_coupon

@router.put("/coupons/{coupon_id}", response_model=CouponResponse, dependencies=[admin_dependency])
def update_coupon(coupon_id: int, coupon_in: CouponCreate, db: Session = Depends(get_db)):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    payload = _validate_coupon_payload(coupon_in)
    duplicate = db.query(Coupon).filter(func.upper(Coupon.code) == payload["code"], Coupon.id != coupon_id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
        
    coupon.code = payload["code"]
    coupon.discount_type = payload["discount_type"]
    coupon.value = payload["value"]
    coupon.max_uses = payload["max_uses"]
    coupon.valid_from = payload["valid_from"]
    coupon.valid_until = payload["valid_until"]
    
    try:
        db.commit()
    except (IntegrityError, OperationalError):
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid coupon update. Check discount value and validity dates")
    db.refresh(coupon)
    return coupon

@router.delete("/coupons/{coupon_id}", dependencies=[admin_dependency])
def delete_coupon(coupon_id: int, db: Session = Depends(get_db)):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(coupon)
    db.commit()
    return {"success": True, "message": "Coupon deleted successfully"}

# ── Promotion Management ─────────────────────────────────────────────────────
@router.get("/promotions", response_model=List[PromotionResponse], dependencies=[admin_dependency])
def list_promotions(db: Session = Depends(get_db)):
    return db.query(Promotion).all()

@router.post("/promotions", response_model=PromotionResponse, dependencies=[admin_dependency])
def create_promotion(promo_in: PromotionCreate, db: Session = Depends(get_db)):
    new_promo = Promotion(
        name=promo_in.name,
        scope=promo_in.scope,
        product_id=promo_in.product_id,
        min_quantity=promo_in.min_quantity,
        min_order_amount=promo_in.min_order_amount,
        discount_type=promo_in.discount_type,
        value=promo_in.value,
        valid_from=promo_in.valid_from,
        valid_until=promo_in.valid_until,
        is_active=True
    )
    db.add(new_promo)
    db.commit()
    db.refresh(new_promo)
    return new_promo

@router.put("/promotions/{promo_id}", response_model=PromotionResponse, dependencies=[admin_dependency])
def update_promotion(promo_id: int, promo_in: PromotionCreate, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
        
    promo.name = promo_in.name
    promo.scope = promo_in.scope
    promo.product_id = promo_in.product_id
    promo.min_quantity = promo_in.min_quantity
    promo.min_order_amount = promo_in.min_order_amount
    promo.discount_type = promo_in.discount_type
    promo.value = promo_in.value
    promo.valid_from = promo_in.valid_from
    promo.valid_until = promo_in.valid_until
    
    db.commit()
    db.refresh(promo)
    return promo

@router.delete("/promotions/{promo_id}", dependencies=[admin_dependency])
def delete_promotion(promo_id: int, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    db.delete(promo)
    db.commit()
    return {"success": True, "message": "Promotion deleted successfully"}

# ── Live Table Status Monitoring ─────────────────────────────────────────────
@router.get("/tables/status", dependencies=[admin_dependency])
def monitor_tables(db: Session = Depends(get_db)):
    tables = db.query(TableMaster).all()
    result = []
    for t in tables:
        # Find active order
        active_order_data = None
        if t.current_order_id:
            order = db.query(Order).filter(Order.id == t.current_order_id).first()
            if order:
                items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
                items_cooked = sum(1 for item in items if item.kitchen_status == "completed")
                total_items = len(items)
                
                active_order_data = {
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "status": order.status,
                    "payment_status": "Paid" if order.status == "paid" else "Unpaid",
                    "items_count": total_items,
                    "cooking_progress": f"{items_cooked}/{total_items}" if total_items > 0 else "0/0"
                }
                
        waiter_name = None
        if t.current_waiter_id:
            waiter = db.query(User).filter(User.id == t.current_waiter_id).first()
            if waiter:
                waiter_name = waiter.name
                
        result.append({
            "table_id": t.id,
            "table_number": t.table_number,
            "seats": t.seats,
            "status": t.current_status,
            "waiter_name": waiter_name,
            "active_order": active_order_data
        })
    return result

# ── Venue Setting Endpoints ──────────────────────────────────────────────────
@router.get("/settings", dependencies=[admin_dependency])
def get_venue_settings(db: Session = Depends(get_db)):
    settings_obj = db.query(VenueSetting).first()
    if not settings_obj:
        # Create a default one if none exists
        settings_obj = VenueSetting(
            venue_name="iTech Canteen",
            currency_symbol="₹",
            self_ordering_enabled=True,
            self_ordering_mode="online_ordering",
            self_order_lock_mode="device",
            kds_auto_advance=False
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj

@router.put("/settings", dependencies=[admin_dependency])
def update_venue_settings(payload: Dict[str, Any], db: Session = Depends(get_db)):
    settings_obj = db.query(VenueSetting).first()
    if not settings_obj:
        raise HTTPException(status_code=404, detail="Venue settings not found")
        
    for k, v in payload.items():
        if hasattr(settings_obj, k):
            setattr(settings_obj, k, v)
            
    db.commit()
    db.refresh(settings_obj)
    return settings_obj

# ── Floors & Tables Endpoints ────────────────────────────────────────────────

@router.get("/floors", response_model=List[FloorResponse], dependencies=[admin_dependency])
def get_floors(db: Session = Depends(get_db)):
    floors = db.query(Floor).order_by(Floor.display_order).all()
    # Eager loading or properties will handle tables if relationships are defined
    return floors

@router.post("/floors", response_model=FloorResponse, dependencies=[admin_dependency])
def create_floor(floor_in: FloorCreate, db: Session = Depends(get_db)):
    max_order = db.query(func.max(Floor.display_order)).scalar() or 0
    new_floor = Floor(
        name=floor_in.name,
        display_order=max_order + 1
    )
    db.add(new_floor)
    db.commit()
    db.refresh(new_floor)
    return new_floor

@router.post("/tables", response_model=TableResponse, dependencies=[admin_dependency])
def create_table(table_in: TableCreate, db: Session = Depends(get_db)):
    floor = db.query(Floor).filter(Floor.id == table_in.floor_id).first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
        
    existing = db.query(TableMaster).filter(TableMaster.table_number == table_in.table_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
        
    new_table = TableMaster(
        floor_id=table_in.floor_id,
        table_number=table_in.table_number,
        seats=table_in.seats,
        is_active=True,
        current_status='available',
        qr_token=str(uuid.uuid4())
    )
    db.add(new_table)
    db.commit()
    db.refresh(new_table)
    return new_table

