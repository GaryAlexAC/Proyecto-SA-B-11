FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci
RUN npm --workspace @bank-usac/customer-service run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "--workspace", "@bank-usac/customer-service", "run", "start:prod"]
