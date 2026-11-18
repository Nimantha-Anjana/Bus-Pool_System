import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { Alert, Button, FormField, PageHeader, useToast } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { listAllOwners } from "../../../services/admin/ownersService";
import {
  createBus, deleteBusImage, getBus, setPrimaryBusImage, updateBus, uploadBusImages,
} from "../../../services/admin/busesService";
import { assetUrl, getErrorMessage } from "../../../services/admin/http";
import BusImageManager from "./BusImageManager";

const BUS_TYPES = ["Luxury Coach", "Semi Luxury", "Normal", "Mini Bus", "Van"];
const FACILITY_SUGGESTIONS = ["AC", "Wi-Fi", "USB Charging", "TV", "Music System", "Reclining Seats", "Toilet", "Luggage Space"];
const EMPTY = { ownerId: "", registrationNumber: "", busName: "", busType: "", seatingCapacity: "", airConditioned: false, status: "available", description: "" };

function validate(v) {
  const e = {};
  if (!v.ownerId) e.ownerId = "Select a bus owner.";
  if (!v.registrationNumber.trim()) e.registrationNumber = "Registration number is required.";
  else if (v.registrationNumber.trim().length > 30) e.registrationNumber = "Maximum 30 characters.";
  if (!v.busType.trim()) e.busType = "Bus type is required.";
  const seats = Number(v.seatingCapacity);
  if (!v.seatingCapacity) e.seatingCapacity = "Seating capacity is required.";
  else if (!Number.isInteger(seats) || seats < 1 || seats > 100) e.seatingCapacity = "Enter a whole number between 1 and 100.";
  return e;
}

// One form for Add Bus (/admin/buses/new) and Edit Bus (/admin/buses/:id/edit)
export default function BusForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notify, toastNode] = useToast();

  const [values, setValues] = useState({ ...EMPTY, ownerId: searchParams.get("ownerId") || "" });
  const [facilities, setFacilities] = useState([]);
  const [facilityInput, setFacilityInput] = useState("");
  const [staged, setStaged] = useState([]);           // create mode: files waiting for the bus to exist
  const [serverImages, setServerImages] = useState([]); // edit mode
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  const owners = useAsync(listAllOwners, []);
  const bus = useAsync(() => (isEdit ? getBus(id) : Promise.resolve(null)), [id]);

  useEffect(() => {
    if (!bus.data) return;
    const b = bus.data;
    setValues({
      ownerId: String(b.ownerId), registrationNumber: b.registrationNumber, busName: b.busName || "", busType: b.busType,
      seatingCapacity: String(b.seatingCapacity), airConditioned: Boolean(b.airConditioned), status: b.status, description: b.description || "",
    });
    setFacilities(b.facilities || []);
    setServerImages(b.images || []);
  }, [bus.data]);

  // Only active owners can receive a bus (backend rule) - but keep the current owner visible when editing
  const ownerOptions = useMemo(
    () => (owners.data || []).filter((o) => o.status === "active" || String(o.id) === values.ownerId),
    [owners.data, values.ownerId]
  );

  const set = (e) => {
    const { name, type, checked, value } = e.target;
    setValues((v) => ({ ...v, [name]: type === "checkbox" ? checked : value }));
  };

  const addFacility = (name) => {
    const clean = name.trim();
    if (!clean) return;
    if (clean.length > 80) { setErrors((e) => ({ ...e, facilities: "Facility names must be 80 characters or fewer." })); return; }
    if (!facilities.some((f) => f.toLowerCase() === clean.toLowerCase())) setFacilities((l) => [...l, clean]);
    setFacilityInput("");
    setErrors((e) => ({ ...e, facilities: undefined }));
  };

  /* ----- images ----- */
  const imageList = isEdit
    ? serverImages.map((i) => ({ key: i.id, id: i.id, url: assetUrl(i.imageUrl), name: i.originalName, isPrimary: i.isPrimary }))
    : staged.map((s, i) => ({ key: s.key, url: s.url, name: s.file.name, isPrimary: i === 0 }));

  const addImages = async (files) => {
    if (!isEdit) {
      setStaged((list) => [...list, ...files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) }))]);
      return;
    }
    setImageBusy(true);
    try {
      await uploadBusImages(id, files);
      const fresh = await getBus(id);
      setServerImages(fresh.images || []);
      notify("Images uploaded.");
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = async (img) => {
    if (!isEdit) {
      URL.revokeObjectURL(img.url);
      setStaged((list) => list.filter((s) => s.key !== img.key));
      return;
    }
    setImageBusy(true);
    try {
      await deleteBusImage(id, img.id);
      setServerImages((await getBus(id)).images || []);
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setImageBusy(false);
    }
  };

  const makePrimary = async (img) => {
    setImageBusy(true);
    try {
      await setPrimaryBusImage(id, img.id);
      setServerImages((await getBus(id)).images || []);
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setImageBusy(false);
    }
  };

  /* ----- submit ----- */
  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setServerError("");
    const payload = {
      ownerId: Number(values.ownerId),
      registrationNumber: values.registrationNumber.trim(),
      busName: values.busName.trim() || null,
      busType: values.busType.trim(),
      seatingCapacity: Number(values.seatingCapacity),
      airConditioned: values.airConditioned,
      description: values.description.trim() || null,
      facilities,
    };
    // "assigned" is controlled by the tour-assignment flow, never sent manually
    if (values.status !== "assigned") payload.status = values.status;

    try {
      if (isEdit) {
        await updateBus(id, payload);
        navigate(`/admin/buses/${id}`, { state: { notice: "Bus updated." } });
        return;
      }
      const created = await createBus(payload);
      let notice = "Bus added.";
      if (staged.length) {
        try {
          await uploadBusImages(created.id, staged.map((s) => s.file));
        } catch (imgError) {
          notice = `Bus added, but the images could not be uploaded: ${getErrorMessage(imgError)}`;
        }
      }
      navigate(`/admin/buses/${created.id}`, { state: { notice } });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setSaving(false);
    }
  };

  const back = () => navigate(isEdit ? `/admin/buses/${id}` : "/admin/buses");

  if (isEdit && bus.error) {
    return (<div><PageHeader title="Edit Bus" onBack={back} /><Alert onRetry={bus.reload}>{bus.error}</Alert></div>);
  }
  if (isEdit && !bus.data) {
    return (<div><PageHeader title="Edit Bus" onBack={back} /><div className="content-card"><span className="bp-skeleton" style={{ width: "50%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "80%" }} /></div></div>);
  }

  const isAssigned = values.status === "assigned";

  return (
    <div>
      <PageHeader
        eyebrow="BUS MANAGEMENT"
        title={isEdit ? "Edit Bus" : "Add Bus"}
        subtitle={isEdit ? `Update the details of ${values.registrationNumber}` : "Register a new bus and assign it to an owner."}
        onBack={back}
        backLabel={isEdit ? "Back to bus" : "Back to buses"}
      />

      {serverError && <Alert>{serverError}</Alert>}
      {owners.error && <Alert onRetry={owners.reload}>Could not load bus owners: {owners.error}</Alert>}

      <form onSubmit={submit} noValidate>
        <div className="row g-4">
          <div className="col-12 col-xl-8">
            <div className="content-card mb-4">
              <div className="card-heading"><div><h5>Bus information</h5><p>Basic details and owner assignment</p></div></div>
              <div className="row gx-3">
                <div className="col-12 col-md-6">
                  <FormField label="Bus owner" name="ownerId" as="select" required value={values.ownerId} onChange={set} error={errors.ownerId} disabled={owners.loading}>
                    <option value="">{owners.loading ? "Loading owners..." : "Select owner"}</option>
                    {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.ownerName}</option>)}
                  </FormField>
                </div>
                <div className="col-12 col-md-6"><FormField label="Registration number" name="registrationNumber" required value={values.registrationNumber} onChange={set} error={errors.registrationNumber} placeholder="e.g. NB-1234" style={{ textTransform: "uppercase" }} /></div>
                <div className="col-12 col-md-6"><FormField label="Bus name" name="busName" value={values.busName} onChange={set} placeholder="e.g. Ocean Star" /></div>
                <div className="col-12 col-md-6">
                  <FormField label="Bus type" name="busType" required value={values.busType} onChange={set} error={errors.busType} list="bus-type-list" placeholder="Select or type" />
                  <datalist id="bus-type-list">{BUS_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
                </div>
                <div className="col-12 col-md-6"><FormField label="Seating capacity" name="seatingCapacity" type="number" min="1" max="100" required value={values.seatingCapacity} onChange={set} error={errors.seatingCapacity} /></div>
                <div className="col-12 col-md-6">
                  <FormField
                    label="Availability" name="status" as="select" value={values.status} onChange={set} disabled={isAssigned}
                    hint={isAssigned ? "This bus has an active assignment, so its status is managed automatically." : undefined}
                  >
                    {isAssigned && <option value="assigned">Assigned</option>}
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </FormField>
                </div>
                <div className="col-12"><label className="bp-switch"><input type="checkbox" name="airConditioned" checked={values.airConditioned} onChange={set} /> Air conditioned</label></div>
                <div className="col-12 mt-2"><FormField label="Description" name="description" as="textarea" rows={3} value={values.description} onChange={set} className="mb-0" /></div>
              </div>
            </div>

            <div className="content-card">
              <div className="card-heading"><div><h5>Facilities</h5><p>What passengers get on this bus</p></div></div>
              <div className="bp-chips mb-3">
                {facilities.length === 0 && <span className="text-secondary" style={{ fontSize: 12 }}>No facilities added yet.</span>}
                {facilities.map((f) => (
                  <span className="bp-chip" key={f}>
                    {f}
                    <button type="button" aria-label={`Remove ${f}`} onClick={() => setFacilities((l) => l.filter((x) => x !== f))}><X size={13} /></button>
                  </span>
                ))}
              </div>
              <div className="d-flex gap-2 mb-3">
                <input
                  className="bp-input" value={facilityInput} placeholder="Add a facility and press Enter" aria-label="New facility"
                  onChange={(e) => setFacilityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFacility(facilityInput); } }}
                />
                <Button variant="outline" icon={Plus} onClick={() => addFacility(facilityInput)}>Add</Button>
              </div>
              {errors.facilities && <div className="bp-error-text mb-2">{errors.facilities}</div>}
              <div className="bp-hint mb-2">Quick add</div>
              <div className="bp-chips">
                {FACILITY_SUGGESTIONS.filter((s) => !facilities.some((f) => f.toLowerCase() === s.toLowerCase())).map((s) => (
                  <button type="button" key={s} className="bp-chip bp-chip-suggest" onClick={() => addFacility(s)}><Plus size={12} /> {s}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="content-card">
              <div className="card-heading"><div><h5>Bus images</h5><p>{isEdit ? "Changes are saved immediately" : "Uploaded when the bus is saved"}</p></div></div>
              <BusImageManager images={imageList} onAdd={addImages} onRemove={removeImage} onSetPrimary={makePrimary} busy={imageBusy || saving} canSetPrimary={isEdit} />
            </div>
          </div>
        </div>

        <div className="bp-form-actions">
          <Button variant="outline" onClick={back} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>{isEdit ? "Save Changes" : "Add Bus"}</Button>
        </div>
      </form>
      {toastNode}
    </div>
  );
}
