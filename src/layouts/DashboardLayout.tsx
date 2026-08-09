import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const DashboardLayout = () => {
  return (
    <div className="flex h-screen">
      <Sidebar/>

      <main className="flex-5 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
