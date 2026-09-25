FROM node:22-alpine AS build

WORKDIR /workspace
COPY . .
RUN npm ci --workspace=frontend --include-workspace-root=false --ignore-scripts
ARG VITE_API_GATEWAY_URL
ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL
RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 8080
