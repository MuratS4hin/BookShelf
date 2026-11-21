import { Platform } from 'react-native';

const DEFAULT_BASE_URL = 'http://localhost:5002';

export default class ApiService {
  static baseUrl = DEFAULT_BASE_URL;
  static token = null;

  static getBaseUrl() {
    return this.baseUrl.replace(/\/+$/, '');
  }

  static setBaseUrl(url) {
    if (url && typeof url === 'string') {
      this.baseUrl = url.trim().replace(/\/+$/, '');
    }
  }

  static setToken(newToken) {
    this.token = newToken;
  }

  static resolveUrl(path) {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.getBaseUrl()}${cleanPath}`;
  }

  static async getHealth(baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/health`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return response.json();
  }

  static async uploadBook(file, speed = 1.0, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const formData = new FormData();

    if (Platform.OS === 'web' && file.file) {
      formData.append('file', file.file, file.name);
    } else {
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
    }
    formData.append('speed', String(speed));

    const response = await fetch(`${base}/upload-book/`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `Upload failed (${response.status})`);
    }
    return data;
  }

  static async getAudiobookStatus(bookId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/audiobook-status/book/${bookId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Status check failed (${response.status})`);
    }
    return data;
  }

  static async getCleanedText(bookId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/books/${bookId}/text`);
    if (!response.ok) {
      throw new Error(`Cleaned text not available (${response.status})`);
    }
    return response.text();
  }

  static async deleteBook(bookId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/books/${bookId}/full`, {
      method: 'DELETE',
    });
    if (response.status === 404) {
      return { status: 'not_found' };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Delete failed (${response.status})`);
    }
    return data;
  }

  static getStreamUrl(bookId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    return `${base}/stream-audiobook/book/${bookId}`;
  }
}
