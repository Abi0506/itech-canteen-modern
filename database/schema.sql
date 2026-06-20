-- iTech Canteen System MySQL Schema

-- 1. Categories Table
CREATE TABLE categories (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Category Timings Table
CREATE TABLE category_timings (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE
);

-- 3. Users Table
CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    roll_no VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_no VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user', -- 'user', 'cashier', 'admin', 'dept'
    user_type VARCHAR(20) DEFAULT 'student', -- 'student', 'faculty', 'external'
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verify_token VARCHAR(64),
    wallet_balance VARCHAR(255), -- AES encrypted string
    favourites JSON, -- array of food_item_ids
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    reset_code VARCHAR(10),
    reset_code_expiry DATETIME,
    group_deleted_notification BOOLEAN DEFAULT FALSE,
    group_order_success_notification BOOLEAN DEFAULT FALSE,
    action_otp VARCHAR(10),
    action_otp_expiry DATETIME,
    deleted_at DATETIME,
    bulk_order_enabled BOOLEAN DEFAULT FALSE
);

-- 4. Departments Table
CREATE TABLE departments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Food Items Table
CREATE TABLE food_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    cash_price DECIMAL(10, 2),
    image VARCHAR(255),
    quantity_available INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_stock_update DATETIME,
    perishable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Group Carts Table
CREATE TABLE group_carts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- 7. Group Cart Members Table
CREATE TABLE group_cart_members (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    group_cart_id INTEGER NOT NULL REFERENCES group_carts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_cart_id, user_id)
);

-- 8. Group Cart Items Table
CREATE TABLE group_cart_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    group_cart_id INTEGER NOT NULL REFERENCES group_carts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Orders Table
CREATE TABLE orders (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_number VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(10, 2) NOT NULL,
    items JSON, -- JSON breakdown of purchased items
    payment_method VARCHAR(20) NOT NULL, -- 'wallet', 'razorpay', 'partial', 'cash', 'upi'
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    is_scanned BOOLEAN DEFAULT FALSE,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_group_order BOOLEAN NOT NULL DEFAULT FALSE,
    group_cart_id INTEGER REFERENCES group_carts(id) ON DELETE SET NULL,
    wallet_amount DECIMAL(10, 2) DEFAULT 0.00,
    online_amount DECIMAL(10, 2) DEFAULT 0.00,
);

-- 10. Order Items Table
CREATE TABLE order_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- 11. Refunds Table
CREATE TABLE refunds (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255),
    stock_restored BOOLEAN NOT NULL DEFAULT FALSE,
    performed_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Audit Logs Table
CREATE TABLE audit_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    row_id INTEGER,
    before_state JSON,
    after_state JSON,
    meta JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Wallet Transactions Table
CREATE TABLE wallet_transactions (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- 'credit', 'debit'
    amount DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255),
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Stock Audit Logs Table
CREATE TABLE stock_audit_logs (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_roll_no VARCHAR(64),
    actor_role VARCHAR(32),
    action VARCHAR(32) NOT NULL,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    food_item_name VARCHAR(255),
    before_quantity INTEGER,
    after_quantity INTEGER,
    change_amount INTEGER,
    source VARCHAR(32) DEFAULT 'cashier_stock_update',
    ip_address VARCHAR(45),
    user_agent TEXT,
    meta JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Stock Notifications Table
CREATE TABLE stock_notifications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) DEFAULT 'stock_update',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. System Controls Table
CREATE TABLE system_controls (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sales_mode VARCHAR(20) NOT NULL DEFAULT 'closed', -- 'closed', 'open', 'emergency'
    sales_open_date DATE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 17. Wastage Table
CREATE TABLE wastage (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    wastage_date DATE NOT NULL,
    quantity_wasted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 18. Ideas Table
CREATE TABLE ideas (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Idea Upvotes Table
CREATE TABLE idea_upvotes (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, user_id)
);

-- 20. Kiosk API Tokens Table
CREATE TABLE kiosk_api_tokens (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token_name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- 21. Kiosk Audit Log Table
CREATE TABLE kiosk_audit_log (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    kiosk_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 22. Kiosk Auth Lockouts Table
CREATE TABLE kiosk_auth_lockouts (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(100) NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    last_attempt_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 23. Closing Balance Table
CREATE TABLE closing_balance (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dates DATE DEFAULT CURRENT_DATE,
    balance DECIMAL(12, 2) NOT NULL,
    cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 24. Morning Balance Table
CREATE TABLE morning_balance (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    dates DATE DEFAULT CURRENT_DATE,
    balance DECIMAL(12, 2) NOT NULL,
    cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 25. Special Item Table
CREATE TABLE special_item (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    food_name VARCHAR(100) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 26. Bulk Order Payment Log Table
CREATE TABLE bulk_order_payment_log (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    department_id INTEGER NOT NULL, -- references departments or users if customized
    amount DECIMAL(10, 2) NOT NULL,
    logged_by INTEGER NOT NULL REFERENCES users(id),
    payment_method VARCHAR(20) NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 27. Cashier Requests Table
CREATE TABLE cashier_requests (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 28. Faculty Bulk Requests Table
CREATE TABLE faculty_bulk_requests (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    delivery_time TIME NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- 29. Faculty Bulk Items Table
CREATE TABLE faculty_bulk_items (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES faculty_bulk_requests(id) ON DELETE CASCADE,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);
