export type UserRole = 'ADMIN' | 'MEMBER';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  avatar?: string | null;
  created_at?: string;
  updated_at?: string;
  total_tasks?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AdminInvite {
  id: number;
  email: string;
  token_hash: string;
  role: string;
  invited_by?: number;
  inviter_name?: string;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  details?: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
}

export interface AdminStats {
  system: {
    status: string;
    databaseConnected: boolean;
    databaseEngine: string;
    uptimeSeconds: number;
    timestamp: string;
  };
  users: {
    total: number;
    admins: number;
    members: number;
    active?: number;
    suspended?: number;
  };
  invitations?: {
    total: number;
    pending: number;
  };
  content: {
    tasks: number;
    projects: number;
  };
}
