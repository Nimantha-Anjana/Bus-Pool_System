import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, EmptyState, PageHeader, StatusBadge, useToast } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate, formatDateTime, initials } from "../../../components/admin-ui/format";
import { LicenseBadge } from "../../../components/driver-tour/badges";
import DocumentManager from "../../../components/driver-tour/DocumentManager";
import { fullName, licenseState, parseNic } from "../../../components/driver-tour/utils";
import { deleteDriver, getDriver, setDriverStatus } from "../../../services/admin/driversService";
import { getErrorMessage } from "../../../services/admin/http";
import "../../../components/driver-tour/driver-tour.css";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

// Driver profile: personal info, NIC details, licence + expiry status, documents, activate / deactivate
export default function DriverDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [notify, toastNode] = useToast();

  const driver = useAsync(() => getDriver(id), [id]);
  const [savingStatus, setSavingStatus] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // message coming from the add / edit form
  useEffect(() => {
    if (location.state?.notice) {
      notify(location.state.notice, location.state.notice.includes("could not") ? "error" : "success");
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeStatus = async (status) => {
    if (status === d.status) return;
    setSavingStatus(status);
    try {
      await setDriverStatus(id, status);
      notify(`Driver is now ${status}.`);
      driver.reload();
    } catch (e) {
      notify(getErrorMessage(e), "error"); // e.g. expired licence / active assignments
    } finally {
      setSavingStatus("");
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteDriver(id);
      navigate("/admin/drivers");
    } catch (e) {
      setDeleteError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const back = () => navigate("/admin/drivers");
  const d = driver.data;

  if (driver.loading && !d) {
    return <div className="content-card"><span className="bp-skeleton" style={{ width: "35%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "75%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "55%" }} /></div>;
  }
  if (driver.error || !d) {
    return (
      <div>
        <PageHeader eyebrow="DRIVERS" title="Driver Profile" onBack={back} backLabel="Back to drivers" />
        <div className="content-card"><Alert onRetry={driver.reload}>{driver.error || "Driver not found."}</Alert><EmptyState title="Driver not available" /></div>
      </div>
    );
  }

  const name = fullName(d.user);
  const lic = licenseState(d.licenseExpiryDate);
  const nic = parseNic(d.nic);
  const meter = lic.days == null ? 0 : Math.max(4, Math.min(100, (Math.max(lic.days, 0) / 365) * 100));

  return (
    <div>
      <PageHeader
        eyebrow="DRIVERS"
        title="Driver Profile"
        onBack={back}
        backLabel="Back to drivers"
        actions={(
          <>
            <Button variant="outline" icon={Pencil} onClick={() => navigate(`/admin/drivers/${d.id}/edit`)}>Edit</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { setDeleteError(""); setConfirmOpen(true); }}>Delete</Button>
          </>
        )}
      />

      {lic.key !== "valid" && (
        <Alert type={lic.key === "expired" ? "error" : "info"}>
          {lic.key === "expired"
            ? "This driver's licence has expired. The driver cannot log in or be assigned until the expiry date is updated."
            : `This driver's licence ${lic.label.toLowerCase()}. Ask the driver for a renewed licence.`}
        </Alert>
      )}

      <div className="dt-layout">
        <div className="dt-stack">
          <div className="content-card">
            <div className="dt-hero">
              <div className="bp-avatar-lg">{initials(name)}</div>
              <div>
                <h4>{name}</h4>
                <small>{d.user.email}</small>
                <div className="dt-hero-badges">
                  <StatusBadge status={d.status} />
                  <LicenseBadge expiryDate={d.licenseExpiryDate} />
                </div>
              </div>
            </div>
            <hr style={{ margin: "22px 0", borderColor: "#eef1f6", opacity: 1 }} />
            <dl className="bp-kv">
              <div><dt>Phone</dt><dd>{d.user.phone || "—"}</dd></div>
              <div><dt>Email</dt><dd>{d.user.email}</dd></div>
              <div className="full"><dt>Address</dt><dd>{d.address || "—"}</dd></div>
              <div><dt>Emergency contact</dt><dd>{d.emergencyContactName || "—"}</dd></div>
              <div><dt>Emergency phone</dt><dd>{d.emergencyContactPhone || "—"}</dd></div>
            </dl>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">NIC details</h6>
            <p className="dt-section-sub">Birth date and gender are read from the NIC number for convenience.</p>
            <dl className="bp-kv">
              <div><dt>NIC number</dt><dd>{d.nic}</dd></div>
              <div><dt>Format</dt><dd>{d.nic.length === 12 ? "New (12 digits)" : "Old (9 digits + letter)"}</dd></div>
              <div><dt>Date of birth</dt><dd>{nic ? formatDate(nic.birthDate) : "—"}</dd></div>
              <div><dt>Gender</dt><dd>{nic?.gender || "—"}</dd></div>
            </dl>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Driving licence</h6>
            <p className="dt-section-sub">Expiry is checked every time the driver logs in.</p>
            <div className="dt-license">
              <dl className="bp-kv">
                <div><dt>Licence number</dt><dd>{d.licenseNumber}</dd></div>
                <div><dt>Expiry date</dt><dd>{formatDate(d.licenseExpiryDate)}</dd></div>
              </dl>
              <div>
                <div className="d-flex justify-content-between mb-2" style={{ fontSize: 12 }}>
                  <span style={{ color: "#8a96a8" }}>Licence validity</span>
                  <strong>{lic.label}</strong>
                </div>
                <div className="dt-license-bar"><div className={lic.color} style={{ width: `${lic.key === "expired" ? 100 : meter}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Documents</h6>
            <p className="dt-section-sub">Private files - only admins can open them.</p>
            <DocumentManager driver={d} notify={notify} onChanged={driver.reload} />
          </div>
        </div>

        <div className="dt-stack">
          <div className="content-card">
            <h6 className="dt-section-title">Driver status</h6>
            <p className="dt-section-sub">Inactive and suspended drivers are signed out immediately.</p>
            <div className="bp-segmented">
              {STATUSES.map((s) => (
                <button
                  key={s.value} type="button" className={d.status === s.value ? "active" : ""}
                  disabled={Boolean(savingStatus)} onClick={() => changeStatus(s.value)}
                >
                  {savingStatus === s.value ? "Saving…" : s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="content-card">
            <h6 className="dt-section-title">Account</h6>
            <ul className="dt-side-list">
              <li><span>Added</span><strong>{formatDate(d.createdAt)}</strong></li>
              <li><span>Last login</span><strong>{d.user.lastLoginAt ? formatDateTime(d.user.lastLoginAt) : "Never"}</strong></li>
              <li><span>Login account</span><strong><StatusBadge status={d.user.status} /></strong></li>
            </ul>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete driver?"
        message={`“${name}” and their login account will be permanently removed. Drivers with assignment history cannot be deleted - set them to inactive instead.`}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      {toastNode}
    </div>
  );
}
