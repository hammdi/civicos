import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Landmark,
  Ticket,
  FileText,
  ShoppingBag,
  MapPin,
  LifeBuoy,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import AuthModal from "./AuthModal";
import Avatar from "./Avatar";

const links = [
  { to: "/queue", key: "nav.queue", Icon: Ticket },
  { to: "/documents", key: "nav.documents", Icon: FileText },
  { to: "/market", key: "nav.market", Icon: ShoppingBag },
  { to: "/report", key: "nav.report", Icon: MapPin },
  { to: "/help", key: "nav.help", Icon: LifeBuoy },
];

export default function Navbar() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close menus whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  // Close the account dropdown on outside click.
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountOpen]);

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode);
    setAuthOpen(true);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Landmark className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">CivicOS</span>
        </Link>

        {/* Center nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, key, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {isAuthenticated && user ? (
            <div ref={accountRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1 pe-2 ps-1 text-sm font-medium transition hover:bg-white/20"
              >
                <Avatar name={user.name} src={user.avatar_url} size={28} />
                <span className="max-w-[8rem] truncate">{user.name}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>

              {accountOpen && (
                <div className="absolute end-0 mt-2 w-52 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 text-slate-700 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
                    <p className="truncate text-xs text-slate-400">{user.phone}</p>
                  </div>
                  <Link
                    to="/account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50"
                  >
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    {t("nav.account")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setAccountOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 rtl-flip" />
                    {t("common.logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10"
              >
                {t("nav.login")}
              </button>
              <button
                type="button"
                onClick={() => openAuth("signup")}
                className="rounded-lg bg-civic-green px-3 py-2 text-sm font-semibold text-white transition hover:bg-civic-greenDark"
              >
                {t("nav.signup")}
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="border-t border-white/10 bg-navy px-4 pb-4 pt-2 md:hidden">
          {links.map(({ to, key, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/15" : "text-white/85 hover:bg-white/10"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {t(key)}
            </NavLink>
          ))}

          <div className="my-2 h-px bg-white/10" />

          {isAuthenticated && user ? (
            <>
              <Link
                to="/account"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
              >
                <UserIcon className="h-4 w-4" />
                {t("nav.account")}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 rtl-flip" />
                {t("common.logout")}
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/20"
              >
                {t("nav.login")}
              </button>
              <button
                type="button"
                onClick={() => openAuth("signup")}
                className="rounded-lg bg-civic-green px-3 py-2.5 text-sm font-semibold hover:bg-civic-greenDark"
              >
                {t("nav.signup")}
              </button>
            </div>
          )}
        </nav>
      )}

      {authOpen && <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} />}
    </header>
  );
}
