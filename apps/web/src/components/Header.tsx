import { Link } from "../router.tsx";
import { loginHref, type Me } from "../server.ts";
import { AccountMenu } from "./AccountMenu.tsx";
import { Mark } from "./Mark.tsx";

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
  return <AccountMenu name={me.user.name} admin={me.user.admin} onSignedOut={onChange} />;
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
          {me !== null && <Account me={me} path={path} onChange={onChange} />}
        </nav>
      </div>
    </header>
  );
}
