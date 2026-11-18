import { useEffect, useState, type ReactNode } from "react";

/** The three pages need no router library: just the path, kept in step with the address bar. */
export function usePath(): string {
  const [path, setPath] = useState(globalThis.location.pathname);
  useEffect(() => {
    const update = (): void => {
      setPath(globalThis.location.pathname);
    };
    globalThis.addEventListener("popstate", update);
    return () => {
      globalThis.removeEventListener("popstate", update);
    };
  }, []);
  return path;
}

export function navigate(to: string): void {
  globalThis.history.pushState(null, "", to);
  globalThis.dispatchEvent(new PopStateEvent("popstate"));
  globalThis.scrollTo({ top: 0 });
}

/** A link that changes page without reloading, but still opens in a new tab when asked. */
export function Link({
  to,
  className,
  children,
  onNavigate,
}: {
  readonly to: string;
  readonly className?: string;
  readonly children: ReactNode;
  /** Runs on any click, for example to close the menu the link is in. */
  readonly onNavigate?: () => void;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        onNavigate?.();
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
