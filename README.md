# Buildathon

A fitness tracking app with step counting and AI-powered chat assistance.

## Project Structure

- `client/` - React frontend (Vite)
- `server/` - Bun backend with OpenAI integration

## Development Setup

### Backend

1. Navigate to `server/` directory
2. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_key_here
   PORT=3001
   ```
3. Install dependencies and run:
   ```bash
   cd server
   bun install
   bun run dev
   ```

### Frontend

1. Navigate to `client/` directory
2. Install dependencies and run:
   ```bash
   cd client
   pnpm install
   pnpm dev
   ```

The frontend will proxy `/api/*` requests to the backend server automatically.

## Cloudflare Tunnel Setup

When using Cloudflare Tunnel (cloudflared), both frontend and backend can be accessed through the same domain:

1. **Development**: The Vite dev server proxies `/api/*` requests to the backend automatically
2. **Production**: 
   - Option A: Deploy backend as Cloudflare Worker/Pages Function
   - Option B: Use Cloudflare Workers to proxy requests to your backend
   - Option C: Run both services and configure Cloudflare routing

The frontend defaults to `/api` for API requests, which works seamlessly with the Vite proxy in development and can be configured for production via `VITE_CHAT_API_URL` environment variable.