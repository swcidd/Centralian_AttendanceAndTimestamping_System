import { NavLink } from "react-router-dom";

const Sidebar = () => {
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 ${
      isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 p-4">
      <h2 className="mb-6 text-2xl font-bold text-white">Dashboard</h2>

      <nav className="flex flex-col">
        <NavLink to="/" className={linkStyle}>
          Activity
        </NavLink>

        <NavLink to="/tracking" className={linkStyle}>
          Tracking
        </NavLink>

        <NavLink to="/courses" className={linkStyle}>
          Courses
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
