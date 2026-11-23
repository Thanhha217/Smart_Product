// Recently viewed products (product page visits), offered as suggestions in Compare and Cart.
// Never added anywhere automatically.
import { useEffect, useState } from "react";
import { normalizeProduct } from "./data";
import { readJson, writeJson } from "./storage";

const KEY = "spf.recent";
const EVENT = "spf-recent-change";
const MAX = 8;

export function getRecent() {
  const list = readJson(KEY, []);
  return Array.isArray(list) ? list.map(normalizeProduct).filter(Boolean) : [];
}

export function addRecent(product) {
  const p = normalizeProduct(product);
  if (!p) return;
  const list = [p, ...getRecent().filter((x) => x.product_id !== p.product_id)].slice(0, MAX);
  writeJson(KEY, list);
  window.dispatchEvent(new Event(EVENT));
}

export function useRecent() {
  const [list, setList] = useState(getRecent);
  useEffect(() => {
    const update = () => setList(getRecent());
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return list;
}
