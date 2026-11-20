import { database } from "./db";

// Fonte única dos avisos: calendário interno + eventos importados do Teams.
// Os compromissos privados nunca retornam pauta, convidados ou link.
export async function dueCalendarEvents({ beforeMinutes = 2, afterMinutes = 15 } = {}) {
  const sql = database();
  const rows = await sql.query(
    `SELECT * FROM (
    SELECT ('calendar:'||e.id::text) AS event_key,
      e.id::text AS event_id,'calendar'::text AS source,
      e.title,e.description,e.location,''::text AS join_url,
      e.kind,e.owner_email,e.starts_at,e.ends_at,
      false AS is_private,
      ARRAY(SELECT lower(a.email) FROM cc_calendar_attendees a WHERE a.event_id=e.id) AS attendees
    FROM cc_calendar_events e
    WHERE e.deleted_at IS NULL AND e.status='agendado'
      AND (e.external_task_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM cc_commercial_tasks t WHERE t.id=e.external_task_id
        AND (t.payload ? 'deletedAt' OR COALESCE(t.payload->>'archived','false')='true')))
      AND e.starts_at BETWEEN now()-($1::numeric*interval '1 minute')
                           AND now()+($2::numeric*interval '1 minute')
    UNION ALL
    SELECT ('microsoft:'||encode(sha256(convert_to(m.owner_email||':'||m.graph_id,'UTF8')),'hex')) AS event_key,
      m.graph_id AS event_id,'microsoft'::text AS source,
      m.title,CASE WHEN m.is_private THEN '' ELSE m.description END,
      CASE WHEN m.is_private THEN '' ELSE m.location END,
      CASE WHEN m.is_private THEN '' ELSE m.join_url END,
      'microsoft'::text AS kind,m.owner_email,m.starts_at,m.ends_at,m.is_private,
      ARRAY[]::text[] AS attendees
    FROM cc_microsoft_calendar_events m
    WHERE m.starts_at BETWEEN now()-($1::numeric*interval '1 minute')
                           AND now()+($2::numeric*interval '1 minute')
   ) upcoming
   ORDER BY starts_at ASC
   LIMIT 350`,
    [beforeMinutes, afterMinutes],
  );
  return rows;
}
export function canSeeDueEvent(access, event) {
  const role = access?.role;
  if (["developer", "admin", "gestor"].includes(role)) return true;
  const user = String(access?.email || "").toLowerCase();
  return (
    user === String(event.owner_email || "").toLowerCase() ||
    (Array.isArray(event.attendees) && event.attendees.includes(user))
  );
}
