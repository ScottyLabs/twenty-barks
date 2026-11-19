# Twenty Barks

Twenty Barks is a daily guessing game from [Bark](https://git.cmu.dev/ScottyLabs/cmugpt-surface), ScottyLabs' campus assistant. Each day Bark is thinking of something at CMU, such as a place, a course, a food, or a tradition, and players get twenty yes-or-no questions to work out what it is.

## How it works

One Deno service serves both the API and the built web app, so the browser only ever talks to its own origin.

```
twenty-barks/
├── apps/
│   ├── server/              # Hono API on Deno, also serves apps/web/dist
│   │   └── src/
│   │       ├── main.ts      # Entry point: reads the environment, migrates, and starts the server
│   │       ├── app.ts       # Puts the routes together, including the /api/health check kennel polls
│   │       ├── routes/      # auth.ts (sign-in, /api/me, theme), game.ts (daily game, scores), admin.ts
│   │       ├── oidc.ts      # Sign-in with Keycloak (Andrew ID), through the shared OAuth relay
│   │       ├── jev.ts       # Asks Jev, through the AI gateway, how to answer a question
│   │       ├── ask.ts       # Turns Jev's odds into Bark's verdict and reply
│   │       ├── draft.ts     # Asks a chat model to draft a puzzle, for "Draft with AI"
│   │       ├── game.ts      # Turns, campus days, scores, and streaks
│   │       ├── store.ts     # Everything kept in Postgres
│   │       ├── db.ts        # Migrations, run at startup
│   │       └── static.ts    # Serves the web app, with index.html as the fallback for client routes
│   └── web/                 # React, Vite, and Tailwind
│       ├── index.html       # Also picks light or dark before the first paint
│       └── src/
│           ├── App.tsx      # Page layout and routes: /, /scores, /admin
│           ├── components/  # Header, account menu, theme toggle, Bark, the rounds, and the end-of-game curve
│           ├── pages/       # Scores, and the admin page (schedule, editor, Draft with AI)
│           ├── bark/        # Bark's drawing and animations
│           ├── server.ts    # Calls to the API, with every response checked before use
│           ├── practice.ts  # The practice round, which works offline
│           └── theme.ts     # Light and dark mode
├── flake.nix                # Dev shell, local Postgres, login relay, dev processes, and the kennel deployment
└── secretspec.toml          # Environment variables, resolved from OpenBao
```

**Answering questions.** Each question goes to the server, which asks [Jev](https://docs.typesafe.ai) (through the ScottyLabs AI gateway) how to answer it against the day's fact sheet. The fact sheet never leaves the server, and the answer is only revealed once a game is over. A guess wins only when the question names the answer and Jev reads it as a guess. When Jev is unsure, Bark says so and the question does not use up a bone. When a game ends, a curve shows how many questions everyone who finished that day took, and what share of them you beat. With no puzzle scheduled for the day, the home page falls back to a practice round about the Fence.

**Accounts.** Anyone can play without signing in, and a game in progress survives a reload. Signing in with an Andrew ID saves games, scores, and a streak of days solved in a row; a game started before signing in carries over. The sun or moon in the header switches between light and dark mode, and for signed-in players the choice is saved to their account.

**Admin.** The admin page at `/admin` schedules puzzles and tries questions against a draft's facts. It is open only to the usernames or emails in the `ADMIN_USERS` secret, so admins are not listed in this repository. **Draft with AI** asks a mid-tier chat model on the gateway (`claude-sonnet-5-5`, or `DRAFT_MODEL`) to write a fact sheet, either for something you name or for its own suggestion that avoids past answers. It lists facts to double-check and shows how Bark would answer a dozen sample questions. It runs only when an admin presses the button, and nothing is saved until they press Save.

**Production.** Kennel builds the web app and passes its store path to the server as `STATIC_DIR`, provisions a Postgres database as `DATABASE_URL`, and sets `PORT`. The health check returns 200 only once the database answers, so kennel does not route traffic to a deployment that cannot reach it.

## Running it locally

### 1. One-time setup

1. Install [Lix](https://lix.systems) and set up OpenBao, by following kennel's [local development](https://docs.kennel.scottylabs.org/guides/local-development/) and [secrets](https://docs.kennel.scottylabs.org/guides/secrets/) guides. The server reads its secrets (the AI gateway key, the Keycloak client) from OpenBao through secretspec, so you need to be logged in.

1. Clone the repository and enter the dev shell:

   ```sh
   git clone https://git.cmu.dev/ScottyLabs/twenty-barks.git
   cd twenty-barks
   nix develop   # Deno, Postgres, pitchfork, and the git hooks
   ```

### 2. Start everything

```sh
pitchfork start --local
```

This starts four processes:

| Process | Where | What it is |
| -- | -- | -- |
| `postgres` | a local socket | The database, kept in `.scottylabs/postgres` |
| `ricochet` | `localhost:8090` | The OAuth relay, so sign-in works on localhost |
| `server` | `localhost:3001` | The API, restarted on every change |
| `web` | `localhost:4173` | The Vite dev server, which proxies `/api` to the server |

Open <http://localhost:4173>. Migrations run when the server starts, so a fresh database needs no setup.

Follow one process with `pitchfork logs server`, and stop everything with `pitchfork stop --local`.

### 3. Make yourself an admin

Add your Andrew ID to `ADMIN_USERS` in OpenBao for the `dev` profile, or set it for one run:

```sh
ADMIN_USERS=<andrew-id> pitchfork start --local
```

Sign in, open the menu under your name, and choose **Admin**. Schedule a puzzle for today and the home page switches from the practice round to the daily game.

### Troubleshooting

- **A blank page after updating dependencies:** restart Vite with a fresh cache: `cd apps/web && deno task dev --force`.
- **`Address already in use`:** another copy of the server or web app is still running. Stop it, or run `pitchfork stop --local` and start again.
- **The Sign in button is missing:** the server could not read the Keycloak settings. Check that you are logged in to OpenBao.

## Checks

| Command | What it does |
| -- | -- |
| `deno task test` | Server and web tests. Server tests run their SQL on an in-memory Postgres ([PGlite](https://pglite.dev)), so they need no database or secrets |
| `deno task check` | Type-checks the server and the web app |
| `nix fmt` | Formats the repository |

The git hooks run the tests, type checks, oxlint, and the formatter on every commit.

## Deployment

Kennel deploys `main`, `staging`, and every pull request. A pull request is served at `twenty-barks-app-pr-<number>.scottylabs.net` once nixbot has built it.

## License

Licensed under either of [Apache License 2.0](LICENSE-APACHE-2.0) or [MIT](LICENSE-MIT), at your option.
