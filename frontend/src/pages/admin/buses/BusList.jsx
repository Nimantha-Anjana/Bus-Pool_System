import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BusFront, Eye, Pencil, Plus, Power, Snowflake, Trash2 } from "lucide-react";
import {
  Alert, Button, ConfirmDialog, DataTable, EmptyState, FilterBar, FilterSelect, IconButton, PageHeader,
  Pagination, StatusBadge, useToast,
} from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { deleteBus, listBuses, setBusAvailability } from "../../../services/admin/busesService";
import { listAllOwners } from "../../../services/admin/ownersService";
import { assetUrl, getErrorMessage } from "../../../services/admin/http";

const LIMIT = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inactive", label: "Inactive" },
];
const AC_OPTIONS = [
  { value: "", label: "AC & Non-AC" },
  { value: "true", label: "Air conditioned" },
  { value: "false", label: "Non-AC" },
];

export function BusThumb({ bus, size = 44 }) {
  const url = assetUrl(bus.imageUrl || bus.images?.find((i) => i.isPrimary)?.imageUrl || bus.images?.[0]?.imageUrl);
  return url
    ? <img className="bp-thumb" src={url} alt="" style={{ width: size, height: size }} />
    : <div className="bp-thumb bp-thumb-empty" style={{ width: size, height: size }}><BusFront size={size * 0.45} /></div>;
}

export default function BusList() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const [query, setQuery] = useState({ page: 1, search: "", status: "", ownerId: "", airConditioned: "" });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  const owners = useAsync(listAllOwners, []);
  const { data, loading, error, reload } = useAsync(
    () => listBuses({ ...query, limit: LIMIT }),
    [query.page, query.search, query.status, query.ownerId, query.airConditioned]
  );

  const update = (patch) => setQuery((q) => ({ ...q, page: 1, ...patch }));
  const ownerOptions = [{ value: "", label: "All owners" }, ...(owners.data || []).map((o) => ({ value: String(o.id), label: o.ownerName }))];
  const hasFilters = Boolean(query.search || query.status || query.ownerId || query.airConditioned);

  const toggleAvailability = async (bus) => {
    setTogglingId(bus.id);
    try {
      await setBusAvailability(bus.id, bus.status === "available" ? "inactive" : "available");
      notify(`${bus.registrationNumber} is now ${bus.status === "available" ? "unavailable" : "available"}.`);
      reload();
    } catch (e) {
      notify(getErrorMessage(e), "error");
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteBus(toDelete.id);
      notify("Bus deleted.");
      setToDelete(null);
      if (data.items.length === 1 && query.page > 1) setQuery((q) => ({ ...q, page: q.page - 1 }));
      else reload();
    } catch (e) {
      setDeleteError(getErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "bus", header: "Bus",
      render: (b) => (
        <div className="d-flex align-items-center gap-2 text-start">
          <BusThumb bus={b} />
          <div>
            <strong>{b.busName || b.registrationNumber}</strong>
            <small className="table-subtitle">{b.registrationNumber}</small>
          </div>
        </div>
      ),
    },
    {
      key: "owner", header: "Owner",
      render: (b) => b.owner ? <Link to={`/admin/owners/${b.owner.id}`} className="text-decoration-none">{b.owner.ownerName}</Link> : "—",
    },
    { key: "busType", header: "Type" },
    { key: "seatingCapacity", header: "Seats" },
    {
      key: "airConditioned", header: "AC",
      render: (b) => b.airConditioned ? <span className="bp-ac"><Snowflake size={14} /> AC</span> : <span className="text-secondary">Non-AC</span>,
    },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="BUS MANAGEMENT"
        title="Buses"
        subtitle="Manage buses, facilities, images and availability."
        actions={<Button icon={Plus} onClick={() => navigate("/admin/buses/new")}>Add Bus</Button>}
      />

      <div className="content-card">
        <FilterBar search={query.search} onSearch={(search) => update({ search })} placeholder="Search by registration, name or type">
          <FilterSelect label="Filter by status" value={query.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS} />
          <FilterSelect label="Filter by owner" value={query.ownerId} onChange={(ownerId) => update({ ownerId })} options={ownerOptions} />
          <FilterSelect label="Filter by AC" value={query.airConditioned} onChange={(airConditioned) => update({ airConditioned })} options={AC_OPTIONS} />
        </FilterBar>

        {error && <Alert onRetry={reload}>{error}</Alert>}

        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading && !data}
          empty={!error && (
            <EmptyState
              title="No buses found"
              text={hasFilters ? "Try changing your search or filters." : "Add your first bus to get started."}
              action={!hasFilters && <Button size="sm" icon={Plus} onClick={() => navigate("/admin/buses/new")}>Add Bus</Button>}
            />
          )}
          actions={(b) => (
            <>
              <IconButton icon={Eye} label="View details" onClick={() => navigate(`/admin/buses/${b.id}`)} />
              <IconButton icon={Pencil} label="Edit bus" onClick={() => navigate(`/admin/buses/${b.id}/edit`)} />
              <IconButton
                icon={Power}
                label={b.status === "available" ? "Mark unavailable" : "Mark available"}
                disabled={b.status === "assigned" || togglingId === b.id}
                onClick={() => toggleAvailability(b)}
              />
              <IconButton icon={Trash2} label="Delete bus" danger onClick={() => { setDeleteError(""); setToDelete(b); }} />
            </>
          )}
        />

        <Pagination pagination={data?.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete bus?"
        message={toDelete ? `Bus ${toDelete.registrationNumber} and its images will be permanently removed. Buses with active assignments cannot be deleted.` : ""}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {toastNode}
    </div>
  );
}
