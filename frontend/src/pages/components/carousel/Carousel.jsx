export default function Carousel({activeItemIndex, setActiveItemIndex, pages}) {
  const sharedButtonClasses = "bg-secondary-500 text-primary-100 text-2xl w-6 aspect-square rounded-2xl text-center p-2 hover:bg-secondary-700";
//   const listItems = categories.map(category => <li><CategorySlot text={category.name} src={category.src}/></li>);
  
  if (activeItemIndex > pages.length - 1) {
    setActiveItemIndex(pages.length - 1)
  }
  
  return (
    <div className="bg-primary-100 w-full h-full rounded-2xl py-6 px-1 flex flex-row items-center justify-center">
      {/* <CategorySlot src="C:\Users\monst\Documents\Cours\Projets\SmartProduct-Finder\frontend\public\favicon.ico" text="test"/> */}
        <button 
          onClick={() => {
          activeItemIndex !== 0 &&
            setActiveItemIndex((prevIndex) => prevIndex - 1);
          }}
          className={sharedButtonClasses}>
            &lt;
        </button>

        <div className="w-8/10">
          {pages[activeItemIndex]}
        </div>
        
        <button 
          onClick={() => {
          activeItemIndex !== pages.length - 1 &&
            setActiveItemIndex((prevIndex) => prevIndex + 1);
          }}
          className={sharedButtonClasses}>
            &gt;
        </button>
    </div>
  );
}