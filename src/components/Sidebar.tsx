import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CgLogOut } from "react-icons/cg";
import { CiMenuBurger } from "react-icons/ci";
import { FaBook, FaChartLine, FaCrosshairs, FaIdCard } from "react-icons/fa";
import { supabase } from "../lib/supabase";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

// Icon stacked above its label, like the reference navbar: compact
// vertical items instead of the old text-only rows.
const NAV_ITEMS = [
  { to: "/tracking", label: "Tracking", Icon: FaCrosshairs },
  { to: "/activity", label: "Activity", Icon: FaChartLine },
  { to: "/courses", label: "Courses", Icon: FaBook },
  { to: "/encode", label: "Encode Card", Icon: FaIdCard },
];

const Sidebar = ({ isOpen, toggleSidebar }: SidebarProps) => {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState<{ name: string; initial: string } | null>(
    null
  );

  // Read-only identity lookup for the Account panel. It only reflects
  // the current session (never mutates it), so opening/closing the
  // sidebar cannot affect login status.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        user.email ||
        "Account";
      setAccount({
        name,
        initial: name.trim().charAt(0).toUpperCase() || "?",
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAccountOpen(false);
    navigate("/login");
  };

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-colors ${
      isActive ? "bg-white" : "hover:bg-white/10"
    }`;

  // Shared by the desktop rail and the hamburger drawer: an Account
  // row (label + avatar) that expands to show the name and a logout
  // button.
  const accountBlock = (
    <div className="mb-4 w-full">
      <button
        type="button"
        onClick={() => setAccountOpen((open) => !open)}
        aria-expanded={accountOpen}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/10 ${
          accountOpen ? "bg-white/10" : ""
        }`}
      >
        <span className="text-sm font-semibold text-white">Account</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25 text-xs font-bold text-white">
          {account?.initial ?? "?"}
        </span>
      </button>
      {accountOpen && (
        <div className="mt-1 rounded-lg bg-white/10 p-2">
          <p className="break-all text-[11px] leading-snug text-white/90">
            {account?.name ?? "Not signed in"}
          </p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/30 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
          >
            <CgLogOut className="text-base" />
            Log out
          </button>
        </div>
      )}
    </div>
  );

  const navBlock = (
    <nav className="flex w-full flex-col gap-2">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={itemClass}>
          {({ isActive }) => (
            <>
              <Icon
                className={`text-xl ${
                  isActive ? "text-orange" : "text-white/80"
                }`}
              />
              <span
                className={`text-[11px] font-medium ${
                  isActive ? "text-navy" : "text-white/80"
                }`}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      {isOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-navy/40 lg:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Persistent desktop rail — icon-over-label layout matching the
          reference navbar; the hamburger is hidden on lg so this is the
          only navigation surface there. */}
      <aside className="bg-navy fixed top-0 left-0 z-30 hidden h-screen w-28 flex-col items-center px-2 py-4 lg:flex">
        {accountBlock}
        {navBlock}
      </aside>

      {/* Mobile drawer, opened from the Topbar hamburger — same blocks,
          so Account expansion works here too. */}
      <aside
        className={`bg-navy fixed top-0 left-0 z-50 flex h-screen w-64 flex-col p-4 transition-all duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-2 flex justify-end">
          <CiMenuBurger
            className="stroke-1 text-2xl text-white"
            onClick={toggleSidebar}
          />
        </div>
        {accountBlock}
        {navBlock}
      </aside>
    </>
  );
};

export default Sidebar;
