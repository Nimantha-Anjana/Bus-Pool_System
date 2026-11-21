import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, EmptyState } from "../../components/admin-ui/ui";
import { useAsync } from "../../components/admin-ui/hooks";
import { classify, getMyAssignments } from "../../services/driver/portalService";
import { AssignmentCard } from "./parts";
import "./driver-portal.css";

const TABS = [
  { key: "all", label: "All", match: () => true },
  { key: "request", label: "Requests", match: (k) => k === "request" },
  { key: "upcoming", label: "Upcoming", match: (k) => k === "upcoming" || k === "awaiting" },
  { key: "current", label: "Current", match: (k) => k === "current" },
  { key: "completed", label: "Completed", match: (k) => k === "completed" },
  { key: "closed", label: "Cancelled / Rejected", match: (k) => k === "closed" },
];

export default function MyTours() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all";
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useAsync(() => getMyAssignments(), []);

  const rows = useMemo(() => (data || []).map((a) => ({ a, kind: classify(a) })), [data]);
  const term = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => TABS.find((t) => t.key === tab).match(r.kind))
    .filter(({ a }) => !term || [a.tour.tourName, a.tour.tourCode, a.tour.startLocation, a.tour.destination].some((v) => String(v).toLowerCase().includes(term)));

  return (
    <div>
      <div className="page-heading">
        <div><span className="eyebrow">MY TOURS</span><h2>My Tours</h2><p>Every tour assigned to you, newest first.</p></div>
      </div>

      <div className="dp-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`dp-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setParams(t.key === "all" ? {} : { tab: t.key })}>
            {t.label}<em>{rows.filter((r) => t.match(r.kind)).length}</em>
          </button>
        ))}
      </div>

      <div className="bp-filters">
        <div className="bp-search">
          <input className="bp-input" style={{ paddingLeft: 14 }} placeholder="Search by tour name, code or location" aria-label="Search tours"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <Alert onRetry={reload}>{error}</Alert>}

      {loading && !data ? (
        <div className="dp-grid">{[0, 1, 2].map((i) => <div key={i} className="dp-card"><span className="bp-skeleton" style={{ width: "60%" }} /><span className="bp-skeleton" style={{ width: "80%" }} /><span className="bp-skeleton" style={{ width: "45%" }} /></div>)}</div>
      ) : visible.length === 0 ? (
        <div className="content-card"><EmptyState title="No tours here" text={term || tab !== "all" ? "Try another tab or search." : "You have no assigned tours yet."} /></div>
      ) : (
        <div className="dp-grid">{visible.map(({ a }) => <AssignmentCard key={a.id} a={a} to={`/driver/tours/${a.id}`} />)}</div>
      )}
    </div>
  );
}
