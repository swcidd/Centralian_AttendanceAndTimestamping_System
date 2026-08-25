import { CiMenuBurger } from "react-icons/ci";

interface TopbarProps {
  toggleSidebar: () => void;
}

const Topbar = ({ toggleSidebar }: TopbarProps) => {
  return (
    <div className="bg-orange border-tan flex items-center gap-3 px-4 py-3">
      <CiMenuBurger
        className="cursor-pointer stroke-2 p-1 text-3xl text-white"
        onClick={toggleSidebar}
      />
      <h1 className="text-xl font-bold tracking-tight text-white">
        Centralian Attendance & Timestamping System
      </h1>
    </div>
  );
};

export default Topbar;
