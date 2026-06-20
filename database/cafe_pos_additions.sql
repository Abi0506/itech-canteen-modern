USE cafe_pos;

-- Add chef role
INSERT IGNORE INTO roles (name) VALUES ('chef');

-- Add current_status, current_waiter_id, current_order_id to tables_master
ALTER TABLE tables_master
    ADD COLUMN current_status ENUM('available','reserved','occupied') NOT NULL DEFAULT 'available' AFTER is_active,
    ADD COLUMN current_waiter_id INT UNSIGNED NULL AFTER current_status,
    ADD COLUMN current_order_id INT UNSIGNED NULL AFTER current_waiter_id;

ALTER TABLE tables_master
    ADD CONSTRAINT fk_tm_waiter FOREIGN KEY (current_waiter_id) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tm_order  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Add waiter_id to orders
ALTER TABLE orders
    ADD COLUMN waiter_id INT UNSIGNED NULL AFTER placed_by_user_id;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_waiter FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add chef claim columns to order_items
ALTER TABLE order_items
    ADD COLUMN claimed_by INT UNSIGNED NULL AFTER notes,
    ADD COLUMN claimed_at TIMESTAMP NULL AFTER claimed_by,
    ADD COLUMN completed_at TIMESTAMP NULL AFTER claimed_at;

ALTER TABLE order_items
    ADD CONSTRAINT fk_oi_chef FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE order_items
    MODIFY COLUMN kitchen_status ENUM('pending','claimed','done','to_cook','preparing','completed') NOT NULL DEFAULT 'to_cook';

UPDATE order_items SET kitchen_status='to_cook' WHERE kitchen_status='pending';
UPDATE order_items SET kitchen_status='preparing' WHERE kitchen_status='claimed';
UPDATE order_items SET kitchen_status='completed' WHERE kitchen_status='done';

ALTER TABLE order_items
    MODIFY COLUMN kitchen_status ENUM('to_cook','preparing','completed') NOT NULL DEFAULT 'to_cook';

-- Loyalty credits table
CREATE TABLE IF NOT EXISTS loyalty_credits (
    id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    customer_id     INT UNSIGNED NOT NULL,
    credits_earned  INT UNSIGNED NOT NULL DEFAULT 0,
    credits_redeemed INT UNSIGNED NOT NULL DEFAULT 0,
    total_credits   INT NOT NULL DEFAULT 0,
    last_visit_at   TIMESTAMP NULL,
    CONSTRAINT uq_loyalty_customer UNIQUE (customer_id),
    CONSTRAINT fk_lc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Loyalty transactions ledger
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    customer_id     INT UNSIGNED NOT NULL,
    order_id        INT UNSIGNED NULL,
    type            ENUM('earn','redeem') NOT NULL,
    amount          INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lt_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_lt_order    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Stock reservations table
CREATE TABLE IF NOT EXISTS stock_reservations (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    order_item_id   BIGINT UNSIGNED NOT NULL,
    product_id      INT UNSIGNED NOT NULL,
    quantity         DECIMAL(10,2) NOT NULL,
    status          ENUM('reserved','finalized','released') NOT NULL DEFAULT 'reserved',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sr_oi FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_sr_product FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Additional indexes
CREATE INDEX idx_loyalty_credits_customer ON loyalty_credits(customer_id);
CREATE INDEX idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_tx_order ON loyalty_transactions(order_id);
CREATE INDEX idx_stock_res_oi ON stock_reservations(order_item_id);
CREATE INDEX idx_stock_res_status ON stock_reservations(status);
CREATE INDEX idx_orders_waiter ON orders(waiter_id);
CREATE INDEX idx_oi_claimed ON order_items(claimed_by);
CREATE INDEX idx_tm_status ON tables_master(current_status);
