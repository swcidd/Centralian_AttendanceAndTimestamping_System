import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import ActivityPage from "./pages/ActivityPage";
import TrackingPage from "./pages/TrackingPage";
import CoursesPage from "./pages/CoursesPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<ActivityPage />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="courses" element={<CoursesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
