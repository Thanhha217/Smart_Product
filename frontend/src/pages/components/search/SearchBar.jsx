import { useState } from "react";
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ className }) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault(); // Prevents the browser from reloading the page
    if (searchQuery.trim() === "") return;
    navigate(`/search?query=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className={className}>
      <form className="relative w-full h-full flex items-center" onSubmit={handleSearch}>
        <input
          className="bg-primary-200 absolute rounded-2xl py-1 px-2 w-full outline-secondary-500 focus:outline-2"
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <button
          type="submit"
          className="absolute right-0 py-1 px-2 min-h-8 text-primary-100 bg-secondary-500 hover:bg-secondary-700 rounded-full transition duration-100 ease-in-out cursor-pointer"
          aria-label="Search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.604 10.604Z"
            />
          </svg>
        </button>
      </form>
    </div>



  );
}