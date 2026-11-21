import { useRef, useState } from "react";
import { Eye, FileCheck, FileQuestion, Trash2, Upload } from "lucide-react";
import { Button, ConfirmDialog, IconButton } from "../admin-ui/ui";
import { formatDate } from "../admin-ui/format";
import { deleteDriverDocument, fetchDriverDocumentBlob, uploadDriverDocument } from "../../services/admin/driversService";
import { getErrorMessage } from "../../services/admin/http";
import { formatFileSize, validateDocument, MAX_FILE_MB } from "./utils";
import "./driver-tour.css";

const TYPES = [
  { type: "nic", label: "NIC copy" },
  { type: "license", label: "Driving licence copy" },
];

// Upload / replace / view / delete the driver's NIC and licence scans.
export default function DocumentManager({ driver, notify, onChanged }) {
  const inputs = useRef({});
  const [busy, setBusy] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const docOf = (type) => driver.documents?.find((d) => d.documentType === type);

  const pick = async (type, file) => {
    if (!file) return;
    const problem = validateDocument(file);
    if (problem) { notify(problem, "error"); return; }
    setBusy(type);
    try {
      await uploadDriverDocument(driver.id, type, file);
      notify("Document uploaded.");
      onChanged();
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setBusy("");
    }
  };

  const view = async (doc) => {
    setBusy(`view-${doc.id}`);
    try {
      const blob = await fetchDriverDocumentBlob(driver.id, doc.id);
      if (!blob) { notify("This is demo data - there is no file to preview.", "error"); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setBusy("");
    }
  };

  const confirmDelete = async () => {
    setBusy("delete");
    setDeleteError("");
    try {
      await deleteDriverDocument(driver.id, toDelete.id);
      setToDelete(null);
      notify("Document deleted.");
      onChanged();
    } catch (e) {
      setDeleteError(getErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      {TYPES.map(({ type, label }) => {
        const doc = docOf(type);
        return (
          <div className="dt-doc" key={type}>
            <div className={`dt-doc-icon ${doc ? "" : "missing"}`}>{doc ? <FileCheck size={20} /> : <FileQuestion size={20} />}</div>
            <div className="dt-doc-body">
              <strong>{label}</strong>
              <small>{doc ? `${doc.originalName} · ${formatFileSize(doc.fileSize)} · ${formatDate(doc.createdAt)}` : "Not uploaded yet"}</small>
            </div>
            <div className="dt-doc-actions">
              {doc && <IconButton icon={Eye} label="View document" disabled={busy === `view-${doc.id}`} onClick={() => view(doc)} />}
              <Button size="sm" variant="outline" icon={Upload} loading={busy === type} onClick={() => inputs.current[type]?.click()}>
                {doc ? "Replace" : "Upload"}
              </Button>
              {doc && <IconButton icon={Trash2} label="Delete document" danger onClick={() => { setDeleteError(""); setToDelete(doc); }} />}
              <input
                ref={(el) => { inputs.current[type] = el; }} type="file" hidden accept=".jpg,.jpeg,.png,.pdf"
                onChange={(e) => { pick(type, e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>
          </div>
        );
      })}
      <div className="bp-hint" style={{ marginTop: 10 }}>JPG, PNG or PDF · max {MAX_FILE_MB} MB · uploading again replaces the old file.</div>

      <ConfirmDialog
        open={Boolean(toDelete)} title="Delete document?" loading={busy === "delete"} error={deleteError}
        message={toDelete ? `“${toDelete.originalName}” will be permanently removed.` : ""}
        onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
