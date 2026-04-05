import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postData } from "../lib/api";
import { useAuth } from "../lib/auth";
import logo from "./logo.png";

const FEATURES = [
  "Live project and task visibility",
  "Attendance and leave tracking in one flow",
  "Role-based workspace access for every team"
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await postData("/login/", form);
      login(res);
      navigate("/");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          JSON.stringify(err?.response?.data) ||
          err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ui-shell grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden px-10 py-10 lg:flex">
        <div className="ui-panel flex w-full flex-col justify-between rounded-[2rem] p-10">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="WorkZen"
              className="h-16 w-16 rounded-2xl border border-blue-100 object-cover shadow-md shadow-blue-100"
            />
            <div>
              <p className="ui-brand text-3xl text-slate-900">WorkZen</p>
              <p className="mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">
                Premium operations UI
              </p>
            </div>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-blue-700">
              Welcome back
            </p>
            <h1 className="ui-brand max-w-xl text-5xl leading-tight text-slate-900">
              Step into a sharper dashboard without changing your backend.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Your current logic, API integration, and variables stay the same while the interface gets a more polished operational look.
            </p>
            <div className="mt-8 space-y-4">
              {FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              ["120+", "Teams active"],
              ["82%", "Tasks on track"],
              ["24/7", "Workspace visibility"]
            ].map(([value, label]) => (
              <div key={label} className="ui-hero-card p-4">
                <p className="ui-brand text-3xl text-blue-700">{value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="ui-panel w-full max-w-md rounded-[2rem] p-8 md:p-10">
          <div className="mb-8 text-center">
            <img
              src={logo}
              alt="WorkZen"
              className="mx-auto mb-4 h-20 w-20 rounded-3xl border border-blue-100 object-cover shadow-lg shadow-blue-100"
            />
            <h2 className="text-3xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-2 text-sm text-slate-500">Use your registered email to continue.</p>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="ui-label">Email</span>
              <input
                className="ui-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="ui-label">Password</span>
              <input
                className="ui-input"
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                required
              />
            </label>

            {error ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button className="ui-button-primary w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            New company?{" "}
            <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">
              Register here
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
