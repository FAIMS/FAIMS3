# syntax=docker/dockerfile:1

FROM node:20

WORKDIR /usr/src/app

# Copy the entire project
COPY . .

# Install dependencies for all workspaces
RUN npm ci

# Build the data model package which is dependency of conductor
RUN cd library/data-model && npm run build && cd ../..

# Build the API
RUN cd api && npm run compile && cd ..

# Expose the port the API runs on
EXPOSE 8000

# Command to run the API
CMD ["npm", "run", "start-api"]