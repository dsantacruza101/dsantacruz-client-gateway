FROM node:21-alpine3.19

WORKDIR /user/src/app

COPY package.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3000