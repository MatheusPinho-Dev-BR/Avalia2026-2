import {
  clearOAuthStateCookie,
  createSessionCookieValue,
  isValidOAuthState,
  sessionCookieHeader,
} from "../../../_lib/session.js";

function redirectWithError(origin, error) {
  const response = new Response(null, {
    status: 302,
    headers: { Location: new URL(`/?auth_error=${encodeURIComponent(error)}`, origin).href },
  });
  response.headers.append("Set-Cookie", clearOAuthStateCookie());
  return response;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");

  if (!isValidOAuthState(request, state)) {
    console.warn("Callback OAuth do Discord rejeitado: state ausente ou inválido.");
    return redirectWithError(url.origin, "invalid_state");
  }

  const providerError = url.searchParams.get("error");
  if (providerError) return redirectWithError(url.origin, "authorization_denied");

  const code = url.searchParams.get("code");
  if (!code) return redirectWithError(url.origin, "missing_code");
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    console.error("Credenciais OAuth do Discord não configuradas.");
    return redirectWithError(url.origin, "missing_credentials");
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.warn("Discord recusou a troca do authorization code:", tokenRes.status);
      return redirectWithError(url.origin, "token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    if (!tokenData || typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      console.warn("Resposta inválida do endpoint de token do Discord.");
      return redirectWithError(url.origin, "token_exchange_failed");
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      console.warn("Discord recusou a consulta do perfil:", userRes.status);
      return redirectWithError(url.origin, "fetch_user_failed");
    }

    const discordUser = await userRes.json();
    if (
      !discordUser ||
      typeof discordUser.id !== "string" ||
      !discordUser.id ||
      typeof discordUser.username !== "string" ||
      !discordUser.username
    ) {
      console.warn("Perfil retornado pelo Discord inválido.");
      return redirectWithError(url.origin, "fetch_user_failed");
    }

    const username =
      typeof discordUser.global_name === "string" && discordUser.global_name.trim()
        ? discordUser.global_name.trim()
        : discordUser.username;
    const avatar =
      typeof discordUser.avatar === "string" && discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(discordUser.id)}/${encodeURIComponent(discordUser.avatar)}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png";
    const sessionUser = { userId: discordUser.id, username, avatar };

    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP",
        ).bind(sessionUser.userId, sessionUser.username, sessionUser.avatar).run();
      } catch (error) {
        console.error("Falha ao persistir perfil Discord no D1:", error);
      }
    }

    const cookieValue = await createSessionCookieValue(sessionUser, env.DISCORD_CLIENT_SECRET);
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: "/?login=success",
        "Set-Cookie": sessionCookieHeader(cookieValue),
      },
    });
    response.headers.append("Set-Cookie", clearOAuthStateCookie());
    return response;
  } catch (error) {
    console.error("Falha inesperada no callback OAuth do Discord:", error);
    return redirectWithError(url.origin, "exception");
  }
}
