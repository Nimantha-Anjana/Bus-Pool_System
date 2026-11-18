import { useEffect, useState } from "react";
import { KeyRound, Pencil, Save, X } from "lucide-react";
import { Alert, Button, FormField, PageHeader, StatusBadge, useToast } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { EMAIL_REGEX, initials } from "../../../components/admin-ui/format";
import { changePassword, getProfile, updateProfile } from "../../../services/admin/profileService";
import { getErrorMessage } from "../../../services/admin/http";

// Same rule as the backend: 8-72 chars, at least one letter and one number
const isStrong = (p) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
const strengthScore = (p) => [p.length >= 8, /[A-Za-z]/.test(p) && /\d/.test(p), /[A-Z]/.test(p) && /[a-z]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;

function ProfileCard({ profile, onSaved, notify }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues({ firstName: profile.firstName || "", lastName: profile.lastName || "", email: profile.email || "" });
  }, [profile]);

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Administrator";
  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const cancel = () => {
    setEditing(false); setErrors({}); setServerError("");
    setValues({ firstName: profile.firstName || "", lastName: profile.lastName || "", email: profile.email || "" });
  };

  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (!values.firstName.trim()) found.firstName = "First name is required.";
    if (!values.email.trim()) found.email = "Email is required.";
    else if (!EMAIL_REGEX.test(values.email.trim())) found.email = "Enter a valid email address.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true); setServerError("");
    try {
      const updated = await updateProfile({ firstName: values.firstName.trim(), lastName: values.lastName.trim(), email: values.email.trim() });
      onSaved(updated);
      setEditing(false);
      notify("Profile updated.");
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content-card">
      <div className="card-heading">
        <div><h5>Profile</h5><p>Your account information</p></div>
        {!editing && <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
      </div>

      <div className="bp-profile-head">
        <div className="bp-avatar-lg">{initials(fullName)}</div>
        <div>
          <h5>{fullName}</h5>
          <small>{profile.email}</small>
          <div className="mt-2"><StatusBadge status="active" /> <span className="ms-2 text-secondary" style={{ fontSize: 11, textTransform: "capitalize" }}>{profile.role}</span></div>
        </div>
      </div>

      {!editing ? (
        <dl className="bp-kv">
          <div><dt>First name</dt><dd>{profile.firstName || "—"}</dd></div>
          <div><dt>Last name</dt><dd>{profile.lastName || "—"}</dd></div>
          <div className="full"><dt>Email</dt><dd>{profile.email}</dd></div>
          <div><dt>Role</dt><dd style={{ textTransform: "capitalize" }}>{profile.role}</dd></div>
        </dl>
      ) : (
        <form onSubmit={save} noValidate>
          {serverError && <Alert>{serverError}</Alert>}
          <div className="row gx-3">
            <div className="col-12 col-md-6"><FormField label="First name" name="firstName" required value={values.firstName} onChange={set} error={errors.firstName} /></div>
            <div className="col-12 col-md-6"><FormField label="Last name" name="lastName" value={values.lastName} onChange={set} /></div>
            <div className="col-12"><FormField label="Email" name="email" type="email" required value={values.email} onChange={set} error={errors.email} /></div>
          </div>
          <div className="bp-form-actions">
            <Button variant="outline" icon={X} onClick={cancel} disabled={saving}>Cancel</Button>
            <Button type="submit" icon={Save} loading={saving}>Save Changes</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function PasswordCard({ notify }) {
  const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!values.currentPassword) found.currentPassword = "Enter your current password.";
    if (!values.newPassword) found.newPassword = "Enter a new password.";
    else if (!isStrong(values.newPassword)) found.newPassword = "Use 8–72 characters with at least one letter and one number.";
    else if (values.newPassword === values.currentPassword) found.newPassword = "The new password must be different from the current one.";
    if (values.confirmPassword !== values.newPassword) found.confirmPassword = "Passwords do not match.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true); setServerError(""); setDone(false);
    try {
      await changePassword(values);
      setValues(EMPTY);
      setDone(true);
      notify("Password changed.");
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const score = strengthScore(values.newPassword);

  return (
    <div className="content-card">
      <div className="card-heading"><div><h5>Change password</h5><p>Use a strong password you don't use elsewhere</p></div></div>
      {serverError && <Alert>{serverError}</Alert>}
      {done && <Alert type="success">Password changed. For security you are signed out on all devices, so please log in again with the new password.</Alert>}
      <form onSubmit={submit} noValidate autoComplete="off">
        <FormField label="Current password" name="currentPassword" type="password" autoComplete="current-password" value={values.currentPassword} onChange={set} error={errors.currentPassword} />
        <FormField label="New password" name="newPassword" type="password" autoComplete="new-password" value={values.newPassword} onChange={set} error={errors.newPassword}
          hint={!errors.newPassword ? "At least 8 characters, with a letter and a number." : undefined} className="mb-1" />
        <div className="bp-strength" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={i < score ? "on" : ""} />)}</div>
        <div className="mt-3">
          <FormField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set} error={errors.confirmPassword} />
        </div>
        <div className="bp-form-actions">
          <Button type="submit" icon={KeyRound} loading={saving}>Update Password</Button>
        </div>
      </form>
    </div>
  );
}

export default function AdminProfile() {
  const [notify, toastNode] = useToast();
  const profile = useAsync(getProfile, []);

  return (
    <div>
      <PageHeader eyebrow="ACCOUNT" title="My Profile" subtitle="View your account details and keep your password secure." />
      {profile.error && <Alert onRetry={profile.reload}>{profile.error}</Alert>}
      <div className="row g-4">
        <div className="col-12 col-xl-7">
          {profile.data
            ? <ProfileCard profile={profile.data} onSaved={profile.setData} notify={notify} />
            : <div className="content-card"><span className="bp-skeleton" style={{ width: "40%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "75%" }} /></div>}
        </div>
        <div className="col-12 col-xl-5"><PasswordCard notify={notify} /></div>
      </div>
      {toastNode}
    </div>
  );
}
