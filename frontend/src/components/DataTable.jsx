function formatCellValue(value) {
  if (value === null || value === undefined || value === "") return "-";

  const text = String(value);
  if (/^https?:\/\//i.test(text) || text.includes("@")) return text;
  if (text.includes("_") || /^[A-Z][A-Z0-9 ]+$/.test(text)) {
    return text
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\w/g, (char) => char.toUpperCase());
  }

  return text;
}

export default function DataTable({ columns, rows, emptyText = "No data available", onRowClick }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: "#c7d7ee", background: "#f8fbff", color: "#5b728d" }}>
        {emptyText}
      </div>
    );
  }

  const rowClickable = typeof onRowClick === "function";
  const visibleColumns = Array.isArray(columns)
    ? columns.filter((column) => {
        const key = String(column?.key || "").trim().toLowerCase();
        const label = String(column?.label || "").trim().toLowerCase();
        return key !== "id" && label !== "id";
      })
    : [];

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "#d9e3f2", background: "#ffffff", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.05)" }}>
      <table className="min-w-full text-sm">
        <thead style={{ background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)" }}>
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "#5b728d" }}>
              Serial No
            </th>
            {visibleColumns.map((column) => (
              <th
                key={column.key}
                className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: "#5b728d" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.id || rowIndex}
              className={rowClickable ? "cursor-pointer transition" : ""}
              style={{ borderTop: "1px solid #e3ebf7" }}
              onClick={rowClickable ? () => onRowClick(row, rowIndex) : undefined}
            >
              <td className="whitespace-nowrap px-3 py-3 align-top" style={{ color: "#16304f" }}>{rowIndex + 1}</td>
              {visibleColumns.map((column) => (
                <td key={`${row.id || rowIndex}-${column.key}`} className="max-w-xs px-3 py-3 align-top" style={{ color: "#405772" }}>
                  {column.render ? column.render(row[column.key], row, rowIndex) : formatCellValue(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
