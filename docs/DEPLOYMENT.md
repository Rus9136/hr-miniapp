# Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- Domain with SSL certificate (or use Let's Encrypt)
- PostgreSQL 16+ (included in Docker setup)
- Node.js 18+ (for local development)

## Quick Deployment

### 1. Clone and Configure
```bash
git clone <repository>
cd hr-miniapp
cp .env.example .env.production
```

### 2. Edit Environment Variables
Create `.env.production`:
```env
NODE_ENV=production
PORT=3030
DB_HOST=hr-postgres
DB_PORT=5432
DB_NAME=hr_tracker
DB_USER=hr_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
TELEGRAM_BOT_TOKEN=your_bot_token
```

### 3. Deploy with Docker
```bash
# Build and start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Verify Deployment
```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Check main page
curl -I https://your-domain.com/
```

## Production Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Nginx     │────▶│  Node.js    │────▶│  PostgreSQL  │
│   (SSL)     │     │   App       │     │   Database   │
│  Port 443   │     │  Port 3030  │     │  Port 5432   │
└─────────────┘     └─────────────┘     └──────────────┘
      │
      ▼
┌─────────────┐
│   Static    │
│   Files     │
└─────────────┘
```

## Docker Services

### 1. hr-postgres (Database)
- Image: postgres:16-alpine
- Volume: postgres_data
- Health checks enabled
- Auto-restart policy

### 2. hr-app (Application)
- Custom Node.js image
- Environment-based config
- Health endpoint: /api/health
- Graceful shutdown support

### 3. hr-nginx (Web Server)
- Image: nginx:alpine
- SSL termination
- Reverse proxy to app
- Static file serving
- Security headers

## SSL Certificate Setup

### Using Let's Encrypt (Recommended)
```bash
# Install certbot
apt-get install certbot

# Generate certificate
certbot certonly --standalone -d your-domain.com

# Certificate locations
/etc/letsencrypt/live/your-domain.com/fullchain.pem
/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Update nginx.conf
```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

## Database Management

### Initial Setup
Database is automatically initialized on first run with:
- Schema creation
- Required indexes
- Default admin user

### Backup Database
```bash
# Create backup
docker exec hr-postgres pg_dump -U hr_user hr_tracker > backup.sql

# Restore backup
docker exec -i hr-postgres psql -U hr_user hr_tracker < backup.sql
```

### Run Migrations
```bash
# Connect to container
docker exec -it hr-miniapp node migrations/run_migration.js
```

## Monitoring

### Check Container Health
```bash
# View all containers
docker ps

# Check specific service
docker inspect hr-miniapp | grep -A 5 Health
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker logs hr-miniapp --tail 100 -f
```

### Resource Usage
```bash
# CPU and Memory usage
docker stats

# Disk usage
docker system df
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs hr-miniapp

# Rebuild if needed
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Issues
```bash
# Test connection
docker exec hr-miniapp nc -zv hr-postgres 5432

# Check PostgreSQL logs
docker logs hr-postgres
```

### SSL Certificate Issues
```bash
# Test SSL
openssl s_client -connect your-domain.com:443

# Renew certificate
certbot renew
docker-compose restart hr-nginx
```

## Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and deploy
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup (careful!)
docker system prune -a
```

## Security Checklist

- [ ] Change default passwords
- [ ] Set strong JWT_SECRET
- [ ] Configure firewall (only 80/443 open)
- [ ] Enable automatic security updates
- [ ] Regular backups configured
- [ ] SSL certificate auto-renewal
- [ ] Rate limiting enabled
- [ ] CORS properly configured

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| PORT | Application port | 3030 |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | hr_tracker |
| DB_USER | Database user | hr_user |
| DB_PASSWORD | Database password | - |
| JWT_SECRET | JWT signing secret | - |
| TELEGRAM_BOT_TOKEN | Telegram bot token | - |

## Support

For issues, check:
1. Application logs: `docker logs hr-miniapp`
2. Database logs: `docker logs hr-postgres`
3. Nginx logs: `docker logs hr-nginx`
4. Health endpoint: `https://your-domain.com/api/health`