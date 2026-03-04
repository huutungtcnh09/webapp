FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS api-builder
WORKDIR /app/services/api
COPY services/api/package*.json ./
RUN npm ci --omit=dev
COPY services/api/ ./

FROM node:20-alpine AS runtime
WORKDIR /app/services/api
ENV NODE_ENV=production
ENV PORT=5000
COPY --from=api-builder /app/services/api /app/services/api
COPY --from=frontend-builder /app/frontend/dist /app/services/frontend/dist
EXPOSE 5000
CMD ["node", "index.js"]
