'use client';

import { useState, useEffect } from 'react';
import { Folder, Plus, CheckSquare, Trash2, X, AlertCircle, CheckCircle2, Users, UserPlus, UserMinus, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { Project, ProjectMember } from '@/types/task';
import { useAuth } from '@/context/AuthContext';

export default function ProjectsPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // New Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialInviteEmails, setInitialInviteEmails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Manage Members Modal State
  const [activeProjectForMembers, setActiveProjectForMembers] = useState<Project | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberModalError, setMemberModalError] = useState<string | null>(null);
  const [memberModalSuccess, setMemberModalSuccess] = useState<string | null>(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create base project with owner
      const createdProject = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined
      });

      // If initial invite emails were provided, invite them by email
      if (initialInviteEmails.trim()) {
        const emailList = initialInviteEmails
          .split(/[,;\s]+/)
          .map(em => em.trim().toLowerCase())
          .filter(em => em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));

        for (const email of emailList) {
          if (currentUser && email === currentUser.email.toLowerCase()) continue;
          try {
            await api.addProjectMember(createdProject.id, { email });
          } catch (e) {
            console.warn(`Could not add initial member ${email}:`, e);
          }
        }
      }

      setName('');
      setDescription('');
      setInitialInviteEmails('');
      setIsModalOpen(false);
      await loadProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this project? Associated tasks will also be cleaned up.')) return;
    try {
      await api.deleteProject(id);
      await loadProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    }
  };

  const handleInviteMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectForMembers || !inviteEmail.trim()) return;

    try {
      setMemberActionLoading(true);
      setMemberModalError(null);
      setMemberModalSuccess(null);

      const cleanEmail = inviteEmail.trim().toLowerCase();

      // Invite user strictly by email address (protects directory privacy)
      const updated = await api.addProjectMember(activeProjectForMembers.id, {
        email: cleanEmail
      });

      setActiveProjectForMembers(updated);
      setMemberModalSuccess(`Collaborator with email "${cleanEmail}" added successfully!`);
      setInviteEmail('');
      await loadProjects();
    } catch (err: any) {
      setMemberModalError(err.message || 'Failed to invite collaborator. Please check that the email is registered.');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRemoveMemberFromProject = async (userId: string | number) => {
    if (!activeProjectForMembers) return;
    if (!confirm('Are you sure you want to remove this member from the project?')) return;

    try {
      setMemberActionLoading(true);
      setMemberModalError(null);
      setMemberModalSuccess(null);

      const updated = await api.removeProjectMember(activeProjectForMembers.id, userId);
      setActiveProjectForMembers(updated);
      setMemberModalSuccess('Collaborator removed from project.');
      await loadProjects();
    } catch (err: any) {
      setMemberModalError(err.message || 'Failed to remove member from project');
    } finally {
      setMemberActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Projects & Collaboration
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Organize tasks into structured project initiatives and invite teammates by email
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          ))
        ) : projects.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Folder className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
            <p>No projects accessible. Click "New Project" to create one or ask a teammate to invite you by email.</p>
          </div>
        ) : (
          projects.map((project) => {
            const isOwner = currentUser && String(project.user_id) === String(currentUser.id);
            const canManage = isOwner || isAdmin;
            const membersList = project.members || [];

            return (
              <div
                key={project.id}
                className="p-6 rounded-2xl bg-[#131e30] border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Folder className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveProjectForMembers(project);
                          setMemberModalError(null);
                          setMemberModalSuccess(null);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:text-white hover:bg-slate-700 flex items-center gap-1.5 transition-all"
                        title="Manage Project Members"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>{membersList.length} Team</span>
                      </button>

                      {canManage && (
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1.5">{project.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {project.description || 'No description provided.'}
                  </p>

                  {/* Members Pill List */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {membersList.slice(0, 3).map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800/80 text-slate-300 border border-slate-700/60"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {m.name || m.email || 'Member'}
                      </span>
                    ))}
                    {membersList.length > 3 && (
                      <span className="text-[10px] text-slate-500">
                        +{membersList.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                    {project.task_count || 0} tasks
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {isOwner ? '👑 Owner' : '👥 Member'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#131e30] border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-white">Create New Project</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mobile App Redesign"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the scope and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Invite Teammates by Email on Creation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>Invite Teammates by Email (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. colleague1@example.com, colleague2@example.com"
                  value={initialInviteEmails}
                  onChange={(e) => setInitialInviteEmails(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Separate multiple emails with commas. Only registered accounts will be added as collaborators.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Members Modal: Invite by Email Only */}
      {activeProjectForMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#131e30] border border-slate-800 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span>Project Team: {activeProjectForMembers.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirmed team members collaborating on this project
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveProjectForMembers(null);
                  setMemberModalError(null);
                  setMemberModalSuccess(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberModalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{memberModalError}</span>
              </div>
            )}

            {memberModalSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{memberModalSuccess}</span>
              </div>
            )}

            {/* Current Members List */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Confirmed Collaborators ({activeProjectForMembers.members?.length || 0})
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeProjectForMembers.members && activeProjectForMembers.members.length > 0 ? (
                  activeProjectForMembers.members.map((m, idx) => {
                    const isProjectOwner = String(m.user_id) === String(activeProjectForMembers.user_id);
                    const canRemove = (currentUser && (String(currentUser.id) === String(activeProjectForMembers.user_id) || isAdmin)) && !isProjectOwner;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                            {(m.name || m.email || 'U').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{m.name || 'Member'}</p>
                            <p className="text-[11px] text-slate-400">{m.email || 'No email'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isProjectOwner
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {isProjectOwner ? 'Project Owner' : (m.role || 'Collaborator')}
                          </span>

                          {canRemove && (
                            <button
                              onClick={() => handleRemoveMemberFromProject(m.user_id)}
                              disabled={memberActionLoading}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                              title="Remove collaborator"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500">No collaborators assigned yet.</p>
                )}
              </div>
            </div>

            {/* Invite by Email Only Form */}
            {(currentUser && (String(currentUser.id) === String(activeProjectForMembers.user_id) || isAdmin)) && (
              <form onSubmit={handleInviteMemberByEmail} className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Invite Collaborator by Email</span>
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter your teammate's registered email address. Strangers and unregistered users cannot see this project.
                </p>

                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      if (memberModalError) setMemberModalError(null);
                    }}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />

                  <button
                    type="submit"
                    disabled={!inviteEmail.trim() || memberActionLoading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-600/20 whitespace-nowrap"
                  >
                    {memberActionLoading ? 'Inviting...' : 'Invite to Project'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
