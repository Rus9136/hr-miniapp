#!/bin/bash

echo "Deploying CORS fix to production..."

# Rebuild and restart containers
echo "Rebuilding Docker containers..."
docker-compose down
docker-compose build --no-cache hr-miniapp
docker-compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Test if DELETE method works
echo "Testing DELETE method..."
curl -X OPTIONS https://madlen.space/api/admin/time-events/clear-all -v

echo "Deployment complete!"
echo "Please test the clear buttons in the admin panel at https://madlen.space/admin.html"