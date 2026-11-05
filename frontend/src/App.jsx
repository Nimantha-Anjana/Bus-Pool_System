import { Navigate, Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";
import DriverLayout from "./layouts/DriverLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import DriverDashboard from "./pages/driver/DriverDashboard";

function ComingSoon() {
  return (
    <div className="content-card">
      <h5>Page Under Development</h5>
      <p className="text-secondary mb-0">
        This module will be developed in an upcoming phase.
      </p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>

      <Route path="/driver" element={<DriverLayout />}>
        <Route path="dashboard" element={<DriverDashboard />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}

export default App;