import { Flag, MapPin } from "lucide-react";
import { formatDateTime } from "../admin-ui/format";
import { STOP_TYPE_LABEL, mapsLink } from "./utils";
import "./driver-tour.css";

// Vertical list of pickup / stop / drop locations (used by the admin tour page and the driver portal)
export default function RouteTimeline({ stops = [] }) {
  return (
    <ol className="dt-timeline">
      {stops.map((s) => {
        const Icon = s.stopType === "pickup" ? Flag : MapPin;
        const link = mapsLink(s.latitude, s.longitude, s.locationAddress || s.stopName);
        return (
          <li key={s.id}>
            <span className={`dt-dot ${s.stopType}`}><Icon size={14} /></span>
            <div>
              <strong>{s.stopName} <small style={{ display: "inline", marginLeft: 6 }}>{STOP_TYPE_LABEL[s.stopType]}</small></strong>
              {s.locationAddress && <small>{s.locationAddress}</small>}
              {s.plannedArrivalAt && <small>Planned arrival {formatDateTime(s.plannedArrivalAt)}</small>}
              {s.notes && <small>{s.notes}</small>}
              {link && <a href={link} target="_blank" rel="noreferrer">Open in Google Maps</a>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
