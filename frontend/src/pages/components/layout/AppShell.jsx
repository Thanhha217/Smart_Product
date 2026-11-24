import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../../i18n/LanguageContext";
import { useCart } from "../../../lib/cart";
import { useCompare } from "../../../lib/compare";
import { useHealthSummary } from "../../../lib/health";
import { useShopText } from "../../../i18n/shop";
import LanguageSwitcher from "../header/LanguageSwitcher";
import Icon from "../ui/Icon";

// Find products holds the search, the CO₂ books (/story) and Ask AI (/assistant): one tab for all three.
const NAV = [
  { to: "/dashboard", icon: "dashboard", key: "nav.dashboard" },
  { to: "/world", icon: "globe", key: "nav.world" },
  { to: "/search", icon: "search", key: "nav.search", also: ["/story", "/assistant"] },
  { to: "/method", icon: "calculator", key: "nav.method" },
  { to: "/compare", icon: "scale", key: "nav.compare" },
  { to: "/cart", icon: "cart", key: "nav.cartShort" },
  { to: "/system", icon: "server", key: "nav.system" },
];
const TABS = [
  { to: "/dashboard", icon: "dashboard", key: "tab.home" },
  { to: "/world", icon: "globe", key: "tab.world" },
  { to: "/search", icon: "search", key: "tab.search", also: ["/story", "/assistant"] },
  { to: "/compare", icon: "scale", key: "tab.compare" },
  { to: "/cart", icon: "cart", key: "tab.cart" },
];
const inSection = (item, path) => (item.also || []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

// Wordmark: leaf tile + "Smart Product Finder" in the display serif, with a short readable tagline.
export function Logo({ light = false, compact = false, size = "md" }) {
  const { t } = useI18n();
  const big = size === "lg";
  return (
    <Link to="/" aria-label="Smart Product Finder" className={`group flex items-center gap-3 ${light ? "text-white" : "text-[#1B4D31]"}`}>
      <span className={`grid place-items-center shrink-0 rounded-2xl ${big ? "w-12 h-12" : "w-11 h-11"} ${light ? "bg-white/15 ring-1 ring-white/20" : "bg-[#1F5D3A] shadow-[0_6px_16px_-8px_rgba(31,93,58,.7)]"}`}>
        <Icon name="leaf" size={big ? 26 : 23} className={light ? "text-[#a8e38a]" : "text-[#bde8a5]"} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={`font-display font-bold leading-[1.15] tracking-[-0.01em] ${big ? "text-[25px]" : "text-[21px]"}`}>
            Smart Product <span className={light ? "text-[#a8e38a]" : "text-[#2E7D4F]"}>Finder</span>
          </span>
          <span className={`mt-1.5 text-[13.5px] font-medium ${light ? "text-white/70" : "text-[#5E6B60]"}`}>{t("shell.tagline")}</span>
        </span>
      )}
    </Link>
  );
}

function Sidebar({ t, onNavigate, drawer = false }) {
  const st = useShopText();
  const compare = useCompare();
  const { pathname } = useLocation();
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6 text-white" style={{ background: "linear-gradient(180deg,#1F5D3A 0%,#173F28 100%)" }}>
      <div className="px-1"><Logo light /></div>
      {drawer && <div className="px-1"><LanguageSwitcher dark /></div>}
      <nav className="flex flex-col gap-1" aria-label="main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} onClick={onNavigate}
                   className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[16px] font-medium transition ${isActive || inSection(n, pathname) ? "bg-[#3B8C55] text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.5)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            <Icon name={n.icon} size={19} />
            <span className="flex-1">{t(n.key)}</span>
            {n.to === "/compare" && compare.length > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-white/90 text-[#1F5D3A] text-[13.5px] font-bold grid place-items-center" aria-label={st("shell.compareBadge", { n: compare.length })}>{compare.length}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TopBar({ t, onMenu, count }) {
  const st = useShopText();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const compare = useCompare();
  const health = useHealthSummary();
  const urlQ = location.pathname === "/search" ? (params.get("q") ?? params.get("query") ?? "") : "";
  const [q, setQ] = useState(urlQ);
  useEffect(() => setQ(urlQ), [urlQ]);
  const submit = (e) => {
    e.preventDefault();
    const value = q.replace(/\s+/g, " ").trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };
  const statusLabel = health.state === "unknown" ? st("shell.statusUnknown")
    : health.state === "ok" ? st("shell.statusOk") : st("shell.statusIssues", { n: health.issues });
  const onFind = location.pathname === "/search";
  const onMethod = location.pathname === "/method";   // its own design: a plain page title, like Find products
  const plainBar = onFind || onMethod;
  const findCategory = onFind ? params.get("category") : null;
  const findHere = !onFind ? null : params.get("q") ? `“${params.get("q")}”`
    : findCategory ? (st(`cat.${findCategory}`) === `cat.${findCategory}` ? findCategory : st(`cat.${findCategory}`))
    : t("find.all");
  const iconBtn = "relative place-items-center w-10 h-10 rounded-full bg-white border border-[#E7E2D4] text-[#1F5D3A] hover:border-[#2E7D4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D4F]";
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E7E2D4] bg-[#F6F4EC]/95 backdrop-blur px-4 min-[900px]:px-8 h-[68px]">
      <button type="button" onClick={onMenu} className="min-[900px]:hidden grid place-items-center w-10 h-10 rounded-xl bg-white border border-[#E7E2D4] shrink-0" aria-label={st("shell.menu")}>
        <Icon name="menu" />
      </button>
      {onMethod ? (
        <nav aria-label="breadcrumb" className="flex min-w-0 flex-1 items-center text-[15px]">
          <span className="truncate text-[#55604F]" aria-current="page">{t("nav.method")}</span>
        </nav>
      ) : onFind ? (
        <nav aria-label="breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px]">
          <Link to="/search" className="shrink-0 text-[#55604F] hover:underline">{t("nav.search")}</Link>
          <span aria-hidden="true" className="text-[#8A9186]">›</span>
          <span className="truncate font-semibold text-[#1E2B22]" aria-current="page">{findHere}</span>
        </nav>
      ) : (
      <form role="search" className="flex-1 min-w-0 max-w-[560px]" onSubmit={submit}>
        <label className="flex items-center gap-2 rounded-full bg-white border border-[#E7E2D4] px-4 h-11 focus-within:ring-2 focus-within:ring-[#2E7D4F]/50">
          <span className="sr-only">{st("shell.searchLabel")}</span>
          <Icon name="search" size={18} className="text-[#6B7468] shrink-0" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("shell.searchPh")}
                 enterKeyHint="search" className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[#7c8578] min-w-0" />
        </label>
      </form>
      )}
      <div className="ml-auto flex items-center gap-2 min-[900px]:gap-3">
        <div className="hidden sm:block"><LanguageSwitcher /></div>
        <Link to="/compare" className={`${iconBtn} ${plainBar ? "hidden" : "hidden sm:grid"}`} aria-label={st("shell.compareBadge", { n: compare.length })} title={st("shell.compareBadge", { n: compare.length })}>
          <Icon name="scale" size={19} />
          {compare.length > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#1F5D3A] text-white text-[12.5px] font-bold grid place-items-center">{compare.length}</span>}
        </Link>
        <Link to="/cart" className={`${iconBtn} ${plainBar ? "grid min-[900px]:hidden" : "grid"}`} aria-label={st("shell.cartLabel", { n: count })} title={st("shell.cartLabel", { n: count })}>
          <Icon name="cart" size={19} />
          {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#b42318] text-white text-[12.5px] font-bold grid place-items-center">{count}</span>}
        </Link>
        <Link to="/system" className={`${iconBtn} ${plainBar ? "hidden" : "hidden sm:grid"}`} aria-label={statusLabel} title={statusLabel}>
          <Icon name="bell" size={19} />
          {health.state === "issues" && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#b45309] text-white text-[12.5px] font-bold grid place-items-center">{health.issues}</span>}
        </Link>
        <div className="hidden xl:flex items-center gap-2.5 pl-1" title={st("shell.guestNote")}>
          <span className="grid place-items-center w-10 h-10 rounded-full bg-[#E4F1E6] text-[#1F5D3A]"><Icon name="user" size={19} /></span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold">{st("shell.guestName")}</span>
            <span className="block text-[13.5px] text-[#5E6B60]">{st("shell.guestNote")}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function BottomTabs({ t }) {
  const { pathname } = useLocation();
  return (
    <nav className="min-[900px]:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-[#E7E2D4] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="tabs">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to}
                 className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[13.5px] font-semibold ${isActive || inSection(tab, pathname) ? "text-[#2E7D4F]" : "text-[#8a9186]"}`}>
          {({ isActive }) => (<>
            <span className={`grid place-items-center w-9 h-7 rounded-full ${isActive || inSection(tab, pathname) ? "bg-[#E4F1E6]" : ""}`}><Icon name={tab.icon} size={19} /></span>
            {t(tab.key)}
          </>)}
        </NavLink>
      ))}
    </nav>
  );
}

function CloseButton({ onClose }) {
  const st = useShopText();
  return <button type="button" onClick={onClose} className="absolute right-3 top-5 z-10 text-white/80 hover:text-white" aria-label={st("shell.closeMenu")}><Icon name="close" /></button>;
}

export default function AppShell() {
  const { t } = useI18n();
  const cart = useCart();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-[#F6F4EC]">
      <aside className="hidden min-[900px]:block fixed inset-y-0 left-0 w-[260px] z-40">
        <Sidebar t={t} />
      </aside>
      {open && (
        <div className="min-[900px]:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button type="button" aria-label="close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[288px] shadow-2xl">
            <CloseButton onClose={() => setOpen(false)} />
            <Sidebar t={t} drawer onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-[900px]:pl-[260px] flex min-h-screen flex-col">
        <TopBar t={t} onMenu={() => setOpen(true)} count={count} />
        <div className="flex-1 pb-[72px] min-[900px]:pb-0 min-w-0">
          <Outlet />
        </div>
      </div>
      <BottomTabs t={t} />
    </div>
  );
}
