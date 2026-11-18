import { Link } from "../router.tsx";
import { loginHref, logout, type Me } from "../server.ts";
import { Mark } from "./Mark.tsx";

/** "Welcome, Krish" reads better than a full name in the header. */
function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] ?? name;
}

function Account({
  me,
  path,
  onChange,
}: {
  readonly me: Me;
  readonly path: string;
  readonly onChange: () => void;
}) {
  if (me.user === null) {
    return me.loginAvailable ? (
      <a href={loginHref(path)} className="pill pill--small pill--solid">
        Sign in
      </a>
    ) : null;
  }
  return (
    <>
      <span className="welcome">
        Welcome, <strong>{firstName(me.user.name)}</strong>
      </span>
      <Link to="/scores" className="nav-link">
        My scores
      </Link>
      {me.user.admin && (
        <Link to="/admin" className="nav-link">
          Admin
        </Link>
      )}
      <button
        type="button"
        className="pill pill--small"
        title={`Signed in as ${me.user.name}`}
        onClick={() => {
          void logout().then(onChange);
        }}
      >
        Sign out
      </button>
    </>
  );
}

export function Header({
  me,
  path,
  onChange,
}: {
  readonly me: Me | null;
  readonly path: string;
  readonly onChange: () => void;
}) {
  return (
    <header className="hairline-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-medium">
          <Mark className="h-6 w-7" />
          <span>
            Twenty <span className="gradient-text font-bold">Barks</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-4" aria-label="Account">
          {path === "/" && (
            <a href="#how" className="nav-link hidden sm:inline">
              How to play
            </a>
          )}
          {me !== null && <Account me={me} path={path} onChange={onChange} />}
        </nav>
      </div>
    </header>
  );
}
