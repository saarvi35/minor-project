import { useCallback, useEffect, useRef, useState } from "react";
import api, { getData, postData } from "../lib/api";

const POLL_MS = 8000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILES = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp";

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function fetchAttachment(attachment) {
  const response = await api.get(attachment.url, { responseType: "blob" });
  return response.data;
}

function triggerDownload(blob, name) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function AttachmentView({ attachment, mine }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachment.is_image) return undefined;
    let active = true;
    let objectUrl = "";
    fetchAttachment(attachment)
      .then((blob) => {
        if (!active) return;
        objectUrl = window.URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.url, attachment.is_image]);

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      triggerDownload(await fetchAttachment(attachment), attachment.name);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1">
      {attachment.is_image && previewUrl ? (
        <button type="button" onClick={download} title="Download image" className="block">
          <img src={previewUrl} alt={attachment.name} className="max-h-48 max-w-full rounded-lg border border-white/30 object-contain" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`mt-1 flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold ${mine ? "border-blue-300/50 bg-blue-800/60 text-white" : "border-slate-200 bg-slate-50 text-slate-800"}`}
      >
        <span aria-hidden="true">📎</span>
        <span className="truncate">{attachment.name}</span>
        <span className="shrink-0 opacity-70">{formatSize(attachment.size)}</span>
        <span className="shrink-0 underline">{busy ? "..." : "Download"}</span>
      </button>
      {failed ? <p className="mt-1 text-[11px] text-red-500">File could not be loaded.</p> : null}
    </div>
  );
}

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
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
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

  const pickFile = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      setError("Files must be 10 MB or smaller.");
      return;
    }
    setError("");
    setFile(chosen);
  };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !file) || sending) return;
    setSending(true);
    setError("");
    try {
      let payload = { body };
      if (file) {
        payload = new FormData();
        payload.append("body", body);
        payload.append("attachment", file);
      }
      const created = await postData(`/projects/${projectId}/messages/`, payload);
      merge([created]);
      setDraft("");
      setFile(null);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.attachment?.[0] || data?.body?.[0] || data?.detail || "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (state === "unavailable") return null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-blue-900">Project messages{projectName ? ` · ${projectName}` : ""}</h2>
        <p className="text-xs text-slate-500">Visible to the client and the project team only. Attach PDF, Word, Excel, PowerPoint, text, CSV or images (10 MB max).</p>
      </div>

      <div ref={listRef} className="mt-3 h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3" aria-live="polite">
        {state === "loading" ? <p className="text-sm text-slate-500">Loading messages...</p> : null}
        {state === "error" ? <p className="text-sm text-red-600">Messages could not be loaded.</p> : null}
        {state === "ready" && !messages.length ? <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.is_mine ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
              <p className={`text-[11px] font-bold ${message.is_mine ? "text-blue-100" : "text-slate-500"}`}>{message.is_mine ? "You" : message.sender_name} · {message.sender_role}</p>
              {message.body ? <p className="mt-0.5 whitespace-pre-wrap break-words">{message.body}</p> : null}
              {message.attachment ? <AttachmentView attachment={message.attachment} mine={message.is_mine} /> : null}
              <p className={`mt-1 text-[10px] ${message.is_mine ? "text-blue-200" : "text-slate-400"}`}>{formatTime(message.created_at)}</p>
            </div>
          </div>
        ))}
      </div>

      {file ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900">
          <span aria-hidden="true">📎</span>
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 opacity-70">{formatSize(file.size)}</span>
          <button type="button" className="ml-auto shrink-0 text-red-600 hover:underline" onClick={() => setFile(null)}>Remove</button>
        </div>
      ) : null}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={pickFile} />
        <button type="button" title="Attach a file (PDF, Word, Excel, PowerPoint, text, CSV or image, up to 10 MB)" aria-label="Attach a file" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg leading-none text-slate-600 transition hover:bg-slate-50" onClick={() => fileInputRef.current?.click()}>📎</button>
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
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-60" disabled={sending || (!draft.trim() && !file)}>{sending ? "Sending..." : "Send"}</button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
