export type UserRole = 'collection_manager' | 'field_agent';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

export interface Visit {
  id: string;
  loan_number: string;
  agent_id: string;
  agent_name: string;
  agent_phone: string;
  person_visited: string;
  status: 'PTP' | 'Not Found' | 'Partial Received' | 'Received' | 'Others';
  comments: string;
  photo_urls: string[];
  latitude: number;
  longitude: number;
  address: string;
  visited_at: string;
  ptp_date: string | null;
  ptp_amount: number | null;
}

export interface Profile {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string;
  performed_by_name: string;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const VISIT_STATUSES = ['PTP', 'Not Found', 'Partial Received', 'Received', 'Others'] as const;
