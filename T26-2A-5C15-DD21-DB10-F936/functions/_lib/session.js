const SESSION_COOKIE = "discord_session";

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function createOAuthState() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function isValidOAuthState(request, state) {
  const cookieState = getCookie(request, "discord_oauth_state");
  return Boolean(state && cookieState && safeEqual(state, cookieState));
}

export async function createSessionCookieValue(user, secret) {
  const payload = {
    userId: user.userId,
    username: user.username,
    avatar: user.avatar || null,
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signedValue = `v1.${encodedPayload}`;
  return `${signedValue}.${await sign(signedValue, secret)}`;
}

export async function readSession(request, secret) {
  if (!secret) return null;
  const value = getCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const [version, encodedPayload, signature, extra] = value.split(".");
  if (version !== "v1" || !encodedPayload || !signature || extra !== undefined) return null;

  const signedValue = `${version}.${encodedPayload}`;
  if (!safeEqual(signature, await sign(signedValue, secret))) return null;

  try {
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(encodedPayload)));
    if (
      !payload ||
      typeof payload.userId !== "string" ||
      !payload.userId ||
      typeof payload.username !== "string" ||
      !payload.username ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      avatar: typeof payload.avatar === "string" ? payload.avatar : null,
    };
  } catch (error) {
    console.warn("Sessão Discord inválida:", error);
    return null;
  }
}

export function clearOAuthStateCookie() {
  return "discord_oauth_state=; Path=/api/auth/discord/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function sessionCookieHeader(value) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}
