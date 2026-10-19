import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import {
  setAuthToken,
  setRefreshToken as setApiRefreshToken,
  setLogoutCb,
  setTokensCb,
} from '../services/api.service';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Zustand Auth Store — no circular dependency with api.service.
 * Uses axios directly for auth calls; wires up the api.service
 * interceptor callbacks after initialisation so subsequent API
 * calls always carry the correct JWT token.
 * On logout, ALL cryptographic state is explicitly wiped.
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      // ── Actions ──────────────────────────────────────────
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        setAuthToken(accessToken);
        setApiRefreshToken(refreshToken);
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await axios.post(`${API_BASE}/auth/login`, { email, password });
          const { user, accessToken, refreshToken } = data.data;
          set({ user, accessToken, refreshToken, isLoading: false, error: null });
          setAuthToken(accessToken);
          setApiRefreshToken(refreshToken);
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Login failed.';
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await axios.post(`${API_BASE}/auth/register`, { username, email, password });
          const { user, accessToken, refreshToken } = data.data;
          set({ user, accessToken, refreshToken, isLoading: false, error: null });
          setAuthToken(accessToken);
          setApiRefreshToken(refreshToken);
          return { success: true };
        } catch (err) {
          const message = err.response?.data?.message || 'Registration failed.';
          set({ isLoading: false, error: message });
          return { success: false, message };
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await axios.post(`${API_BASE}/auth/logout`, { refreshToken });
          }
        } catch {
          // Proceed regardless
        } finally {
          // SECURITY: wipe ALL sensitive state from memory
          set({ user: null, accessToken: null, refreshToken: null, isLoading: false, error: null });
          setAuthToken(null);
          setApiRefreshToken(null);
        }
      },

      fetchMe: async (apiInstance) => {
        try {
          const { data } = await apiInstance.get('/auth/me');
          set({ user: data.data.user });
        } catch {
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sv-auth',
      partialize: (state) => ({
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        user:         state.user,
      }),
      // After rehydrating from localStorage, sync tokens into api.service
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken)  setAuthToken(state.accessToken);
        if (state?.refreshToken) setApiRefreshToken(state.refreshToken);
      },
    }
  )
);

// Wire callbacks into api.service AFTER store is created (avoids circular init)
setLogoutCb(() => useAuthStore.getState().logout());
setTokensCb((a, r) => useAuthStore.getState().setTokens(a, r));
