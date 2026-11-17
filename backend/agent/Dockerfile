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

# Remotion rasterizes inside Chromium; without a CJK font every Chinese label
# renders blank. Kept in its own layer (after the slow pip install) so changing
# the font set does not invalidate the Python dependency cache. `fontconfig` is
# named explicitly because the layer calls fc-cache/fc-list: today it only
# arrives transitively through chromium, which is not a contract we control.
# The build fails instead of shipping a renderer that silently drops Chinese
# text.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk fontconfig \
    && fc-cache -f \
    && test -n "$(fc-list :lang=zh)" \
    && rm -rf /var/lib/apt/lists/*

COPY --from=remotion-deps /remotion-compositions/node_modules /remotion-compositions/node_modules
COPY remotion-compositions /remotion-compositions
COPY backend/agent/app ./app
# The algorithm notes archive is imported as searchable Markdown under the
# mounted workspace's digest/wiki directory at startup. Historical editor
# solutions already live in ReMe and are not copied into the image.
COPY 01-算法套路.md.zip ./algorithm-sources/01-算法套路.md.zip
ENV ALGOCOACH_KNOWLEDGE_SOURCE_DIR=/app/algorithm-sources

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
