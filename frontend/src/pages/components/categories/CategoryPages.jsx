import CategorySlot from "./CategorySlot";
import categories from './category_list.json';
import { useRef, useState, useLayoutEffect } from "react";
// import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

export default function useCategoryPages(activeItemIndex) {
  let items = categories.map((category, index) => <li key={index}><CategorySlot text={category.name} src={category.src} /></li>);

  const containerRef = useRef(null);
  const [visibleXCount, setVisibleXCount] = useState(items.length);
  const [visibleYCount, setVisibleYCount] = useState(1);


  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // setVisibleXCount(items.length);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;

      const entry = entries[0];
      const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;

      const computedStyle = window.getComputedStyle(entry.target);
      const rawGap = computedStyle.columnGap; // e.g., "16px" or "normal"
      // const stylePadding = parseFloat(computedStyle.paddingInline)

      const gapNumber = rawGap === 'normal' ? 0 : parseFloat(rawGap);

      console.log("Current parent gap number:", rawGap, gapNumber);

      console.log("witdh : ", width)


      const children = container.children;
      if (children.length === 0) return;

      const childWidth = children[0].offsetWidth;


      // Get the horizontal start point of the first child element
      let startingOffset = children[0].offsetTop;
      let fitXCount = 0;

      // for (let i = 0; i < children.length; i++) {
      //   // If an element's offset changes, it means it wrapped to a new line
      //   if (children[i].offsetTop > startingOffset && i > 0) {
      //     break;
      //   }
      //   fitXCount++;
      // }
      fitXCount = Math.floor((width - gapNumber) / (childWidth + gapNumber))

      console.log("fitXCount", fitXCount)

      setVisibleXCount(fitXCount);

      items = categories.map((category, index) => <li key={index}><CategorySlot text={category.name + "eee"} src={category.src} /></li>);

      let dummyToAdd = fitXCount - (items.slice(activeItemIndex * items_per_page, (activeItemIndex + 1) * items_per_page)).length
      console.log("dummyToAdd", dummyToAdd)

      for (let i = 0; i < dummyToAdd; i++) {
        items.push(<li key={100 + i}><CategorySlot text="dummy" src="dummy" /></li>)
      }
      console.log(items)
    });

    resizeObserver.observe(container);


  }); // Re-run if items array changes


  // 


  let items_per_page = visibleXCount * visibleYCount

  let pages = []

  for (let i = 0; i < Math.ceil(items.length/items_per_page); i++) {
    pages.push(
      <ul key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-2 overflow-hidden" ref={containerRef}>
        {items.slice(i * items_per_page, (i + 1) * items_per_page)}
      </ul>,
    )
  }

  // return ( [
  //   <ul className="flex flex-wrap justify-between gap-x-4 gap-y-2 overflow-hidden" ref={containerRef}>
  //     {/* <CategorySlot src="C:\Users\monst\Documents\Cours\Projets\SmartProduct-Finder\frontend\public\favicon.ico" text="test"/> */}
  //     {/* {pages[activeItemIndex]} */}
  //     {items.slice(activeItemIndex * items_per_page, (activeItemIndex + 1) * items_per_page)}
  //   </ul>,
  // ]
  // );

  return pages;
}