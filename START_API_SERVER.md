# How to Start the API Server

## Quick Start

```bash
cd services/api
pnpm dev
```

## Prerequisites

Before starting the server, ensure:

1. **Environment Variables are Set**
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret for JWT tokens
   - `JWT_REFRESH_SECRET` - Secret for refresh tokens

2. **Database is Ready**
   ```bash
   cd services/api
   pnpm db:push        # Push schema to database
   pnpm db:generate    # Generate Prisma client
   ```

3. **Dependencies are Installed**
   ```bash
   cd services/api
   pnpm install
   ```

## Common Issues

### Issue: "Missing required environment variables"
**Solution**: Create a `.env` file in `services/api/` with:
```
DATABASE_URL=postgresql://user:password@localhost:5432/hos_marketplace
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
```

### Issue: "Prisma client missing models"
**Solution**: 
```bash
cd services/api
pnpm db:generate
```

### Issue: "Database connection failed"
**Solution**: 
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Test connection: `psql $DATABASE_URL`

### Issue: "Port 3001 already in use"
**Solution**: 
- Find process: `lsof -i :3001`
- Kill process: `kill -9 <PID>`
- Or change port in `main.ts`

## Verify Server is Running

```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "database": "connected"
}
```

## Start in Background

```bash
cd services/api
nohup pnpm dev > api.log 2>&1 &
```

Check logs:
```bash
tail -f services/api/api.log
```
