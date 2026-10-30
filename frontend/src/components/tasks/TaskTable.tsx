'use client';

import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  Calendar, 
  AlertCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { Task, Project } from '@/types/task';

interface TaskTableProps {
  tasks: Task[];
  projects: Project[];
  isLoading: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (task: Task) => void;
  onOpenDelete: (task: Task) => void;
  onOpenView: (task: Task) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
}

export function TaskTable({
  tasks,
  projects,
  isLoading,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
  onOpenView,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
}: TaskTableProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<(string | number)[]>([]);

  const toggleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map(t => t.id));
    }
  };

  const toggleSelectOne = (id: string | number) => {
    if (selectedTaskIds.includes(id)) {
      setSelectedTaskIds(selectedTaskIds.filter(i => i !== id));
    } else {
      setSelectedTaskIds([...selectedTaskIds, id]);
    }
  };

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return 'No deadline';
    const cleanDate = dateStr.split('T')[0];
    const date = new Date(cleanDate + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'DONE') return false;
    const today = new Date().toISOString().split('T')[0];
    return task.due_date < today;
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Low
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{priority}</span>;
    }
  };

  const renderStatusBadge = (status: string, task: Task) => {
    if (isOverdue(task)) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <Clock className="w-3 h-3" /> Overdue
        </span>
      );
    }
    switch (status) {
      case 'DONE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Done
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            In Progress
          </span>
        );
      case 'TODO':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/50">
            To Do
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters & Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Dropdowns & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Status: All</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Priority: All</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="due_date">Sort by: Due Date</option>
            <option value="created_at">Sort by: Created Date</option>
            <option value="priority">Sort by: Priority</option>
            <option value="title">Sort by: Title</option>
          </select>

          {/* + New Task Button */}
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Task Listing Table */}
      <div className="overflow-x-auto rounded-2xl bg-[#131e30] border border-slate-800/80 shadow-md">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-900/40 text-slate-400 font-medium text-xs uppercase tracking-wider">
              <th className="py-3.5 px-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800"
                />
              </th>
              <th className="py-3.5 px-4">Task Title</th>
              <th className="py-3.5 px-4">Project</th>
              <th className="py-3.5 px-4">Assignee</th>
              <th className="py-3.5 px-4">Priority</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Due Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4 text-center">
                    <div className="w-4 h-4 bg-slate-800 rounded mx-auto" />
                  </td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-48" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-16" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-slate-800 rounded w-24" /></td>
                  <td className="py-4 px-4 text-right"><div className="h-4 bg-slate-800 rounded w-16 ml-auto" /></td>
                </tr>
              ))
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <AlertCircle className="w-8 h-8 mb-2 text-slate-600" />
                    <p className="text-base font-semibold text-slate-300">No tasks found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or create a new task.</p>
                    <button
                      onClick={onOpenCreate}
                      className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500"
                    >
                      + Create First Task
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const isSelected = selectedTaskIds.includes(task.id);
                return (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isSelected ? 'bg-blue-950/20' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(task.id)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-800"
                      />
                    </td>

                    {/* Task Title & Description snippet */}
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      <div className="flex flex-col">
                        <span 
                          onClick={() => onOpenView(task)}
                          className="hover:text-blue-400 cursor-pointer transition-colors"
                        >
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-xs text-slate-500 line-clamp-1 max-w-sm mt-0.5">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Project */}
                    <td className="py-3.5 px-4">
                      {task.project_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                          {task.project_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="py-3.5 px-4 text-xs">
                      {task.assigned_name ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          {task.assigned_name}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Unassigned</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      {renderPriorityBadge(task.priority)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(task.status, task)}
                    </td>

                    {/* Due Date */}
                    <td className="py-3.5 px-4 text-slate-300 text-xs">
                      <span className={isOverdue(task) ? 'text-rose-400 font-medium' : ''}>
                        {formatDueDate(task.due_date)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenView(task)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenEdit(task)}
                          title="Edit Task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenDelete(task)}
                          title="Delete Task"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
