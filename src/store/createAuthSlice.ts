import type { StateCreator } from 'zustand';
import type { AuthSlice, StoreState } from './types';

export const createAuthSlice: StateCreator<StoreState, [], [], AuthSlice> = set => ({
  isAuthenticated: false,

  setIsAuthenticated: (value: boolean) => {
    set({ isAuthenticated: value });
  },
});
