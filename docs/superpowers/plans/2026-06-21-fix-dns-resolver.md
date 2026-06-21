# Fix Docker DNS Resolver for Railway Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the Nginx `111: Connection refused` DNS resolver error by dynamically extracting the container's system DNS nameserver at runtime and injecting it into Nginx's configuration.

**Architecture:**
Nginx does not use `/etc/resolv.conf` by default when variables are used in `proxy_pass`. Hardcoding `127.0.0.11` fails because Railway's container network does not use the default Docker bridge DNS.
We will create a lightweight `entrypoint.sh` script that:
1. Parses `/etc/resolv.conf` at startup to extract the active nameserver IP.
2. Exports it as the `DNS_RESOLVER` environment variable (falling back to `8.8.8.8` if not found).
3. Handsoff execution to Nginx's official `/docker-entrypoint.sh` which processes our configuration template to replace `${DNS_RESOLVER}`.

**Tech Stack:** Docker, Nginx, Bash/Shell

---

### Task 1: Create Entrypoint Script

**Files:**
- Create: `entrypoint.sh`

- [ ] **Step 1: Write entrypoint.sh**
  Create `entrypoint.sh` in the root of the project to dynamically extract the system DNS resolver.
  
  ```bash
  #!/bin/sh
  export DNS_RESOLVER=$(awk '/nameserver/{print $2; exit}' /etc/resolv.conf)
  export DNS_RESOLVER=${DNS_RESOLVER:-8.8.8.8}
  exec /docker-entrypoint.sh "$@"
  ```

---

### Task 2: Update Nginx Configuration Template

**Files:**
- Modify: [nginx.conf](file:///D:/Repository/real-you/real-you-service-front-end/nginx.conf)

- [ ] **Step 1: Modify nginx.conf**
  Replace the hardcoded `127.0.0.11` resolver with the `${DNS_RESOLVER}` template variable.
  
  ```nginx
  <<<<
      location /api/ {
          resolver 127.0.0.11 valid=5s;
          set $upstream_target ${API_TARGET_URL};
          proxy_pass $upstream_target;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  ====
      location /api/ {
          resolver ${DNS_RESOLVER} valid=5s;
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

### Task 3: Update Dockerfile to run entrypoint.sh

**Files:**
- Modify: [Dockerfile](file:///D:/Repository/real-you/real-you-service-front-end/Dockerfile)

- [ ] **Step 1: Modify Dockerfile**
  Add `entrypoint.sh` to the production stage of the build and set it as the container's ENTRYPOINT.
  
  ```dockerfile
  <<<<
  # Production Stage
  FROM nginx:stable-alpine AS production-stage
  COPY --from=build-stage /app/dist /usr/share/nginx/html
  
  # Copy configuration as a template for environment variable substitution
  COPY nginx.conf /etc/nginx/templates/default.conf.template
  
  # Define environment variables (which Railway will override at runtime)
  ENV PORT=80
  ENV API_TARGET_URL=http://localhost:5176

  EXPOSE $PORT
  CMD ["nginx", "-g", "daemon off;"]
  ====
  # Production Stage
  FROM nginx:stable-alpine AS production-stage
  COPY --from=build-stage /app/dist /usr/share/nginx/html
  
  # Copy configuration as a template for environment variable substitution
  COPY nginx.conf /etc/nginx/templates/default.conf.template
  
  # Copy the entrypoint script and make it executable
  COPY entrypoint.sh /entrypoint.sh
  RUN chmod +x /entrypoint.sh

  # Define environment variables (which Railway will override at runtime)
  ENV PORT=80
  ENV API_TARGET_URL=http://localhost:5176

  EXPOSE $PORT
  ENTRYPOINT ["/entrypoint.sh"]
  CMD ["nginx", "-g", "daemon off;"]
  >>>>
  ```

---

### Task 4: Verification & Commit

**Files:**
- None

- [ ] **Step 1: Build the Docker Image**
  Run: `docker build -t real-you-frontend-railway .`
  
- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add entrypoint.sh nginx.conf Dockerfile docs/superpowers/plans/2026-06-21-fix-dns-resolver.md
  git commit -m "fix: dynamically resolve DNS nameservers from /etc/resolv.conf at runtime"
  ```
