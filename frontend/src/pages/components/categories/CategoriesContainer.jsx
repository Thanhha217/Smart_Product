import CategorySlot from "./CategorySlot";
import categories from './category_list.json';
import { useRef, useState } from "react";
// import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

export default function CategoriesContainer() {
  const listItems = categories.map(category => <li><CategorySlot text={category.name} src={category.src}/></li>);
  const [activeItemIndex, setActiveItemIndex] = useState(1);
  let pages = [
    <ul className="w-8/10 grid grid-flow-col grid-rows-2 gap-x-4 gap-y-2">{listItems}</ul>,
    <ul className="bg-primary-500 w-8/10 grid grid-flow-col grid-rows-2 gap-x-4 gap-y-2">{listItems}</ul>
  ]
  return (
    <div>
      <div className="bg-primary-100 w-full h-full rounded-2xl py-6 px-1 flex flex-row items-center gap-2">
        {/* <CategorySlot src="C:\Users\monst\Documents\Cours\Projets\SmartProduct-Finder\frontend\public\favicon.ico" text="test"/> */}
        {pages[activeItemIndex]}
        
      </div>
    </div>
  );
}