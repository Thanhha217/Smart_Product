import ProductFilter from "./components/products/ProductFilters";
import ProductGrid from "./components/products/ProductGrid";
import { useEffect, useState } from "react";
import { generateMockProducts } from "./components/products/productMock";
import { Link, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Pagination from "./components/general/Pagination";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('query');
  const [page, setPage] = useState(parseInt(searchParams.get('page') ?? 1));
  // const page = parseInt(searchParams.get('page') ?? 1)

  const [products] = useState(() => generateMockProducts(500));
  const maxPerPage = 20;
  const numberOfPages = Math.ceil(products.length / maxPerPage)

  useEffect(() => {
    if (page > numberOfPages) {
      goToPage(numberOfPages);
    }

    else if (page < 1) {
      goToPage(1);
    }

    else {
      goToPage(page)
    }
  }, [page, numberOfPages])


  function goToPage(targetPage) {
    // gets search params and modifies only the page
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', targetPage);

    navigate(`?${newParams.toString()}`);

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }


  return (
    <div className="min-h-full p-10 flex gap-4 m-auto">
      <ProductFilter className="w-3/12 h-full" />
      <div className="flex-1 px-6 flex flex-col gap-6">
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

        <Pagination
          page={page}
          setPage={setPage}
          numberOfPages={numberOfPages}
        />

        <ProductGrid products={products.slice(maxPerPage * (page - 1), maxPerPage * page)} />

        <Pagination
          page={page}
          setPage={setPage}
          numberOfPages={numberOfPages}
        />
      </div>
    </div>
  );
}