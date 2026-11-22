import SearchBar from "../search/SearchBar";
import { Link } from 'react-router-dom';

export default function Header() {
  return (
        <nav className="bg-primary-100 z-99 h-24 md:h-16 flex flex-col md:flex-row items-center gap-x-4 px-6 py-2 justify-between w-full">
            <Link to="/" className="text-primary-500 font-bold text-2xl whitespace-nowrap">Smart Product Finder</Link>
            <SearchBar className="w-full h-full"/>
        </nav>
  );
}