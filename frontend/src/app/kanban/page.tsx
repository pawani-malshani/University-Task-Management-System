'use client';

import { useState, useEffect } from 'react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskFormModal } from '@/components/tasks/TaskFormModal';
import { TaskDetailsModal } from '@/components/tasks/TaskDetailsModal';
import { DeleteDialog } from '@/components/tasks/DeleteDialog';
import { api } from '@/lib/api';
import { Task, Project } from '@/types/task';
import { useAuth } from '@/context/AuthContext';
import { UserCheck, Users, Plus } from 'lucide-react';

export default function KanbanPage() {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'my_tasks' | 'all_shared'>('my_tasks');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskForView, setSelectedTaskForView] = useState<Task | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [selectedTaskForDelete, setSelectedTaskForDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [fetchedTasks, fetchedProjects] = await Promise.all([
        api.getTasks({ scope }),
        api.getProjects()
      ]);
      setTasks(fetchedTasks);
      setProjects(fetchedProjects);
    } catch (err) {
      console.error('Failed to load kanban data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [scope]);

  const handleStatusChange = async (task: Task, newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await api.updateTask(task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      await loadData();
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    await api.createTask(taskData);
    await loadData();
  };

  const handleUpdateTask = async (taskData: Partial<Task>) => {
    if (!selectedTaskForEdit) return;
    await api.updateTask(selectedTaskForEdit.id, taskData);
    setSelectedTaskForEdit(null);
    await loadData();
  };

  const handleDeleteTask = async () => {
    if (!selectedTaskForDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteTask(selectedTaskForDelete.id);
      setSelectedTaskForDelete(null);
      await loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Kanban Board
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Drag and drop tasks between workflow columns
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Task Scope Filter */}
          <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
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

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      <KanbanBoard
        tasks={tasks}
        projects={projects}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenEdit={(task) => setSelectedTaskForEdit(task)}
        onOpenView={(task) => setSelectedTaskForView(task)}
        onStatusChange={handleStatusChange}
      />

      {/* Create Modal */}
      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
        projects={projects}
        title="Create New Task"
      />

      {/* Edit Modal */}
      <TaskFormModal
        isOpen={!!selectedTaskForEdit}
        onClose={() => setSelectedTaskForEdit(null)}
        onSubmit={handleUpdateTask}
        initialData={selectedTaskForEdit}
        projects={projects}
        title="Edit Task"
      />

      {/* View Modal */}
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

      {/* Delete Dialog */}
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
