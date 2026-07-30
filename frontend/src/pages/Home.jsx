import generateCategoryPages from './components/categories/generateCategoryPages.jsx';
import Carousel from './components/carousel/Carousel.jsx';
import SearchBar from "./components/search/SearchBar.jsx"
import { useState } from "react";

export default function Home() {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const pages = generateCategoryPages();

  return (
    <div className="flex flex-col items-center gap-6 min-h-full">
      <div className="bg-primary-100 min-w-full min-h-5/12 flex flex-col items-center py-12 gap-2">
        <div className='flex flex-col items-center py-12 px-2 md:px-12 gap-6'>
          <h1 className="text-primary-500 font-bold text-5xl md:text-8xl text-center">Smart Product Finder</h1>
          <p className="text-primary-800 text-sm md:text-2xl">Lorem ipsum dolor sit amet, consectetur adipiscing elit</p>
        </div>
        
        <SearchBar className="w-9/10 md:w-6/10"/>
      </div>
      
    {/* Hide categories for now */}
      {/* 
      <div className="w-8/10 h-5/12">
        <p>Categories</p>
        <Carousel
          activeItemIndex={activeItemIndex} 
          setActiveItemIndex={setActiveItemIndex}
          pages={pages} 
        />
      </div> 
      */}
      
    </div>
  );
}