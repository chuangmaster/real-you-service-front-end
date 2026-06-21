# Containerize Web Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Dockerfile, Nginx configuration, and .dockerignore file to containerize the frontend application for production-ready deployment.

**Architecture:** A multi-stage Docker build is used. The first stage uses a Node Alpine image to install dependencies and compile the static assets with `npm run build`. The second stage copies the compiled files to an Nginx Alpine image, using a custom Nginx configuration to support SPA routing (Vite HTML5 History Mode) by routing unfound requests to `index.html`.

**Tech Stack:** Docker, Nginx, Node.js

---

### Task 1: Create Nginx Configuration

**Files:**
- Create: `nginx.conf`

- [ ] **Step 1: Write nginx.conf**
  Create `nginx.conf` to serve static files and route fallback requests for SPA (Single Page Application) routing.
  
  ```nginx
  server {
      listen 80;
      server_name localhost;

      location / {
          root /usr/share/nginx/html;
          index index.html index.htm;
          try_files $uri $uri/ /index.html;
      }

      error_page 500 502 503 504 /50x.html;
      location = /50x.html {
          root /usr/share/nginx/html;
      }
  }
  ```

---

### Task 2: Create .dockerignore

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Write .dockerignore**
  Create `.dockerignore` to optimize docker build context.
  
  ```
  node_modules
  dist
  .git
  .gitignore
  .vscode
  docs
  *.md
  ```

---

### Task 3: Create Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write Dockerfile**
  Create the multi-stage `Dockerfile`.
  
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
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```

---

### Task 4: Verification and Commit

**Files:**
- None

- [ ] **Step 1: Build the Docker Image locally**
  Run: `docker build -t real-you-frontend .`
  
- [ ] **Step 2: Commit the changes**
  Run:
  ```bash
  git add nginx.conf .dockerignore Dockerfile docs/superpowers/plans/2026-06-21-containerize-project.md
  git commit -m "feat: add Dockerfile and Nginx configuration for containerization"
  ```
