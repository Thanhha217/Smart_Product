import ProductFilter from "./components/products/ProductFilters";
import ProductGrid from "./components/products/ProductGrid";
import { useEffect, useState } from "react";
import { generateMockProducts } from "./components/products/productMock"; 
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('query'); 
  let page = parseInt(searchParams.get('page') ?? 1);
  
  const [products] = useState(() => generateMockProducts(500));
  const maxPerPage = 20;
  const numberOfPages = Math.ceil(products.length/maxPerPage)

  const pageBtnStyle = "min-w-10 min-h-10 px-1 bg-primary-500 text-primary-100 hover:bg-primary-800"

  useEffect(() => {
    if (page > numberOfPages) {
      goToPage(numberOfPages);
    }

    else if (page < 1) {
      goToPage(1);
    }
  }, [page, numberOfPages])

  function goToPage(page) {
    navigate(`/q?query=${query}&page=${page}`)
  }

  let pageNav = []
  let offset = 2

  if (page - offset - 1 > 1) {
    pageNav.push(<p>...</p>)
  }

  const minBoundary = Math.max(Math.min(page-offset, numberOfPages - (offset*2+1)), 2);
  const maxBoundary = Math.min(Math.max(offset*3, page+offset+1), numberOfPages);
  console.log(minBoundary, maxBoundary)

  for (let i = minBoundary; i < maxBoundary; i++) {
    pageNav.push(<button key={i} className={pageBtnStyle} onClick={() => goToPage(i)}>{i}</button>)
  }

  if (page + offset + 1 < numberOfPages) {
    pageNav.push(<p>...</p>)
  }


  return (
    <div className="min-h-full p-10 flex gap-4 m-auto">
        <ProductFilter className="w-3/12 h-full"/>
        <div className="flex-1 px-6">
          <div className="flex justify-between items-center">
            <p>Search results for "{query}"</p>
            
            <div className="flex gap-4 items-center">
              <label>Sort by</label>
              <select name="sorting" id="sorting" className="bg-primary-100 p-1">
                <option value="">Relevence</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="eco-friendly">Most eco-friendly</option>
              </select>
            </div>
          </div>

          <ProductGrid products={products.slice(maxPerPage * (page - 1), maxPerPage * page)}/>

          <div className="flex gap-4 justify-end">
            <button className={pageBtnStyle} onClick={() => goToPage(1)}>1</button>
            {pageNav}
            <button className={pageBtnStyle} onClick={() => goToPage(numberOfPages)}>{numberOfPages}</button>
          </div>
        </div>
    </div>
  );
}