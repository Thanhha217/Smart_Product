import ProductFilter from "./components/products/ProductFilters";
import ProductGrid from "./components/products/ProductGrid";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Pagination from "./components/general/Pagination";
import ProductMobileFilter from "./components/products/ProductMobileFilters";
import { GATEWAY_URL } from "./utils/consts";
import Throbber from "./components/general/Throbber";

const fetchProducts = async (query, imageQuery) => {
  const body = {};
  
  if (imageQuery) {
    body.image = imageQuery;
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };

  
  const res = await fetch(`${GATEWAY_URL}/query${query ? `?q=${encodeURIComponent(query)}` : ''}`, options);
  
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.products?.products)) return data.products.products;
  return [];
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const query = searchParams.get('query');
  const [imageQuery, setImageQuery] = useState(null);
  useEffect(() => {
    const file = location.state?.imageFile;
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageQuery(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImageQuery(null);
    }
  }, [location.state]);
  // const [page, setPage] = useState(parseInt(searchParams.get('page') ?? 1));
  const page = parseInt(searchParams.get('page') ?? 1)

  const [productsInfo, setProductsInfo] = useState([]);
  const priceLimit = productsInfo.length
    ? (Math.ceil(Math.max(...productsInfo.map(item => parseInt(item.product.final_price))) / 10000) + 1) * 10
    : 0;
  const [minPriceValue, setMinPriceValue] = useState(0);
  const [maxPriceValue, setMaxPriceValue] = useState(priceLimit);
  const [starValue, setStarValue] = useState(0);
  const gwpLimit = productsInfo.length
    ? Math.ceil(Math.max(...productsInfo.map(item => parseInt(item.product.gwp))))
    : 0;
  const [maxGwpValue, setMaxGwpValue] = useState(gwpLimit);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [ignoreGwp, setIgnoreGwp] = useState(false);
  const [sortValue, setSortValue] = useState('');

  useEffect(() => {
    if (!productsInfo.length) {
      setMinPriceValue(0);
      setMaxPriceValue(0);
      setMaxGwpValue(0);
      return;
    }

    setMinPriceValue(0);
    setMaxPriceValue(priceLimit);
    setMaxGwpValue(gwpLimit);
  }, [productsInfo, priceLimit, gwpLimit]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadProducts = async () => {
      if (!query && !imageQuery) {
        if (isActive) {
          setProductsInfo([]);
          setLoading(false);
        }
        return;
      }

      if (isActive) {
        setLoading(true);
      }

      try {
        const data = await fetchProducts(query, imageQuery);

        if (isActive) {
          setProductsInfo(data);
          setLoading(false);
        }
      } catch (error) {
        if (isActive) {
          setProductsInfo([]);
          setLoading(false);
        }

        console.error("Failed to fetch products:", error);
      }
    };

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [query, imageQuery]);

  const handleSortChange = (event) => {
    setSortValue(event.target.value);
  };
  

  let filteredProducts = productsInfo
  // Price filter
  filteredProducts = filteredProducts.filter(item => item.product.final_price <= maxPriceValue*1000);

  if (maxPriceValue > 0) {
    filteredProducts = filteredProducts.filter(item => item.product.final_price <= maxPriceValue*1000);
  }

  // Rating filter
  if (starValue > 0) {
    filteredProducts = filteredProducts.filter(item => item.product.product_rating * 5.0 >= starValue);
  }

  // Gwp filter
  if (maxGwpValue > 0) {
    filteredProducts = filteredProducts.filter(item => item.product.gwp <= maxGwpValue);
  }

  // Options filter
  if (onSaleOnly) {
    filteredProducts = filteredProducts.filter(item => item.product.final_price != item.product.original_price);
  }

  if (ignoreGwp) {
    // TODO when gwp is actually implemented in the ranking
  }
  
  

  // Sorting
  switch (sortValue) {
    case "price-low":
      filteredProducts = filteredProducts.sort((a, b) => a.product.final_price - b.product.final_price);
      break;
    case "price-high":
      filteredProducts = filteredProducts.sort((a, b) => b.product.final_price - a.product.final_price);
      break;
    case "eco-friendly":
      filteredProducts = filteredProducts.sort((a, b) => a.product.gwp - b.product.gwp);
      break;
  }

  const maxPerPage = 20;
  const numberOfPages = Math.max(Math.ceil(filteredProducts.length / maxPerPage), 1)

  useEffect(() => {
    if (page > numberOfPages) {
      goToPage(numberOfPages);
    }

    else if (page < 1) {
      goToPage(1);
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
    <div className="min-h-full md:py-6 md:p-10 pb-12 flex gap-4 m-auto">
      <ProductFilter
        className="hidden w-full md:flex md:w-3/12 h-full"
        priceLimit={priceLimit}
        minPriceValue={minPriceValue}
        setMinPriceValue={setMinPriceValue}
        maxPriceValue={maxPriceValue}
        setMaxPriceValue={setMaxPriceValue}
        starValue={starValue}
        setStarValue={setStarValue}
        gwpLimit={gwpLimit}
        maxGwpValue={maxGwpValue}
        setMaxGwpValue={setMaxGwpValue}
        onSaleOnly={onSaleOnly}
        setOnSaleOnly={setOnSaleOnly}
        ignoreGwp={ignoreGwp}
        setIgnoreGwp={setIgnoreGwp}
      />


      <div className="flex-1 md:px-6 flex flex-col gap-6">
        <ProductMobileFilter
          priceLimit={priceLimit}
          minPriceValue={minPriceValue}
          setMinPriceValue={setMinPriceValue}
          maxPriceValue={maxPriceValue}
          setMaxPriceValue={setMaxPriceValue}
          starValue={starValue}
          setStarValue={setStarValue}
          gwpLimit={gwpLimit}
          maxGwpValue={maxGwpValue}
          setMaxGwpValue={setMaxGwpValue}
          onSaleOnly={onSaleOnly}
          setOnSaleOnly={setOnSaleOnly}
          ignoreGwp={ignoreGwp}
          setIgnoreGwp={setIgnoreGwp}
          sortValue={sortValue}
          setSortValue={setSortValue}
        />

        <div className="flex justify-between items-center">
          <p>Search results for "{query}"</p>

          <div className="hidden md:flex gap-4 items-center">
            <label>Sort by</label>
            <select name="sorting" id="sorting" className="bg-primary-100 p-1" onChange={handleSortChange}>
              <option value="">Relevence</option>
              <option value="price-low">Price low to high</option>
              <option value="price-high">Price high to low</option>
              <option value="eco-friendly">Most eco-friendly</option>
            </select>
          </div>
        </div>

        <Pagination
          page={page}
          setPage={goToPage}
          numberOfPages={numberOfPages}
        />

        {/* <div className={`text-6xl ${loading?"":"hidden"}`}>I'm loading...</div> */}
        <div className={`m-auto ${loading?"":"hidden"}`}>
          <Throbber/>
        </div>

        <p className={`m-auto text-2xl text-primary-800 ${!loading && !filteredProducts.length ?"":"hidden"}`}>
          No products found...
        </p>

        <ProductGrid products={filteredProducts.slice(maxPerPage * (page - 1), maxPerPage * page)} />

        <Pagination
          page={page}
          setPage={goToPage}
          numberOfPages={numberOfPages}
        />
      </div>
    </div>
  );
}