import { FileUp } from "lucide-react";
import "./driver-tour.css";

// Click-to-choose file box with an error line (JPG / PNG / PDF, max 5 MB - checked by the page)
export default function FileField({ label, file, onChange, error, hint, accept = ".jpg,.jpeg,.png,.pdf", disabled }) {
  return (
    <div className={`bp-field ${error ? "has-error" : ""}`}>
      {label && <label className="bp-label">{label}</label>}
      <div className="dt-file">
        <div className="dt-file-box">
          <FileUp size={18} />
          {file ? <strong>{file.name}</strong> : <span>Choose a file…</span>}
        </div>
        <input
          type="file" accept={accept} disabled={disabled} aria-label={label}
          onChange={(e) => { onChange(e.target.files?.[0] || null); e.target.value = ""; }}
        />
      </div>
      {error ? <div className="bp-error-text">{error}</div> : hint ? <div className="bp-hint">{hint}</div> : null}
    </div>
  );
}
