# syntax=docker/dockerfile:1

FROM node:20

WORKDIR /app

COPY . .
RUN npm ci 
CMD ["npm", "start"] 
