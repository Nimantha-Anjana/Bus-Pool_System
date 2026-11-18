import { Route } from "react-router-dom";

import OwnerList from "./owners/OwnerList";
import OwnerDetails from "./owners/OwnerDetails";
import BusList from "./buses/BusList";
import BusForm from "./buses/BusForm";
import BusDetails from "./buses/BusDetails";
import AdminProfile from "./profile/AdminProfile";

// Member 01 routes. Paste {memberOneRoutes} inside <Route path="/admin" element={<AdminLayout />}> in App.jsx,
// ABOVE the existing  <Route path="*" element={<ComingSoon />} />  line.
// (React Router treats the fragment's <Route> children as normal children.)
export const memberOneRoutes = (
  <>
    <Route path="owners" element={<OwnerList />} />
    <Route path="owners/:id" element={<OwnerDetails />} />

    <Route path="buses" element={<BusList />} />
    <Route path="buses/new" element={<BusForm />} />
    <Route path="buses/:id" element={<BusDetails />} />
    <Route path="buses/:id/edit" element={<BusForm />} />

    {/* "Settings" in the sidebar points to /admin/settings, so the profile lives there too */}
    <Route path="settings" element={<AdminProfile />} />
    <Route path="profile" element={<AdminProfile />} />
  </>
);
