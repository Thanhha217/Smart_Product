import SearchBar from "../search/SearchBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from "../../../i18n/LanguageContext";
import { useCart } from "../../../lib/cart";

export default function Header() {
  const { t } = useI18n();
  const cart = useCart();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const link = ({ isActive }) =>
    `text-primary-500 font-semibold whitespace-nowrap hover:underline ${isActive ? "underline" : ""}`;

  return (
        <nav className="bg-primary-100 z-99 flex flex-col gap-2 px-4 md:px-6 py-2 w-full">
            <div className="flex flex-col md:flex-row items-center gap-x-4 gap-y-2 justify-between w-full">
                <div className="flex w-full md:w-auto items-center justify-between gap-4">
                    <Link to="/" className="text-primary-500 font-bold text-2xl whitespace-nowrap">{t("app.title")}</Link>
                    <LanguageSwitcher className="md:hidden" />
                </div>
                <SearchBar className="w-full h-10"/>
                <LanguageSwitcher className="hidden md:flex" />
            </div>
            <div className="flex gap-4 overflow-x-auto text-sm pb-1">
                <NavLink to="/assistant" end className={link}>✨ {t("nav.assistant")}</NavLink>
                <NavLink to="/compare" className={link}>⚖️ {t("nav.compare")}</NavLink>
                <NavLink to="/world" className={link}>🌏 {t("nav.world")}</NavLink>
                <NavLink to="/method" className={link}>🧮 {t("nav.method")}</NavLink>
                <NavLink to="/cart" className={link}>🛒 {t("nav.cart")}{count > 0 ? ` (${count})` : ""}</NavLink>
            </div>
        </nav>
  );
}
