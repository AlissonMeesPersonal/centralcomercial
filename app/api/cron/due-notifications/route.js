import { database } from "../../../../lib/db";
import { githubCronAuthorized } from "../../../../lib/github-oidc-cron";
import { canSeeDueEvent, dueCalendarEvents } from "../../../../lib/due-events";
import { pushConfigured, sendWebPush } from "../../../../lib/web-push";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };
const audience = "https://centralcomercial-eta.vercel.app/api/cron/due-notifications";

async function isAuthorized(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const a = Buffer.from(token),
      b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return githubCronAuthorized(token, audience);
}

export async function GET(request) {
  if (!(await isAuthorized(request)))
    return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  if (!pushConfigured())
    return Response.json(
      { active: false, reason: "Web Push não configurado." },
      { headers: noStore },
    );
  const sql = database(),
    started = Date.now();
  try {
    // A rotina do GitHub roda a cada ~5 minutos: avisa reuniões cujo horário
    // chegou no intervalo recente, sem adiantar avisos do próximo compromisso.
    const events = await dueCalendarEvents({ beforeMinutes: 5, afterMinutes: 0.5 });
    if (!events.length) return Response.json({ processed: 0, sent: 0 }, { headers: noStore });
    const subscriptions = await sql.query(
      "SELECT s.id,s.owner_email,s.endpoint,s.p256dh,s.auth,CASE WHEN d.email IS NOT NULL THEN 'developer' ELSE m.role END AS role FROM cc_push_subscriptions s LEFT JOIN cc_hidden_developers d ON lower(d.email)=lower(s.owner_email) LEFT JOIN cc_team_members m ON lower(m.email)=lower(s.owner_email) AND m.status='active' WHERE d.email IS NOT NULL OR m.email IS NOT NULL ORDER BY s.created_at DESC LIMIT 120",
    );
    let sent = 0,
      failed = 0,
      claimed = 0;
    for (const sub of subscriptions) {
      if (Date.now() - started > 44000) break;
      for (const event of events) {
        if (Date.now() - started > 44000 || claimed >= 120) break;
        if (!canSeeDueEvent(sub, event)) continue;
        const marker = await sql.query(
          "INSERT INTO cc_push_deliveries(subscription_id,event_key,starts_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_key",
          [sub.id, event.event_key, event.starts_at],
        );
        if (!marker.length) continue;
        claimed++;
        try {
          const receipt = randomBytes(24).toString("hex");
          const receiptHash = createHash("sha256").update(receipt).digest("hex");
          await sql.query(
            "UPDATE cc_push_deliveries SET receipt_token_hash = $4 WHERE subscription_id = $1 AND event_key = $2 AND starts_at = $3",
            [sub.id, event.event_key, event.starts_at, receiptHash],
          );
          const message = {
            title:
              "26Fit • " + (event.kind === "microsoft" ? "Reunião Teams" : "Compromisso agendado"),
            body: event.title.slice(0, 130),
            tag:
              "cc-due-" + event.event_key.slice(0, 90) + "-" + new Date(event.starts_at).getTime(),
            data: {
              url: "/?section=calendar&reminder=" + encodeURIComponent(event.event_key),
              receipt,
            },
          };
          const result = await sendWebPush(sub, message);
          if (result.ok) {
            sent++;
            continue;
          }
          failed++;
          if ([404, 410].includes(result.status)) {
            await sql.query("DELETE FROM cc_push_subscriptions WHERE id=$1", [sub.id]);
          } else {
            await sql.query(
              "DELETE FROM cc_push_deliveries WHERE subscription_id=$1 AND event_key=$2 AND starts_at=$3",
              [sub.id, event.event_key, event.starts_at],
            );
          }
        } catch (e) {
          failed++;
          console.error("Web push delivery failed", e?.code || "delivery_error");
          await sql
            .query(
              "DELETE FROM cc_push_deliveries WHERE subscription_id=$1 AND event_key=$2 AND starts_at=$3",
              [sub.id, event.event_key, event.starts_at],
            )
            .catch(() => {});
        }
      }
    }
    return Response.json(
      { processed: claimed, sent, failed, subscriptions: subscriptions.length },
      { headers: noStore },
    );
  } catch (e) {
    console.error("Web push scheduler failed", e?.code || "unavailable");
    return Response.json(
      { error: "Não foi possível distribuir os avisos." },
      { status: 503, headers: noStore },
    );
  }
}
