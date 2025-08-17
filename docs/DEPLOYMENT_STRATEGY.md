# Deployment Strategy for VRF Loot Generator

## Overview
This document outlines the deployment strategy for making the VRF loot generator with WebSocket trading system publicly accessible.

## Architecture Requirements

### Frontend Deployment
- **Platform**: Netlify (recommended) or Vercel
- **Build Command**: `npm run build`
- **Publish Directory**: `build/`
- **Environment Variables**: 
  - `REACT_APP_WEBSOCKET_URL`: WebSocket server URL

### Backend Deployment
- **Platform**: Railway, Render, or Heroku
- **Runtime**: Node.js 18+
- **Port**: Dynamic (from `process.env.PORT`)
- **Environment Variables**:
  - `PORT`: Server port (auto-assigned by platform)
  - `CORS_ORIGIN`: Frontend domain URL
  - `NODE_ENV`: production

## Deployment Steps

### 1. Prepare Backend for Production

#### Update Server Configuration
```typescript
// server/src/server.ts - Production CORS setup
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
};
```

#### Environment Configuration
```bash
# server/.env
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.netlify.app
NODE_ENV=production
```

#### Package.json Scripts
```json
{
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc",
    "dev": "tsx src/server.ts"
  }
}
```

### 2. Deploy Backend First

#### Option A: Railway
1. Connect GitHub repository
2. Select `/server` as root directory
3. Set environment variables
4. Deploy automatically

#### Option B: Render
1. Create new Web Service
2. Connect repository, set root directory to `/server`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Set environment variables

#### Option C: Heroku
```bash
# From server directory
heroku create your-app-name
heroku config:set CORS_ORIGIN=https://your-frontend.netlify.app
git subtree push --prefix server heroku main
```

### 3. Deploy Frontend

#### Netlify Deployment
1. Connect GitHub repository
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
3. Environment variables:
   - `REACT_APP_WEBSOCKET_URL`: Your backend WebSocket URL
4. Deploy

#### Build Configuration
```bash
# Frontend environment variables
REACT_APP_WEBSOCKET_URL=wss://your-backend.railway.app
```

### 4. Update Frontend WebSocket Configuration

```typescript
// src/services/websocket/socket.service.ts
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001';
```

## Security Considerations

### HTTPS/WSS Requirements
- Frontend must use HTTPS in production
- WebSocket connections must use WSS (secure WebSocket)
- Update CORS origins to match production domains

### Environment Variables
- Never commit `.env` files
- Use platform-specific environment variable settings
- Validate all environment variables on startup

### Rate Limiting (Future Enhancement)
```typescript
// Add to server for production
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

## Monitoring and Maintenance

### Health Checks
- Backend already includes `/health` endpoint
- Monitor WebSocket connection counts
- Track active rooms and trades

### Logging
```typescript
// Add structured logging for production
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});
```

### Error Tracking
- Consider integrating Sentry for error monitoring
- Track WebSocket connection failures
- Monitor trade completion rates

## Scaling Considerations

### Current Limitations
- Single server instance (no horizontal scaling)
- In-memory state (lost on restart)
- No persistent storage

### Future Enhancements
- Redis for session storage
- Database for trade history
- Load balancer for multiple instances
- WebSocket clustering with Redis adapter

## Cost Estimation

### Free Tier Options
- **Netlify**: 100GB bandwidth/month (frontend)
- **Railway**: $5/month after free tier (backend)
- **Render**: Free tier with limitations (backend)

### Recommended Setup
- **Frontend**: Netlify (free)
- **Backend**: Railway Hobby plan ($5/month)
- **Total**: ~$5/month

## Deployment Checklist

### Pre-Deployment
- [ ] Test locally with production-like environment variables
- [ ] Verify TypeScript compilation passes
- [ ] Update CORS origins for production domains
- [ ] Set up environment variables on hosting platforms
- [ ] Test WebSocket connections with WSS

### Post-Deployment
- [ ] Verify frontend loads correctly
- [ ] Test WebSocket connection establishment
- [ ] Verify cross-browser functionality
- [ ] Test room creation and joining
- [ ] Validate trade initiation works
- [ ] Monitor error logs for issues

### Domain Setup (Optional)
- [ ] Configure custom domain for frontend
- [ ] Set up SSL certificates (automatic with Netlify)
- [ ] Update WebSocket URL to use custom domain
- [ ] Test end-to-end with custom domains

## Rollback Strategy

### Frontend Rollback
- Netlify provides instant rollback to previous deployments
- Keep previous build artifacts for quick restoration

### Backend Rollback
- Use platform-specific rollback features
- Maintain previous Docker images or build artifacts
- Database migrations (when added) should be backward compatible

## Future Improvements

### Performance
- Implement WebSocket connection pooling
- Add CDN for static assets
- Optimize bundle size with code splitting

### Features
- User authentication and profiles
- Persistent trade history
- Real-time notifications
- Mobile-responsive design improvements

### Infrastructure
- Container orchestration (Docker + Kubernetes)
- Multi-region deployment
- Database integration for persistence
- Automated testing and CI/CD pipelines
