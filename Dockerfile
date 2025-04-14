FROM node:lts-alpine

WORKDIR /app

COPY . .

RUN npm install --ignore-scripts
RUN npm run build

EXPOSE 3000

CMD ["node", "build/index.js"]
