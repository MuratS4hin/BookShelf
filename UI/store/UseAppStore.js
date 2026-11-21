import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';

const useAppStore = create(
  persist(
    (set) => ({
      audiobooks: [],
      serverUrl: 'http://localhost:5002',
      themePreference: 'system', // 'system' | 'light' | 'dark'
      defaultNarrationSpeed: 1.0,
      tempData: {},

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
      onRehydrateStorage: () => (state) => {
        if (state?.serverUrl) {
          ApiService.setBaseUrl(state.serverUrl);
        }
      },
    }
  )
);

export default useAppStore;
