import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { useCart } from "../../../lib/cart";
import LanguageSwitcher from "../header/LanguageSwitcher";
import Icon from "../ui/Icon";

const NAV = [
  { to: "/dashboard", icon: "dashboard", key: "nav.dashboard" },
  { to: "/world", icon: "globe", key: "nav.world" },
  { to: "/search", icon: "search", key: "nav.search" },
  { to: "/assistant", icon: "sparkles", key: "nav.ask" },
  { to: "/compare", icon: "scale", key: "nav.compare" },
  { to: "/method", icon: "calculator", key: "nav.method" },
  { to: "/cart", icon: "cart", key: "nav.cartShort" },
  { to: "/system", icon: "server", key: "nav.system" },
];
const TABS = [
  { to: "/dashboard", icon: "dashboard", key: "tab.home" },
  { to: "/world", icon: "globe", key: "tab.world" },
  { to: "/search", icon: "search", key: "tab.search" },
  { to: "/assistant", icon: "sparkles", key: "tab.ask" },
  { to: "/cart", icon: "cart", key: "tab.cart" },
];

export function Logo({ light = false, compact = false }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${light ? "text-white" : "text-[#1F5D3A]"}`}>
      <span className={`grid place-items-center w-9 h-9 rounded-xl ${light ? "bg-white/15" : "bg-[#E4F1E6]"}`}>
        <Icon name="leaf" size={20} className={light ? "text-[#9be07a]" : "text-[#2E7D4F]"} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-extrabold text-[17px] tracking-tight">SmartProduct</span>
          <span className={`block text-[11px] font-semibold tracking-[.18em] uppercase ${light ? "text-white/60" : "text-[#6B7468]"}`}>Finder · CO₂</span>
        </span>
      )}
    </Link>
  );
}

function SproutArt() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="soil" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6b4a2e" /><stop offset="1" stopColor="#3f2a19" /></linearGradient>
        <linearGradient id="glow" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#cfe9b8" /><stop offset="1" stopColor="#7fb35a" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#glow)" opacity=".35" />
      <path d="M0 92 Q50 80 100 90 T200 88 V120 H0Z" fill="url(#soil)" />
      <path d="M100 92 C100 70 98 58 100 44" stroke="#3f8a3a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M100 62 C82 58 70 46 72 32 C88 34 98 46 100 62Z" fill="#5fb24a" />
      <path d="M100 52 C116 46 128 32 126 18 C110 22 100 36 100 52Z" fill="#7cc95d" />
    </svg>
  );
}

function Sidebar({ t, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6 text-white" style={{ background: "linear-gradient(180deg,#1F5D3A 0%,#173F28 100%)" }}>
      <div className="px-2"><Logo light /></div>
      <nav className="flex flex-col gap-1" aria-label="main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} onClick={onNavigate}
                   className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition ${isActive ? "bg-[#3B8C55] text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.5)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            <Icon name={n.icon} size={19} />
            {t(n.key)}
          </NavLink>
        ))}
      </nav>
      <Link to="/world" onClick={onNavigate} className="mt-auto block overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 hover:bg-white/15 transition">
        <SproutArt />
        <div className="p-3.5">
          <p className="font-display text-lg leading-snug">{t("shell.promo")}</p>
          <span className="mt-2 inline-grid place-items-center w-8 h-8 rounded-full bg-white text-[#1F5D3A]"><Icon name="arrowRight" size={16} /></span>
        </div>
      </Link>
    </div>
  );
}

function TopBar({ t, onMenu, count }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E7E2D4] bg-[#F6F4EC]/90 backdrop-blur px-4 min-[900px]:px-8 h-[68px]">
      <button type="button" onClick={onMenu} className="min-[900px]:hidden grid place-items-center w-10 h-10 rounded-xl bg-white border border-[#E7E2D4]" aria-label="menu">
        <Icon name="menu" />
      </button>
      <div className="min-[900px]:hidden"><Logo compact /></div>
      <form className="flex-1 max-w-[520px]" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?query=${encodeURIComponent(q.trim())}`); }}>
        <label className="flex items-center gap-2 rounded-full bg-white border border-[#E7E2D4] px-4 h-11 focus-within:ring-2 focus-within:ring-[#6FB04A]/50">
          <Icon name="search" size={18} className="text-[#6B7468]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shell.searchPh")}
                 className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#9aa196] min-w-0" />
        </label>
      </form>
      <div className="ml-auto flex items-center gap-2 min-[900px]:gap-3">
        <div className="hidden sm:block"><LanguageSwitcher /></div>
        <Link to="/cart" className="relative grid place-items-center w-10 h-10 rounded-full bg-white border border-[#E7E2D4] text-[#1F5D3A]" aria-label="cart">
          <Icon name="cart" size={19} />
          {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#D9534F] text-white text-[11px] font-bold grid place-items-center">{count}</span>}
        </Link>
        <Link to="/system" className="relative hidden sm:grid place-items-center w-10 h-10 rounded-full bg-white border border-[#E7E2D4] text-[#1F5D3A]" aria-label="system">
          <Icon name="bell" size={19} />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#D9534F]" />
        </Link>
        <div className="hidden md:flex items-center gap-2.5 pl-2">
          <span className="grid place-items-center w-10 h-10 rounded-full text-white font-bold" style={{ background: "linear-gradient(135deg,#6FB04A,#2E7D4F)" }}>K</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">{t("shell.guest")}</span>
            <span className="block text-xs text-[#6B7468]">{t("shell.role")}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function BottomTabs({ t }) {
  return (
    <nav className="min-[900px]:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[#E7E2D4] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="tabs">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to}
                 className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? "text-[#2E7D4F]" : "text-[#8a9186]"}`}>
          {({ isActive }) => (<>
            <span className={`grid place-items-center w-9 h-7 rounded-full ${isActive ? "bg-[#E4F1E6]" : ""}`}><Icon name={tab.icon} size={19} /></span>
            {t(tab.key)}
          </>)}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { t } = useI18n();
  const cart = useCart();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-[#F6F4EC]">
      <aside className="hidden min-[900px]:block fixed inset-y-0 left-0 w-[248px] z-40">
        <Sidebar t={t} />
      </aside>
      {open && (
        <div className="min-[900px]:hidden fixed inset-0 z-50">
          <button type="button" aria-label="close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[272px] shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-5 z-10 text-white/80" aria-label="close"><Icon name="close" /></button>
            <Sidebar t={t} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-[900px]:pl-[248px] flex min-h-screen flex-col">
        <TopBar t={t} onMenu={() => setOpen(true)} count={count} />
        <div className="flex-1 pb-[72px] min-[900px]:pb-0 min-w-0">
          <Outlet />
        </div>
      </div>
      <BottomTabs t={t} />
    </div>
  );
}
