import { useState } from "react";
import { Link } from "react-router-dom";
import { postData } from "../lib/api";
import logo from "./logo.png";

const defaultPayload = {
  owner_name: "",
  owner_email: "",
  password: "",
  company: { name: "", email: "", phone: "", size: "", address: "" }
};

export default function RegisterPage() {
  const [form, setForm] = useState(defaultPayload);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await postData("/register/", form);
      setForm(defaultPayload);
    } catch (err) {
      setError(JSON.stringify(err?.response?.data || err.message));
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));
  const setC = (k) => (e) =>
    setForm((s) => ({ ...s, company: { ...s.company, [k]: e.target.value } }));

  return (
    <main className="ui-shell flex min-h-screen items-center justify-center px-6 py-10">
      <form onSubmit={submit} className="ui-panel w-full max-w-5xl rounded-[2rem] p-6 md:p-8 lg:p-10">
        <div className="mb-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="ui-hero-card p-8">
            <img
              src={logo}
              alt="WorkZen"
              className="mb-5 h-20 w-20 rounded-3xl border border-blue-100 object-cover shadow-lg shadow-blue-100"
            />
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-blue-700">
              Workspace setup
            </p>
            <h1 className="ui-brand text-5xl leading-tight text-slate-900">
              Create your company space with the new UI.
            </h1>
            <p className="mt-5 max-w-md text-base leading-8 text-slate-600">
              We are only changing the frontend presentation. Your payload keys and backend contract stay untouched.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["Owner setup", "Register account owner details first"],
                ["Company profile", "Add organization information once"],
                ["Same API payload", "No variable names changed"]
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-semibold text-slate-900">Register company</h2>
              <p className="mt-2 text-sm text-slate-500">Fill the same fields with a refreshed interface.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="ui-label">Owner Name</span>
                <input className="ui-input" value={form.owner_name} onChange={set("owner_name")} required />
              </label>
              <label className="block">
                <span className="ui-label">Owner Email</span>
                <input className="ui-input" type="email" value={form.owner_email} onChange={set("owner_email")} required />
              </label>
              <label className="block md:col-span-2">
                <span className="ui-label">Owner Password</span>
                <input className="ui-input" type="password" value={form.password} onChange={set("password")} required />
              </label>
            </div>

            <div className="my-6 h-px bg-slate-800" />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="ui-label">Company Name</span>
                <input className="ui-input" value={form.company.name} onChange={setC("name")} required />
              </label>
              <label className="block">
                <span className="ui-label">Company Email</span>
                <input className="ui-input" type="email" value={form.company.email} onChange={setC("email")} required />
              </label>
              <label className="block">
                <span className="ui-label">Phone</span>
                <input className="ui-input" value={form.company.phone} onChange={setC("phone")} required />
              </label>
              <label className="block">
                <span className="ui-label">Size</span>
                <input className="ui-input" value={form.company.size} onChange={setC("size")} required />
              </label>
              <label className="block md:col-span-2">
                <span className="ui-label">Address</span>
                <textarea className="ui-textarea min-h-28" value={form.company.address} onChange={setC("address")} />
              </label>
            </div>

            {error ? (
              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button className="ui-button-primary mt-6 w-full" disabled={loading}>
              {loading ? "Submitting..." : "Register Company"}
            </button>

            <p className="mt-5 text-center text-sm text-slate-500">
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">
                Back to login
              </Link>
            </p>
          </section>
        </div>
      </form>
    </main>
  );
}
