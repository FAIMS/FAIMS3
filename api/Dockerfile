# syntax=docker/dockerfile:1

FROM node:20

# Expose the port the API runs on
EXPOSE 8000

# primary work directory - mirror of the FAIMS3 monorepo
# requires that build context is at the proj root
WORKDIR /usr/src

# Copy the entire project
COPY . .

# Install dependencies for all workspaces
RUN npm ci

# Build the data model package which is dependency of conductor
RUN cd library/data-model && npm run build && cd ../..

# Build the API
RUN cd api && npm run compile && cd ..

# Command to run the API
CMD ["npm", "run", "start-api"]