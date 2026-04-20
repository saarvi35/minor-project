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
    <main className="ui-shell flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="h-14 w-14 rounded-full bg-blue-900 flex items-center justify-center shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
        <h1 className="ui-brand text-2xl font-extrabold tracking-wide text-blue-900">WorkZen</h1>
      </div>

      <form onSubmit={submit} className="ui-panel w-full max-w-md space-y-5 rounded-2xl border p-8 shadow-xl backdrop-blur-md">
        <div>
          <h2 className="ui-brand text-2xl font-bold text-blue-900">Set Your Password</h2>
          <p className="mt-1 text-xs text-slate-400">Token: {token || "Missing"}</p>
        </div>

        <div>
          <label className="ui-label mb-1">New Password</label>
          <input
            className="ui-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="ui-label mb-1">Confirm Password</label>
          <input
            className="ui-input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button
          className="ui-button-primary w-full"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Set Password"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Already set?{" "}
          <Link to="/login" className="font-semibold text-blue-700 hover:underline">Login here</Link>
        </p>

        {error ? <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        {result ? <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{result}</p> : null}
      </form>
    </main>
  );
}
