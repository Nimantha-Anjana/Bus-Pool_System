import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, EmptyState, FormField, PageHeader } from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import StopsEditor, { newStop } from "../../../components/driver-tour/StopsEditor";
import { fromLocalInput, toLocalInput } from "../../../components/driver-tour/utils";
import { createTour, getTour, updateTour } from "../../../services/admin/toursService";
import { getErrorMessage } from "../../../services/admin/http";
import "../../../components/driver-tour/driver-tour.css";

const EMPTY = {
  tourName: "", tourCode: "", tourType: "local", passengerCount: "",
  startLocation: "", destination: "", startAt: "", endAt: "", pickupAt: "", returnAt: "",
  description: "", specialNotes: "",
};
const DATE_KEYS = ["startAt", "endAt", "pickupAt", "returnAt"];

const toStopForm = (s) => ({
  _key: `s-${s.id}`, stopType: s.stopType, stopName: s.stopName, locationAddress: s.locationAddress || "",
  latitude: s.latitude ?? "", longitude: s.longitude ?? "", plannedArrivalAt: toLocalInput(s.plannedArrivalAt), notes: s.notes || "",
});

// Create (/admin/tours/new) and Edit (/admin/tours/:id/edit) in one page
export default function TourForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useAsync(() => (isEdit ? getTour(id) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [stops, setStops] = useState([]);
  const [errors, setErrors] = useState({});
  const [stopErrors, setStopErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  const tour = existing.data;
  useEffect(() => {
    if (!tour) return;
    const values = {
      tourName: tour.tourName, tourCode: tour.tourCode, tourType: tour.tourType, passengerCount: String(tour.passengerCount),
      startLocation: tour.startLocation, destination: tour.destination,
      startAt: toLocalInput(tour.startAt), endAt: toLocalInput(tour.endAt), pickupAt: toLocalInput(tour.pickupAt), returnAt: toLocalInput(tour.returnAt),
      description: tour.description || "", specialNotes: tour.specialNotes || "",
    };
    setForm(values);
    setOriginal(values);
    setStops((tour.stops || []).map(toStopForm));
  }, [tour]);

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };
  const bind = (name) => ({ name, value: form[name], error: errors[name], onChange: (e) => set(name, e.target.value) });

  // Rules the API enforces (so the admin sees them before saving)
  const locked = isEdit && tour && ["completed", "cancelled"].includes(tour.status);
  const datesLocked = isEdit && tour && (tour.status === "ongoing" || tour.assignmentCount > 0);

  const validate = () => {
    const e = {}; const se = {};
    if (!form.tourName.trim()) e.tourName = "Tour name is required.";
    if (!form.startLocation.trim()) e.startLocation = "Start location is required.";
    if (!form.destination.trim()) e.destination = "Destination is required.";
    const pax = Number(form.passengerCount);
    if (!Number.isInteger(pax) || pax < 1 || pax > 1000) e.passengerCount = "Enter a whole number between 1 and 1000.";
    if (form.tourCode && !/^[A-Za-z0-9-]{3,30}$/.test(form.tourCode.trim())) e.tourCode = "3-30 letters, digits or hyphens.";

    const start = form.startAt ? new Date(form.startAt) : null;
    const end = form.endAt ? new Date(form.endAt) : null;
    const pickup = form.pickupAt ? new Date(form.pickupAt) : null;
    const ret = form.returnAt ? new Date(form.returnAt) : null;
    const startChanged = !isEdit || form.startAt !== original.startAt;

    if (!start) e.startAt = "Start date and time is required.";
    else if (startChanged && start.getTime() <= Date.now()) e.startAt = "Tour start must be in the future.";
    if (!end) e.endAt = "End date and time is required.";
    else if (start && end <= start) e.endAt = "End must be after the start.";
    if (pickup && start && pickup > start) e.pickupAt = "Pickup must be at or before the tour start.";
    if (ret && end && ret < end) e.returnAt = "Return must be at or after the tour end.";

    const lo = pickup || start; const hi = ret || end;
    stops.forEach((s, i) => {
      const x = {};
      if (!s.stopName.trim()) x.stopName = "Location name is required.";
      const hasLat = s.latitude !== ""; const hasLng = s.longitude !== "";
      if (hasLat !== hasLng) { x.latitude = "Enter both latitude and longitude."; x.longitude = "Enter both latitude and longitude."; }
      else if (hasLat) {
        if (!(Math.abs(Number(s.latitude)) <= 90)) x.latitude = "Between -90 and 90.";
        if (!(Math.abs(Number(s.longitude)) <= 180)) x.longitude = "Between -180 and 180.";
      }
      if (s.plannedArrivalAt && lo && hi) {
        const at = new Date(s.plannedArrivalAt);
        if (at < lo || at > hi) x.plannedArrivalAt = "Must be inside the tour time window.";
      }
      if (Object.keys(x).length) se[i] = x;
    });
    return { e, se };
  };

  const stopsPayload = () => stops.map((s) => ({
    stopName: s.stopName.trim(), stopType: s.stopType, locationAddress: s.locationAddress.trim() || null,
    latitude: s.latitude === "" ? null : Number(s.latitude), longitude: s.longitude === "" ? null : Number(s.longitude),
    plannedArrivalAt: fromLocalInput(s.plannedArrivalAt), notes: s.notes.trim() || null,
  }));

  const buildPayload = () => {
    const payload = {
      tourName: form.tourName.trim(), tourType: form.tourType, passengerCount: Number(form.passengerCount),
      startLocation: form.startLocation.trim(), destination: form.destination.trim(),
      description: form.description.trim(), specialNotes: form.specialNotes.trim(), stops: stopsPayload(),
    };
    if (form.tourCode.trim() && form.tourCode.trim().toUpperCase() !== original.tourCode) payload.tourCode = form.tourCode.trim();
    DATE_KEYS.forEach((key) => {
      // On edit only send dates that changed (an unchanged date would be re-checked and can be rejected)
      if (isEdit && form[key] === original[key]) return;
      payload[key] = fromLocalInput(form[key]);
    });
    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    const { e, se } = validate();
    setErrors(e); setStopErrors(se); setSubmitError("");
    if (Object.keys(e).length || Object.keys(se).length) {
      document.querySelector(".has-error")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit ? await updateTour(id, buildPayload()) : await createTour(buildPayload());
      navigate(`/admin/tours/${saved.id}`, { state: { notice: isEdit ? "Tour updated." : "Tour created." } });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const back = () => navigate(isEdit ? `/admin/tours/${id}` : "/admin/tours");

  if (isEdit && existing.loading && !tour) {
    return <div className="content-card"><span className="bp-skeleton" style={{ width: "40%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "80%", marginBottom: 14 }} /><span className="bp-skeleton" style={{ width: "60%" }} /></div>;
  }
  if (isEdit && (existing.error || !tour)) {
    return (
      <div>
        <PageHeader eyebrow="TOURS" title="Edit Tour" onBack={() => navigate("/admin/tours")} backLabel="Back to tours" />
        <div className="content-card"><Alert onRetry={existing.reload}>{existing.error || "Tour not found."}</Alert><EmptyState title="Tour not available" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="TOURS"
        title={isEdit ? "Edit Tour" : "Create New Tour"}
        subtitle={isEdit ? `${tour.tourCode} · ${tour.tourName}` : "Plan the route, dates and stops. Buses and drivers are assigned afterwards."}
        onBack={back}
        backLabel={isEdit ? "Back to tour" : "Back to tours"}
      />

      {locked && <Alert type="info">A {tour.status} tour cannot be edited.</Alert>}
      {datesLocked && !locked && (
        <Alert type="info">
          {tour.status === "ongoing"
            ? "This tour is ongoing, so its dates cannot be changed."
            : "Buses or drivers are assigned to this tour. Cancel the assignments first if you need to change the dates."}
        </Alert>
      )}

      <form className="dt-form" onSubmit={submit} noValidate>
        {submitError && <Alert>{submitError}</Alert>}

        <div className="content-card">
          <h6 className="dt-section-title">Tour details</h6>
          <p className="dt-section-sub">A tour code is generated automatically when you leave it empty.</p>
          <div className="dt-grid">
            <FormField label="Tour name" required {...bind("tourName")} disabled={locked} />
            <FormField label="Tour code" {...bind("tourCode")} disabled={locked} placeholder="Auto-generated" />
            <div className="bp-field">
              <label className="bp-label">Tour type<span className="bp-required">*</span></label>
              <div className="bp-segmented dt-seg2">
                {["local", "foreign"].map((type) => (
                  <button key={type} type="button" className={form.tourType === type ? "active" : ""} disabled={locked} onClick={() => set("tourType", type)}>
                    {type === "local" ? "Local" : "Foreign"}
                  </button>
                ))}
              </div>
            </div>
            <FormField label="Passenger count" type="number" min="1" max="1000" required {...bind("passengerCount")} disabled={locked} />
            <FormField label="Starting location" required {...bind("startLocation")} disabled={locked} />
            <FormField label="Destination" required {...bind("destination")} disabled={locked} />
            <FormField className="full" as="textarea" label="Description" {...bind("description")} disabled={locked} />
            <FormField className="full" as="textarea" label="Special notes" {...bind("specialNotes")} disabled={locked} hint="Visible to the assigned driver." />
          </div>
        </div>

        <div className="content-card">
          <h6 className="dt-section-title">Schedule</h6>
          <p className="dt-section-sub">Start and end are required. Pickup and return times are optional buffers around them.</p>
          <div className="dt-grid">
            <FormField label="Start date & time" type="datetime-local" required {...bind("startAt")} disabled={locked || datesLocked} />
            <FormField label="End date & time" type="datetime-local" required {...bind("endAt")} disabled={locked || datesLocked} />
            <FormField label="Pickup time" type="datetime-local" {...bind("pickupAt")} disabled={locked || datesLocked} hint="Optional - at or before the start." />
            <FormField label="Return time" type="datetime-local" {...bind("returnAt")} disabled={locked || datesLocked} hint="Optional - at or after the end." />
          </div>
        </div>

        <div className="content-card">
          <h6 className="dt-section-title">Pickup, stops & drop-off locations</h6>
          <p className="dt-section-sub">Add as many stops as needed, in the order the bus will visit them (up to 50).</p>
          <StopsEditor stops={stops} onChange={setStops} errors={stopErrors} disabled={locked} />
        </div>

        <div className="bp-form-actions">
          <Button variant="outline" onClick={back} disabled={saving}>Cancel</Button>
          {!locked && <Button type="submit" loading={saving}>{isEdit ? "Save changes" : "Create tour"}</Button>}
        </div>
      </form>
    </div>
  );
}
