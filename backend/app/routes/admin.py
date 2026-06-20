from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional

from app.db.session import get_db
from app.db.models import User, Category, FoodItem, Order, AuditLog, SystemControl
from app.models.schemas import CategoryResponse, CategoryCreate, FoodItemResponse, FoodItemCreate, UserResponse
from app.routes.auth import require_role

router = APIRouter(prefix="/admin", tags=["admin"])

admin_dependency = Depends(require_role(["admin"]))

@router.get("/dashboard-stats", dependencies=[admin_dependency])
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Total Users
    total_users = db.query(User).filter(User.deleted_at == None).count()
    
    # Active items & categories
    active_items = db.query(FoodItem).filter(FoodItem.is_active == True).count()
    active_categories = db.query(Category).filter(Category.is_active == True).count()
    
    # Revenue calculations
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_orders = db.query(Order).filter(
        Order.created_at >= today_start, 
        Order.payment_status == "completed"
    ).all()
    
    today_revenue = sum(o.total_amount for o in today_orders)
    
    # Yesterday comparison
    yesterday_start = today_start - timedelta(days=1)
    yesterday_orders = db.query(Order).filter(
        Order.created_at >= yesterday_start,
        Order.created_at < today_start,
        Order.payment_status == "completed"
    ).all()
    yesterday_revenue = sum(o.total_amount for o in yesterday_orders)
    
    # Global sales mode
    sys_control = db.query(SystemControl).first()
    sales_mode = sys_control.sales_mode if sys_control else "closed"
    
    return {
        "total_users": total_users,
        "active_items": active_items,
        "active_categories": active_categories,
        "today_revenue": float(today_revenue),
        "yesterday_revenue": float(yesterday_revenue),
        "sales_mode": sales_mode
    }

# ── Category Management ──────────────────────────────────────────────────────
@router.get("/categories", response_model=List[CategoryResponse], dependencies=[admin_dependency])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("/categories", response_model=CategoryResponse, dependencies=[admin_dependency])
def create_category(cat_in: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == cat_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    new_cat = Category(name=cat_in.name, is_active=True)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.post("/categories/{cat_id}/toggle", dependencies=[admin_dependency])
def toggle_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    cat.is_active = not cat.is_active
    db.commit()
    return {"id": cat.id, "name": cat.name, "is_active": cat.is_active}

# ── Food Item Management ─────────────────────────────────────────────────────
@router.get("/items", response_model=List[FoodItemResponse], dependencies=[admin_dependency])
def list_items(db: Session = Depends(get_db)):
    return db.query(FoodItem).all()

@router.post("/items", response_model=FoodItemResponse, dependencies=[admin_dependency])
def create_item(item_in: FoodItemCreate, db: Session = Depends(get_db)):
    # Verify category
    cat = db.query(Category).filter(Category.id == item_in.category_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid Category ID")
        
    new_item = FoodItem(
        category_id=item_in.category_id,
        name=item_in.name,
        price=item_in.price,
        cash_price=item_in.cash_price,
        description=item_in.description,
        quantity_available=item_in.quantity_available,
        is_active=item_in.is_active,
        perishable=item_in.perishable
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/items/{item_id}", response_model=FoodItemResponse, dependencies=[admin_dependency])
def update_item(item_id: int, item_in: FoodItemCreate, db: Session = Depends(get_db)):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    item.category_id = item_in.category_id
    item.name = item_in.name
    item.price = item_in.price
    item.cash_price = item_in.cash_price
    item.description = item_in.description
    item.quantity_available = item_in.quantity_available
    item.is_active = item_in.is_active
    item.perishable = item_in.perishable
    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}", dependencies=[admin_dependency])
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"success": True, "message": "Item deleted successfully"}

# ── User Roles & Admin Controls ──────────────────────────────────────────────
@router.get("/users", dependencies=[admin_dependency])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.deleted_at == None).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "roll_no": u.roll_no,
            "email": u.email,
            "phone_no": u.phone_no,
            "role": u.role,
            "user_type": u.user_type,
            "wallet_balance": u.get_balance(),
            "email_verified": u.email_verified,
            "created_at": u.created_at
        })
    return result

@router.post("/users/{user_id}/role", dependencies=[admin_dependency])
def update_user_role(user_id: int, role: str, db: Session = Depends(get_db)):
    if role not in ["user", "cashier", "admin", "dept"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role
    db.commit()
    return {"success": True, "new_role": role}

@router.delete("/users/{user_id}", dependencies=[admin_dependency])
def suspend_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.deleted_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "User account suspended"}

# ── Global System Control ─────────────────────────────────────────────────────
@router.post("/system-control/sales-mode", dependencies=[admin_dependency])
def update_sales_mode(mode: str, admin: User = Depends(require_role(["admin"])), db: Session = Depends(get_db)):
    if mode not in ["open", "closed", "emergency"]:
        raise HTTPException(status_code=400, detail="Invalid sales mode")
        
    ctrl = db.query(SystemControl).first()
    if not ctrl:
        ctrl = SystemControl(sales_mode=mode, sales_open_date=date.today(), updated_by=admin.id)
        db.add(ctrl)
    else:
        ctrl.sales_mode = mode
        ctrl.sales_open_date = date.today()
        ctrl.updated_by = admin.id
        
    db.commit()
    return {"sales_mode": mode}

@router.get("/audit-logs", dependencies=[admin_dependency])
def list_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return logs
