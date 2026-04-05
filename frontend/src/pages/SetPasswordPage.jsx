import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { postData } from "../lib/api";

export default function SetPasswordPage() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError("Invite token missing in URL.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await postData(`/set-password/${token}/`, {
        password,
        confirm_password: confirmPassword
      });
      setResult(res?.message || "Password set successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(JSON.stringify(err?.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100/70 backdrop-blur-sm px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
        <h1 className="text-2xl font-extrabold tracking-wide text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>WorkZen</h1>
      </div>

      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-blue-900" style={{ fontFamily: "'Georgia', serif" }}>Set Your Password</h2>
          <p className="mt-1 text-xs text-slate-400">Token: {token || "Missing"}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-200 text-slate-800"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm Password</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-200 text-slate-800"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button
          className="w-full rounded-lg bg-blue-800 py-2.5 font-bold text-white transition hover:bg-blue-900 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Set Password"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already set?{" "}
          <Link to="/login" className="font-semibold text-blue-800 hover:underline">Login here</Link>
        </p>

        {error ? <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {result ? <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{result}</p> : null}
      </form>
    </main>
  );
}
