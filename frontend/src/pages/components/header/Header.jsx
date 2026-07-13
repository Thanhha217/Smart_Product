import SearchBar from "../search/SearchBar";

export default function Header() {
  return (
        <nav className="bg-primary-100 h-16 flex items-center gap-x-4 px-6 justify-between w-full">
            <p className="text-primary-500 font-bold text-2xl whitespace-nowrap">Smart Product Finder</p>
            <SearchBar className="w-full"/>
        </nav>
  );
}