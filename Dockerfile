
# ==========================================
# BUILD STAGE
# ==========================================
FROM node:22-bookworm AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src


# ==========================================
# INSTALL QPDF
# ==========================================
RUN apt-get update \
    && apt-get install -y --no-install-recommends qpdf \
    && mkdir -p /qpdf-runtime/usr/bin \
    && cp -a /usr/bin/qpdf /qpdf-runtime/usr/bin/ \
    && ldd /usr/bin/qpdf \
       | awk '{print $3}' \
       | grep '^/' \
       | sort -u \
       | while read lib; do \
            mkdir -p "/qpdf-runtime$(dirname "$lib")"; \
            cp -L "$lib" "/qpdf-runtime$lib"; \
       done \
    && rm -rf /var/lib/apt/lists/*


# ==========================================
# PRODUCTION RUNTIME
# ==========================================
FROM gcr.io/distroless/nodejs22-debian12:nonroot

ENV NODE_ENV=production
ENV PATH="/usr/local/bin:/usr/bin"

WORKDIR /app

COPY --from=build --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/server.js ./server.js
COPY --from=build --chown=nonroot:nonroot /app/src ./src

# Copy qpdf executable and runtime libraries
COPY --from=build /qpdf-runtime/ /

EXPOSE 5000

CMD ["server.js"]
