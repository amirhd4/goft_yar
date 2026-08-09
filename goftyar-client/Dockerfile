# Step 1: Build the React application
FROM node:18-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Step 2: Serve the React application using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy default nginx config if needed or use standard
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
