-- PK SIG Initial Seed Data
-- This can be used to populate the database with initial sample data for demonstration.

-- Ensure we insert some sample data (only if clients is empty)
-- Note: install.sql already populates master data like categories, accessories, statuses, and payment methods.

-- 1. Sample Clients
INSERT INTO clients (code, type, name, cpf_cnpj, rg_ie, responsible, email, phone, whatsapp, zip_code, street, number, neighborhood, city, state, notes, status) VALUES 
('CLI-2026-000001', 'PF', 'Uillan Eduardo Lira da Silva', '009.988.777-11', '12.345.678-9', NULL, 'uillan@example.com', '(11) 98888-7777', '(11) 98888-7777', '01001-000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP', 'Cliente preferencial da assistência.', 'ativo'),
('CLI-2026-000002', 'PJ', 'Tech Solutions Ltda', '12.345.678/0001-99', 'Isento', 'Carlos Eduardo', 'contato@techsolutions.com', '(11) 3333-4444', '(11) 97777-6666', '04571-010', 'Av. Engenheiro Luís Carlos Berrini', '1000', 'Cidade Monções', 'São Paulo', 'SP', 'Faturamento mensal autorizado.', 'ativo');

-- 2. Sample Equipments
INSERT INTO equipments (client_id, code, category_id, brand, model, serial_number, imei, asset_tag, responsible, color, notes, status) VALUES 
(1, 'EQP-2026-000001', 1, 'Dell', 'Vostro 14 - 3468', 'TI-48912', NULL, 'PAT-2026-991', NULL, 'Preto', 'Apresenta lentidão extrema.', 'Disponível'),
(2, 'EQP-2026-000002', 3, 'Apple', 'iPhone 13 Pro', 'G6VH9XYZ12', '351234567890123', 'TS-IP-04', 'Carlos Eduardo', 'Grafite', 'Tela quebrada e bateria estufada.', 'Em manutenção');

-- 3. Sample Service Orders
INSERT INTO service_orders (client_id, equipment_id, code, technician_name, status_id, status_name, problem_reported, reception_equipment_state, reception_notes) VALUES 
(1, 1, 'OS-2026-000001', 'Suporte TI (Administrador)', 1, 'Recebida', 'Não liga. Led indicador pisca 3 vezes em laranja.', 'Teclado com marcas de uso, carcaça riscada na parte inferior.', 'Deixado com carregador original.'),
(2, 2, 'OS-2026-000002', 'Suporte TI (Administrador)', 5, 'Em manutenção', 'Substituir módulo de tela e bateria.', 'Perfeito estado exceto tela trincada.', 'Aparelho carregado.');

-- 4. Sample Service Order Accessories
INSERT INTO service_order_accessories (service_order_id, accessory_name) VALUES 
(1, 'Carregador / Fonte'),
(2, 'Capa Protetora');

-- 5. Sample Budget Items
INSERT INTO budget_items (service_order_id, description, type, quantity, unit_value) VALUES 
(1, 'Formatação e Instalação do Windows 11', 'Serviço', 1.00, 150.00),
(1, 'SSD 240GB Kingston', 'Peça', 1.00, 180.00),
(2, 'Tela de reposição iPhone 13 Pro Original', 'Peça', 1.00, 1200.00),
(2, 'Bateria iPhone 13 Pro Original', 'Peça', 1.00, 350.00),
(2, 'Mão de obra para troca de tela e bateria', 'Mão de obra', 1.00, 200.00);
