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

export default function ReminderCenter({ onOpenReminder }) {
  const [permission, setPermission] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState([]);
  const [pageVisible, setPageVisible] = useState(true);
  const polling = useRef(false);
  const observed = useRef(new Set());
  const initialized = useRef(false);
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

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

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
    } catch (e) {
      setError(e.message || "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  };

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

  // Revalida a inscrição depois que a permissão já tinha sido concedida
  // (ex.: usuário trocou de computador ou a inscrição expirou).
  useEffect(() => {
    if (permission !== "granted" || initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        const subscription = await reg.pushManager?.getSubscription();
        if (!subscription) return;
        await fetch("/api/notifications/push", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        setPermission("enabled");
      } catch {
        /* A Central permanece funcional sem push. */
      }
    })();
  }, [permission]);

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
    dismiss();
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
                <BellRing size={16} /> AVISO DE COMPROMISSO
              </span>
              <button onClick={dismiss} aria-label="Fechar aviso" type="button">
                <X size={20} />
              </button>
            </div>
            <div className="cc-reminder-emblem">
              <CalendarDays size={29} />
            </div>
            <p className="cc-reminder-kicker">Está começando agora</p>
            <h2>{active.title}</h2>
            <p className="cc-reminder-hour">
              <Clock3 size={16} /> {dateTime(active.startsAt)}
            </p>
            {!!active.description?.trim() && !active.private && (
              <p className="cc-reminder-summary">{active.description.slice(0, 300)}</p>
            )}
            <div className="cc-reminder-actions">
              <button className="btn" type="button" onClick={open}>
                <CalendarDays size={17} /> Ver compromisso
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
              <ShieldCheck size={14} /> Aviso único por compromisso · Horário de Brasília
            </p>
          </section>
        </div>
      )}
    </>
  );
}
