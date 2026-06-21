# Parameterize API Target URL and Port for Railway Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the API target URL and the listening Port into parameters in the Dockerfile to support seamless containerized deployment on Railway.

**Architecture:** Use the official Nginx template processing feature (`envsubst`). The Nginx configuration in the Docker image is written as a template `default.conf.template` under `/etc/nginx/templates/`. The template references the variables `${PORT}` and `${API_TARGET_URL}`. The `Dockerfile` exposes `ENV PORT` and `ENV API_TARGET_URL` with default values. When the container starts on Railway, Nginx's entrypoint script replaces the placeholders in the template with the runtime environment variables (including the dynamic port injected by Railway) and writes the final configuration to `/etc/nginx/conf.d/default.conf`.

**Tech Stack:** Docker, Nginx, Railway

---

### Task 1: Update Nginx Configuration to Template with Dynamic Port

**Files:**
- Modify: [nginx.conf](file:///D:/Repository/real-you/real-you-service-front-end/nginx.conf)

- [ ] **Step 1: Modify nginx.conf**
  Change the listen port from `80` to `${PORT}` and proxy target to `${API_TARGET_URL}`.
  
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
          proxy_pass ${API_TARGET_URL};
          proxy_set_header Host $host;
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

### Task 2: Update Dockerfile to support PORT and API_TARGET_URL

**Files:**
- Modify: [Dockerfile](file:///D:/Repository/real-you/real-you-service-front-end/Dockerfile)

- [ ] **Step 1: Modify Dockerfile**
  Update the Dockerfile to declare `ARG` and `ENV` parameters for both `PORT` and `API_TARGET_URL`, copy the config as a template, and expose the dynamic port.
  
  ```dockerfile
  # Build Stage
  FROM node:20-alpine AS build-stage
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

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
  ```

---

### Task 3: Verification & Commit

**Files:**
- None

- [ ] **Step 1: Build the Docker Image**
  Run: `docker build -t real-you-frontend-railway .`
  
- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add nginx.conf Dockerfile docs/superpowers/plans/2026-06-21-docker-api-parameter.md
  git commit -m "feat: configure dynamic port and API URL parameters for Railway deployment"
  ```
