from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from decimal import Decimal
from datetime import datetime, date, timedelta
from typing import List, Optional

from app.db.session import get_db
from app.db.models import (
    User,
    Category,
    FoodItem,
    Order,
    AuditLog,
    SystemControl,
    RestaurantFloor,
    RestaurantTable,
    PaymentMethod,
    Coupon,
    Promotion,
    TableSession,
)
from app.models.schemas import (
    CategoryResponse,
    CategoryCreate,
    FoodItemResponse,
    FoodItemCreate,
    UserResponse,
    FloorCreate,
    FloorResponse,
    TableCreate,
    TableResponse,
    PaymentMethodResponse,
    CouponCreate,
    CouponResponse,
    PromotionCreate,
    PromotionResponse,
)
from app.routes.auth import require_role

router = APIRouter(prefix="/admin", tags=["admin"])

superadmin_dependency = Depends(require_role(["admin", "superadmin"]))
catalog_dependency = Depends(require_role(["admin", "superadmin", "inventory_manager"]))
user_admin_dependency = Depends(require_role(["admin", "superadmin"]))

@router.get("/dashboard-stats", dependencies=[superadmin_dependency])
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
@router.get("/categories", response_model=List[CategoryResponse], dependencies=[catalog_dependency])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("/categories", response_model=CategoryResponse, dependencies=[catalog_dependency])
def create_category(cat_in: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == cat_in.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    new_cat = Category(name=cat_in.name, color=cat_in.color, is_active=True)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.post("/categories/{cat_id}/toggle", dependencies=[catalog_dependency])
def toggle_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    cat.is_active = not cat.is_active
    db.commit()
    return {"id": cat.id, "name": cat.name, "is_active": cat.is_active}

# ── Food Item Management ─────────────────────────────────────────────────────
@router.get("/items", response_model=List[FoodItemResponse], dependencies=[catalog_dependency])
def list_items(db: Session = Depends(get_db)):
    return db.query(FoodItem).all()

@router.post("/items", response_model=FoodItemResponse, dependencies=[catalog_dependency])
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
        unit_of_measure=item_in.unit_of_measure,
        tax_rate=item_in.tax_rate,
        description=item_in.description,
        quantity_available=item_in.quantity_available,
        reserved_quantity=item_in.reserved_quantity,
        is_active=item_in.is_active,
        perishable=item_in.perishable
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.put("/items/{item_id}", response_model=FoodItemResponse, dependencies=[catalog_dependency])
def update_item(item_id: int, item_in: FoodItemCreate, db: Session = Depends(get_db)):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    item.category_id = item_in.category_id
    item.name = item_in.name
    item.price = item_in.price
    item.cash_price = item_in.cash_price
    item.unit_of_measure = item_in.unit_of_measure
    item.tax_rate = item_in.tax_rate
    item.description = item_in.description
    item.quantity_available = item_in.quantity_available
    item.reserved_quantity = item_in.reserved_quantity
    item.is_active = item_in.is_active
    item.perishable = item_in.perishable
    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}", dependencies=[catalog_dependency])
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FoodItem).filter(FoodItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"success": True, "message": "Item deleted successfully"}

# ── Floor, Table, Payment, Coupon & Promotion Management ─────────────────────
@router.get("/floors", response_model=List[FloorResponse], dependencies=[superadmin_dependency])
def list_floors(db: Session = Depends(get_db)):
    return db.query(RestaurantFloor).order_by(RestaurantFloor.sort_order.asc(), RestaurantFloor.id.asc()).all()


@router.post("/floors", response_model=FloorResponse, dependencies=[superadmin_dependency])
def create_floor(floor_in: FloorCreate, db: Session = Depends(get_db)):
    floor = RestaurantFloor(
        name=floor_in.name,
        sort_order=floor_in.sort_order,
        is_active=floor_in.is_active,
    )
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


@router.put("/floors/{floor_id}", response_model=FloorResponse, dependencies=[superadmin_dependency])
def update_floor(floor_id: int, floor_in: FloorCreate, db: Session = Depends(get_db)):
    floor = db.query(RestaurantFloor).filter(RestaurantFloor.id == floor_id).first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    floor.name = floor_in.name
    floor.sort_order = floor_in.sort_order
    floor.is_active = floor_in.is_active
    db.commit()
    db.refresh(floor)
    return floor


@router.delete("/floors/{floor_id}", dependencies=[superadmin_dependency])
def delete_floor(floor_id: int, db: Session = Depends(get_db)):
    floor = db.query(RestaurantFloor).filter(RestaurantFloor.id == floor_id).first()
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    db.delete(floor)
    db.commit()
    return {"success": True}


@router.get("/tables", response_model=List[TableResponse], dependencies=[superadmin_dependency])
def list_tables(db: Session = Depends(get_db)):
    return db.query(RestaurantTable).order_by(RestaurantTable.floor_id.asc(), RestaurantTable.table_number.asc()).all()


@router.post("/tables", response_model=TableResponse, dependencies=[superadmin_dependency])
def create_table(table_in: TableCreate, db: Session = Depends(get_db)):
    table = RestaurantTable(
        floor_id=table_in.floor_id,
        table_number=table_in.table_number,
        seats=table_in.seats,
        is_active=table_in.is_active,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.put("/tables/{table_id}", response_model=TableResponse, dependencies=[superadmin_dependency])
def update_table(table_id: int, table_in: TableCreate, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.floor_id = table_in.floor_id
    table.table_number = table_in.table_number
    table.seats = table_in.seats
    table.is_active = table_in.is_active
    db.commit()
    db.refresh(table)
    return table


@router.delete("/tables/{table_id}", dependencies=[superadmin_dependency])
def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = db.query(RestaurantTable).filter(RestaurantTable.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    db.delete(table)
    db.commit()
    return {"success": True}


@router.get("/payment-methods", response_model=List[PaymentMethodResponse], dependencies=[superadmin_dependency])
def list_payment_methods(db: Session = Depends(get_db)):
    return db.query(PaymentMethod).order_by(PaymentMethod.sort_order.asc(), PaymentMethod.id.asc()).all()


@router.post("/payment-methods", response_model=PaymentMethodResponse, dependencies=[superadmin_dependency])
def create_payment_method(label: str, method_key: str, db: Session = Depends(get_db), upi_id: Optional[str] = None):
    existing = db.query(PaymentMethod).filter(PaymentMethod.method_key == method_key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    method = PaymentMethod(method_key=method_key, label=label, upi_id=upi_id)
    db.add(method)
    db.commit()
    db.refresh(method)
    return method


@router.post("/payment-methods/{method_id}/toggle", response_model=PaymentMethodResponse, dependencies=[superadmin_dependency])
def toggle_payment_method(method_id: int, db: Session = Depends(get_db)):
    method = db.query(PaymentMethod).filter(PaymentMethod.id == method_id).first()
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    method.is_enabled = not method.is_enabled
    db.commit()
    db.refresh(method)
    return method


@router.get("/coupons", response_model=List[CouponResponse], dependencies=[superadmin_dependency])
def list_coupons(db: Session = Depends(get_db)):
    return db.query(Coupon).order_by(Coupon.created_at.desc()).all()


@router.post("/coupons", response_model=CouponResponse, dependencies=[superadmin_dependency])
def create_coupon(coupon_in: CouponCreate, db: Session = Depends(get_db)):
    existing = db.query(Coupon).filter(Coupon.code == coupon_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = Coupon(
        code=coupon_in.code.upper(),
        discount_type=coupon_in.discount_type,
        discount_value=coupon_in.discount_value,
        minimum_order_amount=coupon_in.minimum_order_amount,
        maximum_discount_amount=coupon_in.maximum_discount_amount,
        is_active=coupon_in.is_active,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.put("/coupons/{coupon_id}", response_model=CouponResponse, dependencies=[superadmin_dependency])
def update_coupon(coupon_id: int, coupon_in: CouponCreate, db: Session = Depends(get_db)):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon.code = coupon_in.code.upper()
    coupon.discount_type = coupon_in.discount_type
    coupon.discount_value = coupon_in.discount_value
    coupon.minimum_order_amount = coupon_in.minimum_order_amount
    coupon.maximum_discount_amount = coupon_in.maximum_discount_amount
    coupon.is_active = coupon_in.is_active
    db.commit()
    db.refresh(coupon)
    return coupon


@router.delete("/coupons/{coupon_id}", dependencies=[superadmin_dependency])
def delete_coupon(coupon_id: int, db: Session = Depends(get_db)):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(coupon)
    db.commit()
    return {"success": True}


@router.get("/promotions", response_model=List[PromotionResponse], dependencies=[superadmin_dependency])
def list_promotions(db: Session = Depends(get_db)):
    return db.query(Promotion).order_by(Promotion.created_at.desc()).all()


@router.post("/promotions", response_model=PromotionResponse, dependencies=[superadmin_dependency])
def create_promotion(promo_in: PromotionCreate, db: Session = Depends(get_db)):
    promo = Promotion(
        name=promo_in.name,
        target_type=promo_in.target_type,
        target_id=promo_in.target_id,
        discount_type=promo_in.discount_type,
        discount_value=promo_in.discount_value,
        minimum_quantity=promo_in.minimum_quantity,
        minimum_order_amount=promo_in.minimum_order_amount,
        is_active=promo_in.is_active,
    )
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo


@router.put("/promotions/{promo_id}", response_model=PromotionResponse, dependencies=[superadmin_dependency])
def update_promotion(promo_id: int, promo_in: PromotionCreate, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    promo.name = promo_in.name
    promo.target_type = promo_in.target_type
    promo.target_id = promo_in.target_id
    promo.discount_type = promo_in.discount_type
    promo.discount_value = promo_in.discount_value
    promo.minimum_quantity = promo_in.minimum_quantity
    promo.minimum_order_amount = promo_in.minimum_order_amount
    promo.is_active = promo_in.is_active
    db.commit()
    db.refresh(promo)
    return promo


@router.delete("/promotions/{promo_id}", dependencies=[superadmin_dependency])
def delete_promotion(promo_id: int, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    db.delete(promo)
    db.commit()
    return {"success": True}


@router.get("/table-overview", dependencies=[superadmin_dependency])
def table_overview(db: Session = Depends(get_db)):
    tables = db.query(RestaurantTable).all()
    overview = []
    for table in tables:
        active_order = None
        if table.active_order_id:
            active_order = db.query(Order).filter(Order.id == table.active_order_id).first()
        overview.append({
            "id": table.id,
            "floor_id": table.floor_id,
            "table_number": table.table_number,
            "seats": table.seats,
            "status": table.status,
            "is_active": table.is_active,
            "active_cashier_id": table.active_cashier_id,
            "active_order": {
                "id": active_order.id,
                "bill_number": active_order.bill_number,
                "payment_status": active_order.payment_status,
                "order_status": active_order.order_status,
                "kitchen_status": active_order.kitchen_status,
                "total_amount": float(active_order.total_amount),
            } if active_order else None,
        })
    return overview

# ── User Roles & Admin Controls ──────────────────────────────────────────────
@router.get("/users", dependencies=[user_admin_dependency])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.deleted_at == None).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "roll_no": u.roll_no,
            "display_name": u.display_name,
            "email": u.email,
            "phone_no": u.phone_no,
            "role": u.role,
            "user_type": u.user_type,
            "wallet_balance": u.get_balance(),
            "email_verified": u.email_verified,
            "loyalty_points": u.loyalty_points,
            "created_at": u.created_at
        })
    return result

@router.post("/users/{user_id}/role", dependencies=[user_admin_dependency])
def update_user_role(user_id: int, role: str, db: Session = Depends(get_db)):
    if role not in [
        "user",
        "customer",
        "cashier",
        "admin",
        "superadmin",
        "inventory_manager",
        "chef",
        "dept",
        "external",
    ]:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = role
    db.commit()
    return {"success": True, "new_role": role}

@router.delete("/users/{user_id}", dependencies=[user_admin_dependency])
def suspend_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.deleted_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "User account suspended"}

# ── Global System Control ─────────────────────────────────────────────────────
@router.post("/system-control/sales-mode", dependencies=[superadmin_dependency])
def update_sales_mode(mode: str, admin: User = Depends(require_role(["admin", "superadmin"])), db: Session = Depends(get_db)):
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

@router.get("/audit-logs", dependencies=[superadmin_dependency])
def list_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return logs
