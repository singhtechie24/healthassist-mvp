/*
  Minimal Vercel Edge WebSocket proxy to OpenAI Realtime.
  Note: The Edge runtime exposes WebSocket features that are not fully typed
  in standard TypeScript DOM libs. We use narrow casts to avoid type errors
  while keeping runtime behavior correct.
*/
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // Only handle WebSocket upgrades
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  const upstreamUrl = 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

  // OpenAI API key must be set in the Vercel (proxy) project, server-only
  const apiKey = (process.env.OPENAI_API_KEY as string) || '';
  if (!apiKey) {
    return new Response('OPENAI_API_KEY not configured', { status: 500 });
  }

  // Connect to OpenAI Realtime via WebSocket
  const upstream = await fetch(upstreamUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
      Connection: 'Upgrade',
      Upgrade: 'websocket',
    },
  });

  // The Edge runtime provides a non-standard webSocket property on Response.
  // Cast to any to access it safely.
  const upstreamAny = upstream as unknown as { webSocket?: WebSocket };
  if (upstream.status !== 101 || !upstreamAny.webSocket) {
    return new Response('Failed to connect to OpenAI Realtime', { status: 502 });
  }

  // Acquire client and upstream sockets
  // On Vercel Edge, use WebSocketPair to establish client socket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pair = new (globalThis as any).WebSocketPair();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const client = pair[0] as unknown as WebSocket;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const serverClient = pair[1] as unknown as WebSocket;
  // Upstream socket from OpenAI
  const server = upstreamAny.webSocket as WebSocket;

  // Accept both sides
  // @ts-expect-error accept is available at runtime on Edge WebSockets
  client.accept();
  // @ts-expect-error accept is available at runtime on Edge WebSockets
  serverClient.accept();
  // @ts-expect-error accept is available at runtime on Edge WebSockets
  server.accept();

  // Pipe messages bi-directionally
  client.addEventListener('message', (ev) => {
    try { server.send((ev as MessageEvent).data as unknown as string); } catch (e) { console.warn('pipe->server error', e); }
  });
  server.addEventListener('message', (ev) => {
    try { client.send((ev as MessageEvent).data as unknown as string); } catch (e) { console.warn('pipe->client error', e); }
  });

  const closeBoth = () => {
    try { client.close(); } catch (e) { console.warn('client close err', e); }
    try { server.close(); } catch (e) { console.warn('server close err', e); }
  };

  client.addEventListener('close', closeBoth);
  server.addEventListener('close', closeBoth);
  client.addEventListener('error', closeBoth);
  server.addEventListener('error', closeBoth);

  // Return upgraded response (non-standard ResponseInit.webSocket on Edge)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Response(null, { status: 101, webSocket: client } as any);
}


