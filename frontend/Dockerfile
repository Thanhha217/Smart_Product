FROM node:20-alpine3.21 AS build

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN node_modules/.bin/react-scripts build

FROM nginx:1.30-alpine

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /var/www/html