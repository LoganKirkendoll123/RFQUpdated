export type UserRole = 'admin' | 'sales_rep' | 'customer';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Customer {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  customer_id?: string;
  customer?: Customer;
  is_active: boolean;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SalesRepCustomer {
  id: string;
  sales_rep_id: string;
  customer_id: string;
  customer: Customer;
  assigned_at: string;
  assigned_by?: string;
  is_active: boolean;
}

export interface PendingRegistration {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  requested_role: UserRole;
  customer_name?: string;
  company_name?: string;
  phone?: string;
  message?: string;
  status: ApprovalStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export interface RegistrationData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  requested_role: UserRole;
  customer_name?: string;
  company_name?: string;
  phone?: string;
  message?: string;
}