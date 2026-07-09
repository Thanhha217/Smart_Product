export default function SearchBar({className}) {
  return (
    <input className={className + " bg-primary-100 rounded-2xl py-1 px-2 outline-secondary-500 focus:outline-2"} type="text" placeholder="Search..."/>
  );
}