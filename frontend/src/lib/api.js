import axios from "axios";
import { clearAuthStorage, getRefreshToken, getToken, updateAccessToken } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://workbridge-smart-enterprise-platform1.onrender.com/api";
const REFRESH_PATH = import.meta.env.VITE_TOKEN_REFRESH_PATH || "/token/refresh/";

const api = axios.create({ baseURL: API_BASE_URL });
const refreshClient = axios.create({ baseURL: API_BASE_URL });

let refreshPromise = null;

function shouldSkipRefresh(url = "") {
  return url.includes("/login/") || url.includes("/set-password/") || url.includes(REFRESH_PATH);
}

async function fetchNewAccessToken(refreshToken) {
  const candidates = [REFRESH_PATH, "/token/refresh/", "/auth/token/refresh/"];

  for (const path of candidates) {
    try {
      const { data } = await refreshClient.post(path, { refresh: refreshToken });
      if (data?.access) {
        return data.access;
      }
    } catch {
      // Try next configured endpoint.
    }
  }

  throw new Error("Unable to refresh access token");
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (!originalRequest || status !== 401 || originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
      throw error;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthStorage();
      throw error;
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = fetchNewAccessToken(refreshToken).finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      updateAccessToken(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearAuthStorage();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw refreshError;
    }
  }
);

export async function getData(url) {
  const { data } = await api.get(url);
  return data;
}

export async function postData(url, payload) {
  const { data } = await api.post(url, payload);
  return data;
}

export async function patchData(url, payload) {
  const { data } = await api.patch(url, payload);
  return data;
}

export async function putData(url, payload) {
  const { data } = await api.put(url, payload);
  return data;
}

export async function deleteData(url) {
  const { data } = await api.delete(url);
  return data;
}

export default api;