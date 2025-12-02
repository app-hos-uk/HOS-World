#!/bin/bash
# Elasticsearch Setup Script

echo "Setting up Elasticsearch for House of Spells Marketplace..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Elasticsearch container already exists
if docker ps -a | grep -q elasticsearch; then
    echo "Elasticsearch container already exists. Starting it..."
    docker start elasticsearch
else
    echo "Creating Elasticsearch container..."
    docker run -d \
        --name elasticsearch \
        -p 9200:9200 \
        -p 9300:9300 \
        -e "discovery.type=single-node" \
        -e "xpack.security.enabled=false" \
        -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
        elasticsearch:8.11.0
    
    echo "Waiting for Elasticsearch to start..."
    sleep 10
fi

# Check if Elasticsearch is running
if curl -s http://localhost:9200 > /dev/null; then
    echo "✅ Elasticsearch is running successfully!"
    echo "Elasticsearch URL: http://localhost:9200"
    echo ""
    echo "To verify, run: curl http://localhost:9200"
else
    echo "❌ Elasticsearch failed to start. Check logs with: docker logs elasticsearch"
    exit 1
fi

echo ""
echo "Next steps:"
echo "1. Update your .env file with: ELASTICSEARCH_NODE=http://localhost:9200"
echo "2. Run: npm run db:seed:elasticsearch (if available)"
echo "3. Start syncing products to Elasticsearch"

