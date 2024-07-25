# syntax=docker/dockerfile:1

FROM node:20

WORKDIR /usr/src

COPY ../package.json ./
COPY ../package-lock.json ./

COPY ./package.json ./api/package.json

RUN npm install

COPY .. .

CMD ["npm", "run", "start"] 
