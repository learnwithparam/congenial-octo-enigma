// src/lib/api-client.ts

import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (process.env.NODE_ENV === 'development') {
      const method = config.method?.toUpperCase() || 'UNKNOWN';
      console.log('[API] ' + method + ' ' + config.url);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for consistent error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as Record<string, unknown>;

      console.error(
        '[API Error] ' + status + ': ' + (data?.error || error.message)
      );
    } else if (error.request) {
      // Request made but no response received
      console.error('[API Error] No response from server');
    } else {
      // Error setting up the request
      console.error('[API Error] ' + error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
