export default function JsonViewer({ title, data }) {
  return (
    <section className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
