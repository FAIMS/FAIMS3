#https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

FROM node:lts-alpine3.14@sha256:d5ff6716e21e03983f8522b6e84f15f50a56e183085553e96d2801fc45dc3c74 as build
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

FROM nginx:mainline-alpine@sha256:eb05700fe7baa6890b74278e39b66b2ed1326831f9ec3ed4bdc6361a4ac2f333
RUN rm -rf /usr/share/nginx/html/*
# not /app/www but /app/build because react
COPY ./.nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/build/ /usr/share/nginx/html/
