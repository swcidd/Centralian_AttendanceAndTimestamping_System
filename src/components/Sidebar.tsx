import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CgClose } from "react-icons/cg";
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

  // Read-only identity lookup for the account panel. It only reflects
  // the current session (never mutates it), so opening/closing the
  // sidebar cannot affect login status.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const user = data.session?.user;
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      const parts = [meta.first_name, meta.last_name].filter(
        (part): part is string => Boolean(part)
      );
      const name = parts.join(" ") || user.email || "Account";
      const initial =
        parts.length >= 2
          ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
          : name.trim().charAt(0).toUpperCase() || "?";
      setAccount({ name, initial });
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

  // Shared by the desktop rail and the hamburger drawer. Avatar sits
  // ABOVE the "Account" label — same icon-over-label rhythm as the nav
  // items. Clicking slides the account panel out to the right.
  const accountBlock = (
    <div className="mb-4 w-full">
      <button
        type="button"
        onClick={() => setAccountOpen((open) => !open)}
        aria-expanded={accountOpen}
        aria-controls="account-panel"
        className={`flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-colors hover:bg-white/10 ${
          accountOpen ? "bg-white/10" : ""
        }`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/25 text-sm font-bold text-white">
          {account?.initial ?? "?"}
        </span>
        <span className="text-[11px] font-medium text-white">Account</span>
      </button>
    </div>
  );

  const navBlock = (
    <nav className="flex w-full flex-col gap-2">
      {NAV_ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={itemClass}
          onClick={() => setAccountOpen(false)}
        >
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
          so the Account slide-out works here too. */}
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

      {/* Transparent click-catcher: clicking anywhere outside the panel
          closes it. Stays below the rail (lg) so nav links keep
          working with a single click, and above the drawer on mobile. */}
      {accountOpen && (
        <div
          className="fixed inset-0 z-[55] lg:z-[15]"
          onClick={() => setAccountOpen(false)}
        ></div>
      )}

      {/* Account panel — slides out to the right of the rail (lg: from
          behind the rail, since the rail is painted above it; on
          mobile it overlays the drawer from the left edge). */}
      <div
        id="account-panel"
        role="dialog"
        aria-label="Account"
        className={`fixed top-0 left-0 lg:left-28 h-screen w-80 max-w-full rounded-r-2xl border-r border-tan bg-white shadow-xl transition-transform duration-300 z-[60] lg:z-20 ${
          accountOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {accountOpen && (
          <div className="flex h-full flex-col">
            <div className="flex justify-end p-3">
              <button
                type="button"
                onClick={() => setAccountOpen(false)}
                aria-label="Close account panel"
                className="border-navy/30 text-navy hover:bg-cream rounded-md border p-1"
              >
                <CgClose className="text-lg" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-8">
              <span className="border-tan bg-cream text-navy/80 grid h-20 w-20 place-items-center rounded-full border-2 text-3xl font-semibold">
                {account?.initial ?? "?"}
              </span>
              <p className="text-navy break-words text-center text-xl font-bold">
                {account?.name ?? "Not signed in"}
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="border-tan bg-cream text-navy hover:bg-tan mt-2 rounded-md border px-5 py-1.5 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
