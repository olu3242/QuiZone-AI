"use client";
import type { Snapshot } from "@/lib/types";
import type { AppAction } from "@/lib/validation";
import {
  BookOpen,
  Compass,
  Flag,
  Globe2,
  Home,
  LogOut,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Brand } from "./brand";
const avatar: Record<string, string> = {
  fox: "🦊",
  panda: "🐼",
  owl: "🦉",
  rocket: "🚀",
};
const Context = createContext<{
  data: Snapshot | null;
  error: string;
  refresh: () => Promise<void>;
}>({ data: null, error: "", refresh: async () => {} });
export async function command(action: AppAction["action"], data: unknown) {
  const r = await fetch("/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Could not save your changes.");
  return result;
}
export function Workspace({
  children,
  initialData,
  initialError,
}: {
  children: ReactNode;
  initialData: Snapshot | null;
  initialError: string;
}) {
  const path = usePathname(),
    router = useRouter(),
    [data, setData] = useState<Snapshot | null>(initialData),
    [error, setError] = useState(initialError);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.");
    }
  }, []);
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const nav = [
    ["/home", "Home", Home],
    ["/challenges", "Challenges", Compass],
    ["/world", "World", Globe2],
    ["/passport", "Passport", BookOpen],
    ["/family", "Family", Users],
  ] as const;
  return (
    <Context.Provider value={{ data, error, refresh }}>
      <div className="workspace">
        <aside className="sidebar">
          <Brand />
          <p className="sidebar-label">A WORLD TO EXPLORE</p>
          <nav aria-label="Family navigation">
            {nav.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                className={path.startsWith(href) ? "selected" : ""}
              >
                <Icon size={20} />
                {label}
                {label === "Challenges" && (
                  <span className="nav-badge">
                    {data?.challenges.filter((c) =>
                      c.versions.some((v) => v.status === "published"),
                    ).length || 0}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              href="/parent"
              className={path === "/parent" ? "selected" : ""}
            >
              <ShieldCheck size={20} /> Parent Hub
            </Link>
            {data?.admin && (
              <Link href="/admin">
                <Settings2 size={20} /> Content & safety
              </Link>
            )}
            <div className="together-card">
              <span>✦</span>
              <strong>
                A little time.
                <br />A big connection.
              </strong>
              <p>Make your next game night a family thing.</p>
            </div>
            <button
              className="logout"
              onClick={async () => {
                const r = await fetch("/api/snapshot", { method: "DELETE" });
                if (r.ok) {
                  router.push("/login");
                  router.refresh();
                } else setError("Could not sign out. Please try again.");
              }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>
        <div className="workspace-body">
          <header className="workspace-top">
            <span>
              <span className="live-dot" /> Your family’s space
            </span>
            <div>
              <Link href="/parent" className="guardian-pill">
                <ShieldCheck size={14} /> Parent Hub
              </Link>
              <span className="profile-icon">
                {data?.household?.name.slice(0, 1) || "Q"}
              </span>
            </div>
          </header>
          <main id="main" className="workspace-main">
            {error ? (
              <div className="empty-state">
                <Flag />
                <h2>We couldn’t load your space.</h2>
                <p role="alert">{error}</p>
                <button className="btn" onClick={() => void refresh()}>
                  <RefreshCw size={17} /> Try again
                </button>
              </div>
            ) : !data ? (
              <div className="empty-state" role="status">
                <div className="loading" />
                <h2>Getting your family’s space ready…</h2>
              </div>
            ) : (
              children
            )}
          </main>
          <footer className="workspace-footer">
            Made for curiosity. Built around family.{" "}
            <span>Play Together. Solve the World.</span>
          </footer>
        </div>
        <nav className="mobile-nav" aria-label="Mobile family navigation">
          {nav.map(([href, label, Icon]) => (
            <Link
              className={path.startsWith(href) ? "selected" : ""}
              key={href}
              href={href}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </Context.Provider>
  );
}
export function useFamily() {
  return useContext(Context);
}
