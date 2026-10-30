'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Users, 
  CheckSquare, 
  FolderKanban, 
  Database, 
  Trash2, 
  UserCheck, 
  UserX, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  Search,
  RefreshCw,
  Mail,
  Send,
  Copy,
  Activity,
  UserMinus,
  Ban,
  Check,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { User, AdminStats, UserRole, AdminInvite, AuditLog } from '@/types/auth';

import { usePathname } from 'next/navigation';

type AdminTab = 'overview' | 'users' | 'invitations' | 'audit-logs';

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();

  const getInitialTab = (): AdminTab => {
    if (pathname?.includes('/invitations')) return 'invitations';
    if (pathname?.includes('/audit-logs')) return 'audit-logs';
    if (pathname?.includes('/users')) return 'users';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab());

  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [pathname]);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Form States
  const [userSearch, setUserSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Action status feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsData, usersData, invitesData, auditData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminInvitations(),
        api.getAdminAuditLogs(50)
      ]);
      setStats(statsData);
      setUsers(usersData);
      setInvites(invitesData);
      setAuditLogs(auditData);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setActionMessage({ type: 'error', text: err.message || 'Failed to fetch admin data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  if (!user || !isAdmin) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          The Admin Management Panel is restricted to accounts with the <strong className="text-amber-400">ADMIN</strong> role.
          Public registration can only create standard <strong className="text-blue-400">MEMBER</strong> accounts.
        </p>
        <p className="text-[11px] text-slate-500 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          💡 To provision your first administrator, run in your backend terminal:
          <br /><code className="text-amber-300 font-mono text-xs">npm run bootstrap:admin</code>
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Handle Role Promotion / Demotion
  const handleRoleToggle = async (targetUser: User) => {
    const newRole: UserRole = targetUser.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    if (!confirm(`Are you sure you want to change ${targetUser.name}'s role to ${newRole}?`)) return;

    try {
      setActionLoadingId(targetUser.id);
      setActionMessage(null);
      await api.updateUserRole(targetUser.id, newRole);
      setActionMessage({ type: 'success', text: `Role updated for ${targetUser.name} to ${newRole}.` });
      await loadAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update user role.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Account Status (Active / Suspended)
  const handleStatusToggle = async (targetUser: User) => {
    const newStatus = !targetUser.is_active;
    const actionName = newStatus ? 'activate' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionName} account for ${targetUser.name}?`)) return;

    try {
      setActionLoadingId(targetUser.id);
      setActionMessage(null);
      await api.updateUserStatus(targetUser.id, newStatus);
      setActionMessage({ type: 'success', text: `Account for ${targetUser.name} has been ${newStatus ? 'activated' : 'suspended'}.` });
      await loadAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update account status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (targetUser: User) => {
    if (!confirm(`Are you sure you want to permanently delete user "${targetUser.name}" (${targetUser.email})?`)) return;

    try {
      setActionLoadingId(targetUser.id);
      setActionMessage(null);
      await api.deleteUser(targetUser.id);
      setActionMessage({ type: 'success', text: `User ${targetUser.name} removed successfully.` });
      await loadAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete user.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Create Invitation
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setIsSubmittingInvite(true);
      setActionMessage(null);
      const res = await api.createAdminInvitation(inviteEmail.trim());
      const fullLink = `${window.location.origin}${res.inviteLink}`;
      setCreatedInviteLink(fullLink);
      setInviteEmail('');
      setActionMessage({ type: 'success', text: `Admin invitation link generated for ${inviteEmail.trim()}!` });
      await loadAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create invitation.' });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Handle Revoke Invitation
  const handleDeleteInvite = async (inviteId: number) => {
    if (!confirm('Are you sure you want to revoke this admin invitation?')) return;
    try {
      await api.deleteAdminInvitation(inviteId);
      setActionMessage({ type: 'success', text: 'Invitation revoked successfully.' });
      await loadAdminData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to revoke invitation.' });
    }
  };

  const copyInviteToClipboard = () => {
    if (!createdInviteLink) return;
    navigator.clipboard.writeText(createdInviteLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              Admin Governance Center
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Admin Authorized
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            RBAC permissions, secure administrator invitations, and audit log monitoring
          </p>
        </div>

        <button
          onClick={loadAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
          actionMessage.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'invitations'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Admin Invitations</span>
          {invites.filter(i => !i.used_at).length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {invites.filter(i => !i.used_at).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit-logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'audit-logs'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Total Registered Users</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {stats ? stats.users.total : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {stats ? `${stats.users.admins} Admins · ${stats.users.members} Members` : 'Loading...'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Account Health</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {stats ? `${stats.users.active ?? stats.users.total} Active` : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {stats?.users.suspended ? `${stats.users.suspended} Suspended Accounts` : 'All accounts in good standing'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Pending Admin Invites</span>
                <Mail className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {stats?.invitations?.pending ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Awaiting administrator activation
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Database Engine</span>
                <Database className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stats?.system.databaseConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/20' : 'bg-amber-400 ring-2 ring-amber-400/20'}`} />
                <span>{stats?.system.databaseEngine || 'Checking...'}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Uptime: {stats ? `${Math.floor(stats.system.uptimeSeconds / 60)} min` : '0 min'}
              </p>
            </div>
          </div>

          {/* Quick Security Architecture Overview */}
          <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-[#101827] to-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <h2 className="text-base md:text-lg font-bold text-white">
                TaskFlow Security & Role Enforcement Rules
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 text-xs leading-relaxed text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">1</span>
                  Public Registration Barrier
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Public users can only sign up as <strong>MEMBER</strong>. The server strictly drops any requested role parameter. Administrator status is never granted on public signups.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">2</span>
                  Cryptographic Admin Invites
                </h3>
                <p className="text-slate-400 text-[11px]">
                  New administrators are provisioned via secure, single-use, SHA-256 hashed invitation tokens with 48-hour expiration generated exclusively from the Admin Invitations tab.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <h3 className="font-semibold text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">3</span>
                  Self-Preservation Safeguards
                </h3>
                <p className="text-slate-400 text-[11px]">
                  The backend actively blocks any administrator from revoking their own ADMIN role, suspending themselves, or deleting their own account, preventing accidental platform lockouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-white">Users & Roles Directory</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage roles, suspend accounts, and view task assignments across all users
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, email, role..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Tasks</th>
                  <th className="py-3 px-3">Joined Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-4 px-3 bg-slate-950/20" />
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No users found matching search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrentUser = u.id === user.id;
                    const isBusy = actionLoadingId === u.id;
                    const isActive = u.is_active !== false;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                              {u.name ? u.name.slice(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-white">{u.name}</p>
                                {isCurrentUser && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-400 text-[11px]">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}>
                            {u.role === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                            <span>{u.role}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{isActive ? 'Active' : 'Suspended'}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {u.total_tasks || 0}
                        </td>

                        <td className="py-3 px-3 text-slate-400">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Promote / Demote Role Button */}
                            <button
                              onClick={() => handleRoleToggle(u)}
                              disabled={isCurrentUser || isBusy}
                              title={isCurrentUser ? "You cannot modify your own role" : `Switch to ${u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'}`}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isCurrentUser
                                  ? 'opacity-30 cursor-not-allowed border-transparent text-slate-500'
                                  : 'text-slate-300 hover:text-white bg-slate-800/80 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              {u.role === 'ADMIN' ? (
                                <UserX className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                              )}
                            </button>

                            {/* Suspend / Activate Account Button */}
                            <button
                              onClick={() => handleStatusToggle(u)}
                              disabled={isCurrentUser || isBusy}
                              title={isCurrentUser ? "You cannot suspend your own account" : (isActive ? "Suspend user account" : "Re-activate user account")}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isCurrentUser
                                  ? 'opacity-30 cursor-not-allowed border-transparent text-slate-500'
                                  : 'text-slate-300 hover:text-white bg-slate-800/80 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              {isActive ? (
                                <Ban className="w-3.5 h-3.5 text-rose-400" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </button>

                            {/* Delete User Button */}
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={isCurrentUser || isBusy}
                              title={isCurrentUser ? "You cannot delete yourself" : "Delete user"}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isCurrentUser
                                  ? 'opacity-30 cursor-not-allowed border-transparent text-slate-500'
                                  : 'text-slate-400 hover:text-rose-400 bg-slate-800/80 border-slate-700 hover:border-rose-500/50'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* TAB 3: ADMIN INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          {/* Create Invite Form */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                <span>Issue Administrator Invitation</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate a secure, cryptographically hashed, one-time administrator provisioning link (valid for 48 hours)
              </p>
            </div>

            <form onSubmit={handleCreateInvite} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="email"
                required
                placeholder="Enter colleague's email address..."
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
              />
              <button
                type="submit"
                disabled={isSubmittingInvite}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all shadow-md shadow-amber-600/30 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmittingInvite ? 'Generating...' : 'Generate Admin Invite'}</span>
              </button>
            </form>

            {createdInviteLink && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 mt-3">
                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Invitation Link Ready</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteLink}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/30 text-[11px] font-mono text-slate-200 select-all"
                  />
                  <button
                    onClick={copyInviteToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Invitations List */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
            <h2 className="text-base font-bold text-white">Invitations History & Status</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Invited Email</th>
                    <th className="py-3 px-3">Invited By</th>
                    <th className="py-3 px-3">Expires At</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No invitations generated yet.
                      </td>
                    </tr>
                  ) : (
                    invites.map((inv) => {
                      const isUsed = Boolean(inv.used_at);
                      const isExpired = !isUsed && new Date(inv.expires_at) < new Date();

                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {inv.email}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {inv.inviter_name || 'Admin'}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isUsed
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : isExpired
                                ? 'bg-slate-800 text-slate-400 border-slate-700'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {isUsed ? 'Accepted' : isExpired ? 'Expired' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {!isUsed && (
                              <button
                                onClick={() => handleDeleteInvite(inv.id)}
                                title="Revoke Invitation"
                                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit-logs' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Privileged & Security Audit Logs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable timeline of administrative events, privilege modifications, and user lifecycle actions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Actor / Email</th>
                  <th className="py-3 px-3">IP Address</th>
                  <th className="py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white">
                        {log.user_email || log.user_name || 'System'}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] font-mono truncate max-w-xs">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
