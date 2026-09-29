import { BrowserRouter, Routes, Route, Link, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Header from './pages/components/header/Header';
import Product from './pages/Product';
import Assistant from './pages/Assistant';

function LayoutWithHeader() {
  return (
    <>
      <Header />
      <Outlet/>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="">
        <Routes>
          {/* Home route doesn't have the Layout, so no header will render */}
          <Route path="/" element={<Home />} />

          {/* Group routes that require a header under the Layout parent */}
          <Route element={<LayoutWithHeader />}>
            <Route path="/search" element={<SearchResults />} />
            <Route path="/product/:productId" element={<Product />} />
            <Route path="/assistant" element={<Assistant />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}