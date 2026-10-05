# Stage 1: Build the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm (версия пиннится полем packageManager в package.json)
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy project files
COPY . .

ARG COMMIT_HASH=unknown
ENV COMMIT_HASH=$COMMIT_HASH
# SYNC-V2: build-arg должен быть объявлен как ARG и прокинут в ENV,
# иначе vite соберёт с VITE_SYNC_V2=false и вырежет V2-код (DS-элиминация)
ARG VITE_SYNC_V2=false
ENV VITE_SYNC_V2=$VITE_SYNC_V2

# Build the project
RUN pnpm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy nginx config
COPY .docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3980

CMD ["nginx", "-g", "daemon off;"]
