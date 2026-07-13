export default function SearchBar({className}) {
  return (
    <div className={className}>
      <input className="bg-primary-200 rounded-2xl py-1 px-2 w-full outline-secondary-500 focus:outline-2" type="text" placeholder="Search..."/>
    </div>
    
  );
}