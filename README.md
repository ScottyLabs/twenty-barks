# Twenty Barks

Twenty Barks is a daily guessing game from [Bark](https://git.cmu.dev/ScottyLabs/cmugpt-surface), ScottyLabs' campus assistant. Each day Bark is thinking of something at CMU, such as a place, a course, a food, or a tradition, and players get twenty yes-or-no questions to work out what it is.

## How it works

One Deno service serves both the API and the built web app, so the browser only ever talks to its own origin.

```
twenty-barks/
├── apps/
│   ├── server/          # Hono API on Deno, also serves apps/web/dist
│   │   └── src/
│   │       ├── main.ts      # Entry point: reads the environment and starts the server
│   │       ├── app.ts       # Routes, including the /api/health check kennel polls
│   │       └── static.ts    # Serves the web app, with index.html as the fallback for client routes
│   └── web/             # React, Vite, and Tailwind
├── flake.nix            # Dev shell, local Postgres, and the kennel deployment
└── secretspec.toml      # Environment variables, resolved from OpenBao
```

In production, kennel builds the web app and passes its store path to the server as `STATIC_DIR`, provisions a Postgres database as `DATABASE_URL`, and sets `PORT`. The health check returns 200 only once the database answers, so kennel does not route traffic to a deployment that cannot reach it.

## Development

Install Lix and log in to OpenBao by following kennel's [local development](https://docs.kennel.scottylabs.org/guides/local-development/) and [secrets](https://docs.kennel.scottylabs.org/guides/secrets/) guides. Then:

```sh
nix develop               # Deno, a local Postgres, and the git hooks
pitchfork start --local   # Starts Postgres, the server on :3001, and the web app on :4173
```

Stop everything with `pitchfork stop --local`, and follow one process's output with `pitchfork logs server`.

Open <http://localhost:4173>. The Vite dev server proxies `/api` to the local server.

| Command | What it does |
| -- | -- |
| `deno task test` | Server tests |
| `deno task check` | Type-checks the server and the web app |
| `nix fmt` | Formats the repository |

## Deployment

Kennel deploys `main`, `staging`, and every pull request. A pull request is served at `twenty-barks-app-pr-<number>.scottylabs.net`.

## License

Licensed under either of [Apache License 2.0](LICENSE-APACHE-2.0) or [MIT](LICENSE-MIT), at your option.
