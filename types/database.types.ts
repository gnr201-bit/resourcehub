export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role_title: string;
  status: 'active' | 'retired' | 'onboarding';
  joined_at: string;
  retired_at: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  serial_number: string;
  name: string;
  category: string;
  spec: string | null;
  price: number | null;
  purchased_at: string | null;
  manufacturer: string | null;
  model_name: string | null;
  status: 'normal' | 'repairing' | 'disposed' | 'unassigned';
  location: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  // Join fields helper
  employees?: Employee | null;
}

export interface SaasService {
  id: string;
  name: string;
  total_licenses: number;
  used_licenses: number;
  warning_threshold: number;
  price_per_license: number;
  created_at: string;
}

export interface SaasAccount {
  id: string;
  employee_id: string;
  saas_id: string;
  email: string;
  status: 'active' | 'inactive';
  assigned_at: string;
  revoked_at: string | null;
  created_at: string;
  // Join fields helper
  employees?: Employee;
  saas_services?: SaasService;
}

export interface HrEvent {
  id: string;
  event_type: 'onboarding' | 'offboarding' | 'transfer';
  employee_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  details: Record<string, any>;
  event_date: string;
  processed_at: string | null;
  created_at: string;
  // Join fields helper
  employees?: Employee;
}

export interface ResourceRequest {
  id: string;
  employee_id: string;
  request_type: 'new_resource' | 'return_resource';
  resource_category: 'IT Asset' | 'SaaS' | 'Other';
  resource_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
  // Join fields helper
  employees?: Employee;
}

export interface SyncLog {
  id: string;
  log_type: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details: string | null;
  created_at: string;
}
