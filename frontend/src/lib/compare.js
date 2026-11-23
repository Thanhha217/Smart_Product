// Compare list kept in the browser (max 4), shared by every page through an event.
import { useEffect, useState } from "react";
import { normalizeProduct } from "./data";
import { readJson, writeJson } from "./storage";

const KEY = "spf.compare";
const EVENT = "spf-compare-change";
export const COMPARE_MAX = 4;

export function getCompare() {
  const list = readJson(KEY, []);
  return Array.isArray(list) ? list.map(normalizeProduct).filter(Boolean).slice(0, COMPARE_MAX) : [];
}

function save(list) {
  writeJson(KEY, list);
  window.dispatchEvent(new Event(EVENT));
}

/** Adds a product; returns "added" | "duplicate" | "full" | "invalid". */
export function addToCompare(product) {
  const p = normalizeProduct(product);
  if (!p) return "invalid";
  const list = getCompare();
  if (list.some((x) => x.product_id === p.product_id)) return "duplicate";
  if (list.length >= COMPARE_MAX) return "full";
  save([...list, p]);
  return "added";
}

export function removeFromCompare(productId) {
  save(getCompare().filter((x) => x.product_id !== String(productId)));
}

export function setCompareIds(products) {
  save(products.map(normalizeProduct).filter(Boolean).slice(0, COMPARE_MAX));
}

export function clearCompare() {
  save([]);
}

export function useCompare() {
  const [list, setList] = useState(getCompare);
  useEffect(() => {
    const update = () => setList(getCompare());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return list;
}
