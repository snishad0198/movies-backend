FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

# Source files
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# On start, automatically synchronize database schema and launch production server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node ./scripts/seed-if-needed.js 2>/dev/null || true && npm run start"]
