# Fix Upstream Connection Timeout in Nginx Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the upstream connection timeout issue in the Nginx proxy by implementing dynamic DNS resolution. This ensures Nginx re-resolves the backend's IP address when the backend service redeploys/restarts on Railway.

**Architecture:** 
1. **Dynamic IP Resolution:** In Nginx, a static domain name in `proxy_pass` is only resolved at startup. If the backend redeploys on Railway, its private IP changes, causing `110: Connection timed out`. By assigning `${API_TARGET_URL}` to a variable (`$upstream_target`) and specifying a `resolver` (Docker/Railway's DNS server `127.0.0.11`), Nginx will re-resolve the hostname at runtime and honor the DNS TTL.
2. **Port Check:** Advise the user to verify if the backend is actually listening on port `8080` (as in `http://10.162.170.77:8080`).

**Tech Stack:** Nginx, Docker

---

### Task 1: Update Nginx Configuration for Dynamic DNS Resolution

**Files:**
- Modify: [nginx.conf](file:///D:/Repository/real-you/real-you-service-front-end/nginx.conf)

- [ ] **Step 1: Modify nginx.conf**
  Update the `/api/` location block to use a variable for `proxy_pass` and configure the DNS resolver.
  
  ```nginx
  <<<<
      location /api/ {
          proxy_pass ${API_TARGET_URL};
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  ====
      location /api/ {
          resolver 127.0.0.11 valid=5s;
          set $upstream_target ${API_TARGET_URL};
          proxy_pass $upstream_target;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  >>>>
  ```

---

### Task 2: Verification and Commit

**Files:**
- None

- [ ] **Step 1: Build the Docker Image**
  Run: `docker build -t real-you-frontend-railway .`
  
- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add nginx.conf docs/superpowers/plans/2026-06-21-fix-upstream-timeout.md
  git commit -m "fix: resolve upstream connection timeouts by forcing dynamic DNS resolution in Nginx"
  ```
