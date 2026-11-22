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
    this.token = newToken || null;
  }

  static getAuthHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  static resolveUrl(path) {
    if (!path) return null;
    if (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('file://') ||
      path.startsWith('idb://')
    ) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.getBaseUrl()}${cleanPath}`;
  }

  static _extractError(data, fallbackMessage) {
    if (typeof data?.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
    return data?.message || fallbackMessage;
  }

  static async getHealth(baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/health`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return response.json();
  }

  // ----------------------------------------------------------------------
  // User Authentication (Database-backed)
  // ----------------------------------------------------------------------

  static async signup({ email, username, password, full_name }, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        username,
        password,
        full_name: full_name || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Sign up failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }

  static async login({ email, password }, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Sign in failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }

  static async getMe(baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/api/auth/me`, {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Session check failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }

  // ----------------------------------------------------------------------
  // Ephemeral Conversion Jobs (Books & audio downloaded to phone only)
  // ----------------------------------------------------------------------

  static async startConversionJob(file, speed = 1.0, baseUrlOverride = null) {
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

    const response = await fetch(`${base}/jobs/convert`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Upload failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }

  static async getJobStatus(jobId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/jobs/${jobId}/status`, {
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Status check failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }

  static getJobAudioUrl(jobId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    return `${base}/jobs/${jobId}/audio`;
  }

  static getJobTextUrl(jobId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    return `${base}/jobs/${jobId}/text`;
  }

  static getJobCoverUrl(jobId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    return `${base}/jobs/${jobId}/cover`;
  }

  static async deleteJob(jobId, baseUrlOverride = null) {
    const base = (baseUrlOverride || this.getBaseUrl()).replace(/\/+$/, '');
    const response = await fetch(`${base}/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    if (response.status === 404) {
      return { status: 'not_found' };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(this._extractError(data, `Cleanup failed (${response.status})`));
      err.status = response.status;
      throw err;
    }
    return data;
  }
}
