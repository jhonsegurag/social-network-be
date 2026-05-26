FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/users uploads/publications

EXPOSE 3000

CMD ["node", "index.js"]
