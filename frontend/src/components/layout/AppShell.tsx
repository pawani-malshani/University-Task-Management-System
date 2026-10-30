'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Sun, Moon } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/signup' || pathname.startsWith('/invite');

  useEffect(() => {
    // Theme sync
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user && !isAuthPage) {
        // Enforce login: Do not allow access to system pages without authenticating
        router.replace('/login');
      } else if (user && isAuthPage) {
        // Already authenticated, redirect to workspace dashboard
        router.replace('/');
      }
    }
  }, [user, loading, isAuthPage, router]);

  // Auth Pages (Login / Register / Invite): Dedicated clean container
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#0d1522] text-slate-100 flex flex-col justify-between transition-colors">
        {/* Auth Header with Logo and Theme Switcher */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-[#0d1522]/90 backdrop-blur-md">
          <Link href="/login" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/25">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-bold tracking-tight text-white text-base">
              TaskFlow
            </span>
          </Link>

          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </header>

        {/* Main Auth Content */}
        <main className="flex-1 flex items-center justify-center">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-800/40">
          TaskFlow Management System &copy; 2026 &middot; Secure Access Protected
        </footer>
      </div>
    );
  }

  // Workspace Shell: Always renders children so Next.js never drops segments
  return (
    <div className="min-h-screen flex bg-[#0d1522] text-slate-100 transition-colors">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full relative">
          {children}

          {/* Secure client-side protection overlay while verifying or redirecting unauthenticated users */}
          {(!user || loading) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1522]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30 animate-pulse">
                  T
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span>{loading ? 'Verifying session...' : 'Redirecting to login...'}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
