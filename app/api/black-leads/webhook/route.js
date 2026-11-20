import { createHash } from "node:crypto";
import { database } from "../../../../lib/db";
import { headers, importLeads, mapSheetRows } from "../../../../lib/black-leads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data, status = 200) => Response.json(data, { status, headers });
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /i, "").trim();
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token))
    return json({ error: "Chave de integração ausente." }, 401);
  if (Number(request.headers.get("content-length") || 0) > 750000)
    return json({ error: "Lote acima de 750 KB." }, 413);
  const sql = database(),
    hash = createHash("sha256").update(token).digest("hex");
  const rows = await sql.query(
    "SELECT id,label FROM cc_black_sync_sources WHERE token_hash=$1 AND active=true LIMIT 1",
    [hash],
  );
  if (!rows.length) return json({ error: "Integração revogada ou inválida." }, 403);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  if (
    !Array.isArray(body.headers) ||
    !Array.isArray(body.rows) ||
    body.headers.length > 150 ||
    body.rows.length > 300 ||
    body.rows.length < 1
  )
    return json(
      { error: "O Google Sheets deve enviar até 300 linhas por lote e os títulos das colunas." },
      422,
    );
  const sourceId = String(body.sourceId || "").slice(0, 150);
  const numbers = Array.isArray(body.rowNumbers) ? body.rowNumbers.map(Number) : [];
  if (
    !sourceId ||
    numbers.length !== body.rows.length ||
    numbers.some((x) => !Number.isSafeInteger(x) || x < 2)
  )
    return json(
      { error: "Informe ID da planilha e número real das linhas para evitar duplicação." },
      422,
    );
  try {
    const records = mapSheetRows(body.headers, body.rows, numbers, sourceId);
    const result = await importLeads(
      records,
      "Google Sheets: " + rows[0].label,
      "Sincronização automática",
      "google",
    );
    await sql.query(
      "UPDATE cc_black_sync_sources SET last_sync_at=now(),last_error=NULL WHERE id=$1::uuid",
      [rows[0].id],
    );
    return json({ ok: true, ...result });
  } catch (e) {
    await sql
      .query("UPDATE cc_black_sync_sources SET last_error=$2 WHERE id=$1::uuid", [
        rows[0].id,
        String(e.message || "Falha na importação").slice(0, 240),
      ])
      .catch(() => {});
    return json({ error: e.message || "Planilha incompatível." }, 422);
  }
}
