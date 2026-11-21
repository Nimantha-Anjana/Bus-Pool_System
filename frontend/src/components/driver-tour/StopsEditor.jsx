import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, FormField, IconButton } from "../admin-ui/ui";
import { STOP_TYPE_LABEL } from "./utils";
import "./driver-tour.css";

let counter = 0;
export const newStop = (stopType = "stop") => ({ _key: `new-${Date.now()}-${counter++}`, stopType, stopName: "", locationAddress: "", latitude: "", longitude: "", plannedArrivalAt: "", notes: "" });

// Multiple tour stops with pickup / stop / drop locations. The array order is the stop order.
// errors: { [index]: { stopName?, plannedArrivalAt?, latitude?, longitude? } }
export default function StopsEditor({ stops, onChange, errors = {}, disabled, max = 50 }) {
  const patch = (index, change) => onChange(stops.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const remove = (index) => onChange(stops.filter((_, i) => i !== index));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="dt-stops">
      {stops.length === 0 && (
        <EmptyState title="No stops added" text="Add the pickup point, stops along the way and the drop-off location." />
      )}

      {stops.map((stop, i) => {
        const err = errors[i] || {};
        return (
          <div className="dt-stop" key={stop._key}>
            <div className="dt-stop-head">
              <span className="dt-stop-no">{i + 1}</span>
              <select
                className="bp-select" value={stop.stopType} disabled={disabled} aria-label={`Stop ${i + 1} type`}
                onChange={(e) => patch(i, { stopType: e.target.value })}
              >
                {Object.entries(STOP_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {!disabled && (
                <div className="dt-stop-tools">
                  <IconButton icon={ArrowUp} label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon={ArrowDown} label="Move down" disabled={i === stops.length - 1} onClick={() => move(i, 1)} />
                  <IconButton icon={Trash2} label="Remove stop" danger onClick={() => remove(i)} />
                </div>
              )}
            </div>

            <div className="dt-grid">
              <FormField label="Location name" required value={stop.stopName} error={err.stopName} disabled={disabled}
                onChange={(e) => patch(i, { stopName: e.target.value })} placeholder="e.g. Colombo Fort Railway Station" />
              <FormField label="Planned arrival" type="datetime-local" value={stop.plannedArrivalAt} error={err.plannedArrivalAt} disabled={disabled}
                onChange={(e) => patch(i, { plannedArrivalAt: e.target.value })} />
              <FormField className="full" label="Address" value={stop.locationAddress} disabled={disabled}
                onChange={(e) => patch(i, { locationAddress: e.target.value })} />
              <FormField label="Latitude" type="number" step="any" value={stop.latitude} error={err.latitude} disabled={disabled}
                onChange={(e) => patch(i, { latitude: e.target.value })} placeholder="6.9271" />
              <FormField label="Longitude" type="number" step="any" value={stop.longitude} error={err.longitude} disabled={disabled}
                onChange={(e) => patch(i, { longitude: e.target.value })} placeholder="79.8612" />
              <FormField className="full" label="Notes" value={stop.notes} disabled={disabled}
                onChange={(e) => patch(i, { notes: e.target.value })} />
            </div>
          </div>
        );
      })}

      {!disabled && (
        <div className="dt-add-row">
          <Button variant="outline" size="sm" icon={Plus} disabled={stops.length >= max} onClick={() => onChange([...stops, newStop("pickup")])}>Add pickup</Button>
          <Button variant="outline" size="sm" icon={MapPin} disabled={stops.length >= max} onClick={() => onChange([...stops, newStop("stop")])}>Add stop</Button>
          <Button variant="outline" size="sm" icon={Plus} disabled={stops.length >= max} onClick={() => onChange([...stops, newStop("drop")])}>Add drop-off</Button>
        </div>
      )}
    </div>
  );
}
