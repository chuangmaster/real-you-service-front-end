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
