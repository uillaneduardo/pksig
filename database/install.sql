-- PK SIG Database Installation Schema
-- Target: MySQL 8.0+ / MariaDB

-- Enable strict modes and transactions
SET FOREIGN_KEY_CHECKS = 0;

-- 1. App Meta & Versioning
DROP TABLE IF EXISTS app_meta;
CREATE TABLE app_meta (
    meta_key VARCHAR(100) PRIMARY KEY,
    meta_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_meta (meta_key, meta_value) VALUES ('version', '1.0.0'), ('installed_at', NOW());

-- 2. Administrators
DROP TABLE IF EXISTS admins;
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    INDEX idx_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Login Attempts
DROP TABLE IF EXISTS login_attempts;
CREATE TABLE login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success TINYINT(1) NOT NULL,
    INDEX idx_login_attempts_username (username),
    INDEX idx_login_attempts_time (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Company Settings
DROP TABLE IF EXISTS company_settings;
CREATE TABLE company_settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_id VARCHAR(50), -- CPF or CNPJ
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(100),
    address_text TEXT,
    logo_path VARCHAR(255),
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_company_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. System Settings
DROP TABLE IF EXISTS system_settings;
CREATE TABLE system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    system_name VARCHAR(100) DEFAULT 'PK SIG',
    currency VARCHAR(10) DEFAULT 'BRL',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
    records_per_page INT DEFAULT 15,
    prefix_client VARCHAR(10) DEFAULT 'CLI',
    prefix_equipment VARCHAR(10) DEFAULT 'EQP',
    prefix_os VARCHAR(10) DEFAULT 'OS',
    prefix_guide VARCHAR(10) DEFAULT 'GUIA',
    prefix_warranty VARCHAR(10) DEFAULT 'GAR',
    include_year_in_code TINYINT(1) DEFAULT 1,
    digits_count INT DEFAULT 6,
    default_delay_alert_days INT DEFAULT 5,
    default_tax_rate DECIMAL(5,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_id CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default system settings
INSERT INTO system_settings (id) VALUES (1);

-- 6. Clients
DROP TABLE IF EXISTS clients;
CREATE TABLE clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('PF', 'PJ') NOT NULL,
    name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(50) NOT NULL,
    rg_ie VARCHAR(50),
    responsible VARCHAR(255), -- for PJ
    birth_date DATE,
    email VARCHAR(100),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    zip_code VARCHAR(20),
    street VARCHAR(255),
    number VARCHAR(50),
    complement VARCHAR(255),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(50),
    notes TEXT,
    status ENUM('ativo', 'inativo') DEFAULT 'ativo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clients_code (code),
    INDEX idx_clients_name (name),
    INDEX idx_clients_cpf_cnpj (cpf_cnpj),
    INDEX idx_clients_phone (phone),
    INDEX idx_clients_whatsapp (whatsapp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Equipment Categories
DROP TABLE IF EXISTS equipment_categories;
CREATE TABLE equipment_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    notes TEXT,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial categories
INSERT INTO equipment_categories (name) VALUES 
('Notebook'), 
('Desktop / PC'), 
('Smartphone'), 
('Tablet'), 
('Impressora'), 
('Videogame / Console'), 
('Monitor');

-- 8. Reception Accessories
DROP TABLE IF EXISTS reception_accessories;
CREATE TABLE reception_accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial accessories
INSERT INTO reception_accessories (name) VALUES 
('Carregador / Fonte'), 
('Cabo de Força'), 
('Bateria'), 
('Capa Protetora'), 
('Película de Proteção'), 
('Controle / Joystick'), 
('Cartão de Memória'), 
('Cabo HDMI'), 
('Mouse sem Fio'), 
('Teclado');

-- 9. Category-Accessory Mapping
DROP TABLE IF EXISTS equipment_category_accessories;
CREATE TABLE equipment_category_accessories (
    category_id INT NOT NULL,
    accessory_id INT NOT NULL,
    PRIMARY KEY (category_id, accessory_id),
    FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES reception_accessories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Map charging adapter to all
INSERT INTO equipment_category_accessories (category_id, accessory_id)
SELECT c.id, a.id FROM equipment_categories c, reception_accessories a 
WHERE a.name IN ('Carregador / Fonte', 'Bateria');

-- 10. Equipments
DROP TABLE IF EXISTS equipments;
CREATE TABLE equipments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    imei VARCHAR(100),
    asset_tag VARCHAR(100), -- Patrimônio
    responsible VARCHAR(100),
    color VARCHAR(50),
    notes TEXT,
    status ENUM('Disponível', 'Em manutenção', 'Arquivado', 'Descartado') DEFAULT 'Disponível',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE RESTRICT,
    INDEX idx_equipments_code (code),
    INDEX idx_equipments_serial (serial_number),
    INDEX idx_equipments_imei (imei),
    INDEX idx_equipments_asset (asset_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Service Order Statuses
DROP TABLE IF EXISTS service_order_statuses;
CREATE TABLE service_order_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    position INT NOT NULL DEFAULT 0,
    is_system TINYINT(1) DEFAULT 0,
    active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial statuses
INSERT INTO service_order_statuses (name, position, is_system) VALUES 
('Recebida', 1, 1),
('Em análise', 2, 1),
('Aguardando aprovação', 3, 1),
('Aguardando peça', 4, 1),
('Em manutenção', 5, 1),
('Pronta', 6, 1),
('Entregue', 7, 1),
('Cancelada', 8, 1);

-- 12. Service Orders (OS)
DROP TABLE IF EXISTS service_orders;
CREATE TABLE service_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    equipment_id INT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    technician_name VARCHAR(255),
    status_id INT NOT NULL,
    status_name VARCHAR(100) NOT NULL, -- cache name for quick loading
    entry_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    promise_date DATE,
    completion_date TIMESTAMP NULL,
    problem_reported TEXT NOT NULL,
    technical_defect TEXT,          -- Análise Técnica: Defeito encontrado
    technical_diagnosis TEXT,       -- Análise Técnica: Diagnóstico
    technical_service_recommended TEXT, -- Análise Técnica: Serviço recomendado
    technical_parts_needed TEXT,    -- Análise Técnica: Peças necessárias
    technical_estimated_hours DECIMAL(5,2), -- Análise Técnica: Tempo estimado
    technical_notes TEXT,           -- Análise Técnica: Observações técnicas
    reception_equipment_state TEXT, -- Recepção: Estado do equipamento
    reception_notes TEXT,           -- Recepção: Observações adicionais
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES service_order_statuses(id) ON DELETE RESTRICT,
    INDEX idx_os_code (code),
    INDEX idx_os_status (status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Service Order Accessories
DROP TABLE IF EXISTS service_order_accessories;
CREATE TABLE service_order_accessories (
    service_order_id INT NOT NULL,
    accessory_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (service_order_id, accessory_name),
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Budget Items
DROP TABLE IF EXISTS budget_items;
CREATE TABLE budget_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_order_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    type ENUM('Serviço', 'Peça', 'Mão de obra') NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    unit_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_value DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_value) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Payment Methods
DROP TABLE IF EXISTS payment_methods;
CREATE TABLE payment_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    allows_installments TINYINT(1) DEFAULT 0,
    max_installments INT DEFAULT 1,
    notes TEXT,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial payment methods
INSERT INTO payment_methods (name, allows_installments, max_installments) VALUES 
('Dinheiro', 0, 1),
('PIX', 0, 1),
('Cartão de Crédito', 1, 12),
('Cartão de Débito', 0, 1),
('Boleto Bancário', 1, 3);

-- 16. Payment Guides
DROP TABLE IF EXISTS payment_guides;
CREATE TABLE payment_guides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    service_order_id INT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    total_amount DECIMAL(12,2) NOT NULL,
    expected_method_id INT,
    installments_count INT DEFAULT 1,
    issue_date DATE NOT NULL,
    due_date DATE,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance_amount DECIMAL(12,2) NOT NULL,
    status ENUM('Em aberto', 'Parcial', 'Quitada', 'Vencida', 'Cancelada') DEFAULT 'Em aberto',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE RESTRICT,
    FOREIGN KEY (expected_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
    INDEX idx_guides_code (code),
    INDEX idx_guides_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Payment Installments (Parcelas)
DROP TABLE IF EXISTS payment_installments;
CREATE TABLE payment_installments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_guide_id INT NOT NULL,
    installment_number INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('Pendente', 'Pago', 'Atrasado', 'Cancelado') DEFAULT 'Pendente',
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    paid_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_guide_id) REFERENCES payment_guides(id) ON DELETE CASCADE,
    UNIQUE KEY uq_guide_installment (payment_guide_id, installment_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Payments (Pagamentos realizados)
DROP TABLE IF EXISTS payments;
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_guide_id INT NOT NULL,
    installment_id INT NULL, -- Can link to a specific installment if relevant
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    method_id INT NOT NULL,
    method_name VARCHAR(100) NOT NULL, -- Cache name in case method deleted
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_guide_id) REFERENCES payment_guides(id) ON DELETE RESTRICT,
    FOREIGN KEY (installment_id) REFERENCES payment_installments(id) ON DELETE SET NULL,
    FOREIGN KEY (method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. Warranty Rules
DROP TABLE IF EXISTS warranty_rules;
CREATE TABLE warranty_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    duration_days INT NOT NULL,
    terms_description TEXT,
    category_id INT, -- Optional category specific rule
    service_type VARCHAR(100), -- Type of service e.g. "Reparo de placa"
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES equipment_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial warranty rules
INSERT INTO warranty_rules (name, duration_days) VALUES 
('Garantia Legal 90 dias', 90), 
('Garantia Estendida 180 dias', 180), 
('Garantia Cortesia 30 dias', 30);

-- 20. Warranties Issued
DROP TABLE IF EXISTS warranties;
CREATE TABLE warranties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    equipment_id INT NOT NULL,
    service_order_id INT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('Vigente', 'Expirada', 'Cancelada') DEFAULT 'Vigente',
    pdf_reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE RESTRICT,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE RESTRICT,
    INDEX idx_warranties_code (code),
    INDEX idx_warranties_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Attachments
DROP TABLE IF EXISTS attachments;
CREATE TABLE attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_order_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    description TEXT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
