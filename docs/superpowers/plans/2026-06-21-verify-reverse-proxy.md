# Verify Reverse Proxy Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm the frontend is configured in a reverse proxy architecture, routing all `/api/` calls dynamically through Nginx to the Railway-injected `API_TARGET_URL`. Adjust the `Host` header configuration to ensure compatibility with Railway's private network routing.

**Architecture:**
Nginx acts as the reverse proxy. Instead of hardcoding public API endpoints in the client browser code, the browser makes requests to `/api/...` (relative to the frontend). Nginx intercepts `/api/...` and proxies it to `API_TARGET_URL` (the backend's private domain).
*   **Host Header Correction:** We will remove `proxy_set_header Host $host;` in `nginx.conf`. This defaults the Host header to `$proxy_host` (the backend's private domain, e.g. `real-you-back-end.railway.internal:8080`), ensuring Railway's private DNS/mesh router maps the request correctly to the backend service.

**Tech Stack:** Nginx, Docker

---

### Task 1: Update Nginx Host Header Settings

**Files:**
- Modify: [nginx.conf](file:///D:/Repository/real-you/real-you-service-front-end/nginx.conf)

- [ ] **Step 1: Modify nginx.conf**
  Remove `proxy_set_header Host $host;` (or change to `$proxy_host`) in the `/api/` location block.
  
  ```nginx
  <<<<
      location /api/ {
          resolver ${DNS_RESOLVER} ipv6=on valid=1s;
          set $upstream_target ${API_TARGET_URL};
          proxy_pass $upstream_target;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
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
  >>>>
  ```

---

### Task 2: Verification & Commit

**Files:**
- None

- [ ] **Step 1: Build the Docker Image**
  Run: `docker build -t real-you-frontend-railway .`
  
- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add nginx.conf docs/superpowers/plans/2026-06-21-verify-reverse-proxy.md
  git commit -m "chore: default Nginx proxy Host header to proxy_host for Railway private routing compatibility"
  ```
