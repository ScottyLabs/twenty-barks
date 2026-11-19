import { useEffect, useId, useRef, useState } from "react";
import { Link } from "../router.tsx";
import { logout } from "../server.ts";

/** "Welcome, Krish" reads better than a full name in the header. */
function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? name;
}

/** Closes the menu on a click outside it or on Escape, handing focus back to its button. */
function useDismiss(close: () => void, box: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const onPointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && box.current?.contains(event.target) !== true) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && box.current?.contains(document.activeElement) === true) {
        close();
        box.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, box]);
}

function Chevron({ open }: { readonly open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className={`chevron ${open ? "chevron--open" : ""}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function Items({
  admin,
  close,
  onChange,
}: {
  readonly admin: boolean;
  readonly close: () => void;
  readonly onChange: () => void;
}) {
  return (
    <>
      <Link to="/scores" className="account__item" onNavigate={close}>
        My scores
      </Link>
      {admin && (
        <Link to="/admin" className="account__item" onNavigate={close}>
          Admin
        </Link>
      )}
      <hr className="account__rule" />
      <button
        type="button"
        className="account__item"
        onClick={() => {
          close();
          void logout().then(onChange);
        }}
      >
        Sign out
      </button>
    </>
  );
}

/** "Welcome, Krish", opening onto the signed-in player's links. */
export function AccountMenu({
  name,
  admin,
  onChange,
}: {
  readonly name: string;
  readonly admin: boolean;
  /** Runs after signing out, to fetch who is signed in again. */
  readonly onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [close] = useState(() => () => {
    setOpen(false);
  });
  const menuId = useId();
  useDismiss(close, box);

  return (
    <div ref={box} className="account">
      <button
        type="button"
        className="account__button"
        aria-expanded={open}
        aria-controls={menuId}
        title={`Signed in as ${name}`}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        Welcome, <strong>{firstName(name)}</strong>
        <Chevron open={open} />
      </button>
      {open && (
        <div id={menuId} className="account__menu">
          <Items admin={admin} close={close} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
