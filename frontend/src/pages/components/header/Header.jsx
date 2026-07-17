import SearchBar from "../search/SearchBar";
import { Link } from 'react-router-dom';

export default function Header() {
  return (
        <nav className="bg-primary-100 h-16 flex items-center gap-x-4 px-6 justify-between w-full">
            <Link to="/" className="text-primary-500 font-bold text-2xl whitespace-nowrap">Smart Product Finder</Link>
            <SearchBar className="w-full h-full"/>
        </nav>
  );
}