import { NavLink } from "react-router-dom";
import { CiMenuBurger } from "react-icons/ci";
import { useState } from "react";

const Sidebar = () => {
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 ${
      isActive ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700"
    }`;

  const [isMenuOpen, setIsMenuOpen] = useState(true);

  return (
    <>
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        ></div>
      )}

      <div
        className="fixed top-2 left-2 border-2 border-black stroke-2 p-1 text-black"
        onClick={() => setIsMenuOpen((prev) => !prev)}
      >
        <CiMenuBurger />
      </div>
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col bg-gray-900 p-4 transition-all duration-300 ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <CiMenuBurger
            className="stroke-2 text-white"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          />
        </div>
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
    </>
  );
};

export default Sidebar;
