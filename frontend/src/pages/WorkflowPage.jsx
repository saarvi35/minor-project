import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteData, getData, patchData, postData } from "../lib/api";
import { extractError, humanizeLabel, toArray } from "./detailHelpers";

const initialForm = {
  name: "",
  description: "",
  trigger: "TASK_UPDATED",
  condition_field: "ANY",
  condition_operator: "EQUALS",
  condition_value: "",
  action: "NOTIFY_ASSIGNEE",
  action_message: ""
};

export default function WorkflowPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const [ruleRows, runRows] = await Promise.all([getData("/workflows/"), getData("/workflows/runs/")]);
      setRules(toArray(ruleRows));
      setRuns(toArray(runRows));
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const saveRule = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorText("");
    try {
      await postData("/workflows/", form);
      setForm(initialForm);
      await loadWorkflows();
    } catch (error) {
      setErrorText(extractError(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule) => {
    try {
      const updated = await patchData(`/workflows/${rule.id}/`, { is_enabled: !rule.is_enabled });
      setRules((current) => current.map((item) => item.id === rule.id ? updated : item));
    } catch (error) {
      setErrorText(extractError(error));
    }
  };

  const removeRule = async (rule) => {
    if (!window.confirm(`Delete workflow "${rule.name}"?`)) return;
    try {
      await deleteData(`/workflows/${rule.id}/`);
      setRules((current) => current.filter((item) => item.id !== rule.id));
    } catch (error) {
      setErrorText(extractError(error));
    }
  };

  return (
    <main className="dashboard-shell min-h-screen p-4 md:p-6">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900/50">Automation centre</p>
              <h1 className="mt-1 text-2xl font-bold text-blue-900">Workflow rules</h1>
              <p className="mt-1 text-sm text-slate-500">Create tenant-specific task automations with a visible execution history.</p>
            </div>
            <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900" onClick={() => navigate("/app")}>Back to workspace</button>
          </div>
        </header>

        {errorText ? <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorText}</section> : null}

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-blue-900">New workflow</h2>
            <p className="mt-1 text-sm text-slate-500">Example: when progress reaches 80%, notify the task assignee.</p>
            <form className="mt-5 space-y-3" onSubmit={saveRule}>
              <label className="block text-sm font-medium text-slate-700">Name<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} required /></label>
              <label className="block text-sm font-medium text-slate-700">Trigger<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.trigger} onChange={(event) => setForm((value) => ({ ...value, trigger: event.target.value, condition_field: event.target.value === "TASK_OVERDUE" ? "ANY" : value.condition_field, condition_value: event.target.value === "TASK_OVERDUE" ? "" : value.condition_value }))}><option value="TASK_UPDATED">Task updated</option><option value="TASK_OVERDUE">Task overdue (hourly SLA watchdog)</option></select></label>
              {form.trigger === "TASK_UPDATED" ? <><label className="block text-sm font-medium text-slate-700">When a task changes<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.condition_field} onChange={(event) => setForm((value) => ({ ...value, condition_field: event.target.value, condition_value: event.target.value === "ANY" ? "" : value.condition_value }))}><option value="ANY">Any task update</option><option value="status">Status changes to</option><option value="priority">Priority changes to</option><option value="progress">Progress reaches</option></select></label>{form.condition_field !== "ANY" ? <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-slate-700">Operator<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.condition_operator} onChange={(event) => setForm((value) => ({ ...value, condition_operator: event.target.value }))}><option value="EQUALS">Equals</option><option value="GREATER_THAN_OR_EQUAL">At least</option><option value="LESS_THAN_OR_EQUAL">At most</option></select></label><label className="block text-sm font-medium text-slate-700">Value<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.condition_value} onChange={(event) => setForm((value) => ({ ...value, condition_value: event.target.value }))} placeholder={form.condition_field === "progress" ? "80" : "COMPLETED"} required /></label></div> : null}</> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The SLA watchdog checks overdue, unfinished tasks every hour. Each rule runs only once per task per day.</p>}
              <label className="block text-sm font-medium text-slate-700">Then<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.action} onChange={(event) => setForm((value) => ({ ...value, action: event.target.value }))}><option value="NOTIFY_ASSIGNEE">Notify assignee</option><option value="NOTIFY_CREATOR">Notify task creator</option><option value="CREATE_ACTIVITY">Add activity entry</option></select></label>
              <label className="block text-sm font-medium text-slate-700">Message<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.action_message} onChange={(event) => setForm((value) => ({ ...value, action_message: event.target.value }))} placeholder="Optional custom message" /></label>
              <button className="btn-primary w-full" disabled={saving}>{saving ? "Creating..." : "Create workflow"}</button>
            </form>
          </article>

          <div className="space-y-5">
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-blue-900">Active rules</h2><button className="text-sm font-bold text-blue-800" onClick={loadWorkflows}>Refresh</button></div>
              {loading ? <p className="mt-4 text-sm text-slate-500">Loading workflows...</p> : null}
              <div className="mt-4 space-y-3">
                {rules.map((rule) => <article key={rule.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">{rule.name}</h3><p className="mt-1 text-sm text-slate-600">When <strong>{humanizeLabel(rule.condition_field)}</strong>{rule.condition_field !== "ANY" ? ` ${humanizeLabel(rule.condition_operator)} ${rule.condition_value}` : ""}, then <strong>{humanizeLabel(rule.action)}</strong>.</p>{rule.description ? <p className="mt-1 text-sm text-slate-500">{rule.description}</p> : null}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${rule.is_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rule.is_enabled ? "Enabled" : "Paused"}</span></div><div className="mt-3 flex gap-3 text-sm"><button className="font-bold text-blue-800" onClick={() => toggleRule(rule)}>{rule.is_enabled ? "Pause" : "Enable"}</button><button className="font-bold text-rose-700" onClick={() => removeRule(rule)}>Delete</button></div></article>)}
                {!loading && !rules.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No rules yet. Create your first automation.</p> : null}
              </div>
            </article>
            <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-blue-900">Recent executions</h2><div className="mt-4 space-y-3">{runs.map((run) => <article key={run.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-800">{run.rule_name} <span className="font-normal text-slate-500">on {run.task_title}</span></p><p className="mt-1 text-sm text-slate-600">{run.detail || humanizeLabel(run.status)}</p><time className="mt-1 block text-xs text-slate-500">{run.created_at ? new Date(run.created_at).toLocaleString() : ""}</time></article>)}{!runs.length ? <p className="text-sm text-slate-500">Rules have not run yet.</p> : null}</div></article>
          </div>
        </section>
      </section>
    </main>
  );
}
