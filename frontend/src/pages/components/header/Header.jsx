import SearchBar from "../search/SearchBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { Link } from 'react-router-dom';
import { useI18n } from "../../../i18n/LanguageContext";

export default function Header() {
  const { t } = useI18n();

  return (
        <nav className="bg-primary-100 z-99 h-24 md:h-16 flex flex-col md:flex-row items-center gap-x-4 px-6 py-2 justify-between w-full">
            <div className="flex w-full md:w-auto items-center justify-between gap-4">
                <Link to="/" className="text-primary-500 font-bold text-2xl whitespace-nowrap">{t("app.title")}</Link>
                <LanguageSwitcher className="md:hidden" />
            </div>
            <SearchBar className="w-full h-full"/>
            <Link to="/assistant" className="hidden md:block text-primary-500 font-semibold whitespace-nowrap hover:underline">{t("nav.assistant")}</Link>
            <LanguageSwitcher className="hidden md:flex" />
        </nav>
  );
}
