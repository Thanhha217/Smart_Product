import { useEffect, useRef, useState } from "react";

// Vega-Lite specs are written by the AI and sanitised by the assistant service
// (no remote data, no links). vega-embed is loaded from a CDN on first use so
// the main bundle and package.json stay unchanged.
const CDN_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/vega@5",
  "https://cdn.jsdelivr.net/npm/vega-lite@5",
  "https://cdn.jsdelivr.net/npm/vega-embed@6",
];

let loader = null;
function loadVegaEmbed() {
  if (window.vegaEmbed) return Promise.resolve(window.vegaEmbed);
  if (!loader) {
    loader = CDN_SCRIPTS.reduce(
      (chain, src) =>
        chain.then(
          () =>
            new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = src;
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            })
        ),
      Promise.resolve()
    ).then(() => window.vegaEmbed);
  }
  return loader;
}

export default function ChartView({ title, spec }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let view = null;
    let cancelled = false;
    loadVegaEmbed()
      .then((vegaEmbed) => {
        if (cancelled || !containerRef.current) return;
        return vegaEmbed(containerRef.current, spec, { actions: false, renderer: "svg" }).then((result) => {
          view = result.view;
        });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [spec]);

  return (
    <figure className="bg-white rounded-2xl p-4 shadow-sm">
      {title && <figcaption className="font-semibold mb-2">{title}</figcaption>}
      {error ? (
        <p className="text-sm text-gray-500">Chart unavailable.</p>
      ) : (
        <div ref={containerRef} className="w-full" />
      )}
    </figure>
  );
}
