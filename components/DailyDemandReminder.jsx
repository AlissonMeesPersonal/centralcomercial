"use client";
import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, Clock3, X } from "lucide-react";

const dateInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const daysBetween = (today, due) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || "")) return null;
  const timestamp = (value) => Date.parse(value + "T12:00:00Z");
  return Math.round((timestamp(due) - timestamp(today)) / 86400000);
};
const deadlineText = (days) =>
  days === null
    ? "Sem data"
    : days < 0
      ? Math.abs(days) + " dia(s) em atraso"
      : days === 0
        ? "Vence hoje"
        : "Faltam " + days + " dia(s)";

export default function DailyDemandReminder({ tasks, ready, userEmail, onOpenTask }) {
  const [today, setToday] = useState(dateInBrazil);
  const [visible, setVisible] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [filter, setFilter] = useState("all");
  const key = "cc-daily-demand-reminder-v1:" + String(userEmail || "user").toLowerCase();
  const demands = useMemo(
    () =>
      (tasks || [])
        .filter((task) => !task.archived && !task.deletedAt && task.stage !== "Concluído")
        .map((task) => {
          const items = (Array.isArray(task.checklist) ? task.checklist : []).filter(
            (item) => !item.done,
          );
          const completed =
            (Array.isArray(task.checklist) ? task.checklist : []).length - items.length;
          const pending = items
            .map((item) => ({
              ...item,
              days: daysBetween(today, item.due || task.due),
              individualDue: Boolean(item.due),
            }))
            .sort((a, b) => (a.days ?? 999999) - (b.days ?? 999999));
          return { task, pending, completed, days: daysBetween(today, task.due) };
        })
        .filter((entry) => entry.pending.length)
        .sort((a, b) => (a.pending[0].days ?? 999999) - (b.pending[0].days ?? 999999)),
    [tasks, today],
  );
  const pendingCount = demands.reduce((count, entry) => count + entry.pending.length, 0);
  const overdueCount = demands.reduce(
    (count, entry) =>
      count + entry.pending.filter((item) => item.days !== null && item.days < 0).length,
    0,
  );
  const matchesFilter = (item) => {
    if (filter === "overdue") return item.days !== null && item.days < 0;
    if (filter === "today") return item.days === 0;
    if (filter === "week") return item.days !== null && item.days >= 0 && item.days <= 7;
    return true;
  };
  const shown = demands.filter((entry) => entry.pending.some(matchesFilter));
  const filterLabels = {
    all: "Nenhum checklist pendente. Tudo em dia!",
    overdue: "Nenhuma atividade atrasada.",
    today: "Nenhuma atividade vence hoje.",
    week: "Nenhuma atividade vence nos próximos 7 dias.",
  };

  useEffect(() => {
    const checkDay = () => setToday(dateInBrazil());
    const interval = setInterval(checkDay, 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!ready || initialized) return;
    setInitialized(true);
    try {
      if (window.localStorage.getItem(key) !== today && demands.length) setVisible(true);
    } catch {
      if (demands.length) setVisible(true);
    }
  }, [ready, initialized, key, today, demands.length]);
  useEffect(() => {
    if (!ready || !initialized) return;
    try {
      if (demands.length && window.localStorage.getItem(key) !== today) setVisible(true);
    } catch {
      // Falha no armazenamento não bloqueia os lembretes.
    }
  }, [today, key, ready, initialized, demands.length]);
  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(key, today);
    } catch {}
  };

  return (
    <>
      <button
        type="button"
        className="cc-daily-reminder-trigger"
        onClick={() => setVisible(true)}
        title="Consultar checklist e prazos pendentes"
        aria-label={"Pendências diárias: " + pendingCount + " atividades"}
      >
        <BellRing size={16} /> <span>Pendências</span> <b>{pendingCount}</b>
      </button>
      {visible && (
        <div
          className="cc-daily-reminder-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-daily-reminder-title"
            className="cc-daily-reminder-panel"
          >
            <header className="cc-daily-reminder-head">
              <div>
                <small>26FIT • CENTRAL COMERCIAL</small>
                <h2 id="cc-daily-reminder-title">
                  <BellRing size={21} /> Seu checklist de hoje
                </h2>
                <p>Confira as demandas em andamento e os prazos de cada atividade.</p>
              </div>
              <button type="button" aria-label="Fechar lembrete" onClick={dismiss}>
                <X size={20} />
              </button>
            </header>
            <div className="cc-daily-reminder-summary">
              <div>
                <strong>{demands.length}</strong>
                <span>Demandas pendentes</span>
              </div>
              <div>
                <strong>{pendingCount}</strong>
                <span>Atividades abertas</span>
              </div>
              <div>
                <strong>{overdueCount}</strong>
                <span>Atividades atrasadas</span>
              </div>
            </div>
            <div className="cc-daily-reminder-filters" aria-label="Filtrar atividades pendentes">
              {[
                ["overdue", "Atrasadas"],
                ["today", "Vencem hoje"],
                ["week", "Próximos 7 dias"],
                ["all", "Todas"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="cc-daily-reminder-list">
              {!shown.length && (
                <p className="cc-daily-reminder-empty">
                  <CheckCircle2 size={19} />{" "}
                  {demands.length ? filterLabels[filter] : filterLabels.all}
                </p>
              )}
              {shown.map(({ task, pending, completed, days }) => (
                <article className="cc-daily-reminder-task" key={task.id}>
                  <div className="cc-daily-reminder-task-heading">
                    <button
                      type="button"
                      onClick={() => {
                        dismiss();
                        onOpenTask(task);
                      }}
                    >
                      {task.title}
                    </button>
                    <span>
                      <CalendarDays size={13} /> {deadlineText(days)}
                    </span>
                  </div>
                  <small>
                    {completed}/{completed + pending.length} concluídas • {pending.length}{" "}
                    pendente(s)
                  </small>
                  <div className="cc-daily-reminder-progress">
                    <span
                      style={{
                        width:
                          (completed + pending.length
                            ? (completed * 100) / (completed + pending.length)
                            : 0) + "%",
                      }}
                    />
                  </div>
                  <ul>
                    {pending.filter(matchesFilter).map((item) => (
                      <li key={item.id}>
                        <span>{item.title || "Atividade sem título"}</span>
                        <small className={item.days !== null && item.days < 0 ? "late" : ""}>
                          <Clock3 size={12} />
                          {deadlineText(item.days)}
                          {item.individualDue ? " • prazo da atividade" : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <footer>
              <span>Atualizado automaticamente com as demandas compartilhadas.</span>
              <button type="button" onClick={dismiss}>
                Entendi, fechar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
