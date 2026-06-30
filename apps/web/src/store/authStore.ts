import { create } from 'zustand';
import { supabase } from '../lib/supabase.js';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  role: 'viewer' | 'analyst' | 'operator' | 'admin' | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: 'viewer' | 'analyst' | 'operator' | 'admin' | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  loading: true,
  initialized: false,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  initialize: async () => {
    if (get().initialized) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user });
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        set({ role: (profile?.role as any) || 'viewer' });
      }
    } catch (err) {
      console.error('Failed to initialize auth session:', err);
    } finally {
      set({ loading: false, initialized: true });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, role: null });
        return;
      }

      if (session?.user) {
        set({ user: session.user });
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          set({ role: (profile?.role as any) || 'viewer' });
        }
      }
    });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null });
  },
}));
