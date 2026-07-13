// PK SIG Shared TypeScript Types

export interface Client {
  id: number;
  code: string;
  type: "PF" | "PJ";
  name: string;
  cpf_cnpj: string;
  rg_ie?: string;
  responsible?: string;
  birth_date?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  status: "ativo" | "inativo";
  created_at: string;
  updated_at: string;
  equipment_count?: number;
  open_os_count?: number;
  last_service_date?: string;
}

export interface Equipment {
  id: number;
  client_id: number;
  code: string;
  category_id: number;
  brand: string;
  model: string;
  serial_number?: string;
  imei?: string;
  asset_tag?: string; // Patrimônio
  responsible?: string;
  color?: string;
  notes?: string;
  status: "Disponível" | "Em manutenção" | "Arquivado" | "Descartado";
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface ServiceOrder {
  id: number;
  client_id: number;
  equipment_id: number;
  code: string;
  technician_name?: string;
  status_id: number;
  status_name: string;
  entry_date: string;
  promise_date?: string;
  completion_date?: string;
  problem_reported: string;
  technical_defect?: string;
  technical_diagnosis?: string;
  technical_service_recommended?: string;
  technical_parts_needed?: string;
  technical_estimated_hours?: number;
  technical_notes?: string;
  reception_equipment_state?: string;
  reception_notes?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  client_name?: string;
  client_code?: string;
  client_phone?: string;
  client_whatsapp?: string;
  client_cpf_cnpj?: string;
  equip_brand?: string;
  equip_model?: string;
  equip_serial?: string;
  equip_code?: string;
  equip_asset?: string;
  equip_category_id?: number;
  total_value?: number;
}

export interface BudgetItem {
  id: number;
  service_order_id: number;
  description: string;
  type: "Serviço" | "Peça" | "Mão de obra";
  quantity: number;
  unit_value: number;
  total_value: number;
  created_at: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  allows_installments: boolean;
  max_installments: number;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface PaymentGuide {
  id: number;
  client_id: number;
  service_order_id: number;
  code: string;
  total_amount: number;
  expected_method_id?: number;
  installments_count: number;
  issue_date: string;
  due_date?: string;
  paid_amount: number;
  balance_amount: number;
  status: "Em aberto" | "Parcial" | "Quitada" | "Vencida" | "Cancelada";
  notes?: string;
  created_at: string;
  updated_at: string;
  os_code?: string;
}

export interface PaymentInstallment {
  id: number;
  payment_guide_id: number;
  installment_number: number;
  amount: number;
  due_date: string;
  status: "Pendente" | "Pago" | "Atrasado" | "Cancelado";
  paid_amount: number;
  paid_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  payment_guide_id: number;
  installment_id?: number;
  amount: number;
  payment_date: string;
  method_id: number;
  method_name: string;
  notes?: string;
  created_at: string;
}

export interface WarrantyRule {
  id: number;
  name: string;
  duration_days: number;
  category_id?: number;
  service_type?: string;
  active: boolean;
  created_at: string;
}

export interface Warranty {
  id: number;
  client_id: number;
  equipment_id: number;
  service_order_id: number;
  code: string;
  start_date: string;
  end_date: string;
  status: "Vigente" | "Expirada" | "Cancelada";
  pdf_reference?: string;
  created_at: string;
  updated_at: string;
  os_code?: string;
  brand?: string;
  model?: string;
}

export interface EquipmentCategory {
  id: number;
  name: string;
  notes?: string;
  active: boolean;
  created_at: string;
}

export interface ReceptionAccessory {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
}

export interface SystemStatus {
  configured: boolean;
  connected?: boolean;
  hasAdmin?: boolean;
  error?: string;
  mode?: "local" | "remoto";
  host?: string;
  database?: string;
  user?: string;
}

export interface AppStatus {
  authenticated: boolean;
  user?: {
    id: number;
    username: string;
    name: string;
  };
  companyName: string;
  systemName: string;
  currency: string;
}

export interface DatabaseConfig {
  mode: "local" | "remoto";
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}
