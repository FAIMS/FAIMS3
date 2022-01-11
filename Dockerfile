#https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

FROM node:lts-alpine3.14@sha256:a9b9cb880fa429b0bea899cd3b1bc081ab7277cc97e6d2dcd84bd9753b2027e1 as build
ARG REACT_APP_COMMIT_VERSION
ARG REACT_APP_DIRECTORY_HOST
RUN apk --no-cache add python3=~3.9 make=~4.3 g++=~10.3

# we need as build due to line 22

# https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/
WORKDIR /app
COPY --chown=node:node ./ /app/
RUN npm ci
#COPY --chown=node:node package*.json /app/


# https://github.com/FAIMS/FAIMS3/wiki/building-the-webapp
ENV NODE_ENV production
#ENV REACT_APP_COMMIT_VERSION $REACT_APP_COMMIT_VERSION
#RUN sh /app/bin/setVersionExport.sh
ENV REACT_APP_PRODUCTION_BUILD true
ENV REACT_APP_USE_REAL_DATA false
#REACT_APP_USE_REAL_DATA: This configures whether to include local test data in the system or not. REACT_APP_USE_REAL_DATA=true disables test data.
ENV REACT_APP_USE_HTTPS true
#ENV REACT_APP_DIRECTORY_HOST $REACT_APP_DIRECTORY_HOST
ENV REACT_APP_DIRECTORY_PORT 443
# https://blog.knoldus.com/deployment-with-docker-in-ionic/
#USER node
# They say to run with min privs, but since we're building and not running, I CBF'd right now.
RUN npm run-script build

FROM nginx:mainline-alpine@sha256:12aa12ec4a8ca049537dd486044b966b0ba6cd8890c4c900ccb5e7e630e03df0
RUN rm -rf /usr/share/nginx/html/*
# not /app/www but /app/build because react
COPY ./.nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/build/ /usr/share/nginx/html/
