import { CiMenuBurger } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface TopbarProps {
  toggleSidebar: () => void;
}

const Topbar = ({ toggleSidebar }: TopbarProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="bg-orange border-tan flex items-center gap-3 px-4 py-3">
      <CiMenuBurger
        className="cursor-pointer stroke-2 p-1 text-3xl text-white"
        onClick={toggleSidebar}
      />
      <h1 className="text-xl font-bold tracking-tight text-white">
        Centralian Attendance & Timestamping System
      </h1>
      <button
        type="button"
        onClick={handleSignOut}
        className="ml-auto rounded-md border border-white/40 px-3 py-1 text-sm text-white hover:bg-white/10"
      >
        Log out
      </button>
    </div>
  );
};

export default Topbar;
