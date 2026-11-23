import os
import requests

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dto.gateway_dto import AssistantPayload, ImagePayload
app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Hello World"}

RANKING_SYSTEM_URL = os.environ.get("RANKING_SYSTEM_URL")
DB_SEARCH_URL = os.environ.get("DB_SEARCH_URL")

if not RANKING_SYSTEM_URL:
    raise ValueError("RANKING_SYSTEM_URL environment variable is not set")

if not DB_SEARCH_URL:
    raise ValueError("DB_SEARCH_URL environment variable is not set")


@app.post("/query")
async def query_endpoint(q: str = None, limit: int = 32, payload: Optional[ImagePayload] = None):

    # First of all, retrieve the products ids from the ranking system after passing the query to it
    try:
        image_base64 = payload.image if payload else None

        ranking_url = f"{DB_SEARCH_URL}/query?limit={limit}"
        if q and q != "None":
            ranking_url += f"&q={q}"

        json_data = {"image": image_base64} if image_base64 else {}

        response = requests.post(ranking_url, json=json_data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the ranking system")
        
    products_data = response.json()
    return {"products": products_data}

# Optional: the AI assistant service. Left unset, /assistant answers 503 and
# the rest of the gateway keeps working.
ASSISTANT_URL = os.environ.get("ASSISTANT_URL")


@app.post("/assistant")
def assistant_endpoint(payload: AssistantPayload):
    if not ASSISTANT_URL:
        raise HTTPException(status_code=503, detail="Assistant service is not configured")
    try:
        response = requests.post(f"{ASSISTANT_URL}/assistant", json=payload.model_dump(), timeout=300)
        response.raise_for_status()
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=502, detail="Error communicating with the assistant service")
    return response.json()


@app.get("/product/{product_id}")
def product_endpoint(product_id: str):

    try:
        request = f"{DB_SEARCH_URL}/product/{product_id}"
        response = requests.get(request)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with the db-search service")
    
    product_data = response.json()
    return {"product": product_data}

# =====================================================================================
# /api/* for the AI page, compare page, test checkout and MCP server
# (docs/demo/api-contract.md). The gateway only forwards: status code and JSON body
# are passed through unchanged.
# =====================================================================================
from fastapi import Request
from fastapi.responses import JSONResponse


def _forward(method: str, url: str, request: Request | None = None, json_body=None, timeout: float = 120):
    headers = {}
    if request is not None and request.headers.get("x-confirm-source"):
        headers["X-Confirm-Source"] = request.headers["x-confirm-source"]
    params = dict(request.query_params) if request is not None else None
    try:
        response = requests.request(method, url, params=params, json=json_body, headers=headers, timeout=timeout)
    except requests.exceptions.RequestException:
        return JSONResponse(status_code=502, content={"error": {"code": "upstream_unavailable",
                                                                "message": "Upstream service unavailable"}})
    try:
        body = response.json()
    except ValueError:
        body = {"error": {"code": "bad_upstream_response", "message": response.text[:200]}}
    return JSONResponse(status_code=response.status_code, content=body)


def _assistant_url():
    if not ASSISTANT_URL:
        return None
    return ASSISTANT_URL.rstrip("/")


def _no_assistant():
    return JSONResponse(status_code=503, content={"error": {"code": "assistant_not_configured",
                                                            "message": "Assistant service is not configured"}})


@app.get("/api/products/{product_id}/related")
def api_related(product_id: str, request: Request):
    return _forward("GET", f"{DB_SEARCH_URL}/products/{product_id}/related", request)


@app.get("/api/categories/{category}/stats")
def api_category_stats(category: str, request: Request):
    return _forward("GET", f"{DB_SEARCH_URL}/categories/{category}/stats", request)


@app.get("/api/search")
def api_search(request: Request):
    return _forward("GET", f"{DB_SEARCH_URL}/search", request, timeout=30)


@app.get("/api/categories")
def api_categories(request: Request):
    return _forward("GET", f"{DB_SEARCH_URL}/categories", request, timeout=30)


@app.get("/api/overview")
def api_overview(request: Request):
    return _forward("GET", f"{DB_SEARCH_URL}/stats/overview", request, timeout=120)


HEALTH_TARGETS = [
    ("db-search", "Cơ sở dữ liệu & tìm kiếm", lambda: f"{DB_SEARCH_URL}/docs"),
    ("ranking", "Xếp hạng CatBoost + RRF", lambda: f"{RANKING_SYSTEM_URL}/"),
    ("clip", "OpenCLIP (so độ giống)", lambda: f"{os.environ.get('OPEN_CLIP_PROVIDER_URL', 'http://smartproductfinder-backend-clip-provider:8067')}/"),
    ("etl", "ETL + tính CO₂", lambda: os.environ.get("ETL_WORKER_URL", "http://smartproductfinder-backend-etl-worker:8001") + "/docs"),
    ("assistant", "AI giải thích & trang AI", lambda: f"{(ASSISTANT_URL or '').rstrip('/')}/api/llm" if ASSISTANT_URL else None),
    ("mcp", "MCP cho ChatGPT", lambda: os.environ.get("MCP_URL", "http://smartproductfinder-mcp-server:8100") + "/healthz"),
]


def _probe(key, name, url_fn):
    import time as _time
    url = url_fn()
    if not url:
        return {"key": key, "name": name, "status": "offline", "latency_ms": None, "detail": "not configured"}
    started = _time.monotonic()
    try:
        r = requests.get(url, timeout=2)
        detail = None
        if key == "assistant" and r.ok:
            detail = r.json().get("model")
        return {"key": key, "name": name, "status": "online" if r.status_code < 500 else "offline",
                "latency_ms": int((_time.monotonic() - started) * 1000), "detail": detail}
    except (requests.exceptions.RequestException, ValueError):
        return {"key": key, "name": name, "status": "offline", "latency_ms": None, "detail": None}


@app.get("/api/health")
def api_health():
    from concurrent.futures import ThreadPoolExecutor
    from datetime import datetime, timezone
    with ThreadPoolExecutor(max_workers=len(HEALTH_TARGETS)) as pool:
        services = list(pool.map(lambda t: _probe(*t), HEALTH_TARGETS))
    services.insert(0, {"key": "gateway", "name": "API gateway", "status": "online", "latency_ms": 0, "detail": None})
    return {"services": services, "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


@app.api_route("/api/{path:path}", methods=["GET", "POST"])
async def api_assistant(path: str, request: Request):
    """Everything else under /api goes to the assistant service (pages, co2, compare, method, test orders)."""
    base = _assistant_url()
    if base is None:
        return _no_assistant()
    body = None
    if request.method == "POST":
        raw = await request.body()
        body = await request.json() if raw else None
    timeout = 300 if path == "assistant" else 60
    import anyio
    return await anyio.to_thread.run_sync(lambda: _forward(request.method, f"{base}/api/{path}", request, body, timeout))
