import { createOAuthState } from "../../_lib/session.js";

/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages para login.",
    }, { status: 503 });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const state = createOAuthState();
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.href,
      "Set-Cookie": `discord_oauth_state=${state}; Path=/api/auth/discord/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
