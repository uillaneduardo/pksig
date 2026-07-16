import fs from "fs";
import path from "path";

// Raw SQL content from phpMyAdmin dump
const sqlContent = `
-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 16/07/2026 às 00:45
-- Versão do servidor: 11.8.8-MariaDB-log
-- Versão do PHP: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Banco de dados: \`u770116055_pksig\`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela \`admins\`
--

CREATE TABLE \`admins\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`username\` varchar(100) NOT NULL,
  \`password_hash\` varchar(255) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  \`last_login_at\` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`admins\`
--

INSERT INTO \`admins\` (\`id\`, \`name\`, \`username\`, \`password_hash\`, \`created_at\`, \`updated_at\`, \`last_login_at\`) VALUES
(1, 'Uillan', 'uillan', '$2b$10$4VIF66OaD3alNiZ8OmRiiuqvq0XGQ2uGJ/RWx2qzdPU9bTfys16Ui', '2026-07-13 00:56:26', '2026-07-16 00:41:52', '2026-07-16 00:41:52');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`admin_sessions\`
--

CREATE TABLE \`admin_sessions\` (
  \`id\` int(11) NOT NULL,
  \`admin_id\` int(11) NOT NULL,
  \`token_hash\` varchar(64) NOT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`expires_at\` timestamp NOT NULL,
  \`last_activity_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  \`ip_address\` varchar(45) DEFAULT NULL,
  \`user_agent\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`admin_sessions\`
--

INSERT INTO \`admin_sessions\` (\`id\`, \`admin_id\`, \`token_hash\`, \`created_at\`, \`expires_at\`, \`last_activity_at\`, \`ip_address\`, \`user_agent\`) VALUES
(1, 1, 'd11c18a5a1031dbbfccaf99ff00136a45cfd6556197fbb5a104f516bbbb393c4', '2026-07-16 00:41:52', '2026-07-17 00:41:52', '2026-07-16 00:42:31', '127.0.0.1', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:152.0) Gecko/20100101 Firefox/152.0');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`app_meta\`
--

CREATE TABLE \`app_meta\` (
  \`meta_key\` varchar(100) NOT NULL,
  \`meta_value\` varchar(255) NOT NULL,
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`app_meta\`
--

INSERT INTO \`app_meta\` (\`meta_key\`, \`meta_value\`, \`updated_at\`) VALUES
('installed_at', '2026-07-13 00:56:24', '2026-07-13 00:56:24'),
('version', '1.0.0', '2026-07-13 00:56:24');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`attachments\`
--

CREATE TABLE \`attachments\` (
  \`id\` int(11) NOT NULL,
  \`service_order_id\` int(11) NOT NULL,
  \`filename\` varchar(255) NOT NULL,
  \`file_path\` varchar(255) NOT NULL,
  \`file_size\` int(11) NOT NULL,
  \`mime_type\` varchar(100) NOT NULL,
  \`uploaded_at\` timestamp NULL DEFAULT current_timestamp(),
  \`description\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`attachments\`
--

INSERT INTO \`attachments\` (\`id\`, \`service_order_id\`, \`filename\`, \`file_path\`, \`file_size\`, \`mime_type\`, \`uploaded_at\`, \`description\`) VALUES
(9, 18, 'VID_20260713_123740.mp4', 'storage/attachments/1783958786740-VID_20260713_123740.mp4', 25430358, 'video/mp4', '2026-07-13 16:06:27', NULL),
(10, 18, 'IMG_20260713_123734.jpg', 'storage/attachments/1783958789094-IMG_20260713_123734.jpg', 1096865, 'image/jpeg', '2026-07-13 16:06:29', NULL),
(11, 18, 'IMG_20260713_123732.jpg', 'storage/attachments/1783958789990-IMG_20260713_123732.jpg', 2016776, 'image/jpeg', '2026-07-13 16:06:30', NULL),
(12, 18, 'IMG_20260713_123731.jpg', 'storage/attachments/1783958790552-IMG_20260713_123731.jpg', 1997081, 'image/jpeg', '2026-07-13 16:06:30', NULL),
(13, 18, 'IMG_20260713_123729.jpg', 'storage/attachments/1783958791928-IMG_20260713_123729.jpg', 2251955, 'image/jpeg', '2026-07-13 16:06:32', NULL),
(14, 18, 'IMG_20260713_123728.jpg', 'storage/attachments/1783958792455-IMG_20260713_123728.jpg', 1962251, 'image/jpeg', '2026-07-13 16:06:32', NULL),
(15, 18, 'IMG_20260713_123727.jpg', 'storage/attachments/1783958792873-IMG_20260713_123727.jpg', 1021541, 'image/jpeg', '2026-07-13 16:06:33', NULL),
(16, 18, 'IMG_20260713_123725.jpg', 'storage/attachments/1783958793994-IMG_20260713_123725.jpg', 1881138, 'image/jpeg', '2026-07-13 16:06:34', NULL),
(17, 18, 'IMG_20260713_123711.jpg', 'storage/attachments/1783958794580-IMG_20260713_123711.jpg', 1857942, 'image/jpeg', '2026-07-13 16:06:34', NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`budget_items\`
--

CREATE TABLE \`budget_items\` (
  \`id\` int(11) NOT NULL,
  \`service_order_id\` int(11) NOT NULL,
  \`description\` varchar(255) NOT NULL,
  \`type\` enum('Serviço','Peça','Mão de obra') NOT NULL,
  \`quantity\` decimal(10,2) NOT NULL DEFAULT 1.00,
  \`unit_value\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`total_value\` decimal(12,2) GENERATED ALWAYS AS (\`quantity\` * \`unit_value\`) STORED,
  \`created_at\` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`budget_items\`
--

INSERT INTO \`budget_items\` (\`id\`, \`service_order_id\`, \`description\`, \`type\`, \`quantity\`, \`unit_value\`, \`created_at\`) VALUES
(1, 17, 'Reparo de Placa', 'Serviço', 1.00, 150.00, '2026-07-13 04:47:29'),
(2, 17, 'SSD SATA 120GB ', 'Peça', 1.00, 150.00, '2026-07-13 04:47:49'),
(3, 17, 'MEM RAM DDR3 8GB 1600MHZ PC3L', 'Peça', 1.00, 200.00, '2026-07-13 04:48:23'),
(4, 17, 'Formatação + Windows 10 + Office', 'Serviço', 1.00, 0.00, '2026-07-13 04:49:53'),
(6, 18, 'Instalação de Periférico Smartphone', 'Peça', 1.00, 0.00, '2026-07-13 15:34:05'),
(7, 18, 'Tela Xiaomi Redmi Note 13 4G Incell', 'Peça', 1.00, 70.00, '2026-07-13 15:34:18'),
(8, 20, 'Recondicionamento de Bateria', 'Serviço', 1.00, 60.00, '2026-07-14 17:43:46');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`clients\`
--

CREATE TABLE \`clients\` (
  \`id\` int(11) NOT NULL,
  \`code\` varchar(50) NOT NULL,
  \`type\` enum('PF','PJ') NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`cpf_cnpj\` varchar(50) NOT NULL,
  \`rg_ie\` varchar(50) DEFAULT NULL,
  \`responsible\` varchar(255) DEFAULT NULL,
  \`birth_date\` date DEFAULT NULL,
  \`email\` varchar(100) DEFAULT NULL,
  \`phone\` varchar(50) DEFAULT NULL,
  \`whatsapp\` varchar(50) DEFAULT NULL,
  \`zip_code\` varchar(20) DEFAULT NULL,
  \`street\` varchar(255) DEFAULT NULL,
  \`number\` varchar(50) DEFAULT NULL,
  \`complement\` varchar(255) DEFAULT NULL,
  \`neighborhood\` varchar(100) DEFAULT NULL,
  \`city\` varchar(100) DEFAULT NULL,
  \`state\` varchar(50) DEFAULT NULL,
  \`notes\` text DEFAULT NULL,
  \`status\` enum('ativo','inativo') DEFAULT 'ativo',
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`clients\`
--

INSERT INTO \`clients\` (\`id\`, \`code\`, \`type\`, \`name\`, \`cpf_cnpj\`, \`rg_ie\`, \`responsible\`, \`birth_date\`, \`email\`, \`phone\`, \`whatsapp\`, \`zip_code\`, \`street\`, \`number\`, \`complement\`, \`neighborhood\`, \`city\`, \`state\`, \`notes\`, \`status\`, \`created_at\`, \`updated_at\`) VALUES
(1, 'CLI-2026-000001', 'PF', 'Uillan Eduardo Lira da Silva', '093.706.904-33', NULL, NULL, '1993-05-10', 'uillandr@gmail.com', '(81) 99565-5293', '(81) 99565-5293', '54330-560', 'Rua Rui Barbosa', '340', NULL, 'Cajueiro Seco', 'Jaboatão dos Guararapes', 'PE', NULL, 'ativo', '2026-07-13 00:58:49', '2026-07-13 00:58:49'),
(2, 'CLI-2026-000002', 'PF', 'Gleison Vanderlei da Silva', '110.801.644-89', NULL, NULL, NULL, NULL, '(81) 99608-8394', '(81) 99608-8394', '54352-150', 'Rua Buganville', '115', NULL, 'Muribeca', 'Jaboatão dos Guararapes', 'PE', NULL, 'ativo', '2026-07-13 03:58:53', '2026-07-13 03:58:53'),
(3, 'CLI-2026-000003', 'PF', 'Williane Pereira da Silva', '111.281.444-25', NULL, NULL, NULL, NULL, '(81) 99655-3523', '(81) 99655-3523', '54330-775', 'Rua Nova Piedade', '470', NULL, 'Cajueiro Seco', 'Jaboatão dos Guararapes', 'PE', NULL, 'ativo', '2026-07-13 06:34:55', '2026-07-13 06:34:55'),
(4, 'CLI-2026-000004', 'PF', 'Sidynei Tiago Basílio de Oliveira', '059.951.454-01', NULL, NULL, '1985-04-29', 'advtiagobasilio@gmail.com', '(81) 99922-6397', '(81) 99922-6397', '34360-160', 'Rua Arraial do Bom Jesus', '100', NULL, 'Marcos Freire', 'Jaboatão dos Guararapes', 'PE', NULL, 'ativo', '2026-07-13 15:22:09', '2026-07-13 16:05:16'),
(5, 'CLI-2026-000005', 'PF', 'Adriano Arlindo de Moura', '022.653.284-48', NULL, NULL, NULL, 'adrianoarlindodemoura99@gmail.com', '(81) 99945-4455', '(81) 99945-4455', '54360-070', 'Rua Forte do Brum', '40', NULL, 'Marcos Freire', 'Jaboatão dos Guararapes', 'PE', NULL, 'ativo', '2026-07-13 16:36:04', '2026-07-13 16:36:04'),
(6, 'CLI-2026-000006', 'PF', 'Cassia Maria Rodrigues ', '070.535.734-19', NULL, NULL, NULL, NULL, '(81) 99721-3532', '(81) 99721-3532', '54420-140', 'Rua Guanambi', '819', 'Bloco 2, apto 301', 'Piedade', 'Jaboatão dos Guararapes', 'PE', 'RESIDENCIAL CORAIS F', 'ativo', '2026-07-14 17:30:23', '2026-07-14 17:30:23');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`company_settings\`
--

CREATE TABLE \`company_settings\` (
  \`id\` int(11) NOT NULL DEFAULT 1,
  \`company_name\` varchar(255) NOT NULL,
  \`trade_name\` varchar(255) DEFAULT NULL,
  \`tax_id\` varchar(50) DEFAULT NULL,
  \`phone\` varchar(50) DEFAULT NULL,
  \`whatsapp\` varchar(50) DEFAULT NULL,
  \`email\` varchar(100) DEFAULT NULL,
  \`address_text\` text DEFAULT NULL,
  \`logo_path\` varchar(255) DEFAULT NULL,
  \`notes\` text DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Despejando dados para a tabela \`company_settings\`
--

INSERT INTO \`company_settings\` (\`id\`, \`company_name\`, \`trade_name\`, \`tax_id\`, \`phone\`, \`whatsapp\`, \`email\`, \`address_text\`, \`logo_path\`, \`notes\`, \`updated_at\`) VALUES
(1, 'UILLAN EDUARDO LIRA DA SILVA', 'PKSIG', '24889125000182', NULL, '81995655293', 'uillandr@gmail.com', 'Rua Rui Barbosa, 340, Cajueiro Seco, Jaboatão dos Guararapes, Pernambuco, Brasil', NULL, NULL, '2026-07-13 06:26:40');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`equipments\`
--

CREATE TABLE \`equipments\` (
  \`id\` int(11) NOT NULL,
  \`client_id\` int(11) NOT NULL,
  \`code\` varchar(50) NOT NULL,
  \`category_id\` int(11) NOT NULL,
  \`brand\` varchar(100) NOT NULL,
  \`model\` varchar(100) NOT NULL,
  \`serial_number\` varchar(100) DEFAULT NULL,
  \`imei\` varchar(100) DEFAULT NULL,
  \`asset_tag\` varchar(100) DEFAULT NULL,
  \`responsible\` varchar(100) DEFAULT NULL,
  \`color\` varchar(50) DEFAULT NULL,
  \`notes\` text DEFAULT NULL,
  \`status\` enum('Disponível','Em manutenção','Arquivado','Descartado') DEFAULT 'Disponível',
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`equipments\`
--

INSERT INTO \`equipments\` (\`id\`, \`client_id\`, \`code\`, \`category_id\`, \`brand\`, \`model\`, \`serial_number\`, \`imei\`, \`asset_tag\`, \`responsible\`, \`color\`, \`notes\`, \`status\`, \`created_at\`, \`updated_at\`) VALUES
(1, 2, 'EQP-2026-000001', 1, 'Acer', 'Aspire ES1-411', NULL, NULL, NULL, 'Uillan Eduardo', 'Preto', 'Com marcas de uso, sinal de que entrou em contato com água, bastante sujo.', 'Disponível', '2026-07-13 04:02:05', '2026-07-13 05:47:21'),
(2, 4, 'EQP-2026-000002', 2, 'Xiaomi', 'Redmi Note 13 4G', '60203/04WW00357', '868796072822160', NULL, 'Uillan', 'Preto', 'Marcas de uso. Cor preta. Conservado.', 'Em manutenção', '2026-07-13 15:28:39', '2026-07-13 15:29:36'),
(3, 5, 'EQP-2026-000003', 6, 'Sem Marca', 'Não Informado', NULL, NULL, NULL, 'Adriano', 'Preto', 'Usada. Marcas de Uso', 'Em manutenção', '2026-07-13 16:43:25', '2026-07-13 16:48:22'),
(4, 6, 'EQP-2026-000004', 9, 'Amazon Kindle', '7th Gen', NULL, NULL, NULL, NULL, 'Preto', 'Conservado, com caixa.', 'Disponível', '2026-07-14 17:38:17', '2026-07-14 17:43:28');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`equipment_categories\`
--

CREATE TABLE \`equipment_categories\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`active\` tinyint(1) DEFAULT 1,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`notes\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`equipment_categories\`
--

INSERT INTO \`equipment_categories\` (\`id\`, \`name\`, \`active\`, \`created_at\`, \`notes\`) VALUES
(1, 'Notebook', 1, '2026-07-13 03:49:30', 'Notebook'),
(2, 'Celular Android', 1, '2026-07-13 03:49:49', NULL),
(3, 'Celular Apple', 1, '2026-07-13 03:49:56', NULL),
(4, 'Desktop', 1, '2026-07-13 03:50:04', NULL),
(5, 'Impressora', 1, '2026-07-13 03:50:22', NULL),
(6, 'Máquina de Fumaça', 1, '2026-07-13 16:36:57', NULL),
(7, 'Iluminação', 1, '2026-07-13 16:37:07', NULL),
(8, 'Traje de Festa', 1, '2026-07-13 16:37:16', NULL),
(9, 'Ebook', 1, '2026-07-14 17:26:23', 'Leitor de livros digital.'),
(10, 'Macbook', 1, '2026-07-15 02:42:59', NULL),
(11, 'Ipad', 1, '2026-07-15 02:43:07', NULL),
(12, 'Iphone', 1, '2026-07-15 02:43:13', NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`equipment_category_accessories\`
--

CREATE TABLE \`equipment_category_accessories\` (
  \`category_id\` int(11) NOT NULL,
  \`accessory_id\` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela \`financial_categories\`
--

CREATE TABLE \`financial_categories\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`type\` enum('entrada','saida') NOT NULL,
  \`active\` tinyint(1) DEFAULT 1,
  \`created_at\` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`financial_categories\`
--

INSERT INTO \`financial_categories\` (\`id\`, \`name\`, \`type\`, \`active\`, \`created_at\`) VALUES
(1, 'Ordem de Serviço', 'entrada', 1, '2026-07-14 16:53:10'),
(2, 'Venda de Produto', 'entrada', 1, '2026-07-14 16:53:10'),
(3, 'Outras Receitas', 'entrada', 1, '2026-07-14 16:53:10'),
(4, 'Compra de Peças', 'saida', 1, '2026-07-14 16:53:10'),
(5, 'Aluguel / Condomínio', 'saida', 1, '2026-07-14 16:53:10'),
(6, 'Salários e Pró-labore', 'saida', 1, '2026-07-14 16:53:10'),
(7, 'Energia', 'saida', 1, '2026-07-14 16:53:10'),
(8, 'Impostos e Taxas', 'saida', 1, '2026-07-14 16:53:11'),
(9, 'Outras Despesas', 'saida', 1, '2026-07-14 16:53:11'),
(10, 'Transporte', 'saida', 1, '2026-07-14 17:11:46'),
(11, 'Prestação de Serviço', 'entrada', 1, '2026-07-14 17:12:13'),
(12, 'Água', 'saida', 1, '2026-07-15 02:41:58'),
(13, 'Internet', 'saida', 1, '2026-07-15 02:42:03');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`financial_transactions\`
--

CREATE TABLE \`financial_transactions\` (
  \`id\` int(11) NOT NULL,
  \`description\` varchar(255) NOT NULL,
  \`type\` enum('entrada','saida') NOT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`transaction_date\` date NOT NULL,
  \`category_id\` int(11) DEFAULT NULL,
  \`os_id\` int(11) DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  \`payment_id\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`financial_transactions\`
--

INSERT INTO \`financial_transactions\` (\`id\`, \`description\`, \`type\`, \`amount\`, \`transaction_date\`, \`category_id\`, \`os_id\`, \`created_at\`, \`updated_at\`, \`payment_id\`) VALUES
(2, 'Pagamento da OS OS-2026-000001 - Gleison Vanderlei da Silva (Pix)', 'entrada', 500.00, '2026-07-14', NULL, 17, '2026-07-14 17:18:37', '2026-07-14 17:18:37', 6),
(3, 'Uber 11.07.2026', 'saida', 99.00, '2026-07-11', 10, NULL, '2026-07-14 17:19:21', '2026-07-14 17:19:21', NULL),
(4, 'Pagamento da OS OS-2026-000004 - Cassia Maria Rodrigues  (Pix)', 'entrada', 60.00, '2026-07-14', NULL, 20, '2026-07-14 17:44:02', '2026-07-14 17:44:02', 7);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`login_attempts\`
--

CREATE TABLE \`login_attempts\` (
  \`id\` int(11) NOT NULL,
  \`username\` varchar(100) NOT NULL,
  \`ip_address\` varchar(45) NOT NULL,
  \`attempted_at\` timestamp NULL DEFAULT current_timestamp(),
  \`success\` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`login_attempts\`
--

INSERT INTO \`login_attempts\` (\`id\`, \`username\`, \`ip_address\`, \`attempted_at\`, \`success\`) VALUES
(1, 'uillan', '127.0.0.1', '2026-07-13 00:56:36', 1),
(2, 'uillan', '127.0.0.1', '2026-07-13 03:45:30', 1),
(3, 'uillan', '127.0.0.1', '2026-07-13 03:49:06', 1),
(4, 'uillan', '127.0.0.1', '2026-07-13 04:09:47', 1),
(5, 'uillan', '127.0.0.1', '2026-07-13 04:27:11', 1),
(6, 'uillan', '127.0.0.1', '2026-07-13 05:27:18', 1),
(7, 'uillan', '127.0.0.1', '2026-07-13 05:31:14', 1),
(8, 'uillan', '127.0.0.1', '2026-07-13 05:33:36', 1),
(9, 'uillan', '127.0.0.1', '2026-07-13 05:46:20', 1),
(10, 'uillan', '192.168.0.3', '2026-07-13 05:53:20', 1),
(11, 'uillan', '127.0.0.1', '2026-07-13 06:02:29', 1),
(12, 'uillan', '127.0.0.1', '2026-07-13 06:06:42', 1),
(13, 'uillan', '192.168.0.3', '2026-07-13 06:07:16', 1),
(14, 'uillan', '127.0.0.1', '2026-07-13 06:24:32', 1),
(15, 'uillan', '127.0.0.1', '2026-07-13 06:36:38', 1),
(16, 'uillan', '127.0.0.1', '2026-07-13 15:08:30', 1),
(17, 'uillan', '192.168.15.99', '2026-07-13 15:45:24', 1),
(18, 'uillan', '127.0.0.1', '2026-07-13 16:08:22', 1),
(19, 'uillan', '192.168.15.99', '2026-07-13 16:09:12', 1),
(20, 'uillan', '127.0.0.1', '2026-07-14 14:18:49', 1),
(21, 'uillan', '127.0.0.1', '2026-07-14 14:54:55', 1),
(22, 'uillan', '127.0.0.1', '2026-07-14 16:53:19', 1),
(23, 'uillan', '127.0.0.1', '2026-07-14 17:11:08', 1),
(24, 'uillan', '127.0.0.1', '2026-07-15 19:54:21', 1),
(25, 'uillan', '127.0.0.1', '2026-07-15 23:11:54', 1),
(26, 'uillan', '127.0.0.1', '2026-07-15 23:52:37', 1),
(27, 'uillan', '127.0.0.1', '2026-07-15 23:55:48', 1),
(28, 'uillan', '127.0.0.1', '2026-07-15 23:57:10', 1),
(29, 'uillan', '127.0.0.1', '2026-07-16 00:11:55', 1),
(30, 'uillan', '127.0.0.1', '2026-07-16 00:41:52', 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`payments\`
--

CREATE TABLE \`payments\` (
  \`id\` int(11) NOT NULL,
  \`payment_guide_id\` int(11) NOT NULL,
  \`installment_id\` int(11) DEFAULT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`payment_date\` date NOT NULL,
  \`method_id\` int(11) NOT NULL,
  \`method_name\` varchar(100) NOT NULL,
  \`notes\` text DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`payments\`
--

INSERT INTO \`payments\` (\`id\`, \`payment_guide_id\`, \`installment_id\`, \`amount\`, \`payment_date\`, \`method_id\`, \`method_name\`, \`notes\`, \`created_at\`) VALUES
(6, 1, NULL, 500.00, '2026-07-14', 1, 'Pix', NULL, '2026-07-14 17:18:37'),
(7, 3, NULL, 60.00, '2026-07-14', 1, 'Pix', NULL, '2026-07-14 17:44:02');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`payment_guides\`
--

CREATE TABLE \`payment_guides\` (
  \`id\` int(11) NOT NULL,
  \`client_id\` int(11) NOT NULL,
  \`service_order_id\` int(11) NOT NULL,
  \`code\` varchar(50) NOT NULL,
  \`total_amount\` decimal(12,2) NOT NULL,
  \`expected_method_id\` int(11) DEFAULT NULL,
  \`installments_count\` int(11) DEFAULT 1,
  \`issue_date\` date NOT NULL,
  \`due_date\` date DEFAULT NULL,
  \`paid_amount\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`balance_amount\` decimal(12,2) NOT NULL,
  \`status\` enum('Em aberto','Parcial','Quitada','Vencida','Cancelada') DEFAULT 'Em aberto',
  \`notes\` text DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`payment_guides\`
--

INSERT INTO \`payment_guides\` (\`id\`, \`client_id\`, \`service_order_id\`, \`code\`, \`total_amount\`, \`expected_method_id\`, \`installments_count\`, \`issue_date\`, \`due_date\`, \`paid_amount\`, \`balance_amount\`, \`status\`, \`notes\`, \`created_at\`, \`updated_at\`) VALUES
(1, 2, 17, 'GUIA-2026-000001', 500.00, 2, 1, '2026-07-13', '2026-06-03', 500.00, 0.00, 'Quitada', 'R$ 597,16 parcelado em 6x', '2026-07-13 05:18:43', '2026-07-14 17:18:37'),
(2, 4, 18, 'GUIA-2026-000002', 70.00, 2, 1, '2026-07-13', '2026-07-14', 0.00, 70.00, '', 'PAGBANK', '2026-07-13 15:35:45', '2026-07-15 19:59:48'),
(3, 6, 20, 'GUIA-2026-000003', 60.00, 1, 1, '2026-07-14', '2026-07-14', 60.00, 0.00, 'Quitada', NULL, '2026-07-14 17:43:58', '2026-07-14 17:44:03');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`payment_installments\`
--

CREATE TABLE \`payment_installments\` (
  \`id\` int(11) NOT NULL,
  \`payment_guide_id\` int(11) NOT NULL,
  \`installment_number\` int(11) NOT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`due_date\` date NOT NULL,
  \`status\` enum('Pendente','Pago','Atrasado','Cancelado') DEFAULT 'Pendente',
  \`paid_amount\` decimal(12,2) NOT NULL DEFAULT 0.00,
  \`paid_date\` date DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`payment_installments\`
--

INSERT INTO \`payment_installments\` (\`id\`, \`payment_guide_id\`, \`installment_number\`, \`amount\`, \`due_date\`, \`status\`, \`paid_amount\`, \`paid_date\`, \`created_at\`, \`updated_at\`) VALUES
(1, 1, 1, 500.00, '2026-07-13', 'Pago', 500.00, '2026-07-14', '2026-07-13 05:18:43', '2026-07-14 17:18:37'),
(2, 2, 1, 70.00, '2026-07-13', 'Pendente', 0.00, NULL, '2026-07-13 15:35:45', '2026-07-15 19:59:48'),
(3, 3, 1, 60.00, '2026-07-14', 'Pago', 60.00, '2026-07-14', '2026-07-14 17:43:58', '2026-07-14 17:44:03');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`payment_methods\`
--

CREATE TABLE \`payment_methods\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`allows_installments\` tinyint(1) DEFAULT 0,
  \`max_installments\` int(11) DEFAULT 1,
  \`notes\` text DEFAULT NULL,
  \`active\` tinyint(1) DEFAULT 1,
  \`created_at\` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`payment_methods\`
--

INSERT INTO \`payment_methods\` (\`id\`, \`name\`, \`allows_installments\`, \`max_installments\`, \`notes\`, \`active\`, \`created_at\`) VALUES
(1, 'Pix', 0, 1, NULL, 1, '2026-07-13 03:50:29'),
(2, 'Cartão de Crédito', 1, 12, NULL, 1, '2026-07-13 03:50:49'),
(3, 'Cartão de Débito', 0, 1, NULL, 1, '2026-07-13 03:51:01'),
(4, 'Espécie', 0, 1, NULL, 1, '2026-07-13 03:51:09'),
(5, 'Espécie Parcelado', 1, 12, NULL, 1, '2026-07-13 03:51:24');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`reception_accessories\`
--

CREATE TABLE \`reception_accessories\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`active\` tinyint(1) DEFAULT 1,
  \`created_at\` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`reception_accessories\`
--

INSERT INTO \`reception_accessories\` (\`id\`, \`name\`, \`active\`, \`created_at\`) VALUES
(1, 'Cabo Alimentação', 1, '2026-07-13 03:53:20'),
(2, 'Cabo USB', 1, '2026-07-13 03:53:25'),
(3, 'Fonte/Carregador', 1, '2026-07-13 03:53:33'),
(4, 'Capa', 1, '2026-07-13 03:53:36'),
(5, 'Cartão SIM', 1, '2026-07-13 03:53:47'),
(6, 'Cartão SD', 1, '2026-07-13 03:54:09'),
(7, 'Teclado', 1, '2026-07-13 03:54:13'),
(8, 'Mouse', 1, '2026-07-13 03:54:17'),
(9, 'Controle', 1, '2026-07-13 16:48:32'),
(10, 'PowerBank', 1, '2026-07-14 17:14:50'),
(11, 'Caixa', 1, '2026-07-14 17:38:41');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`sequences\`
--

CREATE TABLE \`sequences\` (
  \`type\` varchar(50) NOT NULL,
  \`last_value\` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`sequences\`
--

INSERT INTO \`sequences\` (\`type\`, \`last_value\`) VALUES
('client', 6),
('equipment', 4),
('guide', 3),
('os', 4),
('warranty', 2);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`service_orders\`
--

CREATE TABLE \`service_orders\` (
  \`id\` int(11) NOT NULL,
  \`client_id\` int(11) NOT NULL,
  \`equipment_id\` int(11) NOT NULL,
  \`code\` varchar(50) NOT NULL,
  \`technician_name\` varchar(255) DEFAULT NULL,
  \`status_id\` int(11) NOT NULL,
  \`status_name\` varchar(100) NOT NULL,
  \`entry_date\` timestamp NULL DEFAULT current_timestamp(),
  \`promise_date\` date DEFAULT NULL,
  \`completion_date\` timestamp NULL DEFAULT NULL,
  \`problem_reported\` text NOT NULL,
  \`technical_defect\` text DEFAULT NULL,
  \`technical_diagnosis\` text DEFAULT NULL,
  \`technical_service_recommended\` text DEFAULT NULL,
  \`technical_parts_needed\` text DEFAULT NULL,
  \`technical_estimated_hours\` decimal(5,2) DEFAULT NULL,
  \`technical_notes\` text DEFAULT NULL,
  \`reception_equipment_state\` text DEFAULT NULL,
  \`reception_notes\` text DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`service_orders\`
--

INSERT INTO \`service_orders\` (\`id\`, \`client_id\`, \`equipment_id\`, \`code\`, \`technician_name\`, \`status_id\`, \`status_name\`, \`entry_date\`, \`promise_date\`, \`completion_date\`, \`problem_reported\`, \`technical_defect\`, \`technical_diagnosis\`, \`technical_service_recommended\`, \`technical_parts_needed\`, \`technical_estimated_hours\`, \`technical_notes\`, \`reception_equipment_state\`, \`reception_notes\`, \`created_at\`, \`updated_at\`) VALUES
(17, 2, 1, 'OS-2026-000001', 'Suporte TI (Administrador)', 7, 'Entregue', '2026-07-13 04:27:31', '2026-06-15', '2026-07-13 05:47:20', 'Notebook não liga e teclado não funciona. Cliente usa teclado e mouse externo.', 'Placa em estado de intermitência.\\nLeitor de CD/DVD oxidado.\\nHD com badblocks, não foi possível realizar leitura e recuperação de dados.', 'Sujeira em excesso.\\nOxidação.', 'Reparo de Placa.\\nManutenção Preventiva\\nInstalação de SSD + Windows 10 + Pacote Office\\nInstalação de Memória RAM DDR3 8gb', 'SSD 120GB SATA\\nMEM RAM DDR3 8GB 1600MHZ PC3L', NULL, NULL, 'Notebook com bastante sujeira externa e interna. Marcas de uso e sinal de que entrou em contato com líquido. Ver fotos.', NULL, '2026-07-13 04:27:31', '2026-07-13 05:47:21'),
(18, 4, 2, 'OS-2026-000002', 'Uillan Eduardo', 8, 'Cancelada', '2026-07-13 15:29:36', '2026-07-14', NULL, 'Tela não dá imagem após queda. Sai som normal.', 'Tela com trinco interno visivel. Aparelho sai som normal e vibra. ', 'Tela danificada após queda.\\nNão foi possível testar os demais periféricos.', 'Troca de Tela.', '1 x Tela Xiaomi Redmi Note 13 4G.', 48.00, 'Cliente trouxe a peça.', 'Conservado. Marcas de uso. Tela trincada.', NULL, '2026-07-13 15:29:36', '2026-07-15 20:00:35'),
(19, 5, 3, 'OS-2026-000003', 'Uillan Eduardo', 1, 'Recebida', '2026-07-13 16:48:21', NULL, NULL, 'Liga mas ao apertar o comando a fumaça não sai.', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-13 16:48:21', '2026-07-13 16:48:21'),
(20, 6, 4, 'OS-2026-000004', 'Suporte TI (Administrador)', 7, 'Entregue', '2026-07-14 17:39:25', NULL, '2026-07-14 20:43:28', 'Não carrega. Não acende led de carregamento quando conectado ao carregador.', 'Bateria ruim. Necessário repor ou recondicinoar.', 'Conector de Carga ok.\\nBateria não retém carga ou reconhece quando está no carregador.\\nRealizado testes com outras baterias.', 'Troca de Bateria.\\nRecondicionamento de Bateria.', 'Bateria para Kindle MC-265360-03 7th 8th geração sy69jl wp63gw', 48.00, NULL, 'Conservado. Poucas marcas de uso.', NULL, '2026-07-14 17:39:25', '2026-07-14 17:44:20');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`service_order_accessories\`
--

CREATE TABLE \`service_order_accessories\` (
  \`service_order_id\` int(11) NOT NULL,
  \`accessory_name\` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`service_order_accessories\`
--

INSERT INTO \`service_order_accessories\` (\`service_order_id\`, \`accessory_name\`) VALUES
(17, 'Cabo Alimentação'),
(17, 'Fonte/Carregador'),
(18, 'Capa'),
(19, 'Cabo Alimentação'),
(20, 'Caixa');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`service_order_statuses\`
--

CREATE TABLE \`service_order_statuses\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`position\` int(11) NOT NULL DEFAULT 0,
  \`is_system\` tinyint(1) DEFAULT 0,
  \`active\` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`service_order_statuses\`
--

INSERT INTO \`service_order_statuses\` (\`id\`, \`name\`, \`position\`, \`is_system\`, \`active\`) VALUES
(1, 'Recebida', 1, 1, 1),
(2, 'Em análise', 2, 1, 1),
(3, 'Aguardando aprovação', 3, 1, 1),
(4, 'Aguardando peça', 4, 1, 1),
(5, 'Em manutenção', 5, 1, 1),
(6, 'Pronta', 6, 1, 1),
(7, 'Entregue', 7, 1, 1),
(8, 'Cancelada', 8, 1, 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`system_settings\`
--

CREATE TABLE \`system_settings\` (
  \`id\` int(11) NOT NULL DEFAULT 1,
  \`system_name\` varchar(100) DEFAULT 'PK SIG',
  \`currency\` varchar(10) DEFAULT 'BRL',
  \`date_format\` varchar(20) DEFAULT 'DD/MM/YYYY',
  \`timezone\` varchar(100) DEFAULT 'America/Sao_Paulo',
  \`records_per_page\` int(11) DEFAULT 15,
  \`prefix_client\` varchar(10) DEFAULT 'CLI',
  \`prefix_equipment\` varchar(10) DEFAULT 'EQP',
  \`prefix_os\` varchar(10) DEFAULT 'OS',
  \`prefix_guide\` varchar(10) DEFAULT 'GUIA',
  \`prefix_warranty\` varchar(10) DEFAULT 'GAR',
  \`include_year_in_code\` tinyint(1) DEFAULT 1,
  \`digits_count\` int(11) DEFAULT 6,
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  \`default_delay_alert_days\` int(11) DEFAULT 5,
  \`default_tax_rate\` decimal(5,2) DEFAULT 0.00,
  \`pwa_name\` varchar(255) DEFAULT NULL,
  \`pwa_short_name\` varchar(100) DEFAULT NULL,
  \`pwa_description\` text DEFAULT NULL,
  \`pwa_theme_color\` varchar(50) DEFAULT '#0e131f',
  \`pwa_background_color\` varchar(50) DEFAULT '#ffffff',
  \`pwa_display\` varchar(50) DEFAULT 'standalone',
  \`pwa_icon_url\` longtext DEFAULT NULL
) ;

--
-- Despejando dados para a tabela \`system_settings\`
--

INSERT INTO \`system_settings\` (\`id\`, \`system_name\`, \`currency\`, \`date_format\`, \`timezone\`, \`records_per_page\`, \`prefix_client\`, \`prefix_equipment\`, \`prefix_os\`, \`prefix_guide\`, \`prefix_warranty\`, \`include_year_in_code\`, \`digits_count\`, \`updated_at\`, \`default_delay_alert_days\`, \`default_tax_rate\`, \`pwa_name\`, \`pwa_short_name\`, \`pwa_description\`, \`pwa_theme_color\`, \`pwa_background_color\`, \`pwa_display\`, \`pwa_icon_url\`) VALUES
(1, 'PK SIG', 'R$', 'DD/MM/YYYY', 'America/Sao_Paulo', 15, 'CLI', 'EQP', 'OS', 'GUIA', 'GAR', 1, 6, '2026-07-14 14:56:09', 2, 0.00, 'PKSIG - Gerenciamento de OS', 'PKSIG', 'Sistema de Gerenciamento de Ordem de Serviço para Assistência Técnica', '#1a5fb4', '#ffffff', 'standalone', NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela \`warranties\`
--

CREATE TABLE \`warranties\` (
  \`id\` int(11) NOT NULL,
  \`client_id\` int(11) NOT NULL,
  \`equipment_id\` int(11) NOT NULL,
  \`service_order_id\` int(11) NOT NULL,
  \`code\` varchar(50) NOT NULL,
  \`start_date\` date NOT NULL,
  \`end_date\` date NOT NULL,
  \`status\` enum('Vigente','Expirada','Cancelada') DEFAULT 'Vigente',
  \`pdf_reference\` varchar(255) DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`updated_at\` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`warranties\`
--

INSERT INTO \`warranties\` (\`id\`, \`client_id\`, \`equipment_id\`, \`service_order_id\`, \`code\`, \`start_date\`, \`end_date\`, \`status\`, \`pdf_reference\`, \`created_at\`, \`updated_at\`) VALUES
(1, 2, 1, 17, 'GAR-2026-000001', '2026-06-13', '2026-09-11', 'Vigente', 'cert-GAR-2026-000001.pdf', '2026-07-13 05:47:34', '2026-07-13 05:47:34'),
(2, 6, 4, 20, 'GAR-2026-000002', '2026-07-14', '2026-10-12', 'Vigente', 'cert-GAR-2026-000002.pdf', '2026-07-14 17:44:11', '2026-07-14 17:44:11');

-- --------------------------------------------------------

--
-- Estrutura para tabela \`warranty_rules\`
--

CREATE TABLE \`warranty_rules\` (
  \`id\` int(11) NOT NULL,
  \`name\` varchar(100) NOT NULL,
  \`duration_days\` int(11) NOT NULL,
  \`category_id\` int(11) DEFAULT NULL,
  \`service_type\` varchar(100) DEFAULT NULL,
  \`active\` tinyint(1) DEFAULT 1,
  \`created_at\` timestamp NULL DEFAULT current_timestamp(),
  \`terms_description\` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela \`warranty_rules\`
--

INSERT INTO \`warranty_rules\` (\`id\`, \`name\`, \`duration_days\`, \`category_id\`, \`service_type\`, \`active\`, \`created_at\`, \`terms_description\`) VALUES
(1, 'Garantia Padrão', 90, NULL, NULL, 1, '2026-07-13 03:52:52', 'Garantia 90 dias '),
(2, 'Sem Garantia', 90, NULL, NULL, 1, '2026-07-13 03:53:09', 'Sem Garantia.');
`;

// Simple parser for standard phpMyAdmin INSERT INTO statements
function parseSqlInserts(sql) {
  const result = {};
  
  // Find INSERT INTO blocks
  // Regex matches INSERT INTO \`table_name\` (columns) VALUES (values);
  const insertRegex = /INSERT INTO \`(\w+)\` \(([^)]+)\) VALUES\s*([\s\S]+?);/gi;
  let match;
  
  while ((match = insertRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const columnsStr = match[2];
    const valuesBlock = match[3];
    
    const columns = columnsStr.split(",").map(c => c.trim().replace(/\`/g, ""));
    
    // Parse valuesBlock which can have multiple rows like (val1, val2), (val3, val4)
    // We split rows carefully by looking for ),( or )\s*,\s*\(
    const rows = [];
    let currentPos = 0;
    
    // Simple state machine to parse the tuples
    let inString = false;
    let stringChar = null;
    let currentTuple = "";
    let isEscaped = false;
    
    for (let i = 0; i < valuesBlock.length; i++) {
      const char = valuesBlock[i];
      
      if (isEscaped) {
        currentTuple += char;
        isEscaped = false;
        continue;
      }
      
      if (char === "\\\\") {
        currentTuple += char;
        isEscaped = true;
        continue;
      }
      
      if ((char === "'" || char === '"') && !isEscaped) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (stringChar === char) {
          inString = false;
          stringChar = null;
        }
      }
      
      if (char === "(" && !inString) {
        currentTuple = "";
        continue;
      }
      
      if (char === ")" && !inString) {
        // End of tuple
        rows.push(currentTuple);
        currentTuple = "";
        continue;
      }
      
      if (currentTuple !== "" || inString) {
        currentTuple += char;
      }
    }
    
    const parsedRows = rows.map(row => {
      // Split values by comma outside quotes
      const rowValues = [];
      let cell = "";
      let cellInString = false;
      let cellStringChar = null;
      let cellEscaped = false;
      
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (cellEscaped) {
          cell += c;
          cellEscaped = false;
          continue;
        }
        if (c === "\\\\") {
          cell += c;
          cellEscaped = true;
          continue;
        }
        if ((c === "'" || c === '"') && !cellEscaped) {
          if (!cellInString) {
            cellInString = true;
            cellStringChar = c;
            continue; // don't include outer quotes
          } else if (cellStringChar === c) {
            cellInString = false;
            cellStringChar = null;
            continue; // don't include outer quotes
          }
        }
        if (c === "," && !cellInString) {
          rowValues.push(cell.trim());
          cell = "";
        } else {
          cell += c;
        }
      }
      rowValues.push(cell.trim());
      
      // Map to object
      const obj = {};
      columns.forEach((col, idx) => {
        let val = rowValues[idx];
        if (val === undefined || val.toUpperCase() === "NULL") {
          obj[col] = null;
        } else if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          obj[col] = val.slice(1, -1);
        } else if (!isNaN(val) && val !== "") {
          obj[col] = Number(val);
        } else if (val.toUpperCase() === "TRUE") {
          obj[col] = true;
        } else if (val.toUpperCase() === "FALSE") {
          obj[col] = false;
        } else {
          // Unescape potential characters
          obj[col] = val.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\r/g, "\r");
        }
      });
      return obj;
    });
    
    if (!result[tableName]) {
      result[tableName] = [];
    }
    result[tableName].push(...parsedRows);
  }
  
  return result;
}

const parsedDb = parseSqlInserts(sqlContent);

// 1. Generate Configurations JSON file (the 8 setup tables)
const configTables = [
  "system_settings",
  "company_settings",
  "equipment_categories",
  "payment_methods",
  "financial_categories",
  "warranty_rules",
  "reception_accessories",
  "equipment_category_accessories"
];

const configJson = {};
configTables.forEach(t => {
  configJson[t] = parsedDb[t] || [];
});

// Ensure directory exists
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Save backup settings JSON
fs.writeFileSync(
  path.join(publicDir, "pksig_configuracoes.json"), 
  JSON.stringify(configJson, null, 2), 
  "utf8"
);

// Save complete database backup JSON
fs.writeFileSync(
  path.join(publicDir, "pksig_dados_completos.json"), 
  JSON.stringify(parsedDb, null, 2), 
  "utf8"
);

console.log("Successfully parsed SQL dump and generated both JSON files in /public!");
