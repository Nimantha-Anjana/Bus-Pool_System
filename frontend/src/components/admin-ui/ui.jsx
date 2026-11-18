import { useEffect, useId, useRef, useState, useCallback } from "react";
import {
  TriangleAlert, ArrowLeft, CircleCheck, ChevronLeft, ChevronRight, Info, LoaderCircle, Inbox, Search, X,
} from "lucide-react";
import "./admin-ui.css";

/* ---------- Button ---------- */
export function Button({ variant = "primary", size, loading, icon: Icon, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`bp-btn bp-btn-${variant} ${size === "sm" ? "bp-btn-sm" : ""} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <LoaderCircle size={16} className="bp-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, danger, ...props }) {
  return (
    <button type="button" className={`bp-icon-btn ${danger ? "danger" : ""}`} aria-label={label} title={label} {...props}>
      <Icon size={16} />
    </button>
  );
}

/* ---------- Page header (uses the shared .page-heading styles) ---------- */
export function PageHeader({ eyebrow, title, subtitle, actions, onBack, backLabel = "Back" }) {
  return (
    <>
      {onBack && (
        <button type="button" className="bp-back" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
      )}
      <div className="page-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="bp-page-actions">{actions}</div>}
      </div>
    </>
  );
}

/* ---------- Form fields ---------- */
export function FormField({ label, name, error, hint, required, as = "input", children, className = "", ...props }) {
  const id = useId();
  const Tag = as === "select" ? "select" : as === "textarea" ? "textarea" : "input";
  const cls = as === "select" ? "bp-select" : as === "textarea" ? "bp-textarea" : "bp-input";
  return (
    <div className={`bp-field ${error ? "has-error" : ""} ${className}`}>
      {label && (
        <label className="bp-label" htmlFor={id}>
          {label}
          {required && <span className="bp-required">*</span>}
        </label>
      )}
      <Tag id={id} name={name} className={cls} aria-invalid={Boolean(error)} {...props}>
        {as === "select" ? children : undefined}
      </Tag>
      {error ? <div className="bp-error-text">{error}</div> : hint ? <div className="bp-hint">{hint}</div> : null}
    </div>
  );
}

/* ---------- Alert ---------- */
export function Alert({ type = "error", children, onRetry }) {
  const Icon = type === "success" ? CircleCheck : type === "info" ? Info : TriangleAlert;
  return (
    <div className={`bp-alert ${type}`} role="alert">
      <Icon size={17} />
      <span>{children}</span>
      {onRetry && (
        <button type="button" className="bp-alert-action" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

/* ---------- Status badge ---------- */
const BADGE_COLORS = {
  available: "green", active: "green", completed: "green", confirmed: "green",
  assigned: "blue", ongoing: "blue",
  planned: "orange", pending: "orange", maintenance: "orange",
  inactive: "gray", unavailable: "gray",
  cancelled: "red", rejected: "red", suspended: "red",
};
export function StatusBadge({ status }) {
  const label = String(status || "unknown");
  return (
    <span className={`bp-badge ${BADGE_COLORS[label] || "gray"}`}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ title = "Nothing here yet", text, action }) {
  return (
    <div className="bp-empty">
      <Inbox size={38} />
      <h6>{title}</h6>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/* ---------- Data table (responsive: becomes cards on phones) ---------- */
// columns: [{ key, header, render?(row), className? }]   actions: (row) => ReactNode
export function DataTable({ columns, rows, loading, rowKey = "id", actions, empty, skeletonRows = 5 }) {
  const colCount = columns.length + (actions ? 1 : 0);
  return (
    <div className="bp-table-wrap">
      <table className="table custom-table align-middle bp-table bp-stack">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.header}</th>)}
            {actions && <th className="bp-th-actions">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j}><span className="bp-skeleton" style={{ width: `${55 + ((i + j) % 4) * 10}%` }} /></td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row[rowKey]}>
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.header} className={c.className}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                  {actions && <td className="bp-td-actions"><div className="bp-actions">{actions(row)}</div></td>}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (empty || <EmptyState title="No records found" text="Try changing your search or filters." />)}
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div className="bp-pagination">
      <span>Showing {from}–{to} of {total}</span>
      <div className="bp-pages">
        <button type="button" className="bp-page-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
        {pages.map((p, i) => p === "…"
          ? <span key={`gap-${i}`} className="bp-page-btn" style={{ border: 0, cursor: "default", textAlign: "center", lineHeight: "34px" }}>…</span>
          : <button type="button" key={p} className={`bp-page-btn ${p === page ? "active" : ""}`} onClick={() => onPageChange(p)}>{p}</button>)}
        <button type="button" className="bp-page-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

/* ---------- Search / filter bar ---------- */
export function FilterBar({ search, onSearch, placeholder = "Search...", children }) {
  const [value, setValue] = useState(search || "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const timer = setTimeout(() => onSearch(value), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="bp-filters">
      <div className="bp-search">
        <Search size={16} />
        <input className="bp-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label="Search" />
      </div>
      {children}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label }) {
  return (
    <div className="bp-select-wrap">
      <select className="bp-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ---------- Modal + confirm dialog ---------- */
export function Modal({ open, title, onClose, children, footer, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="bp-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bp-modal ${size || ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="bp-modal-header">
          <h5>{title}</h5>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="bp-modal-body">{children}</div>
        {footer && <div className="bp-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", loading, error, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      size="sm"
      title={title}
      onClose={loading ? () => {} : onCancel}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className="bp-confirm-icon"><TriangleAlert size={22} /></div>
      {error && <Alert>{error}</Alert>}
      <p>{message}</p>
    </Modal>
  );
}

/* ---------- Toast (no provider needed: each page renders the node) ---------- */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3800);
  }, []);

  const node = (
    <div className="bp-toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`bp-toast ${t.type}`}>
          {t.type === "success" ? <CircleCheck size={18} /> : <TriangleAlert size={18} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
  return [notify, node];
}
