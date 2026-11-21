import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Alert, Button, EmptyState, FormField, useToast } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { formatDate, initials } from "../../components/admin-ui/format";
import { LicenseBadge } from "../../components/driver-tour/badges";
import { fullName, isStrongPassword } from "../../components/driver-tour/utils";
import { changePassword, getMyProfile } from "../../services/driver/portalService";
import { clearSession, logoutDriver } from "../../services/driver/session";
import { getErrorMessage } from "../../services/admin/http";
import "../../components/driver-tour/driver-tour.css";
import "./driver-portal.css";

const score = (p) => [p.length >= 8, /[A-Za-z]/.test(p), /\d/.test(p), p.length >= 12].filter(Boolean).length;

export default function DriverProfile() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const { data, loading, error, reload } = useAsync(getMyProfile, []);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setFormError(""); };

  const submit = async (event) => {
    event.preventDefault();
    const e = {};
    if (!form.currentPassword) e.currentPassword = "Enter your current password.";
    if (!isStrongPassword(form.newPassword)) e.newPassword = "8-72 characters with at least one letter and one number.";
    else if (form.newPassword === form.currentPassword) e.newPassword = "Must be different from the current password.";
    if (form.confirmPassword !== form.newPassword) e.confirmPassword = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      await changePassword(form);
      notify("Password changed. Please sign in again.");
      // the backend signs the user out on every device after a password change
      setTimeout(() => { clearSession(); navigate("/driver/login", { replace: true }); }, 1200);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => { setLeaving(true); await logoutDriver(); navigate("/driver/login", { replace: true }); };

  const user = data?.user; const d = data?.driver;
  const name = fullName(user);

  return (
    <div>
      <div className="page-heading">
        <div><span className="eyebrow">MY PROFILE</span><h2>My Profile</h2><p>Your details and account security.</p></div>
        <Button variant="outline" icon={LogOut} loading={leaving} onClick={logout}>Logout</Button>
      </div>
      {error && <Alert onRetry={reload}>{error}</Alert>}

      <div className="dt-layout">
        <div className="dt-stack">
          <div className="content-card">
            {loading && !data ? <span className="bp-skeleton" style={{ width: "50%" }} /> : !user ? <EmptyState title="Profile unavailable" /> : (
              <>
                <div className="dt-hero">
                  <div className="bp-avatar-lg">{initials(name)}</div>
                  <div><h4>{name}</h4><small>{user.email}</small>
                    <div className="dt-hero-badges"><span className="bp-badge green">Driver</span>{d && <LicenseBadge expiryDate={d.licenseExpiryDate} />}</div>
                  </div>
                </div>
                <hr style={{ margin: "22px 0", borderColor: "#eef1f6", opacity: 1 }} />
                <dl className="bp-kv">
                  <div><dt>Email</dt><dd>{user.email}</dd></div>
                  <div><dt>Phone</dt><dd>{user.phone || "—"}</dd></div>
                  {d && <>
                    <div><dt>NIC</dt><dd>{d.nic}</dd></div>
                    <div><dt>Licence number</dt><dd>{d.licenseNumber}</dd></div>
                    <div><dt>Licence expiry</dt><dd>{formatDate(d.licenseExpiryDate)}</dd></div>
                    <div><dt>Emergency contact</dt><dd>{d.emergencyContactName ? `${d.emergencyContactName} · ${d.emergencyContactPhone || ""}` : "—"}</dd></div>
                    <div className="full"><dt>Address</dt><dd>{d.address || "—"}</dd></div>
                  </>}
                </dl>
                <p className="bp-hint" style={{ marginTop: 16 }}>To change your name, phone, NIC or licence details please contact the administrator.</p>
              </>
            )}
          </div>
        </div>

        <div className="dt-stack">
          <form className="content-card" onSubmit={submit} noValidate>
            <h6 className="dt-section-title">Change password</h6>
            <p className="dt-section-sub">You will be signed out afterwards and must log in again.</p>
            {formError && <Alert>{formError}</Alert>}
            <FormField label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} error={errors.currentPassword} onChange={(e) => set("currentPassword", e.target.value)} />
            <FormField label="New password" type="password" autoComplete="new-password" value={form.newPassword} error={errors.newPassword} onChange={(e) => set("newPassword", e.target.value)} />
            <div className="dp-strength" aria-hidden="true">{[1, 2, 3, 4].map((n) => <span key={n} className={score(form.newPassword) >= n ? "on" : ""} />)}</div>
            <div style={{ height: 14 }} />
            <FormField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirmPassword} error={errors.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
            <div className="bp-form-actions"><Button type="submit" loading={saving}>Update password</Button></div>
          </form>
        </div>
      </div>
      {toastNode}
    </div>
  );
}
