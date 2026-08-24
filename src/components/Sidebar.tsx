import { NavLink } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import { CiMenuBurger } from "react-icons/ci";


interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar = ({ isOpen, toggleSidebar }: SidebarProps) => {
  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-4 py-2 ${
      isActive ? "bg-secondary text-white" : "text-[#393e41] hover:bg-[#393e41] hover:text-white"
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
        className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col bg-primary p-4 transition-all duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <CgProfile className="text-4xl text-[#393e41]"/>
          <CiMenuBurger className="text-2xl text-[#393e41] stroke-1" onClick={toggleSidebar}/>
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
