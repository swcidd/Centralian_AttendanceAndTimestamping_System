import { useState } from "react";
import { CiMenuBurger } from "react-icons/ci";
import Sidebar from "./Sidebar";

interface TopbarProps {
  toggleSidebar: () => void;
}

const Topbar = ({ toggleSidebar }: TopbarProps) => {
  return (
    <>
      <div className="flex border-b-2 border-black items-center gap-2 p-2">
        <CiMenuBurger
          className="border-2 border-black stroke-2 p-1 text-2xl text-black"
          onClick={toggleSidebar}
        />
        <h1 className="text-2xl font-bold tracking-tight">Centralian Attendance & Timestamping System</h1>
      </div>
    </>
  );
};

export default Topbar;
