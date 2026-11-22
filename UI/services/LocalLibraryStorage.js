import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const IDB_NAME = 'bookshelf-local-files';
const IDB_VERSION = 1;
const IDB_STORE = 'files';

function getBooksRootDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Device document directory is unavailable.');
  }
  return `${FileSystem.documentDirectory}bookshelf/`;
}

function getBookDir(bookId) {
  return `${getBooksRootDir()}${bookId}/`;
}

async function ensureDir(dirUri) {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
}

// ----------------------------------------------------------------------
// Web IndexedDB helpers (when Platform.OS === 'web')
// ----------------------------------------------------------------------

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open local file storage.'));
  });
}

async function idbPut(key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err || new Error('Failed to save file to device storage.'));
    };
  });
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => {
      const result = req.result;
      db.close();
      resolve(result ?? null);
    };
    req.onerror = () => {
      const err = req.error;
      db.close();
      reject(err || new Error('Failed to read file from device storage.'));
    };
  });
}

async function idbDeletePrefix(prefix) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err || new Error('Failed to delete files from device storage.'));
    };
  });
}

async function idbClear() {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      const err = tx.error;
      db.close();
      reject(err || new Error('Failed to clear device storage.'));
    };
  });
}

function parseIdbKey(uri) {
  return uri.slice('idb://'.length);
}

// ----------------------------------------------------------------------
// Public On-Device Storage Service
// ----------------------------------------------------------------------

export default class LocalLibraryStorage {
  static createBookId() {
    return `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Copy the picked PDF/EPUB into persistent app storage on the phone.
   */
  static async saveSourceFile(bookId, pickedFile) {
    if (Platform.OS === 'web') {
      let blob = pickedFile.file || null;
      if (!blob && pickedFile.uri) {
        const res = await fetch(pickedFile.uri);
        blob = await res.blob();
      }
      if (!blob) {
        throw new Error('Could not read selected file on device.');
      }
      await idbPut(`${bookId}/source`, blob);
      return {
        sourcePath: `idb://${bookId}/source`,
        sourceSize: blob.size || pickedFile.size || 0,
      };
    }

    const bookDir = getBookDir(bookId);
    await ensureDir(bookDir);
    const ext = (pickedFile.name?.split('.').pop() || 'pdf').toLowerCase();
    const dest = `${bookDir}source.${ext}`;

    await FileSystem.copyAsync({
      from: pickedFile.uri,
      to: dest,
    });
    const info = await FileSystem.getInfoAsync(dest, { size: true });
    return {
      sourcePath: dest,
      sourceSize: info.exists ? info.size || pickedFile.size || 0 : pickedFile.size || 0,
    };
  }

  /**
   * Download generated MP3 audio, optional cover image, and optional cleaned text onto this device.
   */
  static async saveConvertedAssets(
    bookId,
    { audioUrl, coverUrl = null, textUrl = null, headers = {}, onProgress = null }
  ) {
    if (!audioUrl) {
      throw new Error('Audio download URL is missing.');
    }

    if (Platform.OS === 'web') {
      const audioRes = await fetch(audioUrl, { headers });
      if (!audioRes.ok) {
        throw new Error(`Audio download failed (HTTP ${audioRes.status})`);
      }
      const audioBlob = await audioRes.blob();
      if (!audioBlob || audioBlob.size <= 0) {
        throw new Error('Downloaded audio file is empty.');
      }
      await idbPut(`${bookId}/audio`, audioBlob);
      onProgress?.(1);

      let totalAssetBytes = audioBlob.size;
      let imageUrl = null;
      let textPath = null;

      if (coverUrl) {
        try {
          const coverRes = await fetch(coverUrl, { headers });
          if (coverRes.ok) {
            const coverBlob = await coverRes.blob();
            if (coverBlob && coverBlob.size > 0) {
              await idbPut(`${bookId}/cover`, coverBlob);
              imageUrl = `idb://${bookId}/cover`;
              totalAssetBytes += coverBlob.size;
            }
          }
        } catch {
          // Optional cover; continue without failing audiobook save.
        }
      }

      if (textUrl) {
        try {
          const textRes = await fetch(textUrl, { headers });
          if (textRes.ok) {
            const cleanedText = await textRes.text();
            if (cleanedText) {
              await idbPut(`${bookId}/text`, cleanedText);
              textPath = `idb://${bookId}/text`;
              totalAssetBytes += new Blob([cleanedText]).size;
            }
          }
        } catch {
          // Optional transcript; continue without failing audiobook save.
        }
      }

      return {
        audioPath: `idb://${bookId}/audio`,
        imageUrl,
        textPath,
        audioSize: audioBlob.size,
        totalAssetBytes,
      };
    }

    const bookDir = getBookDir(bookId);
    await ensureDir(bookDir);

    const audioDest = `${bookDir}audio.mp3`;
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      audioDest,
      { headers },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (onProgress && totalBytesExpectedToWrite > 0) {
          onProgress(Math.max(0, Math.min(1, totalBytesWritten / totalBytesExpectedToWrite)));
        }
      }
    );

    const audioResult = await downloadResumable.downloadAsync();
    if (!audioResult || audioResult.status !== 200) {
      await FileSystem.deleteAsync(audioDest, { idempotent: true });
      throw new Error(`Audio download failed (HTTP ${audioResult?.status ?? 'unknown'})`);
    }

    const audioInfo = await FileSystem.getInfoAsync(audioDest, { size: true });
    if (!audioInfo.exists || !audioInfo.size || audioInfo.size <= 0) {
      await FileSystem.deleteAsync(audioDest, { idempotent: true });
      throw new Error('Downloaded audio file is empty.');
    }
    onProgress?.(1);

    let totalAssetBytes = audioInfo.size;
    let imageUrl = null;
    let textPath = null;

    if (coverUrl) {
      const coverDest = `${bookDir}cover.png`;
      try {
        const coverResult = await FileSystem.downloadAsync(coverUrl, coverDest, { headers });
        if (coverResult.status === 200) {
          const coverInfo = await FileSystem.getInfoAsync(coverDest, { size: true });
          if (coverInfo.exists && coverInfo.size > 0) {
            imageUrl = coverDest;
            totalAssetBytes += coverInfo.size;
          } else {
            await FileSystem.deleteAsync(coverDest, { idempotent: true });
          }
        } else {
          await FileSystem.deleteAsync(coverDest, { idempotent: true });
        }
      } catch {
        await FileSystem.deleteAsync(coverDest, { idempotent: true });
      }
    }

    if (textUrl) {
      const textDest = `${bookDir}cleaned.txt`;
      try {
        const textResult = await FileSystem.downloadAsync(textUrl, textDest, { headers });
        if (textResult.status === 200) {
          const textInfo = await FileSystem.getInfoAsync(textDest, { size: true });
          if (textInfo.exists && textInfo.size > 0) {
            textPath = textDest;
            totalAssetBytes += textInfo.size;
          } else {
            await FileSystem.deleteAsync(textDest, { idempotent: true });
          }
        } else {
          await FileSystem.deleteAsync(textDest, { idempotent: true });
        }
      } catch {
        await FileSystem.deleteAsync(textDest, { idempotent: true });
      }
    }

    return {
      audioPath: audioDest,
      imageUrl,
      textPath,
      audioSize: audioInfo.size,
      totalAssetBytes,
    };
  }

  /**
   * Resolve a playable local URI for Expo AV (`file://` on native, `blob:` object URL on web).
   */
  static async resolveAudioUri(book) {
    if (!book?.audioPath) {
      throw new Error('No audio file is stored on this device for this book.');
    }

    if (Platform.OS === 'web') {
      if (!book.audioPath.startsWith('idb://')) {
        throw new Error('This audiobook is not stored locally in browser storage. Please re-import it.');
      }
      const blob = await idbGet(parseIdbKey(book.audioPath));
      if (!blob) {
        throw new Error('Local audio file is missing from device storage.');
      }
      const uri = URL.createObjectURL(blob);
      return {
        uri,
        revoke: () => URL.revokeObjectURL(uri),
      };
    }

    if (!book.audioPath.startsWith('file://')) {
      throw new Error('This audiobook uses a legacy server URL and is not stored on this device. Please re-import it.');
    }
    const info = await FileSystem.getInfoAsync(book.audioPath);
    if (!info.exists) {
      throw new Error('Local audio file is missing on this device.');
    }
    return {
      uri: book.audioPath,
      revoke: () => {},
    };
  }

  /**
   * Resolve a renderable local cover URI (`file://` on native, `blob:` object URL on web).
   */
  static async resolveCoverUri(book) {
    if (!book?.imageUrl) {
      return { uri: null, revoke: () => {} };
    }

    if (Platform.OS === 'web') {
      if (book.imageUrl.startsWith('idb://')) {
        const blob = await idbGet(parseIdbKey(book.imageUrl));
        if (!blob) {
          return { uri: null, revoke: () => {} };
        }
        const uri = URL.createObjectURL(blob);
        return {
          uri,
          revoke: () => URL.revokeObjectURL(uri),
        };
      }
      return { uri: book.imageUrl, revoke: () => {} };
    }

    if (book.imageUrl.startsWith('file://')) {
      const info = await FileSystem.getInfoAsync(book.imageUrl);
      return {
        uri: info.exists ? book.imageUrl : null,
        revoke: () => {},
      };
    }

    return { uri: book.imageUrl, revoke: () => {} };
  }

  /**
   * Read the cleaned transcript directly from device storage.
   */
  static async readCleanedText(book) {
    if (!book?.textPath) {
      return '';
    }

    if (Platform.OS === 'web') {
      if (!book.textPath.startsWith('idb://')) {
        return '';
      }
      const content = await idbGet(parseIdbKey(book.textPath));
      return typeof content === 'string' ? content : '';
    }

    if (!book.textPath.startsWith('file://')) {
      return '';
    }
    const info = await FileSystem.getInfoAsync(book.textPath);
    if (!info.exists) {
      return '';
    }
    return FileSystem.readAsStringAsync(book.textPath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  /**
   * Return an uploadable payload for a previously imported on-device PDF/EPUB.
   */
  static async getUploadableSourceFile(book) {
    if (!book?.sourcePath) {
      throw new Error('Original PDF or EPUB file is missing from this device.');
    }
    const ext = (book.fileType || 'pdf').toLowerCase();
    const name = book.fileName || `${book.title || 'book'}.${ext}`;
    const mimeType =
      book.mimeType || (ext === 'epub' ? 'application/epub+zip' : 'application/pdf');

    if (Platform.OS === 'web') {
      if (!book.sourcePath.startsWith('idb://')) {
        throw new Error('Original file is missing from browser storage.');
      }
      const blob = await idbGet(parseIdbKey(book.sourcePath));
      if (!blob) {
        throw new Error('Original PDF or EPUB file is missing from browser storage.');
      }
      return { file: blob, name, mimeType };
    }

    if (!book.sourcePath.startsWith('file://')) {
      throw new Error('Original PDF or EPUB file path is invalid.');
    }
    const info = await FileSystem.getInfoAsync(book.sourcePath);
    if (!info.exists) {
      throw new Error('Original PDF or EPUB file is missing on this device.');
    }
    return { uri: book.sourcePath, name, mimeType };
  }

  /**
   * Delete all locally stored files for a single book.
   */
  static async deleteBookFiles(bookId) {
    if (!bookId) return;
    if (Platform.OS === 'web') {
      await idbDeletePrefix(`${bookId}/`);
      return;
    }
    await FileSystem.deleteAsync(getBookDir(bookId), { idempotent: true });
  }

  /**
   * Delete every book, cover, transcript, and MP3 stored on this device.
   */
  static async clearAllBookFiles() {
    if (Platform.OS === 'web') {
      await idbClear();
      return;
    }
    await FileSystem.deleteAsync(getBooksRootDir(), { idempotent: true });
  }

  /**
   * Total bytes occupied on this device across saved books.
   */
  static getTotalStorageBytes(books) {
    return (books || []).reduce((sum, book) => sum + (Number(book?.localSizeBytes) || 0), 0);
  }
}
