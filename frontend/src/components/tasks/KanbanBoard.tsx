'use client';

import { Task, Project } from '@/types/task';
import { Calendar, Plus, MoreHorizontal, ArrowRight, ArrowLeft } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  onOpenCreate: () => void;
  onOpenEdit: (task: Task) => void;
  onOpenView: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: 'TODO' | 'IN_PROGRESS' | 'DONE') => void;
}

export function KanbanBoard({
  tasks,
  projects,
  onOpenCreate,
  onOpenEdit,
  onOpenView,
  onStatusChange
}: KanbanBoardProps) {
  const columns: Array<{ id: 'TODO' | 'IN_PROGRESS' | 'DONE'; title: string; count: number }> = [
    { id: 'TODO', title: 'To Do', count: tasks.filter(t => t.status === 'TODO').length },
    { id: 'IN_PROGRESS', title: 'In Progress', count: tasks.filter(t => t.status === 'IN_PROGRESS').length },
    { id: 'DONE', title: 'Completed', count: tasks.filter(t => t.status === 'DONE').length }
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div key={col.id} className="rounded-2xl bg-[#0e1624] border border-slate-800/80 p-4 min-h-[500px] flex flex-col">
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-200">{col.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
                    {col.count}
                  </span>
                </div>
                <MoreHorizontal className="w-4 h-4 text-slate-500 cursor-pointer" />
              </div>

              {/* Task Cards Column */}
              <div className="space-y-3.5 flex-1">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl text-slate-500 text-xs">
                    No tasks in {col.title}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl bg-[#131e30] border border-slate-800/80 hover:border-slate-700 hover:shadow-lg transition-all duration-200 group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 
                          onClick={() => onOpenView(task)}
                          className="font-semibold text-sm text-slate-200 group-hover:text-blue-400 cursor-pointer transition-colors leading-snug"
                        >
                          {task.title}
                        </h4>
                        <button 
                          onClick={() => onOpenEdit(task)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Badges: Priority + Project */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          task.priority === 'HIGH'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : task.priority === 'MEDIUM'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {task.priority}
                        </span>

                        {task.project_name && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300 border border-slate-700/60">
                            {task.project_name}
                          </span>
                        )}

                        {task.assigned_name && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            👤 {task.assigned_name}
                          </span>
                        )}
                      </div>

                      {/* Card Footer: Due Date & Stage Mover */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formatDate(task.due_date)}
                        </span>

                        {/* Stage movement buttons */}
                        <div className="flex items-center gap-1">
                          {col.id !== 'TODO' && (
                            <button
                              onClick={() => onStatusChange(task, col.id === 'DONE' ? 'IN_PROGRESS' : 'TODO')}
                              title="Move back"
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {col.id !== 'DONE' && (
                            <button
                              onClick={() => onStatusChange(task, col.id === 'TODO' ? 'IN_PROGRESS' : 'DONE')}
                              title="Move forward"
                              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
