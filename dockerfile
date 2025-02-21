FROM node:18-alpine AS builder

WORKDIR /app

COPY minima-ui ./minima-ui

WORKDIR /app/minima-ui

COPY minima-ui/package.json minima-ui/package-lock.json ./

RUN npm install

RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app/minima-ui

COPY --from=builder /app/minima-ui/package.json ./
COPY --from=builder /app/minima-ui/node_modules ./node_modules
COPY --from=builder /app/minima-ui/.next ./.next
COPY --from=builder /app/minima-ui/public ./public
COPY --from=builder /app/minima-ui/src ./src

EXPOSE 3000

CMD ["npm", "run", "start"]