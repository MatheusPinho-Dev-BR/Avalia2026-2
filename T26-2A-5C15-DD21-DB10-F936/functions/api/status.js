import { readSession } from "../_lib/session.js";

/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const chave = "T26-2A-5C15-DD21-DB10-F936";
  const projectId = 0;
  const projectTitle = "Projeto 0 (Teste de Ambiente e Entrega — Sem Nota): Painel de Diagnóstico Cloudflare + D1 + Discord";

  const sessionUser = await readSession(request, env.DISCORD_CLIENT_SECRET);

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];

    if (env.DB) {
      try {
        const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records").first();
        const listRes = await env.DB.prepare("SELECT id, user_id, username, conteudo, created_at FROM project_records ORDER BY id DESC LIMIT 10").all();
        dbConnected = true;
        totalRegistros = Number(countRow?.total || 0);
        ultimosRegistros = listRes.results || [];
      } catch (err) {
        console.error("Falha ao consultar o D1 em /api/status GET:", err);
      }
    }

    return Response.json({
      ok: true,
      chave,
      projectId,
      projectTitle,
      d1Connected: dbConnected,
      discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      sessionUser,
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (request.method === "POST") {
    if (!sessionUser) {
      return Response.json({ ok: false, error: "Autenticação obrigatória." }, { status: 401 });
    }

    if (!env.DB) {
      return Response.json({ ok: false, error: "Banco de dados indisponível." }, { status: 503 });
    }

    let body;
    try {
      if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
        return Response.json({ ok: false, error: "Content-Type deve ser application/json." }, { status: 400 });
      }
      body = await request.json();
    } catch (err) {
      console.warn("Payload JSON inválido em /api/status POST:", err);
      return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.conteudo !== "string") {
      return Response.json({ ok: false, error: "Conteúdo obrigatório." }, { status: 400 });
    }
    const conteudo = body.conteudo.trim();
    if (!conteudo || conteudo.length > 500) {
      return Response.json({ ok: false, error: "Conteúdo deve ter entre 1 e 500 caracteres." }, { status: 400 });
    }

    try {
      await env.DB.prepare(
        "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
      ).bind(sessionUser.userId, sessionUser.username, chave, conteudo).run();
    } catch (err) {
      console.error("Falha ao gravar diagnóstico no D1:", err);
      return Response.json({ ok: false, error: "Banco de dados indisponível." }, { status: 503 });
    }

    return Response.json({
      ok: true,
      saved: true,
      chave,
      serverTimestamp: new Date().toISOString(),
    }, { status: 201 });
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
