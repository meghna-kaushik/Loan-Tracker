export type UserRole = 'collection_manager' | 'field_agent';

export interface Profile {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
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

export interface AuthenticatedRequest extends Express.Request {
  user?: Profile;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: Profile;
    }
  }
}
