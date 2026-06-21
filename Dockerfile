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

# Copy the entrypoint script and make it executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Define environment variables (which Railway will override at runtime)
ENV PORT=80
ENV API_TARGET_URL=http://localhost:5176

EXPOSE $PORT
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
