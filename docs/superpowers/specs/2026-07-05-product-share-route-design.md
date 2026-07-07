# Spec: Product Share Route (Server-Rendered HTML Passthrough)

- **Date**: 2026-07-05
- **Topic**: Product Share Route

## 1. Goal
Provide a URL `/product/{id}/share` that returns the backend's server-rendered HTML for that product directly as the page content, so that link-preview crawlers (and any client opening the URL) receive fully-formed HTML with meta tags instead of the SPA's empty `index.html` shell.

## 2. Background & Constraint
This repository is a Vite-built SPA served as static files by nginx (see `Dockerfile`, `nginx.conf`). Vue Router only takes effect after the SPA's JavaScript has loaded in a browser, so a Vue Router route cannot change what a non-JS crawler receives, and cannot replace the HTTP response body with an upstream response body. Because of this, the passthrough must be implemented at the nginx layer, using the same reverse-proxy pattern already used for the existing `location /api/` block.

## 3. Requirements & Scope
- Requests to `/product/{id}/share` must be proxied to the backend endpoint `api/public/inventory/{id}/share` (same backend host as `${API_TARGET_URL}`, already used by the `/api/` proxy).
- The backend's response (HTML body, status code, headers) is returned to the client as-is — no post-processing, no User-Agent–based branching between bots and regular browsers. Every requester (crawler or human) sees identical content, per explicit product decision.
- This is a full-page-load-only URL: it is not part of in-app client-side navigation, so no changes are made to `src/router/index.js` or any Vue component.
- Out of scope: caching of share responses, custom error pages for non-200 backend responses (pass through unchanged, consistent with existing `/api/` behavior), and any change to backend code (backend is a separate service, not part of this repo).

## 4. Detailed Changes

### `nginx.conf`
Add a new regex `location` block that matches `/product/{id}/share` and proxies to the backend's share endpoint, mirroring the resolver/header conventions of the existing `location /api/` block:

```nginx
location ~ ^/product/([^/]+)/share$ {
    resolver ${DNS_RESOLVER} ipv6=on valid=1s;
    set $upstream_target ${API_TARGET_URL}/api/public/inventory/$1/share;
    proxy_pass $upstream_target;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Placement: added alongside the existing `location /api/` block, before or after it (regex locations take precedence over the prefix `location /` catch-all regardless of file order, so exact placement relative to `location /` does not affect matching behavior).

### Why this takes precedence over the SPA fallback
nginx evaluates regex locations (`~`) ahead of prefix locations like `location /`. Since `location /` uses `try_files $uri $uri/ /index.html;` to serve the SPA shell for any unmatched path, without this new regex block a request to `/product/{id}/share` would fall through to `index.html` and never reach the backend. Adding the regex location ensures this specific path is intercepted and proxied before the SPA fallback applies.

## 5. Verification
- Build and run the nginx container (or `docker build` + run, matching existing `Dockerfile`/`entrypoint.sh` flow) with `API_TARGET_URL` pointed at a backend (real or a local stub) that serves `api/public/inventory/{id}/share`.
- `curl http://localhost:<port>/product/123/share` and confirm the response body matches what `curl <API_TARGET_URL>/api/public/inventory/123/share` returns directly (same HTML, same status code).
- Confirm `/product/123` (without `/share`) still resolves to the SPA (`index.html`) and is unaffected.
