import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import AppShell from './pages/components/layout/AppShell';
import System from './pages/System';
import Product from './pages/Product';
import Assistant from './pages/Assistant';
import AssistantPage from './pages/AssistantPage';
import Compare from './pages/Compare';
import TradeIn from './pages/TradeIn';
import Method from './pages/Method';
import Story from './pages/Story';
import World from './pages/World';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Order from './pages/Order';
import { setNavigator } from './webmcp';

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
      <div>
        <Routes>
          {/* Landing page has its own hero layout */}
          <Route path="/" element={<Home />} />

          {/* Every other page lives in the app shell: sidebar, top bar, mobile tab bar */}
          <Route element={<AppShell />}>
            {/* The CO2 world IS the overview now; /dashboard is kept so old links still land. */}
            <Route path="/dashboard" element={<Navigate to="/world" replace />} />
            <Route path="/system" element={<System />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/product/:productId" element={<Product />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/assistant/:id" element={<AssistantPage />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/trade-in" element={<TradeIn />} />
            <Route path="/method" element={<Method />} />
            <Route path="/world" element={<World />} />
            <Route path="/world/:productId" element={<World />} />
            <Route path="/story" element={<Story />} />
            <Route path="/story/:productId" element={<Story />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders/:id" element={<Order />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
