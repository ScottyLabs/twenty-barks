import { saveTheme } from "../server.ts";
import { flipLook, useLook } from "../theme.ts";

function Moon() {
  return <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />;
}

function Sun() {
  return (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  );
}

/** Flips between light and dark. Shows where you would go: a moon in light, a sun in dark. */
export function ThemeToggle() {
  const look = useLook();
  const next = look === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        const saved = flipLook();
        if (saved !== null) {
          void saveTheme(saved);
        }
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {look === "dark" ? <Sun /> : <Moon />}
      </svg>
    </button>
  );
}
