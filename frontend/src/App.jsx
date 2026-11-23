import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Header from './pages/components/header/Header';
import Product from './pages/Product';
import Assistant from './pages/Assistant';
import AssistantPage from './pages/AssistantPage';
import Compare from './pages/Compare';
import Method from './pages/Method';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Order from './pages/Order';
import { setNavigator } from './webmcp';

function LayoutWithHeader() {
  return (
    <>
      <Header />
      <Outlet/>
    </>
  );
}

// Lets WebMCP tools navigate inside the SPA.
function NavigatorBridge() {
  const navigate = useNavigate();
  useEffect(() => setNavigator(navigate), [navigate]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <NavigatorBridge />
      <div className="">
        <Routes>
          {/* Home route doesn't have the Layout, so no header will render */}
          <Route path="/" element={<Home />} />

          {/* Group routes that require a header under the Layout parent */}
          <Route element={<LayoutWithHeader />}>
            <Route path="/search" element={<SearchResults />} />
            <Route path="/product/:productId" element={<Product />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/assistant/:id" element={<AssistantPage />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/method" element={<Method />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders/:id" element={<Order />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
