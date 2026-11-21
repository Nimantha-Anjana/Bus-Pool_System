import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert, Button, ConfirmDialog, DataTable, EmptyState, FilterBar, FilterSelect, IconButton, PageHeader,
  Pagination, useToast,
} from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { TourStatusBadge, TourTypeBadge } from "../../../components/driver-tour/badges";
import { formatRange } from "../../../components/driver-tour/utils";
import { deleteTour, listTours } from "../../../services/admin/toursService";
import { getErrorMessage } from "../../../services/admin/http";
import "../../../components/driver-tour/driver-tour.css";

const LIMIT = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending (no bus confirmed)" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const TYPE_OPTIONS = [
  { value: "", label: "Local & foreign" },
  { value: "local", label: "Local" },
  { value: "foreign", label: "Foreign" },
];

export default function TourList() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const [query, setQuery] = useState({ page: 1, search: "", status: "", tourType: "", from: "", to: "" });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data, loading, error, reload } = useAsync(
    () => listTours({ ...query, limit: LIMIT }),
    [query.page, query.search, query.status, query.tourType, query.from, query.to]
  );

  const update = (patch) => setQuery((q) => ({ ...q, page: 1, ...patch }));
  const filtered = Boolean(query.search || query.status || query.tourType || query.from || query.to);
  const dateRangeInvalid = query.from && query.to && query.from > query.to;

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteTour(toDelete.id);
      notify("Tour deleted.");
      setToDelete(null);
      if (data.items.length === 1 && query.page > 1) setQuery((q) => ({ ...q, page: q.page - 1 }));
      else reload();
    } catch (e) {
      setDeleteError(getErrorMessage(e)); // e.g. 409 "assignments exist - cancel the tour instead"
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "tour", header: "Tour",
      render: (t) => (
        <div className="text-start">
          <strong>{t.tourName}</strong>
          <small className="table-subtitle">{t.tourCode}</small>
        </div>
      ),
    },
    { key: "tourType", header: "Type", render: (t) => <TourTypeBadge type={t.tourType} /> },
    {
      key: "route", header: "Route",
      render: (t) => <span className="dt-route">{t.startLocation} <ArrowRight size={13} /> {t.destination}</span>,
    },
    { key: "dates", header: "Dates", render: (t) => formatRange(t.startAt, t.endAt) },
    { key: "passengerCount", header: "Passengers" },
    { key: "assignments", header: "Assignments", render: (t) => t.assignmentCount || "—" },
    { key: "status", header: "Status", render: (t) => <TourStatusBadge status={t.displayStatus} /> },
  ];

  const openAdd = () => navigate("/admin/tours/new");

  return (
    <div>
      <PageHeader
        eyebrow="TOURS"
        title="Tours"
        subtitle="Plan tours, routes and stops. Assign buses and drivers from the Assignments page."
        actions={<Button icon={Plus} onClick={openAdd}>Create Tour</Button>}
      />

      <div className="content-card">
        <FilterBar search={query.search} onSearch={(search) => update({ search })} placeholder="Search by tour name, code, start or destination">
          <FilterSelect label="Filter by status" value={query.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS} />
          <FilterSelect label="Filter by tour type" value={query.tourType} onChange={(tourType) => update({ tourType })} options={TYPE_OPTIONS} />
          <div className="bp-select-wrap">
            <input className="bp-input" type="date" aria-label="Starts from" title="Starts on or after" value={query.from} onChange={(e) => update({ from: e.target.value })} />
          </div>
          <div className="bp-select-wrap">
            <input className="bp-input" type="date" aria-label="Starts until" title="Starts on or before" value={query.to} onChange={(e) => update({ to: e.target.value })} />
          </div>
        </FilterBar>

        {dateRangeInvalid && <Alert type="info">The “from” date is after the “to” date, so no tours can match.</Alert>}
        {error && <Alert onRetry={reload}>{error}</Alert>}

        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading && !data}
          empty={!error && (
            <EmptyState
              title="No tours found"
              text={filtered ? "Try changing your search or filters." : "Create your first tour to get started."}
              action={!filtered && <Button size="sm" icon={Plus} onClick={openAdd}>Create Tour</Button>}
            />
          )}
          actions={(t) => (
            <>
              <IconButton icon={Eye} label="View details" onClick={() => navigate(`/admin/tours/${t.id}`)} />
              <IconButton
                icon={Pencil} label={["completed", "cancelled"].includes(t.status) ? `A ${t.status} tour cannot be edited` : "Edit tour"}
                disabled={["completed", "cancelled"].includes(t.status)} onClick={() => navigate(`/admin/tours/${t.id}/edit`)}
              />
              <IconButton icon={Trash2} label="Delete tour" danger onClick={() => { setDeleteError(""); setToDelete(t); }} />
            </>
          )}
        />

        <Pagination pagination={data?.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete tour?"
        message={toDelete ? `“${toDelete.tourName}” and its stops will be permanently removed. Tours with assignments cannot be deleted - cancel them instead.` : ""}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {toastNode}
    </div>
  );
}
