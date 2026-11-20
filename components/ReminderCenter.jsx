"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldCheck,
  X,
} from "lucide-react";

const dateTime = (value) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
const destination = (id) => "/?section=calendar&reminder=" + encodeURIComponent(id);
const ONBOARDING_SESSION_KEY = "cc-reminder-notification-onboarding-v1";

export default function ReminderCenter({ onOpenReminder }) {
  const [permission, setPermission] = useState("checking");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]);
  const [pageVisible, setPageVisible] = useState(true);
  const polling = useRef(false);
  const observed = useRef(new Set());
  const active = queue[0] || null;

  const notifyNative = useCallback(
    async (event) => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      if (document.visibilityState === "visible" && document.hasFocus()) return;
      const title =
        "26Fit • " + (event.source === "microsoft" ? "Reunião Teams" : "Compromisso agora");
      const options = {
        body: String(event.title || "").slice(0, 130),
        tag: "cc-due-" + event.id.slice(0, 90) + "-" + new Date(event.startsAt).getTime(),
        data: { url: destination(event.id) },
        icon: "/logo_v2.png",
        silent: false,
        renotify: false,
      };
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, options);
        } else {
          const note = new Notification(title, options);
          note.onclick = () => {
            window.focus();
            onOpenReminder?.(event.id);
            note.close();
          };
        }
      } catch {
        /* A janela na Central continua disponível mesmo sem notificações nativas. */
      }
    },
    [onOpenReminder],
  );

  // Detecta a permissão e uma inscrição anterior antes de mostrar o convite,
  // evitando pedir ativação a quem já recebe notificações neste navegador.
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        if (mounted) setPermission("unsupported");
        return;
      }

      let state = Notification.permission;

      if (state === "granted") {
        try {
          const registration = await navigator.serviceWorker.register("/push-sw.js", {
            scope: "/",
          });
          const subscription = await registration.pushManager?.getSubscription();

          if (subscription) {
            const response = await fetch("/api/notifications/push", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(subscription.toJSON()),
            });

            if (response.ok) state = "enabled";
          }
        } catch {
          // A Central continua funcionando mesmo se o serviço push estiver fora.
        }
      }

      if (mounted) setPermission(state);
    }

    void initialize();
    return () => {
      mounted = false;
    };
  }, []);

  // Mostra uma única vez por sessão. Se a pessoa optar por "Agora não",
  // o convite volta apenas no próximo login (não a cada atualização da página).
  useEffect(() => {
    if (permission !== "default" && permission !== "granted") {
      setShowOnboarding(false);
      return;
    }

    try {
      if (window.sessionStorage.getItem(ONBOARDING_SESSION_KEY) === "dismissed") return;
    } catch {
      // Modo privado sem storage: o usuário ainda pode escolher.
    }

    setShowOnboarding(true);
  }, [permission]);

  const dismissOnboarding = () => {
    try {
      window.sessionStorage.setItem(ONBOARDING_SESSION_KEY, "dismissed");
    } catch {}
    setShowOnboarding(false);
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator))
        throw Error("Este navegador não suporta notificações em segundo plano.");
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted")
        throw Error("Permita notificações para este site nas configurações do navegador.");
      const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      if (!("pushManager" in registration))
        throw Error("Notificações permitidas, mas o Web Push não está disponível neste navegador.");
      const configResponse = await fetch("/api/notifications/push", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.configured || !config.publicKey)
        throw Error("A configuração das notificações ainda não está disponível.");
      const decoder = (key) => {
        const str = key.replace(/-/g, "+").replace(/_/g, "/");
        const padded = str.padEnd(Math.ceil(str.length / 4) * 4, "=");
        return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      };
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decoder(config.publicKey),
        });
      }
      const response = await fetch("/api/notifications/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Não foi possível ativar os avisos.");
      setPermission("enabled");
      dismissOnboarding();
    } catch (e) {
      setError(e.message || "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

  // Teste manual: não cria evento, não grava dados e não entra na fila
  // de notificações automáticas. Dispara o mesmo modal usado em produção
  // e uma notificação local do navegador quando a permissão já foi dada.
  useEffect(() => {
    const handleTest = () => {
      const now = new Date().toISOString();
      const demo = {
        id: "test-calendar-notification",
        title: "Reunião de teste • Central Comercial",
        description:
          "Esta é uma demonstração do alerta. Nenhum compromisso foi cadastrado no calendário.",
        source: "microsoft",
        startsAt: now,
        url: "",
        private: false,
        demo: true,
      };

      setShowOnboarding(false);
      setPageVisible(true);
      setQueue((previous) => [demo, ...previous.filter((item) => !item.demo)]);

      if (!("Notification" in window) || Notification.permission !== "granted") {
        return; // O modal aparece mesmo sem autorização do navegador.
      }

      const options = {
        body: "Seu aviso de teste está funcionando! Nenhuma reunião foi criada.",
        tag: "cc-manual-test-" + Date.now(),
        icon: "/logo_v2.png",
        data: { url: "/?section=calendar" },
      };

      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .register("/push-sw.js", { scope: "/" })
          .then((registration) =>
            registration.showNotification("26Fit • Teste de notificação", options),
          )
          .catch(() => {});
      } else {
        try {
          const notification = new Notification("26Fit • Teste de notificação", options);
          notification.onclick = () => {
            window.focus();
            window.location.assign("/?section=calendar");
            notification.close();
          };
        } catch {
          // O teste do modal continua disponível sem a notificação do sistema.
        }
      }
    };

    window.addEventListener("26fit:test-calendar-notifications", handleTest);
    return () => {
      window.removeEventListener("26fit:test-calendar-notifications", handleTest);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const response = await fetch("/api/notifications/due", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!mounted) return;
        const now = Date.now();
        const eligible = (Array.isArray(data.events) ? data.events : []).filter((event) => {
          const start = new Date(event.startsAt).getTime();
          if (!Number.isFinite(start) || start > now + 15000 || start < now - 120000) return false;
          const key = event.id + "|" + event.startsAt;
          if (observed.current.has(key)) return false;
          observed.current.add(key);
          try {
            const storageKey = "cc-due-notified:" + key;
            if (window.localStorage.getItem(storageKey)) return false;
            window.localStorage.setItem(storageKey, String(now));
          } catch {
            /* Janela privada: memória da guia continua evitando duplicações. */
          }
          return true;
        });
        if (!eligible.length) return;
        // A janela fica na fila mesmo quando o usuário está em outra aba:
        // ao voltar à Central, ele encontra o aviso no centro da tela.
        setQueue((old) => [...old, ...eligible]);
        if (document.visibilityState !== "visible" || !document.hasFocus()) {
          for (const event of eligible) void notifyNative(event);
        }
      } catch {
        /* Avisos são acessórios; não bloqueiam o sistema se a API estiver fora. */
      } finally {
        polling.current = false;
      }
    };
    const timer = setInterval(check, 15000);
    const onFocus = () => {
      setPageVisible(document.visibilityState === "visible");
      void check();
    };
    const onVisible = () => {
      setPageVisible(document.visibilityState === "visible");
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    void check();
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [notifyNative]);

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker?.getRegistration("/");
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        const result = await fetch("/api/notifications/push", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!result.ok) throw Error("Não foi possível desativar a inscrição no servidor.");
        await subscription.unsubscribe();
      }
      setPermission("granted");
    } catch (e) {
      setError(e.message || "Não foi possível desativar.");
    } finally {
      setBusy(false);
    }
  };
  const dismiss = () => setQueue((x) => x.slice(1));
  const open = () => {
    if (!active) return;
    const id = active.id;
    const isDemo = !!active.demo;
    dismiss();
    if (isDemo) {
      window.location.assign("/?section=calendar");
      return;
    }
    onOpenReminder?.(id);
  };
  return (
    <>
      <div className="cc-reminder-permission">
        {["default", "checking"].includes(permission) && (
          <button
            className="cc-reminder-enable"
            type="button"
            disabled={busy || permission === "checking"}
            onClick={enable}
          >
            <BellRing size={16} />
            {busy ? "Ativando…" : "Ativar avisos"}
          </button>
        )}
        {permission === "granted" && (
          <button className="cc-reminder-enable" onClick={enable} disabled={busy} type="button">
            <BellRing size={16} /> Ativar push
          </button>
        )}
        {permission === "enabled" && (
          <button
            className="cc-reminder-enable"
            onClick={disable}
            disabled={busy}
            type="button"
            title="Avisos do navegador ativos. Clique para desativar."
          >
            <CheckCircle2 size={16} /> Avisos ativos
          </button>
        )}
        {permission === "denied" && (
          <span
            className="cc-reminder-permission-help"
            title="Habilite notificações nas configurações deste site no navegador."
          >
            <BellRing size={15} /> Avisos bloqueados
          </span>
        )}
        {error && (
          <span className="cc-reminder-permission-error" role="alert" title={error}>
            {error}
          </span>
        )}
      </div>
      {showOnboarding && !active && (
        <div className="cc-reminder-backdrop cc-notification-onboarding-backdrop">
          <section
            className="cc-notification-onboarding"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-notification-onboarding-title"
            aria-describedby="cc-notification-onboarding-description"
          >
            <div className="cc-notification-onboarding-head">
              <span className="cc-notification-onboarding-brand">
                26FIT <span>• CENTRAL COMERCIAL</span>
              </span>
              <button
                type="button"
                onClick={dismissOnboarding}
                aria-label="Fechar convite para notificações"
                disabled={busy}
              >
                <X size={19} />
              </button>
            </div>

            <div className="cc-notification-onboarding-icon">
              <BellRing size={31} />
              <span />
            </div>

            <span className="cc-notification-onboarding-eyebrow">NÃO PERCA SEUS COMPROMISSOS</span>
            <h2 id="cc-notification-onboarding-title">Ative os avisos da Central</h2>
            <p id="cc-notification-onboarding-description">
              Receba um lembrete quando uma reunião do Teams ou um evento estiver começando, mesmo
              que você esteja em outra aba do navegador.
            </p>

            <div className="cc-notification-onboarding-benefits">
              <div>
                <Clock3 size={18} />
                <span>Alertas quando chegar o horário da reunião</span>
              </div>
              <div>
                <CalendarDays size={18} />
                <span>Acesso rápido ao compromisso no calendário</span>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>Você controla a permissão e pode desativá-la</span>
              </div>
            </div>

            {error && (
              <p className="cc-notification-onboarding-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              className="cc-notification-onboarding-primary"
              onClick={enable}
              disabled={busy}
            >
              <BellRing size={19} /> {busy ? "Ativando notificações…" : "Ativar notificações"}
            </button>
            <button
              type="button"
              className="cc-notification-onboarding-skip"
              onClick={dismissOnboarding}
              disabled={busy}
            >
              Agora não
            </button>
            <p className="cc-notification-onboarding-privacy">
              A permissão será solicitada pelo navegador após clicar em ativar.
            </p>
          </section>
        </div>
      )}
      {active && pageVisible && (
        <div
          className="cc-reminder-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <section
            className="cc-reminder-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Compromisso começando agora"
          >
            <div className="cc-reminder-dialog-top">
              <span>
                <BellRing size={16} /> {active.demo ? "SIMULAÇÃO DE AVISO" : "AVISO DE COMPROMISSO"}
              </span>
              <button onClick={dismiss} aria-label="Fechar aviso" type="button">
                <X size={20} />
              </button>
            </div>
            <div className="cc-reminder-emblem">
              <CalendarDays size={29} />
            </div>
            <p className="cc-reminder-kicker">{active.demo ? "Teste de notificação" : "Está começando agora"}</p>
            <h2>{active.title}</h2>
            <p className="cc-reminder-hour">
              <Clock3 size={16} /> {dateTime(active.startsAt)}
            </p>
            {!!active.description?.trim() && !active.private && (
              <p className="cc-reminder-summary">{active.description.slice(0, 300)}</p>
            )}
            <div className="cc-reminder-actions">
              <button className="btn" type="button" onClick={open}>
                <CalendarDays size={17} /> {active.demo ? "Abrir calendário" : "Ver compromisso"}
              </button>
              {!!active.url && /^https:\/\//i.test(active.url) && (
                <a
                  className="btn secondary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={active.url}
                >
                  <ExternalLink size={17} /> Entrar na reunião
                </a>
              )}
              <button className="btn secondary cc-reminder-dismiss" type="button" onClick={dismiss}>
                Dispensar
              </button>
            </div>
            <p className="cc-reminder-foot">
              <ShieldCheck size={14} /> {active.demo ? "Apenas teste · Nenhum compromisso criado" : "Aviso único por compromisso · Horário de Brasília"}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
