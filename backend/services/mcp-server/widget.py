"""Self-contained HTML widget: product cards with kg CO2e and the 0-5 green score.

Served twice from the same markup:
* ``ui://widget/products.html``  as ``text/html+skybridge`` for the ChatGPT Apps SDK
  (tool ``_meta["openai/outputTemplate"]``); data comes from ``window.openai.toolOutput``.
* ``ui://widget/products-app.html`` as ``text/html;profile=mcp-app`` for MCP Apps hosts
  (tool ``_meta.ui.resourceUri``); data comes from the ``ui/notifications/tool-result``
  message posted by the host.
No external scripts, styles or images.
"""

SKYBRIDGE_URI = "ui://widget/products.html"
SKYBRIDGE_MIME = "text/html+skybridge"
MCP_APP_URI = "ui://widget/products-app.html"

PRODUCTS_HTML = r"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --bg:#fff; --fg:#1f2937; --muted:#6b7280; --card:#f9fafb; --line:#e5e7eb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111827; --fg:#f3f4f6; --muted:#9ca3af; --card:#1f2937; --line:#374151; } }
  body { margin:0; padding:12px; font:14px/1.4 system-ui, sans-serif; background:var(--bg); color:var(--fg); }
  .grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:6px; }
  .name { font-weight:600; }
  .price { color:var(--muted); }
  .co2 { font-size:18px; font-weight:700; }
  .pill { align-self:flex-start; border-radius:999px; padding:2px 8px; font-size:12px; color:#fff; }
  .src { font-size:12px; color:var(--muted); }
  .best { outline:2px solid #16a34a; }
  a { color:#16a34a; }
  .foot { margin-top:10px; font-size:12px; color:var(--muted); }
</style>
</head>
<body>
<div id="root"><p class="src">Đang tải…</p></div>
<script>
(function () {
  function fmt(x, d) {
    if (x === null || x === undefined) return "–";
    if (d === undefined) d = Math.abs(x) >= 1 ? (Number.isInteger(x) ? 0 : 1) : 2;
    return Number(x).toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function color(score) {
    if (score === null || score === undefined) return "#9ca3af";
    var hue = Math.round(Math.max(0, Math.min(5, score)) / 5 * 120);   // red -> green
    return "hsl(" + hue + ",65%,38%)";
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
  function render(data) {
    if (!data) return;
    var products = data.products || [];
    var root = document.getElementById("root");
    if (!products.length) { root.innerHTML = "<p class='src'>Không có sản phẩm.</p>"; return; }
    var best = data.greenest_product_id || (data.best && data.best.co2e_kg);
    var html = "<div class='grid'>";
    products.forEach(function (p) {
      var co2 = p.co2e_kg === null || p.co2e_kg === undefined
        ? "<div class='co2'>Chưa có số CO₂</div>"
        : "<div class='co2'>" + fmt(p.co2e_kg) + " kg CO₂e</div>" +
          (p.green_score === null || p.green_score === undefined ? "" :
           "<span class='pill' style='background:" + color(p.green_score) + "'>Điểm xanh " + fmt(p.green_score, 1) + "/5</span>");
      html += "<div class='card" + (String(p.product_id) === String(best) ? " best" : "") + "'>" +
        "<div class='name'>" + esc(p.name) + "</div>" +
        "<div class='price'>" + fmt(p.price_vnd, 0) + " đ" + (p.platform ? " · " + esc(p.platform) : "") + "</div>" +
        co2 +
        "<div class='src'>Nguồn: " + esc(p.source_label) + (p.co2e_confidence != null ? " · tin cậy " + fmt(p.co2e_confidence, 2) : "") + "</div>" +
        (p.url ? "<a href='" + encodeURI(p.url) + "' target='_blank' rel='noopener'>Xem chi tiết</a>" : "") +
        "</div>";
    });
    html += "</div>";
    var links = [];
    if (data.ai_page_url) links.push("<a href='" + encodeURI(data.ai_page_url) + "' target='_blank' rel='noopener'>Trang phân tích AI</a>");
    if (data.compare_url) links.push("<a href='" + encodeURI(data.compare_url) + "' target='_blank' rel='noopener'>Bảng so sánh</a>");
    if (data.method_url) links.push("<a href='" + encodeURI(data.method_url) + "' target='_blank' rel='noopener'>Cách tính CO₂</a>");
    html += "<div class='foot'>Số CO₂ lấy từ cơ sở dữ liệu Smart Product Finder. " + links.join(" · ") + "</div>";
    root.innerHTML = html;
  }

  // ChatGPT Apps SDK
  if (window.openai && window.openai.toolOutput) render(window.openai.toolOutput);
  window.addEventListener("openai:set_globals", function (e) {
    var g = (e && e.detail && e.detail.globals) || {};
    if (g.toolOutput) render(g.toolOutput);
  });

  // MCP Apps (best effort): handshake, then wait for the tool result.
  var nextId = 1;
  function send(msg) { try { window.parent.postMessage(msg, "*"); } catch (err) {} }
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id === 1 && m.result) send({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
    if (m.method === "ui/notifications/tool-result" && m.params) {
      render(m.params.structuredContent || m.params.structured_content);
    }
  });
  if (!window.openai && window.parent !== window) {
    send({ jsonrpc: "2.0", id: nextId++, method: "ui/initialize",
           params: { appInfo: { name: "smart-product-finder-widget", version: "1.0.0" }, appCapabilities: {} } });
  }
})();
</script>
</body>
</html>
"""
