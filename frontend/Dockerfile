# --- Build stage ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# VITE_* must be present at build time (baked into the static bundle).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# --- Serve stage ------------------------------------------------------------
FROM nginx:1.27-alpine AS serve
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
