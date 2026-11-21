import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, EmptyState, FormField, PageHeader } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { EMAIL_REGEX, NIC_REGEX, PHONE_REGEX } from "../../../components/admin-ui/format";
import FileField from "../../../components/driver-tour/FileField";
import { LICENSE_REGEX, isStrongPassword, parseNic, todayISO, validateDocument } from "../../../components/driver-tour/utils";
import { createDriver, getDriver, updateDriver, uploadDriverDocument } from "../../../services/admin/driversService";
import { getErrorMessage } from "../../../services/admin/http";
import "../../../components/driver-tour/driver-tour.css";

const EMPTY = {
  firstName: "", lastName: "", email: "", phone: "", password: "",
  nic: "", licenseNumber: "", licenseExpiryDate: "",
  address: "", emergencyContactName: "", emergencyContactPhone: "", status: "active",
};

const addYears = (years) => {
  const d = new Date(); d.setDate(d.getDate() + years * 366);
  return d.toISOString().slice(0, 10);
};

// Add (/admin/drivers/new) and Edit (/admin/drivers/:id/edit) in one page
export default function DriverForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useAsync(() => (isEdit ? getDriver(id) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [files, setFiles] = useState({ nic: null, license: null });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    const values = {
      firstName: d.user.firstName || "", lastName: d.user.lastName || "", email: d.user.email || "", phone: d.user.phone || "",
      password: "", nic: d.nic, licenseNumber: d.licenseNumber, licenseExpiryDate: d.licenseExpiryDate,
      address: d.address || "", emergencyContactName: d.emergencyContactName || "", emergencyContactPhone: d.emergencyContactPhone || "",
      status: d.status,
    };
    setForm(values);
    setOriginal(values);
  }, [existing.data]);

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const bind = (name) => ({ name, value: form[name], error: errors[name], onChange: (e) => set(name, e.target.value) });

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.lastName.trim()) e.lastName = "Last name is required.";
    if (!EMAIL_REGEX.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (form.phone && !PHONE_REGEX.test(form.phone.trim())) e.phone = "Enter a valid phone number.";

    if (!isEdit && !isStrongPassword(form.password)) e.password = "Min 8 characters with at least one letter and one number.";
    if (isEdit && form.password && !isStrongPassword(form.password)) e.password = "Min 8 characters with at least one letter and one number.";

    if (!NIC_REGEX.test(form.nic.trim())) e.nic = "9 digits followed by V/X, or 12 digits.";
    if (!LICENSE_REGEX.test(form.licenseNumber.trim())) e.licenseNumber = "6-20 letters, digits or hyphens.";

    const expiry = form.licenseExpiryDate;
    if (!expiry) e.licenseExpiryDate = "Licence expiry date is required.";
    else if (!isEdit || expiry !== original.licenseExpiryDate) {
      if (expiry < todayISO()) e.licenseExpiryDate = "This licence has already expired.";
      else if (expiry > addYears(15)) e.licenseExpiryDate = "Expiry date is too far in the future.";
    }

    if (form.emergencyContactPhone && !PHONE_REGEX.test(form.emergencyContactPhone.trim())) e.emergencyContactPhone = "Enter a valid phone number.";
    if (form.emergencyContactName.length > 150) e.emergencyContactName = "Maximum 150 characters.";

    ["nic", "license"].forEach((type) => {
      const problem = validateDocument(files[type]);
      if (problem) e[`file_${type}`] = problem;
    });
    return e;
  };

  const buildPayload = () => {
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    if (!isEdit) {
      return { ...trimmed, nic: trimmed.nic.toUpperCase(), licenseNumber: trimmed.licenseNumber.toUpperCase() };
    }
    // Edit: send only what changed (an unchanged, already expired date would be rejected by the API)
    const payload = {};
    Object.keys(EMPTY).forEach((key) => {
      if (key === "status" || key === "password") return;
      if (trimmed[key] !== (original[key] ?? "").toString().trim()) payload[key] = trimmed[key];
    });
    if (payload.nic) payload.nic = payload.nic.toUpperCase();
    if (payload.licenseNumber) payload.licenseNumber = payload.licenseNumber.toUpperCase();
    if (form.password) payload.password = form.password; // admin password reset
    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setSubmitError("");
    if (Object.keys(found).length) { document.querySelector(".has-error")?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }

    const payload = buildPayload();
    if (isEdit && Object.keys(payload).length === 0) { navigate(`/admin/drivers/${id}`, { state: { notice: "No changes to save." } }); return; }

    setSaving(true);
    try {
      const saved = isEdit ? await updateDriver(id, payload) : await createDriver(payload);

      // documents can only be uploaded once the driver exists
      const failed = [];
      if (!isEdit) {
        for (const type of ["nic", "license"]) {
          if (!files[type]) continue;
          try { await uploadDriverDocument(saved.id, type, files[type]); }
          catch { failed.push(type === "nic" ? "NIC copy" : "licence copy"); }
        }
      }
      const notice = failed.length
        ? `Driver added, but the ${failed.join(" and ")} could not be uploaded. Upload it from the profile page.`
        : isEdit ? "Driver updated." : "Driver added.";
      navigate(`/admin/drivers/${saved.id}`, { state: { notice } });
    } catch (e) {
      setSubmitError(getErrorMessage(e)); // 400 / 409 messages come straight from the API
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const nicInfo = parseNic(form.nic);
  const back = () => navigate(isEdit ? `/admin/drivers/${id}` : "/admin/drivers");

  if (isEdit && existing.loading && !existing.data) {
    return <div className="content-card"><span className="bp-skeleton" style={{ width: "40%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "80%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "60%" }} /></div>;
  }
  if (isEdit && existing.error) {
    return (
      <div>
        <PageHeader eyebrow="DRIVERS" title="Edit Driver" onBack={() => navigate("/admin/drivers")} backLabel="Back to drivers" />
        <div className="content-card"><Alert onRetry={existing.reload}>{existing.error}</Alert><EmptyState title="Driver not available" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="DRIVERS"
        title={isEdit ? "Edit Driver" : "Add New Driver"}
        subtitle={isEdit ? "Update the driver's details, licence and contact information." : "Create the driver's login account and licence record."}
        onBack={back}
        backLabel={isEdit ? "Back to profile" : "Back to drivers"}
      />

      <form className="dt-form" onSubmit={submit} noValidate>
        {submitError && <Alert>{submitError}</Alert>}

        <div className="content-card">
          <h6 className="dt-section-title">Account & personal details</h6>
          <p className="dt-section-sub">The email and password are used to log in to the Driver Portal.</p>
          <div className="dt-grid">
            <FormField label="First name" required {...bind("firstName")} autoComplete="given-name" />
            <FormField label="Last name" required {...bind("lastName")} autoComplete="family-name" />
            <FormField label="Email" type="email" required {...bind("email")} autoComplete="off" />
            <FormField label="Phone" type="tel" {...bind("phone")} placeholder="0771234567" />
            <FormField
              className="full" label={isEdit ? "Reset password (optional)" : "Password"} type="password" required={!isEdit}
              {...bind("password")} autoComplete="new-password"
              hint={isEdit ? "Leave empty to keep the current password. Setting one signs the driver out everywhere." : "At least 8 characters with a letter and a number."}
            />
          </div>
        </div>

        <div className="content-card">
          <h6 className="dt-section-title">NIC & driving licence</h6>
          <p className="dt-section-sub">Drivers with an expired licence cannot log in or be activated.</p>
          <div className="dt-grid">
            <FormField
              label="NIC number" required {...bind("nic")} placeholder="199012345678 or 901234567V"
              hint={nicInfo ? `Born ${nicInfo.birthDate} · ${nicInfo.gender} (from NIC)` : undefined}
            />
            <FormField label="Licence number" required {...bind("licenseNumber")} placeholder="B1234567" />
            <FormField label="Licence expiry date" type="date" required {...bind("licenseExpiryDate")} />
            {!isEdit && (
              <FormField label="Initial status" as="select" {...bind("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </FormField>
            )}
          </div>
        </div>

        <div className="content-card">
          <h6 className="dt-section-title">Address & emergency contact</h6>
          <p className="dt-section-sub">Optional, but recommended for tours that run overnight.</p>
          <div className="dt-grid">
            <FormField className="full" as="textarea" label="Address" {...bind("address")} />
            <FormField label="Emergency contact name" {...bind("emergencyContactName")} />
            <FormField label="Emergency contact phone" type="tel" {...bind("emergencyContactPhone")} />
          </div>
        </div>

        {!isEdit && (
          <div className="content-card">
            <h6 className="dt-section-title">Documents (optional)</h6>
            <p className="dt-section-sub">Upload scans now, or later from the driver's profile. JPG, PNG or PDF, max 5 MB.</p>
            <div className="dt-grid">
              <FileField label="NIC copy" file={files.nic} error={errors.file_nic} onChange={(f) => { setFiles((x) => ({ ...x, nic: f })); setErrors((e) => ({ ...e, file_nic: undefined })); }} />
              <FileField label="Driving licence copy" file={files.license} error={errors.file_license} onChange={(f) => { setFiles((x) => ({ ...x, license: f })); setErrors((e) => ({ ...e, file_license: undefined })); }} />
            </div>
          </div>
        )}

        <div className="bp-form-actions">
          <Button variant="outline" onClick={back} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? "Save changes" : "Add driver"}</Button>
        </div>
      </form>
    </div>
  );
}
