import { useCallback, useEffect, useRef, useState } from "react";
import { getData, postData } from "../lib/api";

const POLL_MS = 8000;

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** Shared message thread between a project's team and its client. */
export default function ProjectMessages({ projectId, projectName }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastIdRef = useRef(0);

  const merge = useCallback((rows) => {
    if (!rows.length) return;
    setMessages((current) => {
      const known = new Set(current.map((row) => row.id));
      const next = [...current, ...rows.filter((row) => !known.has(row.id))];
      lastIdRef.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setState("loading");
    setError("");
    lastIdRef.current = 0;

    const load = async (initial) => {
      try {
        const rows = await getData(`/projects/${projectId}/messages/${initial ? "" : `?after=${lastIdRef.current}`}`);
        if (!active) return;
        merge(Array.isArray(rows) ? rows : []);
        if (initial) setState("ready");
      } catch (err) {
        if (!active || !initial) return;
        setState(err?.response?.status === 403 || err?.response?.status === 404 ? "unavailable" : "error");
      }
    };

    load(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load(false);
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [projectId, merge]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const created = await postData(`/projects/${projectId}/messages/`, { body });
      merge([created]);
      setDraft("");
    } catch (err) {
      setError(err?.response?.data?.body?.[0] || err?.response?.data?.detail || "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (state === "unavailable") return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-blue-900">Project messages{projectName ? ` · ${projectName}` : ""}</h2>
        <p className="text-xs text-slate-500">Visible to the client and the project team only.</p>
      </div>

      <div ref={listRef} className="mt-3 h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3" aria-live="polite">
        {state === "loading" ? <p className="text-sm text-slate-500">Loading messages...</p> : null}
        {state === "error" ? <p className="text-sm text-red-600">Messages could not be loaded.</p> : null}
        {state === "ready" && !messages.length ? <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.is_mine ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
              <p className={`text-[11px] font-bold ${message.is_mine ? "text-blue-100" : "text-slate-500"}`}>{message.is_mine ? "You" : message.sender_name} · {message.sender_role}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{message.body}</p>
              <p className={`mt-1 text-[10px] ${message.is_mine ? "text-blue-200" : "text-slate-400"}`}>{formatTime(message.created_at)}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <textarea
          className="min-h-11 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
          value={draft}
          maxLength={2000}
          rows={2}
          placeholder="Write a message..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) send(event);
          }}
        />
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-60" disabled={sending || !draft.trim()}>{sending ? "Sending..." : "Send"}</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
