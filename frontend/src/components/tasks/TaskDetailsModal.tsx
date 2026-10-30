'use client';

import { X, Calendar, Folder, Clock, CheckCircle2, Edit3, Trash2, User as UserIcon } from 'lucide-react';
import { Task } from '@/types/task';

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskDetailsModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete
}: TaskDetailsModalProps) {
  if (!isOpen || !task) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'No deadline set';
    const cleanDate = dateStr.split('T')[0];
    const date = new Date(cleanDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl p-6 md:p-8 rounded-2xl bg-[#131e30] border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        role="dialog"
      >
        {/* Header with Title & Action buttons */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                task.status === 'DONE' 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : task.status === 'IN_PROGRESS'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
              }`}>
                {task.status === 'DONE' ? 'Completed' : task.status === 'IN_PROGRESS' ? 'In Progress' : 'To Do'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                task.priority === 'HIGH'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : task.priority === 'MEDIUM'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {task.priority} Priority
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{task.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Details Content */}
        <div className="space-y-6">
          {/* Description */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2">Description</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
              {task.description || 'No description provided.'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
                <Folder className="w-3.5 h-3.5 text-blue-400" /> Project
              </span>
              <p className="text-sm font-semibold text-slate-200">
                {task.project_name || 'No Project'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" /> Assignee
              </span>
              <p className="text-sm font-semibold text-slate-200">
                {task.assigned_name || 'Unassigned'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Due Date
              </span>
              <p className="text-sm font-semibold text-slate-200">
                {formatDate(task.due_date)}
              </p>
            </div>
          </div>

          {/* Subtasks checklist demo (matching showcase #4) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Subtasks (2/3)</span>
              <span className="text-xs font-bold text-blue-400">67%</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-4">
              <div className="bg-blue-500 h-1.5 rounded-full w-2/3" />
            </div>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 text-blue-600 bg-slate-800" />
                <span className="line-through text-slate-500">Analyze functional specifications</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 text-blue-600 bg-slate-800" />
                <span className="line-through text-slate-500">Design RESTful API routes</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" className="rounded border-slate-700 text-blue-600 bg-slate-800" />
                <span>Verify database persistence & validation</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800 mt-6">
          <button
            onClick={() => {
              onClose();
              onDelete(task);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(task);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Task</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
