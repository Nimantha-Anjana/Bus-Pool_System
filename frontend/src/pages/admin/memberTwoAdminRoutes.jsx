import { Route } from "react-router-dom";

import DriverList from "./drivers/DriverList";
import DriverForm from "./drivers/DriverForm";
import DriverDetails from "./drivers/DriverDetails";
import TourList from "./tours/TourList";
import TourForm from "./tours/TourForm";
import TourDetails from "./tours/TourDetails";

// Member 02 admin routes (Drivers + Tours). Paste {memberTwoAdminRoutes} inside <Route path="/admin" element={<AdminLayout />}>
// in App.jsx, ABOVE the existing  <Route path="*" element={<ComingSoon />} />  line.
// (Put the "new" routes first - React Router ranks them above ":id" automatically.)
export const memberTwoAdminRoutes = (
  <>
    <Route path="drivers" element={<DriverList />} />
    <Route path="drivers/new" element={<DriverForm />} />
    <Route path="drivers/:id" element={<DriverDetails />} />
    <Route path="drivers/:id/edit" element={<DriverForm />} />

    <Route path="tours" element={<TourList />} />
    <Route path="tours/new" element={<TourForm />} />
    <Route path="tours/:id" element={<TourDetails />} />
    <Route path="tours/:id/edit" element={<TourForm />} />
  </>
);
