# AGAPAY Backend Deployment Guide

## Backend Overview
The AGAPAY backend is a Node.js/Express API server with the following characteristics:
- **Runtime**: Node.js (check package.json for version requirements)
- **Database**: SQLite (file-based database at `server/agapay.db`)
- **Port**: 3001 (configurable via PORT environment variable)
- **Authentication**: JWT tokens with bcrypt password hashing
- **CORS**: Configured to allow requests from GitHub Pages frontend

## Environment Variables Required

### Required for Production:
- `PORT` - Server port (default: 3001)
- `JWT_SECRET` - Secret key for JWT token signing (use a strong random string)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (must include `https://jozi-6.github.io`)

### Required for Frontend:
- `VITE_API_URL` - Public URL of your deployed backend (e.g., `https://your-backend.herokuapp.com`)

## Deployment Options

### Option 1: Render.com (Recommended - Free Tier Available)

1. **Create a Render account** at https://render.com

2. **Prepare your repository**:
   ```bash
   git add .
   git commit -m "Add backend deployment configuration"
   git push origin main
   ```

3. **Create a new Web Service**:
   - Go to Render Dashboard → "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the "Agapay" repository
   - Configure:
     - **Name**: agapay-backend (or your preferred name)
     - **Region**: Choose nearest region
     - **Branch**: main
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server/server.js`
     - **Instance Type**: Free (or paid for better performance)

4. **Set Environment Variables**:
   - `PORT`: `3001` (or leave default)
   - `JWT_SECRET`: `[generate a strong random string]`
   - `ALLOWED_ORIGINS`: `https://jozi-6.github.io`
   - `NODE_ENV`: `production`

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Copy the generated URL (e.g., `https://agapay-backend.onrender.com`)

6. **Update Frontend**:
   - Create `.env.production` file in your project root:
     ```
     VITE_API_URL=https://agapay-backend.onrender.com
     ```
   - Rebuild and redeploy frontend to GitHub Pages

**Note**: Render's free tier spins down after 15 minutes of inactivity, which may cause slow initial loads. The paid tier ($7/month) avoids this.

### Option 2: Railway.app

1. **Create a Railway account** at https://railway.app

2. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your Agapay repository
   - Railway will automatically detect Node.js

3. **Configure**:
   - **Start Command**: `node server/server.js`
   - Add environment variables:
     - `PORT`: `3001`
     - `JWT_SECRET`: `[strong random string]`
     - `ALLOWED_ORIGINS`: `https://jozi-6.github.io`
     - `NODE_ENV`: `production`

4. **Deploy** and copy the generated URL

### Option 3: Heroku

1. **Install Heroku CLI** and login:
   ```bash
   heroku login
   ```

2. **Create Heroku app**:
   ```bash
   heroku create agapay-backend
   ```

3. **Set environment variables**:
   ```bash
   heroku config:set JWT_SECRET=your-strong-secret-key
   heroku config:set ALLOWED_ORIGINS=https://jozi-6.github.io
   heroku config:set NODE_ENV=production
   heroku config:set PORT=3001
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

5. **Get the URL**:
   ```bash
   heroku info
   ```

### Option 4: Vercel (for Node.js)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Configure environment variables** in Vercel dashboard

## Database Considerations

### Current Setup: SQLite
The current implementation uses SQLite with a file-based database (`server/agapay.db`). This works for:
- Development environments
- Small-scale deployments
- Testing

### Production Considerations:
For production deployment, consider migrating to a cloud database:

**Options:**
- **PostgreSQL** (recommended for production)
- **MySQL** (if you prefer MySQL)
- **Render PostgreSQL** (easy integration with Render)
- **Railway PostgreSQL** (easy integration with Railway)

**Migration would require:**
1. Setting up a cloud database instance
2. Modifying `server/database.js` to use the new database
3. Updating database connection logic
4. Migrating existing data (if any)

**For initial deployment**, SQLite is acceptable if:
- Your hosting platform supports persistent file storage
- You have adequate backup strategies
- The application scale is moderate

## Testing the Deployment

1. **Test Backend Health**:
   ```bash
   curl https://your-backend-url.com/api/login
   ```

2. **Test CORS**:
   - Open browser DevTools on GitHub Pages site
   - Attempt login
   - Check Network tab for successful API calls

3. **Test Authentication**:
   - Try login with test credentials
   - Verify token generation
   - Test protected endpoints

## Frontend Configuration

After deploying the backend:

1. **Create `.env.production`** file:
   ```
   VITE_API_URL=https://your-deployed-backend-url.com
   ```

2. **Rebuild frontend**:
   ```bash
   npm run build
   ```

3. **Push to GitHub** (triggers GitHub Pages deployment)

## Security Considerations

1. **JWT Secret**: Use a strong, random string in production
2. **HTTPS**: Ensure your backend uses HTTPS (most platforms provide this)
3. **CORS**: Only allow your GitHub Pages origin
4. **Environment Variables**: Never commit `.env` files
5. **Database**: Implement regular backups if using SQLite
6. **Rate Limiting**: Consider adding rate limiting for API endpoints

## Troubleshooting

### Common Issues:

1. **CORS Errors**:
   - Verify `ALLOWED_ORIGINS` includes your GitHub Pages URL
   - Check browser console for specific CORS errors

2. **Database Connection Issues**:
   - Ensure file permissions allow database file creation
   - Check disk space on hosting platform

3. **Slow Response Times**:
   - Free tier services may have cold start delays
   - Consider upgrading to paid tier for better performance

4. **Authentication Failures**:
   - Verify JWT_SECRET is set correctly
   - Check token expiration times

## Monitoring and Logs

Most hosting platforms provide:
- **Application logs** (console output)
- **Deployment logs** (build process)
- **Error tracking** (failed requests)
- **Performance metrics** (response times)

Monitor these regularly to ensure backend health.

## Cost Estimates

- **Render Free Tier**: $0/month (with spin-down)
- **Render Paid**: $7/month (always on)
- **Railway**: $5/month (after free trial)
- **Heroku**: $5-7/month (basic tier)
- **Vercel**: Free for hobby projects

Choose based on your budget and performance requirements.