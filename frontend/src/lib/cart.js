// Test-mode cart kept in the browser. Items are ProductCard snapshots + quantity.
import { useEffect, useState } from "react";
import { readJson, writeJson } from "./storage";

const KEY = "spf.cart";
const EVENT = "spf-cart-change";

export function getCart() {
  const items = readJson(KEY, []);
  return Array.isArray(items) ? items : [];
}

function save(items) {
  writeJson(KEY, items);
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(product, quantity = 1) {
  if (!product || !product.product_id) return getCart();
  const items = getCart();
  const found = items.find((i) => String(i.product.product_id) === String(product.product_id));
  if (found) found.quantity += quantity;
  else items.push({ product, quantity });
  save(items);
  return items;
}

export function setQuantity(productId, quantity) {
  const items = getCart()
    .map((i) => (String(i.product.product_id) === String(productId) ? { ...i, quantity } : i))
    .filter((i) => i.quantity > 0);
  save(items);
}

export function replaceInCart(oldId, product) {
  const items = getCart().map((i) =>
    String(i.product.product_id) === String(oldId) ? { product, quantity: i.quantity } : i
  );
  save(items);
}

export function clearCart() {
  save([]);
}

export function cartTotals(items) {
  let vnd = 0;
  let co2 = 0;
  let missing = 0;
  for (const { product, quantity } of items) {
    vnd += (product.price_vnd || 0) * quantity;
    if (product.co2e_kg === null || product.co2e_kg === undefined) missing += 1;
    else co2 += product.co2e_kg * quantity;
  }
  return { vnd, co2, missing };
}

export function useCart() {
  const [items, setItems] = useState(getCart);
  useEffect(() => {
    const update = () => setItems(getCart());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return items;
}
