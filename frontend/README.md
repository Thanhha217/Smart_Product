# Getting started with the frontend

## Prerequisites
- Node.js (version 20 or higher)
- npm (Node package manager)

## Setup
1. Change directory to the frontend folder:
```bash
cd frontend
```

2. Install the required dependencies:
```bash
npm install
```

## Running the frontend
To start the frontend development server, run the following command:
```bash
npm run dev
```

This will start the development server and open the application in your default web browser. The frontend will be available at `http://localhost:5173`.

## Demo pages (B1 AI page, B3 test checkout, WebMCP)

Routes: `/assistant` (ask by text/voice) → `/assistant/:id` (AI-generated page), `/compare?ids=a,b`, `/method`,
`/cart`, `/checkout` (simulated payment only), `/orders/:id`. All calls go through `src/api/client.js`
(contract: `docs/demo/api-contract.md`).

Run without any backend, on fixture data (`src/api/mock.js`):

```bash
VITE_MOCK_API=1 npm run dev          # PowerShell: $env:VITE_MOCK_API="1"; npm run dev
```

`src/webmcp.js` registers the site tools (search_products, get_product_co2, compare_products, ask_ai_page,
add_to_test_cart) with `navigator.modelContext` when the browser supports WebMCP; otherwise it does nothing.
