import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import ApiService from '../services/ApiService';

const useAppStore = create(
  persist(
    (set) => ({
      user: null,
      authToken: null,
      hasHydrated: false,

      audiobooks: [],
      serverUrl: 'http://localhost:5002',
      themePreference: 'system', // 'system' | 'light' | 'dark'
      defaultNarrationSpeed: 1.0,
      tempData: {},

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setAuthSession: (user, authToken) => {
        ApiService.setToken(authToken || null);
        set({ user: user || null, authToken: authToken || null });
      },

      updateUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : null,
        })),

      clearAuthSession: () => {
        ApiService.setToken(null);
        set({ user: null, authToken: null });
      },

      setServerUrl: (url) => {
        const cleaned = (url || 'http://localhost:5002').trim().replace(/\/+$/, '');
        ApiService.setBaseUrl(cleaned);
        set({ serverUrl: cleaned });
      },

      setThemePreference: (themePreference) => set({ themePreference }),

      setDefaultNarrationSpeed: (defaultNarrationSpeed) => set({ defaultNarrationSpeed }),

      setTempData: (data) =>
        set((state) => ({
          tempData: { ...state.tempData, ...data },
        })),

      clear: () => set({ tempData: {} }),

      addAudiobook: (newBook) =>
        set((state) => ({
          audiobooks: [
            newBook,
            ...state.audiobooks.filter((b) => String(b.id) !== String(newBook.id)),
          ],
        })),

      updateAudiobook: (id, patch) =>
        set((state) => ({
          audiobooks: state.audiobooks.map((b) =>
            String(b.id) === String(id) ? { ...b, ...patch } : b
          ),
        })),

      removeAudiobook: (id) =>
        set((state) => ({
          audiobooks: state.audiobooks.filter((b) => String(b.id) !== String(id)),
        })),

      clearAudiobooks: () => set({ audiobooks: [] }),
    }),
    {
      name: 'audiobook-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        authToken: state.authToken,
        audiobooks: state.audiobooks,
        serverUrl: state.serverUrl,
        themePreference: state.themePreference,
        defaultNarrationSpeed: state.defaultNarrationSpeed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.serverUrl) {
          ApiService.setBaseUrl(state.serverUrl);
        }
        if (state?.authToken) {
          ApiService.setToken(state.authToken);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useAppStore;
