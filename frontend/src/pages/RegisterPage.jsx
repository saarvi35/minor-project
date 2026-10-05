import { useState } from "react";
import { Link } from "react-router-dom";
import { postData } from "../lib/api";
import { alertError, extractError } from "./detailHelpers";

const defaultPayload = {
  owner_name: "",
  owner_email: "",
  password: "",
  company: { name: "", email: "", phone: "", size: "", address: "" },
};

const COMPANY_SIZES = [
  "1 - 10 employees",
  "11 - 50 employees",
  "51 - 200 employees",
  "201 - 500 employees",
  "500+ employees",
];

const css = `
.registration-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 16px;
  position: relative;
  overflow: auto;
  background: var(--ui-bg);
  color: var(--ui-text);
}

.registration-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 55% at 50% 48%, rgba(37, 99, 235, 0.13) 0%, transparent 64%),
    radial-gradient(ellipse 38% 42% at 15% 85%, rgba(22, 163, 74, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 40% 42% at 85% 15%, rgba(37, 99, 235, 0.14) 0%, transparent 62%),
    linear-gradient(135deg, var(--ui-bg) 0%, var(--ui-bg-soft) 52%, var(--ui-bg) 100%);
  z-index: 0;
}

html[data-theme="dark"] .registration-bg {
  background:
    radial-gradient(ellipse 70% 55% at 50% 48%, rgba(75, 139, 255, 0.18) 0%, transparent 64%),
    radial-gradient(ellipse 38% 42% at 15% 85%, rgba(57, 211, 155, 0.14) 0%, transparent 60%),
    radial-gradient(ellipse 40% 42% at 85% 15%, rgba(75, 139, 255, 0.2) 0%, transparent 62%),
    linear-gradient(135deg, var(--ui-bg) 0%, var(--ui-bg-soft) 52%, var(--ui-bg) 100%);
}

.registration-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.06) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 92% 88% at 50% 50%, black, transparent);
}

html[data-theme="dark"] .registration-grid {
  background-image:
    linear-gradient(rgba(75, 139, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(75, 139, 255, 0.08) 1px, transparent 1px);
}

.registration-noise {
  position: fixed;
  inset: 0;
  z-index: 1;
  opacity: 0.025;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

.registration-card {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 500px;
  padding: 40px 36px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 20px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);
  backdrop-filter: blur(18px);
}

html[data-theme="dark"] .registration-card {
  border-color: rgba(255, 255, 255, 0.08);
}

.registration-title {
  margin: 0 0 4px;
  color: var(--ui-text);
  font-size: 1.6rem;
  font-weight: 700;
}

.registration-title span {
  display: inline-block;
  border-bottom: 3px solid var(--ui-primary);
  padding-bottom: 2px;
}

.registration-subtitle {
  margin: 0 0 28px;
  color: var(--ui-text-muted);
  font-size: 0.82rem;
}

.registration-section-label {
  margin: 18px 0 10px;
  color: var(--ui-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.registration-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.registration-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}

.registration-field label {
  margin-bottom: 5px;
  color: var(--ui-text-soft);
  font-size: 0.78rem;
  font-weight: 700;
}

.registration-field input,
.registration-field select {
  width: 100%;
  padding: 11px 14px;
  border: 1.5px solid var(--ui-border);
  border-radius: 8px;
  outline: none;
  background: var(--ui-bg-soft);
  color: var(--ui-text);
  font-family: var(--ui-font);
  font-size: 0.87rem;
  transition: border 0.2s, box-shadow 0.2s, background 0.2s;
}

.registration-field input:focus,
.registration-field select:focus {
  border-color: var(--ui-primary);
  background: var(--ui-bg-elevated);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

html[data-theme="dark"] .registration-field input:focus,
html[data-theme="dark"] .registration-field select:focus {
  box-shadow: 0 0 0 3px rgba(75, 139, 255, 0.16);
}

.registration-field input::placeholder {
  color: var(--ui-text-muted);
}

.registration-field select {
  cursor: pointer;
}

.registration-field option {
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
}

.registration-button {
  width: 100%;
  margin-top: 20px;
  padding: 13px;
  border: none;
  border-radius: 10px;
  background: var(--ui-primary);
  color: #ffffff;
  cursor: pointer;
  font-family: var(--ui-font);
  font-size: 0.95rem;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.28);
  transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
}

.registration-button:hover {
  background: var(--ui-primary-strong);
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.34);
}

.registration-button:active {
  transform: scale(0.98);
}

.registration-button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
  transform: none;
}

.registration-login-link {
  margin-top: 18px;
  color: var(--ui-text-muted);
  font-size: 0.82rem;
  text-align: center;
}

.registration-login-link a {
  color: var(--ui-primary);
  font-weight: 700;
  text-decoration: none;
}

.registration-login-link a:hover {
  color: var(--ui-primary-strong);
  text-decoration: underline;
}

@media (max-width: 480px) {
  .registration-grid-2 {
    grid-template-columns: 1fr;
  }

  .registration-card {
    padding: 28px 20px;
  }
}
`;

export default function RegisterPage() {
  const [form, setForm] = useState(defaultPayload);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [, setErrorState] = useState("");
  const [loading, setLoading] = useState(false);

  const setError = (message) => {
    const text = String(message || "").trim();
    setErrorState("");
    alertError(text);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await postData("/register/", form);
      setForm(defaultPayload);
      setConfirmPassword("");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));
  const setC = (k) => (e) =>
    setForm((s) => ({ ...s, company: { ...s.company, [k]: e.target.value } }));

  return (
    <>
      <style>{css}</style>
      <main className="registration-page">
        <div className="registration-bg" />
        <div className="registration-grid" />
        <div className="registration-noise" />

        <form onSubmit={submit} className="registration-card">
          <h2 className="registration-title"><span>Registration</span></h2>
          <p className="registration-subtitle">Fill in the details below to create your account</p>

          <div className="registration-section-label">Company Information</div>

          <div className="registration-field">
            <label htmlFor="companyName">Company Name</label>
            <input
              id="companyName"
              type="text"
              placeholder="e.g. Acme Pvt. Ltd."
              value={form.company.name}
              onChange={setC("name")}
              required
            />
          </div>

          <div className="registration-grid-2">
            <div className="registration-field">
              <label htmlFor="companyEmail">Company Email</label>
              <input
                id="companyEmail"
                type="email"
                placeholder="info@company.com"
                value={form.company.email}
                onChange={setC("email")}
                required
              />
            </div>
            <div className="registration-field">
              <label htmlFor="companyPhone">Phone Number</label>
              <input
                id="companyPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.company.phone}
                onChange={setC("phone")}
                required
              />
            </div>
          </div>

          <div className="registration-field">
            <label htmlFor="companyAddress">Address</label>
            <input
              id="companyAddress"
              type="text"
              placeholder="Street, City, State"
              value={form.company.address}
              onChange={setC("address")}
            />
          </div>

          <div className="registration-field">
            <label htmlFor="companySize">Company Size</label>
            <select id="companySize" value={form.company.size} onChange={setC("size")} required>
              <option value="" disabled>Select company size</option>
              {COMPANY_SIZES.map((size) => (
                <option value={size} key={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="registration-section-label">Owner Information</div>

          <div className="registration-grid-2">
            <div className="registration-field">
              <label htmlFor="ownerName">Owner Name</label>
              <input
                id="ownerName"
                type="text"
                placeholder="Full name"
                value={form.owner_name}
                onChange={set("owner_name")}
                required
              />
            </div>
            <div className="registration-field">
              <label htmlFor="ownerEmail">Owner Email</label>
              <input
                id="ownerEmail"
                type="email"
                placeholder="owner@email.com"
                value={form.owner_email}
                onChange={set("owner_email")}
                required
              />
            </div>
          </div>

          <div className="registration-grid-2">
            <div className="registration-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Create password"
                value={form.password}
                onChange={set("password")}
                required
              />
            </div>
            <div className="registration-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="registration-button" disabled={loading}>
            {loading ? "Registering..." : "Register Now"}
          </button>

          <p className="registration-login-link">
            Already have an account? <Link to="/login">Login now</Link>
          </p>
        </form>
      </main>
    </>
  );
}
