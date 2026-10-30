'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { TaskTable } from '@/components/tasks/TaskTable';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { TaskDetailsModal } from '@/components/tasks/TaskDetailsModal';
import { DeleteDialog } from '@/components/tasks/DeleteDialog';
import { api } from '@/lib/api';
import { Task, Project } from '@/types/task';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserCheck, Users } from 'lucide-react';

function TasksContent() {
  const { user, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [scope, setScope] = useState<'my_tasks' | 'all_shared'>('my_tasks');
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('due_date');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskForView, setSelectedTaskForView] = useState<Task | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [selectedTaskForDelete, setSelectedTaskForDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedTasks, fetchedProjects] = await Promise.all([
        api.getTasks({
          search,
          status: statusFilter,
          priority: priorityFilter,
          sort: sortBy,
          order: sortBy === 'title' ? 'asc' : 'desc',
          scope
        }),
        api.getProjects()
      ]);
      setTasks(fetchedTasks);
      setProjects(fetchedProjects);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, priorityFilter, sortBy, scope]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async (taskData: Partial<Task>) => {
    await api.createTask(taskData);
    await loadTasks();
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!selectedTaskForEdit) return;
    await api.updateTask(selectedTaskForEdit.id, taskData);
    setSelectedTaskForEdit(null);
    await loadTasks();
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskForDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteTask(selectedTaskForDelete.id);
      setSelectedTaskForDelete(null);
      await loadTasks();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Task Listing
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Search, filter, organize, and manage your complete task list
          </p>
        </div>

        {/* Task Scope Filter: My Tasks vs Shared Project Tasks */}
        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setScope('my_tasks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scope === 'my_tasks'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Tasks</span>
          </button>

          <button
            onClick={() => setScope('all_shared')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              scope === 'all_shared'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'All System Tasks' : 'Shared Project Tasks'}</span>
          </button>
        </div>
      </div>

      <TaskTable
        tasks={tasks}
        projects={projects}
        isLoading={isLoading}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenEdit={(task) => setSelectedTaskForEdit(task)}
        onOpenDelete={(task) => setSelectedTaskForDelete(task)}
        onOpenView={(task) => setSelectedTaskForView(task)}
      />

      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
        projects={projects}
        title="Create New Task"
      />

      <TaskFormModal
        isOpen={!!selectedTaskForEdit}
        onClose={() => setSelectedTaskForEdit(null)}
        onSubmit={handleUpdateTask}
        initialData={selectedTaskForEdit}
        projects={projects}
        title="Edit Task"
      />

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

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading tasks...</div>}>
      <TasksContent />
    </Suspense>
  );
}
