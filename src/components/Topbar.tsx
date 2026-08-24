import { CiMenuBurger } from "react-icons/ci";

interface TopbarProps {
  toggleSidebar: () => void;
}

const Topbar = ({ toggleSidebar }: TopbarProps) => {
  return (
    <div className="bg-secondary flex items-center gap-2 border-b-2 border-gray-500 p-2">
      <CiMenuBurger
        className="stroke-2 p-1 text-2xl text-white"
        onClick={toggleSidebar}
      />
      <h1 className="text-2xl font-bold tracking-tight text-white">
        Centralian Attendance & Timestamping System
      </h1>
    </div>
  );
};

export default Topbar;
