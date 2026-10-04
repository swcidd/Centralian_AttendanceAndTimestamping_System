import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import EncodeCardPage from "./pages/EncodeCardPage";

import DashboardLayout from "./layouts/DashboardLayout";
import ActivityPage from "./pages/ActivityPage";
import TrackingPage from "./pages/TrackingPage";
import CoursesPage from "./pages/CoursesPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Local card encoder — intentionally public; works signed in or out */}
        <Route path="/encode" element={<EncodeCardPage />} />

        <Route element={<DashboardLayout />}>
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/courses" element={<CoursesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
