'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types/auth';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  };

  const initAuth = async () => {
    try {
      const storedToken = localStorage.getItem('taskflow_token');
      const storedUser = localStorage.getItem('taskflow_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        // Background check to verify token & fetch fresh profile
        try {
          const freshUser = await api.getProfile();
          setUser(freshUser);
          localStorage.setItem('taskflow_user', JSON.stringify(freshUser));
        } catch (e: any) {
          // FIX: Logout on both 401 (expired) AND 404 (user deleted from DB)
          if (e?.status === 401 || e?.status === 404 || e?.message?.toLowerCase().includes('not found')) {
            console.warn('Session invalid - user not found or unauthorized, logging out');
            logout();
          } else {
            // If backend is truly offline (Network Error), preserve cached session
            console.info('Backend unreachable, keeping cached user session active');
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('taskflow_token', data.token);
    localStorage.setItem('taskflow_user', JSON.stringify(data.user));
  };

  const register = async (name: string, email: string, password: string, role?: UserRole) => {
    const data = await api.register({ name, email, password, role });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('taskflow_token', data.token);
    localStorage.setItem('taskflow_user', JSON.stringify(data.user));
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('taskflow_user', JSON.stringify(updatedUser));
  };

  const refreshProfile = async () => {
    try {
      const fresh = await api.getProfile();
      setUser(fresh);
      localStorage.setItem('taskflow_user', JSON.stringify(fresh));
    } catch (e: any) {
      console.error('Error refreshing profile:', e);
      if (e?.status === 401 || e?.status === 404) {
        logout();
      }
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin,
        login,
        register,
        logout,
        updateUser,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
