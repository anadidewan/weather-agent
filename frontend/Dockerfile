# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./
COPY src ./src

# Browser must reach the API on the host (published port). Override at build time.
ARG VITE_AGENT_BACKEND_URL=http://localhost:8000
ENV VITE_AGENT_BACKEND_URL=${VITE_AGENT_BACKEND_URL}

RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
