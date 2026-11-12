# Fusion backend — host-agnostic container (Render, Railway, Fly.io, any Docker host).
# Single stage: the server bundle statically imports vite.config at runtime, so
# the "dev" dependencies (vite, plugins) must remain installed even in prod —
# this mirrors how it ran on Replit. No compiler toolchain is needed: the only
# native dependency (bcrypt) ships prebuilt glibc binaries.
FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies (including dev — needed at build AND runtime here).
COPY package*.json ./
RUN npm ci --include=dev --legacy-peer-deps

# Build the client (Vite) + server (esbuild) into dist/.
COPY . .
RUN npm run build

ENV NODE_ENV=production
# The server reads PORT; hosts inject their own. 5000 is the default.
ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist/index.js"]
