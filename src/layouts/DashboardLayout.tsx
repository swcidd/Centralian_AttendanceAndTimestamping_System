import { Navigate, Outlet } from "react-router-dom";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isCheckingSession) {
    return (
      <div className="bg-cream flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 flex-col">
        <Topbar toggleSidebar={toggleSidebar} />
        <main className="flex-1 bg-cream">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
