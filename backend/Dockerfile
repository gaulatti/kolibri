FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS development
ENV NODE_ENV=development
COPY . ./
RUN mkdir -p /app/artifacts /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM dependencies AS build-env
COPY . ./
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build-env /app/dist ./dist
RUN mkdir -p /app/artifacts /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || '3000') + '/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
