#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Analytics API Setup${NC}"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install it first:${NC}"
    echo "curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please update the .env file with your configuration${NC}"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
bun install

# Start Docker services
echo -e "${GREEN}🐳 Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check if PostgreSQL is ready
until docker-compose exec -T postgres pg_isready -U analytics -d analytics_db &> /dev/null; do
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
    sleep 2
done
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Check if Redis is ready
until docker-compose exec -T redis redis-cli ping &> /dev/null; do
    echo -e "${YELLOW}⏳ Waiting for Redis...${NC}"
    sleep 2
done
echo -e "${GREEN}✅ Redis is ready${NC}"

# Run migrations
echo -e "${GREEN}🗄️  Running database migrations...${NC}"
docker-compose exec -T postgres psql -U analytics -d analytics_db < migrations/001_initial.sql

# Start the application
echo -e "${GREEN}🚀 Starting the Analytics API...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 API: http://localhost:3000${NC}"
echo -e "${GREEN}📚 Docs: http://localhost:3000/docs${NC}"
echo -e "${GREEN}🏥 Health: http://localhost:3000/api/health${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Start in development mode with watch
bun run dev