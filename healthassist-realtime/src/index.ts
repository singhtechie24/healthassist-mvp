export default {
	async fetch(request, env) {
	  const { pathname } = new URL(request.url);
	  if (pathname !== "/api/realtime") return new Response("Not found", { status: 404 });
	  if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket upgrade", { status: 400 });
  
	  const pair = new WebSocketPair();
	  const clientWS = pair[0];
	  const serverWS = pair[1];
  
	  const upstreamResp = await fetch(
		"https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
		{
		  headers: {
			Authorization: `Bearer ${env.OPENAI_API_KEY}`,
			"OpenAI-Beta": "realtime=v1",
			Connection: "upgrade",
			Upgrade: "websocket",
		  },
		}
	  );
  
	  // @ts-ignore Cloudflare runtime
	  const upstreamWS = upstreamResp.webSocket;
	  if (!upstreamWS) return new Response("Failed to connect upstream", { status: 502 });
  
	  // @ts-ignore Cloudflare runtime
	  serverWS.accept();
	  // @ts-ignore Cloudflare runtime
	  upstreamWS.accept();
  
	  serverWS.addEventListener("message", (e) => upstreamWS.send(e.data));
	  upstreamWS.addEventListener("message", (e) => serverWS.send(e.data));
  
	  const close = () => { try { serverWS.close(); } catch {} try { upstreamWS.close(); } catch {} };
	  serverWS.addEventListener("close", close);
	  serverWS.addEventListener("error", close);
	  upstreamWS.addEventListener("close", close);
	  upstreamWS.addEventListener("error", close);
  
	  // @ts-ignore Cloudflare runtime
	  return new Response(null, { status: 101, webSocket: clientWS });
	},
  } satisfies ExportedHandler<{ OPENAI_API_KEY: string }>;