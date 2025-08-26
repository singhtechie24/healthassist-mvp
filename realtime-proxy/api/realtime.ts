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
  // On Edge, use globalThis to safely access env without Node types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = (((globalThis as any).process?.env?.OPENAI_API_KEY) as string) || '';
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
  // @ts-expect-error WebSocketPair is available at runtime on Edge
  const pair = new WebSocketPair();
  const clientWS = pair[0] as WebSocket;   // returned to browser
  const serverWS = pair[1] as WebSocket;   // stays on edge
  // Upstream socket from OpenAI
  const upstreamWS = upstreamAny.webSocket as WebSocket;

  // Accept both sides
  // @ts-expect-error accept is available at runtime on Edge WebSockets
  serverWS.accept();
  // @ts-expect-error accept is available at runtime on Edge WebSockets
  upstreamWS.accept();

  // Pipe messages bi-directionally
  serverWS.addEventListener('message', (ev) => {
    try { upstreamWS.send((ev as MessageEvent).data as string); } catch (e) { console.warn('pipe->upstream error', e); }
  });
  upstreamWS.addEventListener('message', (ev) => {
    try { serverWS.send((ev as MessageEvent).data as string); } catch (e) { console.warn('pipe->edge error', e); }
  });

  const closeBoth = () => {
    try { serverWS.close(); } catch (e) { console.warn('edge close err', e); }
    try { upstreamWS.close(); } catch (e) { console.warn('upstream close err', e); }
  };

  serverWS.addEventListener('close', closeBoth);
  upstreamWS.addEventListener('close', closeBoth);
  serverWS.addEventListener('error', closeBoth);
  upstreamWS.addEventListener('error', closeBoth);

  // Return upgraded response to the browser with our server-side socket
  // Return the browser side of the pair
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Response(null, { status: 101, webSocket: clientWS } as any);
}


