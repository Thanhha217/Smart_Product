// Service health for the top bar: fetched once per page load (shared promise), never invented.
import { useEffect, useState } from "react";
import { api } from "../api/client";

let cached = null;

export function fetchHealthOnce() {
  if (!cached) cached = api.getHealth().catch(() => null);
  return cached;
}

/** {state: "unknown" | "ok" | "issues", issues: n}; "unknown" until a real answer arrives. */
export function summarizeHealth(health) {
  const services = Array.isArray(health?.services) ? health.services : null;
  if (!services) return { state: "unknown", issues: 0 };
  const issues = services.filter((s) => s && s.status !== "online").length;
  return { state: issues ? "issues" : "ok", issues };
}

export function useHealthSummary() {
  const [summary, setSummary] = useState({ state: "unknown", issues: 0 });
  useEffect(() => {
    let alive = true;
    fetchHealthOnce().then((h) => alive && setSummary(summarizeHealth(h)));
    return () => { alive = false; };
  }, []);
  return summary;
}
