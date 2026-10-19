import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Module-level token store (no circular import) ──────────
// The auth store calls these setters after it initialises.
let _accessToken    = null;
let _refreshToken   = null;
let _logoutCallback = null;
let _setTokens      = null;

export const setAuthToken    = (token)    => { _accessToken  = token; };
export const setRefreshToken = (token)    => { _refreshToken = token; };
export const setLogoutCb     = (fn)       => { _logoutCallback = fn; };
export const setTokensCb     = (fn)       => { _setTokens = fn; };

// ── Request interceptor: attach JWT ────────────────────────
api.interceptors.request.use(
  (config) => {
    if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: silent token refresh ─────────────
let isRefreshing    = false;
let pendingRequests = [];

const processQueue = (error, token = null) => {
  pendingRequests.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token)
  );
  pendingRequests = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          pendingRequests.push({ resolve, reject })
        ).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken: _refreshToken,
        });
        const newAccess  = data.data.accessToken;
        const newRefresh = data.data.refreshToken;

        // Update module-level tokens
        _accessToken  = newAccess;
        _refreshToken = newRefresh;

        // Notify the auth store to persist
        if (_setTokens) _setTokens(newAccess, newRefresh);

        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (_logoutCallback) _logoutCallback();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

