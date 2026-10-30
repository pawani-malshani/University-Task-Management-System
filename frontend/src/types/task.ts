export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string | number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string | number | null;
  project_name?: string | null;
  user_id?: string | number | null;
  assigned_name?: string | null;
  assigned_email?: string | null;
  created_by?: string | number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectMember {
  user_id: string | number;
  name: string;
  email: string;
  role?: string;
}

export interface Project {
  id: string | number;
  name: string;
  description: string | null;
  user_id?: string | number | null;
  owner_name?: string | null;
  members?: ProjectMember[];
  created_at?: string;
  task_count?: number;
}

export interface DashboardStats {
  totalTasks: number;
  inProgress: number;
  completed: number;
  overdue: number;
  progressPercentage: number;
  recentTasks: Task[];
}

export interface TaskFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  projectId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  scope?: 'my_tasks' | 'all_shared';
}
