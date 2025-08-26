export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.headers.get('upgrade') !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 400 });
  }

  // 1) Create a pair: clientWS <-> serverWS (serverWS stays on edge)
  // @ts-expect-error WebSocketPair is provided by Edge runtime
  const pair = new WebSocketPair();
  const clientWS = pair[0] as WebSocket;      // returned to browser
  const serverWS = pair[1] as WebSocket;      // lives on edge

  // 2) Connect to OpenAI Realtime (upstream WS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = (((globalThis as any).process?.env?.OPENAI_API_KEY) as string) || '';
  const upstreamResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
      Connection: 'Upgrade',
      Upgrade: 'websocket',
    },
  });

  // @ts-expect-error non-standard property available at runtime
  const upstreamWS = upstreamResp.webSocket as WebSocket | undefined;
  if (upstreamResp.status !== 101 || !upstreamWS) {
    return new Response('Failed to connect to OpenAI Realtime', { status: 502 });
  }

  // 3) Accept sockets and pipe both ways
  // @ts-expect-error accept exists in Edge runtime
  serverWS.accept();
  // @ts-expect-error accept exists in Edge runtime
  upstreamWS.accept();

  serverWS.addEventListener('message', (e) => upstreamWS.send((e as MessageEvent).data as string));
  upstreamWS.addEventListener('message', (e) => serverWS.send((e as MessageEvent).data as string));

  const close = () => { try { serverWS.close(); } catch {} try { upstreamWS.close(); } catch {} };
  serverWS.addEventListener('close', close);
  serverWS.addEventListener('error', close);
  upstreamWS.addEventListener('close', close);
  upstreamWS.addEventListener('error', close);

  // 4) Return the browser side of the pair
  // @ts-expect-error webSocket is an Edge-only ResponseInit property
  return new Response(null, { status: 101, webSocket: clientWS });
}