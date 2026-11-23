# The Qhess server in a container: the page, and multiplayer over a websocket at /ws.
# On this computer: docker compose up --build   (see compose.yaml). Hosted: Render builds this file.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production QHESS_NO_BROWSER=1 PORT=8000

# The packages first, so a change to the game's files doesn't reinstall them. Only ws is needed to run.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Everything else not in .dockerignore, read-only to the user the server runs as
COPY . .
USER node

EXPOSE 8000
CMD ["node", "server/server.js"]
