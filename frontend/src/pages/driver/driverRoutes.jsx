import { Route } from "react-router-dom";

import DriverLogin from "./DriverLogin";
import MyTours from "./MyTours";
import DriverTourDetails from "./DriverTourDetails";
import TourRequests from "./TourRequests";
import GpsTracking from "./GpsTracking";
import DriverProfile from "./DriverProfile";

// Member 02 Driver Portal routes. Two one-time hook-ups in App.jsx (shared file -> the team lead adds them):
//
// 1) inside <Route path="/driver" element={<DriverLayout />}>, ABOVE its  <Route path="*" ... />  line:
//        {driverPortalRoutes}
// 2) next to the other top-level routes (outside any layout, so the login page has no sidebar):
//        {driverLoginRoute}
export const driverPortalRoutes = (
  <>
    <Route path="tours" element={<MyTours />} />
    <Route path="tours/:id" element={<DriverTourDetails />} />
    <Route path="requests" element={<TourRequests />} />
    <Route path="tracking" element={<GpsTracking />} />
    <Route path="profile" element={<DriverProfile />} />
  </>
);

export const driverLoginRoute = <Route path="/driver/login" element={<DriverLogin />} />;
