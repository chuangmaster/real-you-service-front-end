# Product Share Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/product/{id}/share` return the backend's server-rendered HTML (from `api/public/inventory/{id}/share`) directly as the response body, bypassing the SPA shell, so crawlers and browsers alike get real HTML/meta tags.

**Architecture:** Add a regex `location` block to `nginx.conf` that proxies `/product/{id}/share` straight to the backend's share endpoint, reusing the same resolver/proxy-header pattern as the existing `location /api/` block. Regex locations in nginx take precedence over the prefix `location /` SPA catch-all, so this path never falls through to `index.html`. No Vue Router or Vue component changes are needed.

**Tech Stack:** Nginx (config template rendered via `envsubst` at container start — see `entrypoint.sh`/`Dockerfile`), Docker.

## Global Constraints

- Backend response (HTML body, status code, headers) must be passed through unchanged — no post-processing, no User-Agent branching (per spec: `docs/superpowers/specs/2026-07-05-product-share-route-design.md`).
- `/product/{id}` (without `/share`) must continue to serve the SPA shell (`index.html`) unaffected.
- No changes to `src/router/index.js` or any `.vue` file — this route is nginx-only.

---

### Task 1: Add the `/product/{id}/share` proxy location to nginx.conf

**Files:**
- Modify: `nginx.conf`

**Interfaces:**
- Consumes: existing template variables `${DNS_RESOLVER}` and `${API_TARGET_URL}`, already substituted at container start by `entrypoint.sh` → `/docker-entrypoint.sh` (envsubst on `nginx.conf` template), same as the existing `location /api/` block.
- Produces: nothing consumed by later tasks — Task 2 verifies this file's behavior only.

- [ ] **Step 1: Edit nginx.conf to add the new location block**

Add a new `location` block for `/product/{id}/share`, placed after the existing `location /api/` block:

```nginx
<<<<
    location /api/ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL};
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 500 502 503 504 /50x.html;
====
    location /api/ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL};
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/product/([^/]+)/share$ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL}/api/public/inventory/$1/share;
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 500 502 503 504 /50x.html;
>>>>
```

The resulting file should read (full `server` block):

```nginx
server {
    listen ${PORT};
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL};
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/product/([^/]+)/share$ {
        resolver ${DNS_RESOLVER} ipv6=on valid=1s;
        set $upstream_target ${API_TARGET_URL}/api/public/inventory/$1/share;
        proxy_pass $upstream_target;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

---

### Task 2: Verify the proxy behavior end-to-end and commit

**Files:**
- None (verification only; commits Task 1's change)

There is no existing automated test suite in this repo (pure static frontend, no test framework configured). Verification is done by building the real Docker image, running it against a stub backend on a Docker network, and curling both the new share route and the untouched SPA route.

- [ ] **Step 1: Write the stub backend server**

Create `/private/tmp/claude-501/-Users-zander-Repository-real-you-service-front-end/cafb64e9-b54b-40c4-bf13-30c1f07612e1/scratchpad/stub_server.py`:

```python
from http.server import BaseHTTPRequestHandler, HTTPServer

HTML = b"<html><head><title>Stub Share Page</title></head><body>stub-share-ok</body></html>"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(HTML)


HTTPServer(("0.0.0.0", 80), Handler).serve_forever()
```

This stub answers any GET request with the same fixed HTML body, regardless of path — enough to prove the proxy reaches it and passes the body through untouched.

- [ ] **Step 2: Build the frontend Docker image**

Run: `docker build -t real-you-frontend-share-test .`
Expected: build completes successfully (`Successfully tagged real-you-frontend-share-test:latest` or equivalent final line).

- [ ] **Step 3: Create an isolated Docker network**

Run: `docker network create share-route-test-net`
Expected: prints a network ID, no error.

- [ ] **Step 4: Start the stub backend container on that network**

Run:
```bash
docker run -d --rm \
  --name stub-backend \
  --network share-route-test-net \
  -v /private/tmp/claude-501/-Users-zander-Repository-real-you-service-front-end/cafb64e9-b54b-40c4-bf13-30c1f07612e1/scratchpad/stub_server.py:/stub_server.py:ro \
  python:3-alpine \
  python3 /stub_server.py
```
Expected: prints a container ID, no error.

- [ ] **Step 5: Start the frontend container pointed at the stub**

Run:
```bash
docker run -d --rm \
  --name share-route-frontend \
  --network share-route-test-net \
  -p 8081:80 \
  -e API_TARGET_URL=http://stub-backend:80 \
  real-you-frontend-share-test
```
Expected: prints a container ID, no error. Give it ~2 seconds to finish nginx startup before curling.

- [ ] **Step 6: Curl the new share route and verify passthrough**

Run: `curl -s http://localhost:8081/product/123/share`
Expected output (exact body from the stub, proving the proxy forwarded the request and returned the backend's HTML untouched):
```html
<html><head><title>Stub Share Page</title></head><body>stub-share-ok</body></html>
```

- [ ] **Step 7: Curl the plain product route and verify the SPA shell is unaffected**

Run: `curl -s http://localhost:8081/product/123`
Expected: output contains `<div id="app"></div>` (the SPA shell from `index.html`) and does **not** contain `stub-share-ok`. This confirms the new regex location did not swallow the existing SPA catch-all route.

- [ ] **Step 8: Tear down the test containers and network**

Run:
```bash
docker stop share-route-frontend stub-backend
docker network rm share-route-test-net
```
Expected: both container names printed (stopped), network name printed (removed), no error.

- [ ] **Step 9: Commit**

```bash
git add nginx.conf docs/superpowers/plans/2026-07-06-product-share-route.md
git commit -m "$(cat <<'EOF'
feat: proxy /product/{id}/share to backend HTML for crawler meta tags

EOF
)"
```
