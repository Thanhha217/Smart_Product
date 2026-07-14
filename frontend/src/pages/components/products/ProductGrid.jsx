import { useState } from "react";
import ProductSlot from "./ProductSlot"; // Adjust path accordingly


export default function ProductGrid({products}) {
  // Generate 8 mock items on initialization
  

  return (
    <div className="w-full p-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((item) => (
          <ProductSlot 
            key={item.product.id}
            product={item.product}
            image_url={item.image_url}
            platform_name={item.platform_name}
          />
        ))}
      </div>
    </div>
  );
}