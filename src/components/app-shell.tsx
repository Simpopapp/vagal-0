import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { pendingCount, useAppState, useStoreHydration } from "../lib/store";

const NAV = [
  { to: "/", label: "Buscar" },
  { to: "/vocabulary", label: "Vocabulário" },
  { to: "/practice", label: "Prática" },
  { to: "/settings", label: "Ajustes" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useStoreHydration();
  const state = useAppState();
  const pending = pendingCount(state);
  const offline = useOffline();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-3">
          <Link to="/" className="group flex items-baseline gap-2">
            <span className="font-display text-xl font-medium tracking-tight text-foreground">
              Verso
            </span>
            <span className="hidden font-sans text-[10px] uppercase tracking-[0.24em] text-muted-foreground sm:inline">
              letra · palavra
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded px-2.5 py-1.5 font-sans text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{
                  className:
                    "rounded px-2.5 py-1.5 font-sans text-[13px] text-foreground bg-accent font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-2 flex items-center gap-2">
            {offline ? (
              <span className="rounded-full border border-border px-2 py-1 font-sans text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                offline
              </span>
            ) : null}
            {pending > 0 ? (
              <Link
                to="/vocabulary"
                className="rounded-full border border-caution/60 bg-caution/10 px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.16em] text-caution-foreground"
              >
                {pending} em fila
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-8">{children}</main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-6 font-sans text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>verso · estudo de inglês pela letra</span>
          <span>dados salvos neste dispositivo</span>
        </div>
      </footer>
    </div>
  );
}

function useOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return offline;
}
