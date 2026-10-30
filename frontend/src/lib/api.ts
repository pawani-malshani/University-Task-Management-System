import { Task, Project, DashboardStats, TaskFilterParams } from '@/types/task';
import { User, AuthResponse, AdminStats, UserRole, AdminInvite, AuditLog } from '@/types/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function fetchWithError(url: string, options?: RequestInit) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {})
    };

    // Attach Bearer token from localStorage if in client
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('taskflow_token');
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers
      });
    } catch (networkError: any) {
      const err = new Error(
        'Cannot connect to TaskFlow server. Please ensure the backend is running at http://localhost:5000'
      ) as Error & { isNetworkError: boolean; status?: number };
      err.isNetworkError = true;
      err.status = 0;
      throw err;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        localStorage.removeItem('taskflow_token');
        localStorage.removeItem('taskflow_user');
        window.location.href = '/login';
      }
      const errorMsg = data.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg) as Error & { status?: number; errors?: Record<string, string> };
      err.status = res.status;
      err.errors = data.errors;
      throw err;
    }

    return data;
  } catch (error: any) {
    if (!error?.isNetworkError) {
      console.error(`API Error on [${url}]:`, error);
    }
    throw error;
  }
}

export const api = {
  // Authentication
  async register(data: { name: string; email: string; password: string; role?: UserRole }): Promise<AuthResponse> {
    const res = await fetchWithError(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetchWithError(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getProfile(): Promise<User> {
    const res = await fetchWithError(`${API_BASE}/auth/me`, { cache: 'no-store' });
    return res.data;
  },

  async updateProfile(data: { name?: string; email?: string; avatar?: string }): Promise<AuthResponse> {
    const res = await fetchWithError(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
    const res = await fetchWithError(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res;
  },

  async getTeamUsers(): Promise<User[]> {
    const res = await fetchWithError(`${API_BASE}/auth/users`, { cache: 'no-store' });
    return res.data || [];
  },

  // Admin Management
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetchWithError(`${API_BASE}/admin/stats`, { cache: 'no-store' });
    return res.data;
  },

  async getAdminUsers(): Promise<User[]> {
    const res = await fetchWithError(`${API_BASE}/admin/users`, { cache: 'no-store' });
    return res.data || [];
  },

  async updateUserRole(userId: number, role: UserRole): Promise<User> {
    const res = await fetchWithError(`${API_BASE}/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
    return res.data;
  },

  async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
    const res = await fetchWithError(`${API_BASE}/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    });
    return res.data;
  },

  async deleteUser(userId: number): Promise<boolean> {
    await fetchWithError(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE'
    });
    return true;
  },

  async getAdminInvitations(): Promise<AdminInvite[]> {
    const res = await fetchWithError(`${API_BASE}/admin/invitations`, { cache: 'no-store' });
    return res.data || [];
  },

  async createAdminInvitation(email: string): Promise<{ invite: AdminInvite; rawToken: string; inviteLink: string }> {
    const res = await fetchWithError(`${API_BASE}/admin/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    return res.data;
  },

  async deleteAdminInvitation(inviteId: number): Promise<boolean> {
    await fetchWithError(`${API_BASE}/admin/invitations/${inviteId}`, {
      method: 'DELETE'
    });
    return true;
  },

  async getAdminAuditLogs(limit = 50): Promise<AuditLog[]> {
    const res = await fetchWithError(`${API_BASE}/admin/audit-logs?limit=${limit}`, { cache: 'no-store' });
    return res.data || [];
  },

  async acceptInvite(data: { inviteToken: string; name: string; password: string }): Promise<AuthResponse> {
    const res = await fetchWithError(`${API_BASE}/auth/accept-invite`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // Tasks
  async getTasks(params?: TaskFilterParams): Promise<Task[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.priority && params.priority !== 'ALL') query.append('priority', params.priority);
    if (params?.projectId && params.projectId !== 'ALL') query.append('projectId', params.projectId);
    if (params?.sort) query.append('sort', params.sort);
    if (params?.order) query.append('order', params.order);
    if (params?.scope) query.append('scope', params.scope);

    const qs = query.toString();
    const endpoint = `${API_BASE}/tasks${qs ? `?${qs}` : ''}`;
    const res = await fetchWithError(endpoint, { cache: 'no-store' });
    return res.data || [];
  },

  async getTaskById(id: string | number): Promise<Task> {
    const res = await fetchWithError(`${API_BASE}/tasks/${id}`, { cache: 'no-store' });
    return res.data;
  },

  async createTask(task: Partial<Task>): Promise<Task> {
    const res = await fetchWithError(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task)
    });
    return res.data;
  },

  async updateTask(id: string | number, updates: Partial<Task>): Promise<Task> {
    const res = await fetchWithError(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.data;
  },

  async deleteTask(id: string | number): Promise<boolean> {
    await fetchWithError(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE'
    });
    return true;
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetchWithError(`${API_BASE}/dashboard/stats`, { cache: 'no-store' });
    return res.data;
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await fetchWithError(`${API_BASE}/projects`, { cache: 'no-store' });
    return res.data || [];
  },

  async createProject(project: { name: string; description?: string; members?: any[] }): Promise<Project> {
    const res = await fetchWithError(`${API_BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify(project)
    });
    return res.data;
  },

  async addProjectMember(projectId: string | number, member: { userId?: string | number; email?: string; name?: string; role?: string }): Promise<Project> {
    const res = await fetchWithError(`${API_BASE}/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(member)
    });
    return res.data;
  },

  async removeProjectMember(projectId: string | number, userId: string | number): Promise<Project> {
    const res = await fetchWithError(`${API_BASE}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    });
    return res.data;
  },

  async deleteProject(id: string | number): Promise<boolean> {
    await fetchWithError(`${API_BASE}/projects/${id}`, {
      method: 'DELETE'
    });
    return true;
  }
};
