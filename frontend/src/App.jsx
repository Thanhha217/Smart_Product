// import './App.css';
// import CategoriesContainer from './components/categories/CategoriesContainer.jsx';
// import SearchBar from "./components/search/SearchBar.jsx"

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header bg-primary-accent-900">
//         <h1 className="text-primary-accent-200">SMART PRODUCT FINDER</h1>
//         <p>Smart tag line</p>
//         <SearchBar />
//       </header>
      

//       <div className="App-categories">
//         <div className="h-20 w-20 bg-red-500 rounded-full m-10 shadow-2xl animate-bounce"></div>
//         <CategoriesContainer />
//       </div>
      
//     </div>
//   );
// }

// export default App;
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
// import Products from './pages/Products';

export default function App() {
  return (
    <BrowserRouter>
      {/* 1. Navigation bar stays visible on all pages */}
      {/* <nav className="p-4 bg-primary-200 flex gap-4">
        <Link to="/" className="text-primary-800 hover:underline">Home</Link>
        <Link to="/products" className="text-primary-800 hover:underline">Products</Link>
      </nav> */}

      {/* 2. The Router determines which component to show based on the URL */}
      <div className="">
        <Routes>
          <Route path="/" element={<Home />} />
          {/* <Route path="/products" element={<Products />} /> */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}