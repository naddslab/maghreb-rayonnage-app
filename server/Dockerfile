# package.json / package-lock.json live at the repo root (shared with the frontend), so this
# image must be built with the repo root as the build context, not server/:
#
#   docker build -f server/Dockerfile -t maghreb-rayonnage-api .
#
# (docker build server/ will fail — there is no package.json inside server/.)

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

WORKDIR /app/server

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "index.js"]
