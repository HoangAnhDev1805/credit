import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, User, AuthResponse } from './api';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  checkAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (login: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.login({ login, password });
          
          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;
            
            // Set token in API client
            apiClient.setToken(token);
            
            // Update store
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });

            // Store in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));
          } else {
            throw new Error(response.message || 'Đăng nhập thất bại');
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.register({ username, email, password });
          
          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;
            
            // Set token in API client
            apiClient.setToken(token);
            
            // Update store
            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });

            // Store in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));
          } else {
            throw new Error(response.message || 'Đăng ký thất bại');
          }
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch (error) {
          // Ignore logout errors
        } finally {
          get().clearAuth();
        }
      },

      updateUser: (user: User) => {
        set({ user });
        localStorage.setItem('user', JSON.stringify(user));
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          get().clearAuth();
          return;
        }

        try {
          const response = await apiClient.getMe();
          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true
            });
            localStorage.setItem('user', JSON.stringify(response.data.user));
          } else {
            get().clearAuth();
          }
        } catch (error: any) {
          console.error('Auth check failed:', error);
          // Only clear auth if it's a real auth error, not network error
          if (error.response?.status === 401 || error.response?.status === 403) {
            get().clearAuth();
          }
        }
      },

      clearAuth: () => {
        apiClient.clearAuth();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          apiClient.setToken(state.token);
        }
      },
    }
  )
);

// Auth guard hook
export const useAuthGuard = (redirectTo = '/auth/login') => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  React.useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      checkAuth();
    }
  }, [isAuthenticated, isLoading, checkAuth]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  return { isAuthenticated, isLoading };
};

// Admin guard hook
export const useAdminGuard = (redirectTo = '/dashboard') => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      window.location.href = redirectTo;
    }
  }, [user, isAuthenticated, isLoading, redirectTo]);

  return { isAdmin: user?.role === 'admin', isLoading };
};

// Import React for hooks
import React from 'react';
