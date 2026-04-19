FROM node:22-bookworm

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV LAB_SERVER_PORT=3001
ENV LAB_DOCKER_NETWORK=lab-net

EXPOSE 3001

CMD ["node", "server/index.js"]
