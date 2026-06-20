-- iTech Canteen schema aligned to the live SQLAlchemy models

CREATE TABLE categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT '#F59E0B',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    roll_no VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_no VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    user_type VARCHAR(20) NOT NULL DEFAULT 'student',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    wallet_balance VARCHAR(255),
    favourites JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    bulk_order_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    loyalty_points INT NOT NULL DEFAULT 0
);

CREATE TABLE food_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id INT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    cash_price DECIMAL(10, 2),
    unit_of_measure VARCHAR(30) DEFAULT 'piece',
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    image VARCHAR(255),
    quantity_available INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_stock_update DATETIME,
    last_reserved_at DATETIME,
    perishable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_items_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE audit_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    row_id INT,
    before_state JSON,
    after_state JSON,
    meta JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE stock_audit_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    actor_roll_no VARCHAR(64),
    actor_role VARCHAR(32),
    action VARCHAR(32) NOT NULL,
    food_item_id INT NOT NULL,
    food_item_name VARCHAR(255),
    before_quantity INT,
    after_quantity INT,
    change_amount INT,
    source VARCHAR(32) DEFAULT 'cashier_stock_update',
    ip_address VARCHAR(45),
    user_agent TEXT,
    meta JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_stock_audit_logs_item FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE
);

CREATE TABLE system_controls (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sales_mode VARCHAR(20) NOT NULL DEFAULT 'closed',
    sales_open_date DATE,
    updated_by INT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_system_controls_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE ideas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ideas_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE idea_upvotes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    idea_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_idea_upvotes_idea_user (idea_id, user_id),
    CONSTRAINT fk_idea_upvotes_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    CONSTRAINT fk_idea_upvotes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE restaurant_floors (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE restaurant_tables (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    floor_id INT NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    seats INT NOT NULL DEFAULT 2,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    active_cashier_id INT NULL,
    active_order_id INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_restaurant_tables_floor FOREIGN KEY (floor_id) REFERENCES restaurant_floors(id) ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_tables_cashier FOREIGN KEY (active_cashier_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE payment_methods (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    method_key VARCHAR(30) NOT NULL UNIQUE,
    label VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    upi_id VARCHAR(100),
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE coupons (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    minimum_order_amount DECIMAL(10, 2) DEFAULT 0.00,
    maximum_discount_amount DECIMAL(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at DATETIME,
    ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE coupon_targets (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    coupon_id INT NOT NULL,
    customer_id INT NOT NULL,
    CONSTRAINT fk_coupon_targets_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupon_targets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE promotions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id INT,
    discount_type VARCHAR(20) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    minimum_quantity INT,
    minimum_order_amount DECIMAL(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at DATETIME,
    ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE table_sessions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    table_id INT NOT NULL,
    customer_id INT NULL,
    cashier_id INT NULL,
    session_pin VARCHAR(4) NOT NULL,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at DATETIME,
    CONSTRAINT fk_table_sessions_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    CONSTRAINT fk_table_sessions_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_table_sessions_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE loyalty_accounts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    total_points INT NOT NULL DEFAULT 0,
    lifetime_spend DECIMAL(12, 2) DEFAULT 0.00,
    tier VARCHAR(30) NOT NULL DEFAULT 'standard',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_loyalty_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE orders (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cashier_id INT NULL,
    floor_id INT NULL,
    table_id INT NULL,
    session_id INT NULL,
    bill_number VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    subtotal_amount DECIMAL(10, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    items JSON,
    payment_method VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending',
    order_status VARCHAR(20) DEFAULT 'draft',
    kitchen_status VARCHAR(20) DEFAULT 'to_cook',
    is_scanned BOOLEAN DEFAULT FALSE,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    wallet_amount DECIMAL(10, 2) DEFAULT 0.00,
    online_amount DECIMAL(10, 2) DEFAULT 0.00,
    coupon_code VARCHAR(50),
    loyalty_points_earned INT NOT NULL DEFAULT 0,
    closed_at DATETIME,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_floor FOREIGN KEY (floor_id) REFERENCES restaurant_floors(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_session FOREIGN KEY (session_id) REFERENCES table_sessions(id) ON DELETE SET NULL
);

CREATE TABLE order_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    food_item_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    kitchen_status VARCHAR(20) DEFAULT 'to_cook',
    assigned_chef_id INT NULL,
    sent_to_kitchen_at DATETIME,
    completed_at DATETIME,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_food_item FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_assignee FOREIGN KEY (assigned_chef_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE wallet_transactions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255),
    order_id INT NULL,
    performed_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_wallet_transactions_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);
