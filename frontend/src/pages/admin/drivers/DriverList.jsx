import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, Power, Trash2 } from "lucide-react";
import {
  Alert, Button, ConfirmDialog, DataTable, EmptyState, FilterBar, FilterSelect, IconButton, PageHeader,
  Pagination, StatusBadge, useToast,
} from "../../../components/admin-ui/ui";
import { useAsync } from "../../../components/admin-ui/hooks";
import { formatDate, initials } from "../../../components/admin-ui/format";
import { LicenseBadge } from "../../../components/driver-tour/badges";
import { fullName } from "../../../components/driver-tour/utils";
import { deleteDriver, listDrivers, setDriverStatus } from "../../../services/admin/driversService";
import { getErrorMessage } from "../../../services/admin/http";

const LIMIT = 10;
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];
const LICENSE_OPTIONS = [
  { value: "", label: "Any licence expiry" },
  { value: "expiring", label: "Expiring within 30 days" },
  { value: "expired", label: "Expired" },
];

export default function DriverList() {
  const navigate = useNavigate();
  const [notify, toastNode] = useToast();
  const [query, setQuery] = useState({ page: 1, search: "", status: "", licenseExpiry: "" });
  const [toDelete, setToDelete] = useState(null);
  const [toDeactivate, setToDeactivate] = useState(null);
  const [working, setWorking] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const { data, loading, error, reload } = useAsync(
    () => listDrivers({ ...query, limit: LIMIT }),
    [query.page, query.search, query.status, query.licenseExpiry]
  );

  const update = (patch) => setQuery((q) => ({ ...q, page: 1, ...patch }));
  const filtered = Boolean(query.search || query.status || query.licenseExpiry);

  const changeStatus = async (driver, status) => {
    setWorking(true);
    setDialogError("");
    try {
      await setDriverStatus(driver.id, status);
      notify(`${fullName(driver.user)} is now ${status}.`);
      setToDeactivate(null);
      reload();
    } catch (e) {
      // 409: expired licence on activate, or active assignments on deactivate
      if (status === "active") notify(getErrorMessage(e), "error");
      else setDialogError(getErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = async () => {
    setWorking(true);
    setDialogError("");
    try {
      await deleteDriver(toDelete.id);
      notify("Driver deleted.");
      setToDelete(null);
      if (data.items.length === 1 && query.page > 1) setQuery((q) => ({ ...q, page: q.page - 1 }));
      else reload();
    } catch (e) {
      setDialogError(getErrorMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const columns = [
    {
      key: "driver", header: "Driver",
      render: (d) => (
        <div className="d-flex align-items-center gap-2 text-start">
          <div className="avatar" style={{ flex: "none" }}>{initials(fullName(d.user))}</div>
          <div>
            <strong>{fullName(d.user)}</strong>
            <small className="table-subtitle">{d.user.email}</small>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (d) => d.user.phone || "—" },
    { key: "nic", header: "NIC" },
    {
      key: "license", header: "Licence",
      render: (d) => (
        <div className="text-start">
          <strong>{d.licenseNumber}</strong>
          <small className="table-subtitle">Expires {formatDate(d.licenseExpiryDate)}</small>
        </div>
      ),
    },
    { key: "expiry", header: "Expiry status", render: (d) => <LicenseBadge expiryDate={d.licenseExpiryDate} /> },
    { key: "status", header: "Status", render: (d) => <StatusBadge status={d.status} /> },
  ];

  const openAdd = () => navigate("/admin/drivers/new");

  return (
    <div>
      <PageHeader
        eyebrow="DRIVERS"
        title="Drivers"
        subtitle="Manage drivers, their licences and documents."
        actions={<Button icon={Plus} onClick={openAdd}>Add Driver</Button>}
      />

      <div className="content-card">
        <FilterBar search={query.search} onSearch={(search) => update({ search })} placeholder="Search by name, NIC, licence, email or phone">
          <FilterSelect label="Filter by status" value={query.status} onChange={(status) => update({ status })} options={STATUS_OPTIONS} />
          <FilterSelect label="Filter by licence expiry" value={query.licenseExpiry} onChange={(licenseExpiry) => update({ licenseExpiry })} options={LICENSE_OPTIONS} />
        </FilterBar>

        {error && <Alert onRetry={reload}>{error}</Alert>}

        <DataTable
          columns={columns}
          rows={data?.items || []}
          loading={loading && !data}
          empty={!error && (
            <EmptyState
              title="No drivers found"
              text={filtered ? "Try changing your search or filters." : "Add your first driver to get started."}
              action={!filtered && <Button size="sm" icon={Plus} onClick={openAdd}>Add Driver</Button>}
            />
          )}
          actions={(d) => (
            <>
              <IconButton icon={Eye} label="View profile" onClick={() => navigate(`/admin/drivers/${d.id}`)} />
              <IconButton icon={Pencil} label="Edit driver" onClick={() => navigate(`/admin/drivers/${d.id}/edit`)} />
              <IconButton
                icon={Power}
                label={d.status === "active" ? "Deactivate driver" : "Activate driver"}
                onClick={() => (d.status === "active" ? (setDialogError(""), setToDeactivate(d)) : changeStatus(d, "active"))}
              />
              <IconButton icon={Trash2} label="Delete driver" danger onClick={() => { setDialogError(""); setToDelete(d); }} />
            </>
          )}
        />

        <Pagination pagination={data?.pagination} onPageChange={(page) => setQuery((q) => ({ ...q, page }))} />
      </div>

      <ConfirmDialog
        open={Boolean(toDeactivate)}
        title="Deactivate driver?"
        confirmLabel="Deactivate"
        message={toDeactivate ? `${fullName(toDeactivate.user)} will be signed out and can no longer log in. Drivers with pending or confirmed assignments cannot be deactivated.` : ""}
        loading={working}
        error={dialogError}
        onConfirm={() => changeStatus(toDeactivate, "inactive")}
        onCancel={() => setToDeactivate(null)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete driver?"
        message={toDelete ? `“${fullName(toDelete.user)}” and their login account will be permanently removed. Drivers with assignment history cannot be deleted - set them to inactive instead.` : ""}
        loading={working}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
      {toastNode}
    </div>
  );
}
