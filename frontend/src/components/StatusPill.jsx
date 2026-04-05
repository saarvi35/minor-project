const toneByValue = {
  PENDING: { bg: "#fff5e8", text: "#b45309", border: "#f7d7a8" },
  IN_PROGRESS: { bg: "#eaf2ff", text: "#2563eb", border: "#bfd3ff" },
  COMPLETED: { bg: "#ebfaf1", text: "#15803d", border: "#b8e7c7" },
  APPROVED: { bg: "#ebfaf1", text: "#15803d", border: "#b8e7c7" },
  REJECTED: { bg: "#fff0f0", text: "#dc2626", border: "#f6c3c3" },
  ACTIVE: { bg: "#ebfaf1", text: "#15803d", border: "#b8e7c7" },
  INVITED: { bg: "#f3ecff", text: "#7c3aed", border: "#ddc7ff" },
  INACTIVE: { bg: "#eef3fb", text: "#5b728d", border: "#d3dfef" },
  ON_HOLD: { bg: "#fff5e8", text: "#b45309", border: "#f7d7a8" },
  ABSENT: { bg: "#fff0f0", text: "#dc2626", border: "#f6c3c3" },
  PRESENT: { bg: "#ebfaf1", text: "#15803d", border: "#b8e7c7" },
  HALF_DAY: { bg: "#fff5e8", text: "#b45309", border: "#f7d7a8" }
};

function formatStatusText(value) {
  const text = String(value || "-").trim();
  if (!text || text === "-") return "-";

  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\w/g, (char) => char.toUpperCase());
}

export default function StatusPill({ value }) {
  const rawText = String(value || "-").trim();
  const toneKey = rawText.toUpperCase();
  const tone = toneByValue[toneKey] || { bg: "#eef3fb", text: "#5b728d", border: "#d3dfef" };

  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
    >
      {formatStatusText(rawText)}
    </span>
  );
}
