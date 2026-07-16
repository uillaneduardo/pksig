# Modelo de Dados do Sistema PKSIG

Este documento detalha o modelo físico-lógico do banco de dados do sistema PKSIG. O sistema adota uma modelagem híbrida perfeitamente traduzível entre os dialetos **MySQL/MariaDB** e **SQLite**.

---

## 1. Diagrama de Relacionamentos (Lógico)

```text
  [clients] 1 ──── 1..* [equipments]
     │                       │
     │                       │ 1
     │ 1                     ▼
     └─────────────────► [service_orders] 1 ── 1..* [budget_items]
                             │
                             ▼ 1
                       [payment_guides] 1 ──── 1..* [payment_installments]
                             │
                             ▼ 1..*
                       [payments]
```

---

## 2. Dicionário de Tabelas Principais

### 2.1. Tabela: `clients` (Clientes)
Armazena as informações cadastrais básicas de pessoas físicas e jurídicas.

| Atributo | Tipo (MySQL) | Tipo (SQLite) | Nulo? | Padrão | Descrição |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `INT` | `INTEGER` | Não | AUTO_INCREMENT | Chave primária do sistema. |
| `code` | `VARCHAR(50)` | `TEXT` | Não | UNIQUE | Código de controle único sequencial (ex: CLI-00001). |
| `type` | `ENUM('PF', 'PJ')` | `TEXT` | Não | - | Identificador de natureza jurídica. |
| `name` | `VARCHAR(255)` | `TEXT` | Não | - | Nome completo ou Razão Social do cliente. |
| `cpf_cnpj` | `VARCHAR(20)` | `TEXT` | Não | UNIQUE | Documento CPF ou CNPJ (apenas dígitos). |
| `rg_ie` | `VARCHAR(20)` | `TEXT` | Sim | NULL | Documento RG ou Inscrição Estadual. |
| `responsible` | `VARCHAR(255)` | `TEXT` | Sim | NULL | Nome do responsável técnico/comercial (para PJ). |
| `birth_date` | `DATE` | `TEXT` | Sim | NULL | Data de nascimento. |
| `email` | `VARCHAR(255)` | `TEXT` | Sim | NULL | E-mail principal para contato e cobranças. |
| `phone` | `VARCHAR(20)` | `TEXT` | Sim | NULL | Telefone fixo de contato. |
| `whatsapp` | `VARCHAR(20)` | `TEXT` | Sim | NULL | Número para contato via WhatsApp. |
| `zip_code` | `VARCHAR(15)` | `TEXT` | Sim | NULL | CEP do endereço. |
| `street` | `VARCHAR(255)` | `TEXT` | Sim | NULL | Logradouro (rua, avenida, etc.). |
| `number` | `VARCHAR(20)` | `TEXT` | Sim | NULL | Número do lote/casa. |
| `complement` | `VARCHAR(255)` | `TEXT` | Sim | NULL | Complemento do endereço. |
| `neighborhood`| `VARCHAR(100)` | `TEXT` | Sim | NULL | Bairro. |
| `city` | `VARCHAR(100)` | `TEXT` | Sim | NULL | Município. |
| `state` | `VARCHAR(2)` | `TEXT` | Sim | NULL | Unidade Federativa (Sigla de 2 caracteres). |
| `notes` | `TEXT` | `TEXT` | Sim | NULL | Observações internas gerais sobre o cliente. |
| `status` | `VARCHAR(20)` | `TEXT` | Não | 'ativo' | Status cadastral ('ativo', 'inativo'). |
| `created_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Data de criação do registro. |
| `updated_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Data da última alteração do registro. |

---

### 2.2. Tabela: `equipments` (Equipamentos)
Armazena o cadastro individual dos bens físicos ou ativos de TI sob manutenção.

| Atributo | Tipo (MySQL) | Tipo (SQLite) | Nulo? | Padrão | Descrição |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `INT` | `INTEGER` | Não | AUTO_INCREMENT | Chave primária. |
| `client_id` | `INT` | `INTEGER` | Não | - | Chave estrangeira ligada a `clients(id)`. |
| `code` | `VARCHAR(50)` | `TEXT` | Não | UNIQUE | Código de controle único (ex: EQ-00001). |
| `category_id`| `INT` | `INTEGER` | Não | - | Chave estrangeira ligada a `equipment_categories(id)`. |
| `brand` | `VARCHAR(100)` | `TEXT` | Não | - | Marca do fabricante (Ex: Samsung, Apple). |
| `model` | `VARCHAR(100)` | `TEXT` | Não | - | Modelo técnico do equipamento. |
| `serial_number`| `VARCHAR(100)`| `TEXT` | Sim | NULL | Número de série física do hardware. |
| `imei` | `VARCHAR(100)` | `TEXT` | Sim | NULL | Código IMEI (para celulares e tablets LTE). |
| `asset_tag` | `VARCHAR(100)` | `TEXT` | Sim | NULL | Etiqueta de patrimônio físico (controle de PJ). |
| `responsible`| `VARCHAR(255)` | `TEXT` | Sim | NULL | Nome do responsável pelo uso do equipamento. |
| `color` | `VARCHAR(50)` | `TEXT` | Sim | NULL | Cor exterior principal do aparelho. |
| `notes` | `TEXT` | `TEXT` | Sim | NULL | Particularidades ou detalhes fixos do ativo. |
| `status` | `VARCHAR(50)` | `TEXT` | Não | 'Disponível' | Status ('Disponível', 'Em manutenção', 'Arquivado'). |
| `created_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Data de cadastro. |
| `updated_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Última alteração. |

---

### 2.3. Tabela: `service_orders` (Ordens de Serviço)
Mapeia o ciclo operacional, checklist e diagnóstico técnico de uma manutenção.

| Atributo | Tipo (MySQL) | Tipo (SQLite) | Nulo? | Padrão | Descrição |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `id` | `INT` | `INTEGER` | Não | AUTO_INCREMENT | Chave primária. |
| `client_id` | `INT` | `INTEGER` | Não | - | Chave estrangeira ligada a `clients(id)`. |
| `equipment_id`| `INT` | `INTEGER` | Não | - | Chave estrangeira ligada a `equipments(id)`. |
| `code` | `VARCHAR(50)` | `TEXT` | Não | UNIQUE | Código de controle sequencial (ex: OS-00001). |
| `technician_name`| `VARCHAR(255)`| `TEXT` | Sim | NULL | Nome do técnico encarregado do diagnóstico/reparo. |
| `status_id` | `INT` | `INTEGER` | Não | - | Chave estrangeira ligada a `service_order_statuses(id)`. |
| `entry_date` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Data de abertura e recebimento na oficina. |
| `promise_date`| `TIMESTAMP` | `TEXT` | Sim | NULL | Data de previsão de entrega prometida ao cliente. |
| `completion_date`| `TIMESTAMP`| `TEXT` | Sim | NULL | Data de finalização técnica efetiva do reparo. |
| `problem_reported`| `TEXT` | `TEXT` | Não | - | Descrição do problema relatado pelo cliente no balcão. |
| `technical_defect`| `TEXT` | `TEXT` | Sim | NULL | Defeito constatado fisicamente pelo técnico na bancada. |
| `technical_diagnosis`| `TEXT`| `TEXT` | Sim | NULL | Laudo técnico contendo o diagnóstico de reparo. |
| `technical_service_recommended`| `TEXT`| `TEXT`| Sim | NULL | Serviços e reparos recomendados pelo especialista. |
| `technical_parts_needed`| `TEXT` | `TEXT` | Sim | NULL | Peças e insumos físicos necessários para a execução. |
| `technical_estimated_hours`| `DECIMAL(5,2)`| `NUMERIC` | Sim | NULL | Horas de mão de obra estimadas para o conserto. |
| `technical_notes`| `TEXT` | `TEXT` | Sim | NULL | Observações de cunho técnico da assistência técnica. |
| `reception_equipment_state`| `TEXT`| `TEXT` | Sim | NULL | Checklist estético detalhado do equipamento na entrada. |
| `reception_notes`| `TEXT` | `TEXT` | Sim | NULL | Observações complementares de recebimento. |
| `created_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Data de criação. |
| `updated_at` | `TIMESTAMP` | `TEXT` | Não | CURRENT_TIMESTAMP | Última alteração. |

---

### 2.4. Outras Tabelas do Schema de Integridade
*   **`budget_items`**: Linhas do orçamento vinculadas a `service_orders`. Campos: `id`, `service_order_id`, `description`, `type` (Serviço, Peça, Mão de obra), `quantity`, `unit_value`, `total_value` (Calculado automaticamente).
*   **`payment_guides`**: Faturas/Controle financeiro de OSs. Campos: `id`, `client_id`, `service_order_id`, `code` (FAT-0001), `total_amount`, `paid_amount`, `balance_amount`, `status` (Em aberto, Parcial, Quitada, Cancelada).
*   **`payment_installments`**: Divisão das faturas. Campos: `id`, `payment_guide_id`, `installment_number`, `amount`, `due_date`, `status` (Pendente, Pago, Atrasado).
*   **`payments`**: Transações de pagamento físicas efetuadas. Campos: `id`, `payment_guide_id`, `installment_id` (opcional), `amount`, `payment_date`, `method_id`, `notes`.
*   **`sequences`**: Tabelas críticas para controle de chaves numéricas sequenciais e concorrentes para evitar furos no SQLite e MySQL. Chave primária `type` (client, equipment, os, guide, warranty) e valor `last_value`.
*   **`idempotency_keys`**: Registro de chaves de idempotência para evitar envios duplicados do PWA offline. Chave primária `key` (UUID) e corpo da resposta retornado em `response_body`.
