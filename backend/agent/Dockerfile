FROM oven/bun:1.4.4 AS remotion-deps
WORKDIR /remotion-compositions
COPY remotion-compositions/package.json remotion-compositions/bun.lock ./
RUN bun install --frozen-lockfile

FROM node:20-bookworm-slim AS node-runtime

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ffmpeg fonts-liberation ca-certificates \
      bubblewrap systemd \
    && rm -rf /var/lib/apt/lists/*
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
# The sandbox launcher uses this canonical interpreter path inside bwrap.
RUN ln -sf /usr/local/bin/python3 /usr/bin/python3

WORKDIR /app
COPY backend/agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=remotion-deps /remotion-compositions/node_modules /remotion-compositions/node_modules
COPY remotion-compositions /remotion-compositions
COPY backend/agent/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
