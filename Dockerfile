#https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:14.17.0-alpine as build
# we need as build due to line 22

# https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
WORKDIR /app
COPY --chown=node:node ./ /app/
RUN npm ci
#COPY --chown=node:node package*.json /app/



ENV NODE_ENV production
ENV REACT_APP_DIRECTORY_HOST="testing.db.faims.edu.au"
ENV REACT_APP_DIRECTORY_PORT="443"
# https://blog.knoldus.com/deployment-with-docker-in-ionic/
#USER node
# They say to run with min privs, but since we're building and not running, I CBF'd right now.
RUN npm run-script build

FROM nginx:1.21.0-alpine
RUN rm -rf /usr/share/nginx/html/*
# not /app/www but /app/build because react
COPY --from=build /app/build/ /usr/share/nginx/html/
