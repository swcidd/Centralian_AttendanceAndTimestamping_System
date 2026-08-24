import { NavLink } from "react-router-dom";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar = ({ isOpen, toggleSidebar }: SidebarProps) => {
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 ${
      isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={toggleSidebar}
        ></div>
      )}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col bg-gray-900 p-4 transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        </div>
        <nav className="flex flex-col">
          <NavLink to="/" className={linkStyle}>
            Tracking
          </NavLink>
          <NavLink to="/tracking" className={linkStyle}>
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
