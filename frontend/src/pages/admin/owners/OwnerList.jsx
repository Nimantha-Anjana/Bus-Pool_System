import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert, Button, ConfirmDialog, DataTable, EmptyState, FilterBar, FilterSelect, IconButton, PageHeader,
  Pagination, StatusBadge, useToast,
} from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate, initials } from "../../../components/admin-ui/format";
import { deleteOwner, listOwners } from "../../../services/admin/ownersService";
import { getErrorMessage } from "../../../services/admin/http";
import OwnerFormModal from "./OwnerFormModal";

const LIMIT = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function OwnerList() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const [query, setQuery] = useState({ page: 1, search: "", status: "" });
  const [formState, setFormState] = useState({ open: false, owner: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data, loading, error, reload } = useAsync(
    () => listOwners({ ...query, limit: LIMIT }),
    [query.page, query.search, query.status]
  );

  const update = (patch) => setQuery((q) => ({ ...q, page: 1, ...patch }));

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteOwner(toDelete.id);
      notify("Bus owner deleted.");
      setToDelete(null);
      // go back a page if the last row of this page was removed
      if (data.items.length === 1 && query.page > 1) setQuery((q) => ({ ...q, page: q.page - 1 }));
      else reload();
    } catch (e) {
      setDeleteError(getErrorMessage(e)); // e.g. 409 "still has buses"
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "ownerName", header: "Owner",
      render: (o) => (
        <div className="d-flex align-items-center gap-2 text-start">
          <div className="avatar" style={{ flex: "none" }}>{initials(o.ownerName)}</div>
          <div>
            <strong>{o.ownerName}</strong>
            <small className="table-subtitle">{o.email}</small>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone" },
    { key: "nic", header: "NIC", render: (o) => o.nic || "—" },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
    { key: "createdAt", header: "Added", render: (o) => formatDate(o.createdAt) },
  ];

  const rows = data?.items || [];
  const openAdd = () => setFormState({ open: true, owner: null });

  return (
    <div>
      <PageHeader
        eyebrow="BUS OWNERS"
        title="Bus Owners"
        subtitle="Manage the owners who provide buses to the pool."
        actions={<Button icon={Plus} onClick={openAdd}>Add Owner</Button>}
      />

      <div className="content-card">
        <FilterBar search={query.search} onSearch={(search) => update({ search })} placeholder="Search by name, email, phone or NIC">
          <FilterSelect label="Filter by status" value={query.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS} />
        </FilterBar>

        {error && <Alert onRetry={reload}>{error}</Alert>}

        <DataTable
          columns={columns}
          rows={rows}
          loading={loading && !data}
          empty={!error && (
            <EmptyState
              title="No bus owners found"
              text={query.search || query.status ? "Try changing your search or filters." : "Add your first bus owner to get started."}
              action={!query.search && !query.status && <Button size="sm" icon={Plus} onClick={openAdd}>Add Owner</Button>}
            />
          )}
          actions={(o) => (
            <>
              <IconButton icon={Eye} label="View details" onClick={() => navigate(`/admin/owners/${o.id}`)} />
              <IconButton icon={Pencil} label="Edit owner" onClick={() => setFormState({ open: true, owner: o })} />
              <IconButton icon={Trash2} label="Delete owner" danger onClick={() => { setDeleteError(""); setToDelete(o); }} />
            </>
          )}
        />

        <Pagination pagination={data?.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>

      <OwnerFormModal
        open={formState.open}
        owner={formState.owner}
        onClose={() => setFormState({ open: false, owner: null })}
        onSaved={(_, wasEdit) => { setFormState({ open: false, owner: null }); notify(wasEdit ? "Owner updated." : "Owner added."); reload(); }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete bus owner?"
        message={toDelete ? `“${toDelete.ownerName}” will be permanently removed. Owners that still have buses cannot be deleted.` : ""}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {toastNode}
    </div>
  );
}
