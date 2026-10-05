export default function BrandMark({ size = 48, variant = "light" }) {
  const isLight = variant === "light";
  const outerColor = isLight ? "rgba(255,255,255,0.72)" : "rgba(37,99,235,0.42)";
  const innerColor = isLight ? "#ffffff" : "#2563eb";
  const bg = isLight ? "rgba(255,255,255,0.08)" : "rgba(37,99,235,0.08)";

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        border: `2px solid ${outerColor}`,
        background: bg,
        boxShadow: isLight ? "0 0 0 4px rgba(30,77,183,0.35)" : "0 0 0 4px rgba(37,99,235,0.12)",
        transform: "rotate(45deg)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: Math.round(size * 0.4),
          height: Math.round(size * 0.4),
          display: "block",
          background: innerColor,
        }}
      />
    </span>
  );
}
