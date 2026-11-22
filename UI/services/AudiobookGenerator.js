import ApiService from './ApiService';
import LocalLibraryStorage from './LocalLibraryStorage';
import useAppStore from '../store/UseAppStore';

export const STAGE_LABELS = {
  uploading: 'Sending document to AI backend…',
  queued: 'Queued for DNN & TTS…',
  extracting: 'Extracting layout & text…',
  cleaning: 'DNN cleaning page numbers & noise…',
  narrating: 'Neural TTS creating audio…',
  encoding: 'Encoding MP3…',
  downloading: 'Saving audio to this device…',
  done: 'Audio ready on device',
};

const _activeJobs = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default class AudiobookGenerator {
  static isGenerating(bookId) {
    return _activeJobs.has(String(bookId));
  }

  /**
   * Upload an already-added local PDF/EPUB to the AI backend, run DNN cleaning +
   * Piper TTS narration, download the assets to phone storage, and purge server temp files.
   */
  static async generateForBook(bookId) {
    const key = String(bookId);
    if (_activeJobs.has(key)) {
      return null;
    }

    const initialState = useAppStore.getState();
    const initialBook = initialState.audiobooks.find((b) => String(b.id) === key);
    if (!initialBook) {
      throw new Error('Document not found on this device.');
    }

    const { serverUrl, defaultNarrationSpeed, updateAudiobook } = initialState;
    _activeJobs.add(key);

    let jobId = null;
    try {
      updateAudiobook(bookId, {
        status: 'processing',
        stage: 'uploading',
        progress: 0,
        error: null,
      });

      const uploadFile = await LocalLibraryStorage.getUploadableSourceFile(initialBook);
      const jobRes = await ApiService.startConversionJob(
        uploadFile,
        defaultNarrationSpeed || 1.0,
        serverUrl
      );
      jobId = jobRes.job_id;

      let completedJob = null;
      while (true) {
        const currentBook = useAppStore
          .getState()
          .audiobooks.find((b) => String(b.id) === key);
        if (!currentBook) {
          ApiService.deleteJob(jobId, serverUrl).catch(() => {});
          return null;
        }

        const job = await ApiService.getJobStatus(jobId, serverUrl);
        const pct = Math.round((job.progress || 0) * 0.9);
        const patch = {
          status: job.status === 'completed' ? 'processing' : job.status,
          stage: job.stage || 'queued',
          progress: pct,
        };
        if (job.title) {
          patch.title = job.title;
        }
        if (job.author && job.author !== 'Unknown') {
          patch.author = job.author;
        }
        updateAudiobook(bookId, patch);

        if (job.status === 'completed') {
          completedJob = job;
          break;
        }
        if (job.status === 'failed') {
          throw new Error(job.error || 'Audiobook generation failed');
        }

        await sleep(1500);
      }

      updateAudiobook(bookId, {
        stage: 'downloading',
        progress: 92,
      });

      const assets = await LocalLibraryStorage.saveConvertedAssets(bookId, {
        audioUrl: ApiService.getJobAudioUrl(jobId, serverUrl),
        coverUrl: completedJob.has_cover
          ? ApiService.getJobCoverUrl(jobId, serverUrl)
          : null,
        textUrl: completedJob.has_text
          ? ApiService.getJobTextUrl(jobId, serverUrl)
          : null,
        headers: ApiService.getAuthHeaders(),
        onProgress: (frac) => {
          updateAudiobook(bookId, {
            stage: 'downloading',
            progress: 92 + Math.round(frac * 8),
          });
        },
      });

      // Immediately purge temporary conversion files from the backend server.
      ApiService.deleteJob(jobId, serverUrl).catch(() => {});
      jobId = null;

      const latestBook = useAppStore
        .getState()
        .audiobooks.find((b) => String(b.id) === key);
      if (!latestBook) {
        await LocalLibraryStorage.deleteBookFiles(bookId).catch(() => {});
        return null;
      }

      const baseSize = latestBook.sourceSize || latestBook.localSizeBytes || 0;
      const finalPatch = {
        title: completedJob.title || latestBook.title,
        author:
          completedJob.author && completedJob.author !== 'Unknown'
            ? completedJob.author
            : latestBook.author || 'AI Narrator',
        imageUrl: assets.imageUrl,
        audioPath: assets.audioPath,
        textPath: assets.textPath,
        duration: completedJob.duration,
        localSizeBytes: baseSize + assets.totalAssetBytes,
        storedLocally: true,
        status: 'completed',
        stage: 'done',
        progress: 100,
        error: null,
      };
      updateAudiobook(bookId, finalPatch);
      return { ...latestBook, ...finalPatch };
    } catch (err) {
      const stillExists = useAppStore
        .getState()
        .audiobooks.some((b) => String(b.id) === key);
      if (stillExists) {
        updateAudiobook(bookId, {
          status: 'failed',
          stage: 'failed',
          error: err.message || 'Conversion failed',
        });
      }
      if (jobId) {
        ApiService.deleteJob(jobId, serverUrl).catch(() => {});
      }
      throw err;
    } finally {
      _activeJobs.delete(key);
    }
  }
}
