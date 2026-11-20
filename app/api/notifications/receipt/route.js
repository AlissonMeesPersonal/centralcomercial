import { createHash } from "node:crypto";
import { getAccess } from "../../../../lib/access";
import { database } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const validToken = value => typeof value === "string" && /^[0-9a-f]{48}$/.test(value);
const allowedStages = {
  received: "received_at",
  displayed: "displayed_at",
  clicked: "clicked_at",
  failed: "display_error_at",
};

// As confirmações usam um token de uso restrito recebido SOMENTE dentro
// do payload Web Push cifrado para aquele dispositivo. Não há exposição
// de dados de agenda nem necessidade de abrir uma sessão da Central.
export async function POST(request) {
  if (Number(request.headers.get("content-length") || 0) > 250)
    return Response.json({ error: "Dados excessivos." }, { status: 413, headers: cache });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origem não permitida." }, { status: 403, headers: cache });

  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Dados inválidos." }, { status: 400, headers: cache });
  }
  if (!validToken(body?.token) || !Object.hasOwn(allowedStages, body?.stage))
    return Response.json({ error: "Confirmação inválida." }, { status: 422, headers: cache });

  try {
    const hash = createHash("sha256").update(body.token).digest("hex");
    const column = allowedStages[body.stage];
    await database().query(
      `UPDATE cc_push_deliveries
       SET ${column} = COALESCE(${column}, now())
       WHERE receipt_token_hash = $1`,
      [hash]
    );
    return new Response(null, { status: 204, headers: cache });
  } catch {
    return Response.json({ error: "Não foi possível registrar a confirmação." }, {
      status: 503, headers: cache
    });
  }
}

// Diagnóstico pessoal: não revela endereços push, chaves, reuniões
// ou dados de outros usuários. Só mostra as etapas de cada envio.
export async function GET() {
  try {
    const access = await getAccess();
    if (!access?.allowed)
      return Response.json({ error: "Acesso não autorizado." }, { status: 403, headers: cache });
    const rows = await database().query(
      `SELECT d.event_key LIKE 'manual-push-test:%' AS test,
              d.sent_at AS dispatched_at,
              d.received_at, d.displayed_at, d.clicked_at, d.display_error_at
         FROM cc_push_deliveries d
         JOIN cc_push_subscriptions s ON s.id = d.subscription_id
        WHERE lower(s.owner_email) = lower($1)
        ORDER BY d.sent_at DESC
        LIMIT 12`,
      [access.email]
    );
    return Response.json({ deliveries: rows }, { headers: {
      ...cache, "Vary": "Cookie"
    }});
  } catch {
    return Response.json({ error: "Diagnóstico indisponível." }, { status: 503, headers: cache });
  }
}
