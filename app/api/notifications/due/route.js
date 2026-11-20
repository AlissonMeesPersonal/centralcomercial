import { getAccess } from "../../../../lib/access";
import { canSeeDueEvent, dueCalendarEvents } from "../../../../lib/due-events";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const access = await getAccess();
    if (!access.allowed) return Response.json({ error: "Acesso não autorizado." }, { status: 403 });
    const events = (await dueCalendarEvents({ beforeMinutes: 2, afterMinutes: 15 }))
      .filter((event) => canSeeDueEvent(access, event))
      .map((event) => ({
        id: event.event_key,
        title: event.title,
        description: String(event.description || "").slice(0, 700),
        kind: event.kind,
        source: event.source,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        url: event.join_url && /^https:\/\//i.test(event.join_url) ? event.join_url : "",
        private: !!event.is_private,
      }));
    return Response.json(
      { events, now: new Date().toISOString() },
      {
        headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
      },
    );
  } catch (e) {
    console.error("Reminder loading error", e?.code || "unavailable");
    return Response.json({ error: "Não foi possível consultar os avisos." }, { status: 503 });
  }
}
