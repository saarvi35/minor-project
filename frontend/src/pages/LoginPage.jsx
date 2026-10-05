import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postData } from "../lib/api";
import { useAuth } from "../lib/auth";
import { alertError, extractError } from "./detailHelpers";

const STATS = [
  ["99.9%", "Uptime SLA"],
  ["240+", "Integrations"],
  ["SOC 2", "Certified"],
];

const BADGES = ["ISO 27001 Certified", "GDPR Compliant", "256-bit TLS"];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const css = `
.enterprise-login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 40px 8%;
  overflow: auto;
  position: relative;
  background: var(--ui-bg);
  color: var(--ui-text);
}

.enterprise-login-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 50%, rgba(37, 99, 235, 0.13) 0%, transparent 65%),
    radial-gradient(ellipse 40% 40% at 15% 85%, rgba(22, 163, 74, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 85% 15%, rgba(37, 99, 235, 0.15) 0%, transparent 60%),
    linear-gradient(135deg, var(--ui-bg) 0%, var(--ui-bg-soft) 50%, var(--ui-bg) 100%);
}

html[data-theme="dark"] .enterprise-login-bg {
  background:
    radial-gradient(ellipse 80% 60% at 50% 50%, rgba(75, 139, 255, 0.18) 0%, transparent 65%),
    radial-gradient(ellipse 40% 40% at 15% 85%, rgba(57, 211, 155, 0.14) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 85% 15%, rgba(75, 139, 255, 0.2) 0%, transparent 60%),
    linear-gradient(135deg, var(--ui-bg) 0%, var(--ui-bg-soft) 50%, var(--ui-bg) 100%);
}

.enterprise-login-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.06) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 94% 92% at 50% 50%, black, transparent);
}

html[data-theme="dark"] .enterprise-login-grid {
  background-image:
    linear-gradient(rgba(75, 139, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(75, 139, 255, 0.08) 1px, transparent 1px);
}

.enterprise-login-noise {
  position: fixed;
  inset: 0;
  z-index: 1;
  opacity: 0.025;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

.enterprise-login-left {
  position: relative;
  z-index: 2;
  width: min(46vw, 560px);
  min-height: 620px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-right: 56px;
}

.enterprise-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  animation: loginFadeUp 0.55s ease both;
}

.enterprise-brand-mark {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1.5px solid var(--ui-primary);
  border-radius: 8px;
  transform: rotate(45deg);
  background: rgba(37, 99, 235, 0.08);
}

.enterprise-brand-mark-inner {
  width: 15px;
  height: 15px;
  border-radius: 4px;
  background: var(--ui-primary);
}

.enterprise-brand-name {
  color: var(--ui-text);
  font-family: var(--ui-serif);
  font-size: 24px;
  letter-spacing: 0.02em;
}

.enterprise-brand-name span {
  color: var(--ui-primary);
}

.enterprise-copy {
  animation: loginFadeUp 0.55s 0.08s ease both;
}

.enterprise-tagline {
  max-width: 520px;
  margin-bottom: 16px;
  color: var(--ui-text);
  font-family: var(--ui-serif);
  font-size: clamp(34px, 4vw, 58px);
  line-height: 1.05;
}

.enterprise-tagline em {
  color: var(--ui-primary);
  font-style: italic;
}

.enterprise-tagline-sub {
  max-width: 380px;
  color: var(--ui-text-soft);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.75;
}

.enterprise-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  max-width: 460px;
  margin-top: 34px;
}

.enterprise-stat-card {
  padding: 16px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-soft);
  backdrop-filter: blur(14px);
}

.enterprise-stat-num {
  color: var(--ui-primary);
  font-family: var(--ui-serif);
  font-size: 28px;
  line-height: 1;
}

.enterprise-stat-label {
  margin-top: 6px;
  color: var(--ui-text-muted);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.enterprise-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  animation: loginFadeUp 0.55s 0.14s ease both;
}

.enterprise-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  background: var(--ui-surface);
  color: var(--ui-text-soft);
  font-size: 11px;
  letter-spacing: 0.05em;
  box-shadow: var(--ui-shadow-soft);
}

.enterprise-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-emerald);
  box-shadow: 0 0 0 3px var(--ui-emerald-soft);
}

.enterprise-login-panel {
  width: 480px;
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 52px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 20px;
  background: var(--ui-surface-strong);
  box-shadow: var(--ui-shadow);
  animation: loginFadeUp 0.5s ease both;
}

html[data-theme="dark"] .enterprise-login-panel {
  border-color: rgba(255, 255, 255, 0.08);
}

@keyframes loginFadeUp {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.enterprise-form-header {
  margin-bottom: 34px;
}

.enterprise-form-eyebrow {
  margin-bottom: 10px;
  color: var(--ui-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.enterprise-form-title {
  margin: 0 0 8px;
  color: var(--ui-text);
  font-family: var(--ui-serif);
  font-size: 34px;
  line-height: 1.1;
}

.enterprise-form-subtitle {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 14px;
}

.enterprise-error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(220, 38, 38, 0.22);
  border-radius: 8px;
  background: var(--ui-rose-soft);
  color: var(--ui-rose);
  font-size: 13px;
}

.enterprise-field-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.enterprise-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enterprise-field-label {
  color: var(--ui-text-soft);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.enterprise-field-wrap {
  position: relative;
}

.enterprise-field-input {
  width: 100%;
  padding: 12px 44px 12px 14px;
  border: 1.5px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg-soft);
  color: var(--ui-text);
  outline: none;
  font-family: var(--ui-font);
  font-size: 14px;
  transition: all 0.18s ease;
}

.enterprise-field-input::placeholder {
  color: var(--ui-text-muted);
}

.enterprise-field-input:focus {
  border-color: var(--ui-primary);
  background: var(--ui-bg-elevated);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

html[data-theme="dark"] .enterprise-field-input:focus {
  box-shadow: 0 0 0 3px rgba(75, 139, 255, 0.16);
}

.enterprise-field-input.error {
  border-color: var(--ui-rose);
  background: var(--ui-rose-soft);
}

.enterprise-field-icon {
  position: absolute;
  top: 50%;
  right: 14px;
  display: grid;
  place-items: center;
  color: var(--ui-text-muted);
  transform: translateY(-50%);
}

button.enterprise-field-icon {
  border: none;
  background: transparent;
  cursor: pointer;
}

.enterprise-field-icon:hover {
  color: var(--ui-text-soft);
}

.enterprise-field-error {
  color: var(--ui-rose);
  font-size: 12px;
}

.enterprise-options-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.enterprise-forgot-link {
  color: var(--ui-primary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.enterprise-forgot-link:hover {
  color: var(--ui-primary-strong);
}

.enterprise-submit-btn {
  width: 100%;
  min-height: 46px;
  margin-bottom: 24px;
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: var(--ui-primary);
  color: #ffffff;
  cursor: pointer;
  font-family: var(--ui-font);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease;
}

.enterprise-submit-btn:hover {
  background: var(--ui-primary-strong);
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.28);
  transform: translateY(-1px);
}

.enterprise-submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.75;
  transform: none;
}

.enterprise-spinner {
  width: 18px;
  height: 18px;
  display: inline-block;
  border: 2px solid rgba(255, 255, 255, 0.32);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: enterpriseSpin 0.7s linear infinite;
}

@keyframes enterpriseSpin {
  to { transform: rotate(360deg); }
}

.enterprise-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0 18px;
}

.enterprise-divider-line {
  flex: 1;
  height: 1px;
  background: var(--ui-border);
}

.enterprise-divider-text {
  color: var(--ui-text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.enterprise-sso-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 16px;
  border: 1.5px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-soft);
  cursor: pointer;
  font-family: var(--ui-font);
  font-size: 13px;
  font-weight: 700;
  transition: all 0.18s ease;
}

.enterprise-sso-btn:hover {
  border-color: var(--ui-border-strong);
  background: var(--ui-bg-soft);
  transform: translateY(-1px);
}

.enterprise-form-footer {
  margin-top: 22px;
}

.enterprise-register-link {
  margin: 18px 0 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  text-align: center;
}

.enterprise-register-link a {
  color: var(--ui-primary);
  font-weight: 800;
  text-decoration: none;
}

.enterprise-register-link a:hover {
  color: var(--ui-primary-strong);
  text-decoration: underline;
}

.enterprise-legal-links {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding-top: 22px;
  border-top: 1px solid var(--ui-border);
}

.enterprise-legal-links a,
.enterprise-help-link {
  color: var(--ui-text-muted);
  font-size: 11px;
  letter-spacing: 0.03em;
  text-decoration: none;
}

.enterprise-legal-links a:hover,
.enterprise-help-link:hover {
  color: var(--ui-text-soft);
}

.enterprise-help-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 12px;
}

@media (max-width: 1024px) {
  .enterprise-login-page {
    justify-content: center;
    padding: 32px 20px;
  }

  .enterprise-login-left {
    display: none;
  }
}

@media (max-width: 560px) {
  .enterprise-login-page {
    align-items: flex-start;
    padding: 0;
  }

  .enterprise-login-panel {
    width: 100%;
    min-height: 100vh;
    border-radius: 0;
    padding: 48px 28px;
    box-shadow: none;
  }
}
`;

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [bannerError, setBannerError] = useState("");
  const [, setErrorState] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const setError = (message) => {
    const text = String(message || "").trim();
    setErrorState("");
    setBannerError(text);
    alertError(text);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Please enter a valid work email.";
    }
    if (!form.password) {
      nextErrors.password = "Password is required.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBannerError("");
    if (!validate()) return;

    setLoading(true);
    setError("");
    try {
      const res = await postData("/login/", form);
      login(res);
      navigate("/");
    } catch (err) {
      setFieldErrors({ email: " ", password: " " });
      setError(extractError(err) || "Invalid credentials. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    const accessToken = response?.access_token;
    if (!accessToken) {
      setError("Google did not return a sign-in token. Please try again.");
      setSsoLoading(false);
      return;
    }

    try {
      const res = await postData("/google-login/", { access_token: accessToken });
      login(res);
      navigate("/");
    } catch (err) {
      setError(extractError(err));
      setSsoLoading(false);
    }
  };

  const handleSso = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google login is not configured. Add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID first.");
      return;
    }

    setSsoLoading(true);
    setBannerError("");

    try {
      await loadGoogleIdentityScript();
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        callback: handleGoogleCredential,
      });
      tokenClient.requestAccessToken({ prompt: "select_account" });
    } catch {
      setSsoLoading(false);
      setError("Unable to load Google sign-in. Please check your network and try again.");
    }
  };

  return (
    <>
      <style>{css}</style>
      <main className="enterprise-login-page">
        <div className="enterprise-login-bg" />
        <div className="enterprise-login-grid" />
        <div className="enterprise-login-noise" />

        <section className="enterprise-login-left" aria-label="WorkZen overview">
          <div className="enterprise-brand">
            <div className="enterprise-brand-mark"><div className="enterprise-brand-mark-inner" /></div>
            <span className="enterprise-brand-name">Work<span>Zen</span></span>
          </div>

          <div className="enterprise-copy">
            <h1 className="enterprise-tagline">
              The operating system<br />enterprise <em>runs on.</em>
            </h1>
            <p className="enterprise-tagline-sub">
              Unified operations, intelligence, and security for teams that move fast and cannot afford to lose clarity.
            </p>
            <div className="enterprise-stats">
              {STATS.map(([value, label]) => (
                <div className="enterprise-stat-card" key={label}>
                  <div className="enterprise-stat-num">{value}</div>
                  <div className="enterprise-stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-badges">
            {BADGES.map((badge) => (
              <div className="enterprise-badge" key={badge}>
                <div className="enterprise-badge-dot" />
                {badge}
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="enterprise-login-panel">
          <div className="enterprise-form-header">
            <div className="enterprise-form-eyebrow">Secure Access Portal</div>
            <h2 className="enterprise-form-title">Welcome back</h2>
            <p className="enterprise-form-subtitle">Sign in to your WorkZen workspace</p>
          </div>

          {bannerError ? (
            <div className="enterprise-error-banner">
              <AlertIcon />
              <span>{bannerError}</span>
            </div>
          ) : null}

          <div className="enterprise-field-group">
            <div className="enterprise-field">
              <label className="enterprise-field-label" htmlFor="loginEmail">Work Email</label>
              <div className="enterprise-field-wrap">
                <input
                  id="loginEmail"
                  className={`enterprise-field-input ${fieldErrors.email ? "error" : ""}`}
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((s) => ({ ...s, email: e.target.value }));
                    setFieldErrors((s) => ({ ...s, email: "" }));
                  }}
                  required
                />
                <span className="enterprise-field-icon"><MailIcon /></span>
              </div>
              {fieldErrors.email?.trim() ? <span className="enterprise-field-error">{fieldErrors.email}</span> : null}
            </div>

            <div className="enterprise-field">
              <label className="enterprise-field-label" htmlFor="loginPassword">Password</label>
              <div className="enterprise-field-wrap">
                <input
                  id="loginPassword"
                  className={`enterprise-field-input ${fieldErrors.password ? "error" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => {
                    setForm((s) => ({ ...s, password: e.target.value }));
                    setFieldErrors((s) => ({ ...s, password: "" }));
                  }}
                  required
                />
                <button
                  type="button"
                  className="enterprise-field-icon"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
              {fieldErrors.password?.trim() ? <span className="enterprise-field-error">{fieldErrors.password}</span> : null}
            </div>
          </div>

          <div className="enterprise-options-row">
            <a href="#help" className="enterprise-forgot-link">Forgot password?</a>
          </div>

          <button className="enterprise-submit-btn" disabled={loading}>
            {loading ? <span className="enterprise-spinner" /> : "Sign In to Workspace"}
          </button>

          <div className="enterprise-divider">
            <div className="enterprise-divider-line" />
            <span className="enterprise-divider-text">or sign in with</span>
            <div className="enterprise-divider-line" />
          </div>

          <button type="button" className="enterprise-sso-btn" onClick={handleSso} disabled={ssoLoading}>
            {ssoLoading ? <span className="enterprise-spinner" /> : <GoogleIcon />}
            {ssoLoading ? "Redirecting..." : "Sign in with Google"}
          </button>

          <p className="enterprise-register-link">
            New company? <Link to="/register">Register here</Link>
          </p>

          <div className="enterprise-form-footer">
            <div className="enterprise-legal-links">
              <a href="#privacy">Privacy Policy</a>
              <a href="#terms">Terms of Use</a>
              <a href="#cookies">Cookies</a>
            </div>
            <a href="#help" id="help" className="enterprise-help-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Contact IT Help Desk
            </a>
          </div>
        </form>
      </main>
    </>
  );
}
