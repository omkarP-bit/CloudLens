import { create } from 'zustand';

interface AccountState {
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),
}));
