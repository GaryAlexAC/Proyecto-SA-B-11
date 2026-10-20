FROM node:22-alpine

WORKDIR /workspace
COPY . .
RUN npm ci --workspace=apps/api-gateway --include-workspace-root=false --ignore-scripts
RUN npm run build --workspace=packages/observability
RUN npm run build --workspace=apps/api-gateway

WORKDIR /workspace/apps/api-gateway
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
