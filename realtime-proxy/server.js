const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

console.log('🚀 Starting OpenAI Realtime Proxy Server...');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true
  }
});

// Track active connections
let activeConnections = 0;

wss.on('connection', (clientWs, request) => {
  activeConnections++;
  console.log(`📱 Client connected (${activeConnections} active)`);
  
  let openaiWs = null;
  
  try {
    // Connect to OpenAI Realtime API
    console.log('🔗 Connecting to OpenAI Realtime API...');
    openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // Handle OpenAI connection success
    openaiWs.on('open', () => {
      console.log('✅ Connected to OpenAI Realtime API');
    });

    // Handle OpenAI connection errors
    openaiWs.on('error', (error) => {
      console.error('❌ OpenAI connection error:', error.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: {
            message: 'Failed to connect to OpenAI Realtime API',
            details: error.message
          }
        }));
      }
    });

    // Relay messages: Client → OpenAI
    clientWs.on('message', (data, isBinary) => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        try {
          console.log(`📤 Relaying ${isBinary ? 'binary' : 'text'} message to OpenAI`);
          openaiWs.send(data, { binary: isBinary });
        } catch (error) {
          console.error('❌ Error relaying to OpenAI:', error.message);
        }
      } else {
        console.warn('⚠️ OpenAI connection not ready, dropping client message');
      }
    });

    // Relay messages: OpenAI → Client
    openaiWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          console.log(`📥 Relaying ${isBinary ? 'binary' : 'text'} message to client`);
          clientWs.send(data, { binary: isBinary });
        } catch (error) {
          console.error('❌ Error relaying to client:', error.message);
        }
      }
    });

    // Handle client disconnection
    clientWs.on('close', (code, reason) => {
      activeConnections--;
      console.log(`📱 Client disconnected (${activeConnections} active). Code: ${code}`);
      if (openaiWs) {
        openaiWs.close();
      }
    });

    // Handle OpenAI disconnection
    openaiWs.on('close', (code, reason) => {
      console.log(`🔗 OpenAI connection closed. Code: ${code}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    });

    // Handle client errors
    clientWs.on('error', (error) => {
      console.error('❌ Client connection error:', error.message);
      activeConnections--;
      if (openaiWs) {
        openaiWs.close();
      }
    });

  } catch (error) {
    console.error('❌ Failed to create OpenAI connection:', error.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: {
          message: 'Proxy server error',
          details: error.message
        }
      }));
      clientWs.close();
    }
    activeConnections--;
  }
});

// Handle server errors
wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error);
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎙️ OpenAI Realtime Proxy running on port ${PORT}`);
  console.log(`📡 Accepting connections from Vite dev server`);
  console.log(`🔑 Using OpenAI API key: ${process.env.OPENAI_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down proxy server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});
