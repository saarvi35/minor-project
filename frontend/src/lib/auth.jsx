import { createContext, useContext, useMemo, useState } from "react";

const ACCESS_TOKEN_KEY = "workhub_access_token";
const REFRESH_TOKEN_KEY = "workhub_refresh_token";
const USER_KEY = "workhub_user";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://workbridge-smart-enterprise-platform1.onrender.com/api";

const AuthContext = createContext(null);

function safeReadJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function updateAccessToken(accessToken) {
  if (!accessToken) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearAuthStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function sendLogoutRequest(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return;

  const base = String(API_BASE_URL || "").replace(/\/$/, "");
  const logoutUrl = `${base}/logout/`;

  try {
    await fetch(logoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ refresh: refreshToken })
    });
  } catch {
    // Ignore network/logout API errors; local logout still proceeds.
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken());
  const [refreshToken, setRefreshToken] = useState(getRefreshToken());
  const [user, setUser] = useState(() => safeReadJson(USER_KEY));

  const login = (payload) => {
    const access = payload?.data?.access;
    const refresh = payload?.data?.refresh;

    if (!access || !refresh) {
      throw new Error("Access/refresh token not found in login response.");
    }

    const profile = { ...(payload?.data || {}) };
    delete profile.access;
    delete profile.refresh;

    setToken(access);
    setRefreshToken(refresh);
    setUser(profile);

    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
  };

  const logout = async () => {
    const access = token || getToken();
    const refresh = refreshToken || getRefreshToken();

    await sendLogoutRequest(access, refresh);

    setToken(null);
    setRefreshToken(null);
    setUser(null);
    clearAuthStorage();
  };

  const value = useMemo(
    () => ({ token, refreshToken, user, login, logout }),
    [token, refreshToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
