<!-- # OpenAI Realtime Proxy Server

A simple WebSocket proxy that enables browser access to OpenAI's Realtime API by handling authentication headers.

## Why This is Needed

Browser WebSockets cannot send custom headers like `Authorization`, but OpenAI Realtime API requires these headers. This proxy solves that limitation.

## Setup

1. **Add your OpenAI API key**:
   ```bash
   # Edit .env file
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```

2. **Install dependencies** (already done):
   ```bash
   npm install
   ```

3. **Start the proxy**:
   ```bash
   npm run dev
   ```

4. **Keep running** while using the main app

## How It Works

```
Browser (localhost:5173) ↔ Proxy (localhost:3001) ↔ OpenAI Realtime API
```

1. Browser connects to proxy (no auth needed)
2. Proxy connects to OpenAI with proper headers  
3. Proxy relays all messages between browser and OpenAI

## Testing

1. Start this proxy: `npm run dev`
2. Start main app: `cd .. && npm run dev`
3. Go to Chat page and try Realtime Voice mode

## Deployment (Optional)

For production, deploy to:
- **Railway.app** (free tier)
- **Render.com** (free tier)  
- **Heroku** or other platforms

No deployment needed for local development! -->


