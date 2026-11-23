// Test-mode cart kept in the browser. Items are ProductCard snapshots + quantity.
import { useEffect, useState } from "react";
import { co2Scope, normalizeProduct, num, price } from "./data";
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

export function addToCart(raw, quantity = 1) {
  const product = normalizeProduct(raw);
  if (!product) return getCart();
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

/**
 * Totals that never pretend: a product without a price is counted in missingPrice (not as 0 ₫),
 * and CO2 only adds figures of the same cradle-to-grave scope; the others are counted apart.
 */
export function cartTotals(items) {
  let vnd = 0;
  let co2 = 0;
  let missingPrice = 0;
  let missing = 0;          // products without a CO2 figure
  let otherScope = 0;       // price-based (cradle-to-shelf) figures, not added to the lifecycle total
  let units = 0;
  for (const { product, quantity } of items) {
    const q = Math.max(0, Number(quantity) || 0);
    units += q;
    const p = price(product?.price_vnd);
    if (p === null) missingPrice += 1;
    else vnd += p * q;
    const kg = num(product?.co2e_kg);
    if (kg === null) missing += 1;
    else if (co2Scope(product) === "cradle_to_shelf") otherScope += 1;
    else co2 += kg * q;
  }
  return { vnd, co2, missing, missingPrice, otherScope, units, complete: missingPrice === 0 };
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
