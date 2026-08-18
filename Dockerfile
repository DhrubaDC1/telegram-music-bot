FROM node:22-bookworm-slim

WORKDIR /app

# better-sqlite3 is a native module; no prebuilt binary is guaranteed for
# every host arch, so give node-gyp a compiler to fall back to.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src

USER node

CMD ["npm", "start"]
