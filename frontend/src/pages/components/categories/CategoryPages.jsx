import CategorySlot from "./CategorySlot";
import categories from './category_list.json';
import { useRef, useState, useLayoutEffect } from "react";
// import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

export default function useCategoryPages() {
  let items = categories.map((category, index) => <li key={index}><CategorySlot text={category.name} src={category.src} /></li>);
  const maxItems = items.length;

  for (let i = 0; i < maxItems; i++) {
    items.push(<li key={100 + i}><CategorySlot visible={false} text="dummy" src="dummy" /></li>);
  }

  const containerRef = useRef(null);
  const [visibleXCount, setVisibleXCount] = useState(items.length);
  const [visibleYCount, setVisibleYCount] = useState(2);


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
      const rawGap = computedStyle.columnGap;
      const gapNumber = rawGap === 'normal' ? 0 : parseFloat(rawGap);

      const children = container.children;
      if (children.length === 0) return;

      const childWidth = children[0].offsetWidth;


      // Get the horizontal start point of the first child element
      let startingOffset = children[0].offsetTop;
      let fitXCount = 0;

      fitXCount = Math.floor((width + gapNumber) / (childWidth + gapNumber))
      // console.log((width ) / (childWidth + gapNumber))
      // console.log((width + gapNumber) / (childWidth + gapNumber))

      setVisibleXCount(fitXCount);
    });

    resizeObserver.observe(container);


  }); // Re-run if items array changes


  // 


  let items_per_page = visibleXCount * visibleYCount

  let pages = []

  for (let i = 0; i < Math.ceil(maxItems/items_per_page); i++) {
    pages.push(
      <ul key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-2 overflow-hidden" ref={containerRef}>
        {items.slice(i * items_per_page, (i + 1) * items_per_page)}
      </ul>,
    )
  }

  return pages;
}