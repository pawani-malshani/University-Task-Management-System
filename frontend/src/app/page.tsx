'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Plus,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { TaskDetailsModal } from '@/components/tasks/TaskDetailsModal';
import { DeleteDialog } from '@/components/tasks/DeleteDialog';
import { api } from '@/lib/api';
import { Task, Project, DashboardStats } from '@/types/task';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    progressPercentage: 0,
    recentTasks: []
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskForView, setSelectedTaskForView] = useState<Task | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [selectedTaskForDelete, setSelectedTaskForDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, projectsData] = await Promise.all([
        api.getDashboardStats(),
        api.getProjects()
      ]);
      setStats(statsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleCreateTask = async (taskData: Partial<Task>) => {
    await api.createTask(taskData);
    await loadDashboardData();
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!selectedTaskForEdit) return;
    await api.updateTask(selectedTaskForEdit.id, taskData);
    setSelectedTaskForEdit(null);
    await loadDashboardData();
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskForDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteTask(selectedTaskForDelete.id);
      setSelectedTaskForDelete(null);
      await loadDashboardData();
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'No deadline';
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Welcome back! Here's what's happening across your tasks and projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards Matching 01_dashboard_ui.jpg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={CheckSquare}
          subtitle="All managed tasks"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          badge={stats.inProgress}
          badgeColor="amber"
          subtitle="Currently active"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          subtitle="Finished successfully"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          badge={stats.overdue}
          badgeColor="rose"
          subtitle="Action required"
        />
      </div>

      {/* Clean Progress Banner Matching 01_dashboard_ui.jpg */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#131e30] via-[#16253d] to-[#131e30] border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-white">Clean progress</span>
          </div>
          <span className="text-sm font-bold text-blue-400">
            {stats.progressPercentage}% overall completion
          </span>
        </div>
        <div className="w-full bg-slate-900/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-700 shadow-sm shadow-blue-500/50"
            style={{ width: `${Math.max(stats.progressPercentage, 4)}%` }}
          />
        </div>
      </div>

      {/* Recent Tasks Table Matching 01_dashboard_ui.jpg */}
      <div className="rounded-2xl bg-[#131e30] border border-slate-800/80 p-5 md:p-6 shadow-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Recent Tasks</h2>
            <p className="text-xs text-slate-400 mt-0.5">Most recently updated tasks across your workspace</p>
          </div>
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 font-medium text-xs uppercase tracking-wider pb-3">
                <th className="py-3 px-3">Task title</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Due date</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.recentTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                    No tasks yet. Click "Create Task" above to get started!
                  </td>
                </tr>
              ) : (
                stats.recentTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => setSelectedTaskForView(task)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3 font-medium text-slate-200">
                      <div>
                        <span>{task.title}</span>
                        {task.project_name && (
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {task.project_name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        task.priority === 'HIGH'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : task.priority === 'MEDIUM'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {task.priority === 'HIGH' ? 'High priority' : task.priority === 'MEDIUM' ? 'Medium priority' : 'Low priority'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-slate-300 text-xs">
                      {formatDate(task.due_date)}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        task.status === 'DONE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
                      }`}>
                        {task.status === 'DONE' ? 'Done' : task.status === 'IN_PROGRESS' ? 'Running' : 'To Do'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Creation Modal */}
      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
        projects={projects}
        title="Create New Task"
      />

      {/* Task Edit Modal */}
      <TaskFormModal
        isOpen={!!selectedTaskForEdit}
        onClose={() => setSelectedTaskForEdit(null)}
        onSubmit={handleUpdateTask}
        initialData={selectedTaskForEdit}
        projects={projects}
        title="Edit Task"
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        isOpen={!!selectedTaskForView}
        onClose={() => setSelectedTaskForView(null)}
        task={selectedTaskForView}
        onEdit={(task) => {
          setSelectedTaskForView(null);
          setSelectedTaskForEdit(task);
        }}
        onDelete={(task) => {
          setSelectedTaskForView(null);
          setSelectedTaskForDelete(task);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        isOpen={!!selectedTaskForDelete}
        task={selectedTaskForDelete}
        isDeleting={isDeleting}
        onClose={() => setSelectedTaskForDelete(null)}
        onConfirm={handleDeleteTask}
      />
    </div>
  );
}
