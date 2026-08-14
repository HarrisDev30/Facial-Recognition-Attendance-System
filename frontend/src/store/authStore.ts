import { create } from "zustand";
import type { UserProfileResponse } from "../types/auth";
import * as authApi from "../api/auth";
import { setSessionExpiredHandler } from "../utils/session";
import { getApiError } from "../utils/error";

interface AuthState {
  token: string | null;
  user: UserProfileResponse | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
  setProfilePhotoUrl: (url: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem("token", res.access_token);
      const user = res.user || await authApi.getMe();
      set({ token: res.access_token, user, loading: false });
    } catch (err: unknown) {
      const msg = getApiError(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null, error: null });
  },

  restoreSession: async () => {
    const token = get().token;
    if (!token) return;
    set({ loading: true });
    try {
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),

  setProfilePhotoUrl: (url) =>
    set((state) => ({
      user: state.user ? { ...state.user, profile_photo_url: url } : null,
    })),
}));

setSessionExpiredHandler(() => useAuthStore.getState().logout());
