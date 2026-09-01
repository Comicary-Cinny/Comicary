# Step 1: Build stage for native packages like sqlite3
FROM node:18-alpine AS builder

# Install build dependencies for sqlite3 compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install all dependencies including build-tools
RUN npm ci

# Step 2: Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy built node_modules and code from previous stage
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Create a persistent directory folder for the SQLite database
RUN mkdir -p /app/data

# Expose app port (defaults to 3000 based on server.js)
EXPOSE 3000

# Set environment production defaults
ENV NODE_ENV=production
ENV PORT=3000
# Points database to persistent storage folder path
ENV DATABASE_URL=/app/data/comicary.db

CMD ["npm", "start"]
