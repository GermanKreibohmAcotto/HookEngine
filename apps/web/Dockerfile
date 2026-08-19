# Dev-mode image: runs the Vite dev server with hot reload for `docker compose up`.
# A production static build (served via Nginx) is added in Phase 6 for the
# published GHCR image.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
