import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Header from './pages/components/header/Header';
import Product from './pages/Product';

export default function App() {
  return (
    <BrowserRouter>
      {/* 1. Navigation bar stays visible on all pages */}
      {/* <nav className="p-4 bg-primary-200 flex gap-4">
        <Link to="/" className="text-primary-800 hover:underline">Home</Link>
        <Link to="/products" className="text-primary-800 hover:underline">Products</Link>
      </nav> */}

      <Header />

      {/* 2. The Router determines which component to show based on the URL */}
      <div className="">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/q" element={<SearchResults />} />
          <Route path="/p/:productId" element={<Product />} />
          {/* <Route path="/products" element={<Products />} /> */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}