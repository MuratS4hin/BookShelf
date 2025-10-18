import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // Persist middleware'ini içeri aktar
import AsyncStorage from '@react-native-async-storage/async-storage'; // AsyncStorage'i içeri aktar

// NOT: AsyncStorage'i projenize kurmanız gerekebilir:
// yarn add @react-native-async-storage/async-storage

const useAppStore = create(
  // Zustand'ın durumunu kalıcı hale getirmek için persist fonksiyonunu kullanıyoruz
  persist(
    (set, get) => ({
      // ✅ audiobooks: Bu veriler artık kalıcı olarak saklanacak
      audiobooks: [
        // Varsayılan kitaplar (Uygulama ilk kez yüklendiğinde kullanılacak)
        // { id: '1', title: 'The Silent Observer', author: 'Ethan Carter', imageUrl: 'https://picsum.photos/id/4/150/200', audioPath: null },
        // { id: '2', title: 'Echoes of the Past', author: 'Sophia Bennett', imageUrl: 'https://picsum.photos/id/5/150/200', audioPath: null },
        // { id: '3', title: 'The Hidden Path', author: 'Daniel Harper', imageUrl: 'https://picsum.photos/id/6/150/200', audioPath: null },
      ],
      tempData: {}, // Geçici veriler (Bunlar da kalıcı olur, isterseniz exclude edebilirsiniz)
      
      // Actions
      setTempData: (data) => set((state) => ({
        tempData: { ...state.tempData, ...data },
      })),
      clear: () => set({ tempData: {} }),

      // Yeni: Yeni bir sesli kitap (ve .mp3 yolu) ekleme
      addAudiobook: (newBook) => set((state) => ({
        audiobooks: [newBook, ...state.audiobooks],
      })),
    }),
    {
      name: 'audiobook-storage', // AsyncStorage'de kullanılacak benzersiz anahtar
      storage: createJSONStorage(() => AsyncStorage), // Hangi depolama motorunun kullanılacağını belirtir
      // optionally, you can choose which parts of the state to persist
      // partialize: (state) => ({ audiobooks: state.audiobooks }),
    }
  )
);

export default useAppStore;
