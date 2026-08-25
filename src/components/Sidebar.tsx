import { NavLink } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import { CiMenuBurger } from "react-icons/ci";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar = ({ isOpen, toggleSidebar }: SidebarProps) => {
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 transition-colors ${
      isActive
        ? "bg-orange text-white"
        : "text-white/80 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy/40"
          onClick={toggleSidebar}
        ></div>
      )}
      <aside
        className={`bg-navy fixed top-0 left-0 z-50 flex h-screen w-64 flex-col p-4 transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <CgProfile className="text-4xl text-white" />
          <CiMenuBurger
            className="stroke-1 text-2xl text-white"
            onClick={toggleSidebar}
          />
        </div>
        <nav className="flex flex-col">
          <NavLink to="/tracking" className={linkStyle}>
            Tracking
          </NavLink>
          <NavLink to="/activity" className={linkStyle}>
            Activity
          </NavLink>
          <NavLink to="/courses" className={linkStyle}>
            Courses
          </NavLink>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
