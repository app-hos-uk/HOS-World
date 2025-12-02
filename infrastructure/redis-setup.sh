#!/bin/bash
# Redis Setup Script

echo "Setting up Redis for House of Spells Marketplace..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Redis container already exists
if docker ps -a | grep -q redis; then
    echo "Redis container already exists. Starting it..."
    docker start redis
else
    echo "Creating Redis container..."
    docker run -d \
        --name redis \
        -p 6379:6379 \
        redis:7-alpine
    
    echo "Waiting for Redis to start..."
    sleep 3
fi

# Check if Redis is running
if docker exec redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is running successfully!"
    echo "Redis URL: redis://localhost:6379"
    echo ""
    echo "To verify, run: docker exec redis redis-cli ping"
else
    echo "❌ Redis failed to start. Check logs with: docker logs redis"
    exit 1
fi

echo ""
echo "Next steps:"
echo "1. Update your .env file with: REDIS_URL=redis://localhost:6379"
echo "2. Test Redis connection in your application"
echo "3. Monitor Redis with: docker exec -it redis redis-cli"

