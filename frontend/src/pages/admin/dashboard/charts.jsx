// Tiny dependency-free SVG/CSS charts (no chart library is installed in this project).

export const CHART_COLORS = { green: "#16a34a", blue: "#2463eb", orange: "#f59e0b", gray: "#94a3b8", red: "#ef4444", purple: "#7c3aed" };

// segments: [{ label, value, color }]
export function DonutChart({ segments, centerLabel, centerValue }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="bp-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef1f6" strokeWidth="18" />
        {total > 0 && segments.map((s) => {
          const length = (s.value / total) * circumference;
          const circle = (
            <circle
              key={s.label} cx="70" cy="70" r={radius} fill="none" stroke={s.color} strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="70" y="68" textAnchor="middle" className="bp-donut-value">{centerValue}</text>
        <text x="70" y="86" textAnchor="middle" className="bp-donut-label">{centerLabel}</text>
      </svg>
      <ul className="bp-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="bp-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// items: [{ label, value, color }]
export function ColumnChart({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bp-columns" role="img" aria-label="Tours by status">
      {items.map((i) => (
        <div className="bp-column" key={i.label}>
          <span className="bp-column-value">{i.value}</span>
          <div className="bp-column-track">
            <div className="bp-column-bar" style={{ height: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
          <span className="bp-column-label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

// items: [{ label, value }]
export function HorizontalBars({ items, color = CHART_COLORS.blue, unit = "" }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bp-hbars">
      {items.map((i) => (
        <div className="bp-hbar" key={i.label}>
          <div className="bp-hbar-head"><span>{i.label}</span><strong>{i.value}{unit}</strong></div>
          <div className="bp-hbar-track"><div style={{ width: `${(i.value / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}
