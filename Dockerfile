FROM --platform=linux/amd64 node:20-alpine as base
# Create the user up front to save a little time on rebuilds.
RUN adduser --gecos '' --disabled-password --no-create-home user
ENV NODE_OPTIONS=--max-old-space-size=4096
# Create app directory
RUN mkdir -p /usr/src/node-backend
WORKDIR /usr/src/node-backend
# Copy deps files
COPY package.json /usr/src/node-backend/package.json
COPY yarn.lock /usr/src/node-backend/yarn.lock

# BUILD DEPS
FROM base as build-deps
RUN yarn
COPY . /usr/src/node-backend
WORKDIR /usr/src/node-backend
RUN yarn build

# START API
FROM base as prod-stage
COPY --from=build-deps /usr/src/node-backend/prisma ./prisma
COPY --from=build-deps /usr/src/node-backend/dist ./dist
COPY --from=build-deps /usr/src/node-backend/start.sh ./start.sh

RUN yarn --production
RUN yarn prisma:generate
CMD ["yarn", "start:prod"]