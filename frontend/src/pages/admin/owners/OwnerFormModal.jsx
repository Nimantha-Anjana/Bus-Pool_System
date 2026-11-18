import { useEffect, useState } from "react";
import { Alert, Button, FormField, Modal } from "../../../components/admin-ui/ui";
import { EMAIL_REGEX, NIC_REGEX, PHONE_REGEX } from "../../../components/admin-ui/format";
import { createOwner, updateOwner } from "../../../services/admin/ownersService";
import { getErrorMessage } from "../../../services/admin/http";

const EMPTY = { ownerName: "", phone: "", email: "", nic: "", businessRegistrationNo: "", address: "", status: "active", notes: "" };

function validate(v) {
  const e = {};
  if (!v.ownerName.trim()) e.ownerName = "Owner name is required.";
  if (!v.phone.trim()) e.phone = "Phone number is required.";
  else if (!PHONE_REGEX.test(v.phone.trim())) e.phone = "Enter a valid phone number (9–15 digits).";
  if (!v.email.trim()) e.email = "Email is required.";
  else if (!EMAIL_REGEX.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (v.nic.trim() && !NIC_REGEX.test(v.nic.trim())) e.nic = "NIC must be 9 digits + V/X, or 12 digits.";
  return e;
}

// Add + Edit in one modal. Pass `owner` to edit.
export default function OwnerFormModal({ open, owner, onClose, onSaved }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(owner);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError("");
    setValues(owner ? {
      ownerName: owner.ownerName || "", phone: owner.phone || "", email: owner.email || "", nic: owner.nic || "",
      businessRegistrationNo: owner.businessRegistrationNo || "", address: owner.address || "",
      status: owner.status || "active", notes: owner.notes || "",
    } : EMPTY);
  }, [open, owner]);

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setServerError("");
    try {
      const payload = {
        ownerName: values.ownerName.trim(), phone: values.phone.trim(), email: values.email.trim(),
        nic: values.nic.trim() || null, businessRegistrationNo: values.businessRegistrationNo.trim() || null,
        address: values.address.trim() || null, status: values.status, notes: values.notes.trim() || null,
      };
      const saved = isEdit ? await updateOwner(owner.id, payload) : await createOwner(payload);
      onSaved(saved, isEdit);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      size="lg"
      title={isEdit ? "Edit Bus Owner" : "Add Bus Owner"}
      onClose={saving ? () => {} : onClose}
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="owner-form" loading={saving}>{isEdit ? "Save Changes" : "Add Owner"}</Button>
        </>
      )}
    >
      {serverError && <Alert>{serverError}</Alert>}
      <form id="owner-form" onSubmit={submit} noValidate>
        <div className="row gx-3">
          <div className="col-12 col-md-6"><FormField label="Owner name" name="ownerName" required value={values.ownerName} onChange={set} error={errors.ownerName} placeholder="e.g. Nimal Perera" /></div>
          <div className="col-12 col-md-6"><FormField label="Phone" name="phone" required value={values.phone} onChange={set} error={errors.phone} placeholder="0771234567" inputMode="tel" /></div>
          <div className="col-12 col-md-6"><FormField label="Email" name="email" type="email" required value={values.email} onChange={set} error={errors.email} placeholder="owner@example.lk" /></div>
          <div className="col-12 col-md-6"><FormField label="NIC" name="nic" value={values.nic} onChange={set} error={errors.nic} placeholder="199012345678" /></div>
          <div className="col-12 col-md-6"><FormField label="Business registration no." name="businessRegistrationNo" value={values.businessRegistrationNo} onChange={set} placeholder="Optional" /></div>
          <div className="col-12 col-md-6">
            <FormField label="Status" name="status" as="select" value={values.status} onChange={set}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </FormField>
          </div>
          <div className="col-12"><FormField label="Address" name="address" as="textarea" rows={2} value={values.address} onChange={set} /></div>
          <div className="col-12"><FormField label="Notes" name="notes" as="textarea" rows={2} value={values.notes} onChange={set} className="mb-0" /></div>
        </div>
      </form>
    </Modal>
  );
}
