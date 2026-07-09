import useCategoryPages from './components/categories/CategoryPages.jsx';
import Carousel from './components/carousel/Carousel.jsx';
import SearchBar from "./components/search/SearchBar.jsx"
import { useState } from "react";

export default function Home() {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const pages = useCategoryPages(activeItemIndex);

  return (
    <div className="flex flex-col items-center gap-6 min-h-full">
      <div className="bg-primary-500 min-w-full min-h-5/12 flex flex-col items-center py-12 gap-2">
        <div className='flex flex-col items-center p-12 gap-6'>
          <h1 className="text-primary-900 font-bold text-8xl text-center">Smart Product Finder</h1>
          <p className="text-primary-800 text-2xl">Lorem ipsum dolor sit amet, consectetur adipiscing elit</p>
        </div>
        
        <SearchBar className="w-6/10"/>
      </div>
      

      <div className="w-8/10 h-5/12">
        <p>Categories</p>
        {/* <CategoriesContainer /> */}
        <Carousel
          activeItemIndex={activeItemIndex} 
          setActiveItemIndex={setActiveItemIndex}
          pages={pages} 
        />
      </div>
      
    </div>
  );
}