import { ArrowLeft, ArrowRight } from "../general/icons";

export default function Carousel({activeItemIndex, setActiveItemIndex, pages}) {
  const sharedButtonClasses = "bg-secondary-500 text-primary-100 flex items-center justify-center w-10 h-10 aspect-square rounded-full text-center m-auto cursor-pointer transition duration-200 ease-in-out hover:bg-secondary-700";
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
            <ArrowLeft />
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
            <ArrowRight />
        </button>
    </div>
  );
}