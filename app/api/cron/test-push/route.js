import { database } from "../../../../lib/db";
import { githubCronAuthorized } from "../../../../lib/github-oidc-cron";
import { sendWebPush, pushConfigured } from "../../../../lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const audience = "https://centralcomercial-eta.vercel.app/api/cron/test-push";
const TEST_TIME = "2000-01-01T00:00:00.000Z";

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const ownerHash = params.get("owner_hash") || "";
  const testId = params.get("test_id") || "";
  const auth = request.headers.get("authorization") || "";

  // O envio só pode ser solicitado por um workflow do repositório autorizado,
  // assinado pelo GitHub e vinculado ao próprio commit que iniciou o teste.
  if (
    !/^[a-f0-9]{64}$/.test(ownerHash) ||
    !/^[a-f0-9]{40}$/.test(testId) ||
    !auth.startsWith("Bearer ") ||
    !(await githubCronAuthorized(auth.slice(7), audience, testId))
  ) {
    return Response.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }
  if (!pushConfigured()) {
    return Response.json({ error: "Web Push não configurado." }, { status: 503, headers: noStore });
  }

  const sql = database();
  try {
    // Apenas dispositivos de desenvolvedores já inscritos podem receber
    // este teste remoto. Nenhum usuário da rede recebe mensagens inesperadas.
    const subscriptions = await sql.query(
      `SELECT s.id, s.endpoint, s.p256dh, s.auth
         FROM cc_push_subscriptions s
         JOIN cc_hidden_developers h ON lower(s.owner_email) = lower(h.email)
         WHERE encode(sha256(convert_to(lower(s.owner_email), 'UTF8')), 'hex') = $1
         ORDER BY s.updated_at DESC LIMIT 5`,
      [ownerHash],
    );

    const key = "manual-push-test:" + testId;
    let accepted = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const saved = await sql.query(
        `INSERT INTO cc_push_deliveries(subscription_id, event_key, starts_at)
         VALUES($1, $2, $3::timestamptz)
         ON CONFLICT DO NOTHING
         RETURNING event_key`,
        [sub.id, key, TEST_TIME],
      );
      if (!saved.length) continue;

      try {
        const response = await sendWebPush(sub, {
          title: "26Fit • Teste remoto de notificações",
          body: "A Central está fechada e a notificação chegou! Nenhum compromisso foi criado.",
          tag: "cc-remote-test-" + testId,
          data: { url: "/?section=calendar" },
        });

        if (response.ok) accepted++;
        else {
          failed++;
          if ([404, 410].includes(response.status)) {
            await sql.query("DELETE FROM cc_push_subscriptions WHERE id = $1", [sub.id]);
          } else {
            await sql.query(
              "DELETE FROM cc_push_deliveries WHERE subscription_id = $1 AND event_key = $2 AND starts_at = $3",
              [sub.id, key, TEST_TIME],
            );
          }
        }
      } catch (e) {
        failed++;
        console.error("Push remoto falhou", e?.code || "send_failed");
        await sql.query(
          "DELETE FROM cc_push_deliveries WHERE subscription_id = $1 AND event_key = $2 AND starts_at = $3",
          [sub.id, key, TEST_TIME],
        ).catch(() => {});
      }
    }

    return Response.json(
      { accepted, failed, devices: subscriptions.length, test: true },
      { headers: noStore },
    );
  } catch (e) {
    console.error("Teste remoto indisponível", e?.code || "db_unavailable");
    return Response.json({ error: "Não foi possível testar as notificações." }, { status: 503, headers: noStore });
  }
}
