import { timingSafeEqual } from "node:crypto";
import { database } from "../../../../lib/db";
import { configured, performSync } from "../../../../lib/microsoft-calendar";
import { githubCronAuthorized } from "../../../../lib/github-oidc-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };

// O cron diário da Vercel utiliza CRON_SECRET. O GitHub Actions, agendado
// a cada cinco minutos, apresenta um JWT OIDC de curta duração e assinado.
// Nenhum outro visitante pode iniciar a leitura dos calendários.
async function authorized(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const a = Buffer.from(token),
      b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return githubCronAuthorized(token);
}

export async function GET(request) {
  if (!(await authorized(request)))
    return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  if (!configured())
    return Response.json(
      { skipped: true, reason: "Microsoft não configurado." },
      { headers: noStore },
    );

  try {
    const sql = database();
    // Mais antigas primeiro. Rodadas futuras distribuem as demais contas.
    const connections = await sql.query(
      "SELECT * FROM cc_microsoft_calendar_connections WHERE status='connected' ORDER BY last_synced_at ASC NULLS FIRST LIMIT 8",
    );
    const results = [];
    const started = Date.now();
    for (const connection of connections) {
      // Evita iniciar nova leitura Graph se restar pouco tempo de execução.
      if (Date.now() - started > 45000) break;
      try {
        const updated = await performSync(connection);
        results.push({ ok: true, synced: updated.synced });
      } catch (e) {
        console.error("Microsoft cron sync failed", e?.code || "sync_error");
        results.push({ ok: false });
      }
    }
    return Response.json(
      {
        processed: results.length,
        ok: results.filter((x) => x.ok).length,
        failed: results.filter((x) => !x.ok).length,
        queued: Math.max(0, connections.length - results.length),
      },
      { headers: noStore },
    );
  } catch (e) {
    console.error("Microsoft cron failed", e?.code || "database_error");
    return Response.json(
      { error: "Falha na rotina de sincronização." },
      { status: 503, headers: noStore },
    );
  }
}
