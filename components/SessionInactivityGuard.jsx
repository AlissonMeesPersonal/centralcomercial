"use client";

import { useEffect, useRef } from "react";

// Prazo de inatividade da Central Comercial: 30 minutos.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_THROTTLE_MS = 15 * 1000;

export default function SessionInactivityGuard({ userEmail, onExpire }) {
  const expiring = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const identity = String(userEmail || "").trim().toLowerCase();
    if (!identity) return;

    const storageKey = "cc-central-last-activity-v1:" + identity;
    let lastActivity = Date.now();
    try {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0 && stored <= Date.now()) {
        lastActivity = stored;
      } else {
        window.localStorage.setItem(storageKey, String(lastActivity));
      }
    } catch {
      // Fallback para modo privado / armazenamento desabilitado.
    }

    const expire = () => {
      if (expiring.current) return;
      expiring.current = true;
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}
      void onExpireRef.current?.();
    };

    const readActivity = () => {
      try {
        const stored = Number(window.localStorage.getItem(storageKey));
        if (Number.isFinite(stored) && stored > lastActivity && stored <= Date.now()) {
          lastActivity = stored;
        }
      } catch {}
      return lastActivity;
    };

    const check = () => {
      if (Date.now() - readActivity() >= IDLE_TIMEOUT_MS) expire();
    };

    // Ao voltar após deixar a Central fechada, não renova a sessão
    // antes de verificar a última atividade registrada.
    check();
    if (expiring.current) return;

    const registerActivity = () => {
      if (expiring.current || document.visibilityState !== "visible") return;
      check();
      if (expiring.current) return;
      const now = Date.now();
      if (now - lastActivity < ACTIVITY_THROTTLE_MS) return;
      lastActivity = now;
      try {
        window.localStorage.setItem(storageKey, String(now));
      } catch {}
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    // Atualização em outras abas do mesmo navegador não encerra uma sessão
    // enquanto houver atividade legítima do mesmo usuário.
    const onStorage = (event) => {
      if (event.key === storageKey) check();
    };

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) {
      window.addEventListener(event, registerActivity, { passive: true });
    }
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) {
        window.removeEventListener(event, registerActivity);
      }
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userEmail]);

  return null;
}
