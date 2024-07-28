# syntax=docker/dockerfile:1

FROM node:20

WORKDIR /usr/src/app

# Copy the entire project
COPY . .

# Install dependencies for all workspaces
RUN npm ci

# Build the data model package which is dependency of conductor
WORKDIR /usr/src/app/library/data-model
RUN npm run build

# Build the API
WORKDIR /usr/src/app/api
RUN npm run compile

# Set the working directory back to the root
WORKDIR /usr/src/app

# Expose the port the API runs on
EXPOSE 8000

# Command to run the API
CMD ["npm", "run", "start-api"]