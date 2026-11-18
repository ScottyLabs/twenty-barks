# Twenty Barks

Twenty Barks is a daily guessing game from [Bark](https://git.cmu.dev/ScottyLabs/cmugpt-surface), ScottyLabs' campus assistant. Each day Bark is thinking of something at CMU, such as a place, a course, a food, or a tradition, and players get twenty yes-or-no questions to work out what it is.

## How it works

One Deno service serves both the API and the built web app, so the browser only ever talks to its own origin.

```
twenty-barks/
├── apps/
│   ├── server/          # Hono API on Deno, also serves apps/web/dist
│   │   └── src/
│   │       ├── main.ts      # Entry point: reads the environment, migrates, and starts the server
│   │       ├── app.ts       # Puts the routes together, including the /api/health check kennel polls
│   │       ├── routes/      # Sign-in, the daily game and scores, and the admin API
│   │       ├── jev.ts       # Asks Jev, through the AI gateway, how to answer a question
│   │       ├── ask.ts       # Turns Jev's odds into Bark's verdict and reply
│   │       ├── game.ts      # Turns, campus days, scores, and streaks
│   │       ├── store.ts     # Everything kept in Postgres
│   │       ├── db.ts        # Migrations, run at startup
│   │       └── static.ts    # Serves the web app, with index.html as the fallback for client routes
│   └── web/             # React, Vite, and Tailwind
├── flake.nix            # Dev shell, local Postgres, and the kennel deployment
└── secretspec.toml      # Environment variables, resolved from OpenBao
```

Each question goes to the server, which asks [Jev](https://docs.typesafe.ai) (through the ScottyLabs AI gateway) how to answer it against the day's fact sheet. The fact sheet never leaves the server, and the answer is only revealed once a game is over. A guess wins only when the question names the answer and Jev reads it as a guess.

Anyone can play without signing in. Signing in with an Andrew ID saves games, scores, and a streak of days solved in a row; a game started before signing in carries over. The admin page at `/admin` schedules puzzles and tries questions against a draft's facts. It is open only to the usernames or emails in the `ADMIN_USERS` secret, so admins are not listed in this repository.

In production, kennel builds the web app and passes its store path to the server as `STATIC_DIR`, provisions a Postgres database as `DATABASE_URL`, and sets `PORT`. The health check returns 200 only once the database answers, so kennel does not route traffic to a deployment that cannot reach it.

## Development

Install Lix and log in to OpenBao by following kennel's [local development](https://docs.kennel.scottylabs.org/guides/local-development/) and [secrets](https://docs.kennel.scottylabs.org/guides/secrets/) guides. Then:

```sh
nix develop               # Deno, a local Postgres, and the git hooks
pitchfork start --local   # Starts Postgres, the login relay, the server on :3001, and the web app on :4173
```

Stop everything with `pitchfork stop --local`, and follow one process's output with `pitchfork logs server`.

Open <http://localhost:4173>. The Vite dev server proxies `/api` to the local server.

| Command | What it does |
| -- | -- |
| `deno task test` | Server and web tests. Server tests run their SQL on an in-memory Postgres ([PGlite](https://pglite.dev)) |
| `deno task check` | Type-checks the server and the web app |
| `nix fmt` | Formats the repository |

To make yourself an admin locally, add your Andrew ID to `ADMIN_USERS` in OpenBao for the `dev` profile, or set it when starting the server: `ADMIN_USERS=<andrew-id> pitchfork start --local`.

## Deployment

Kennel deploys `main`, `staging`, and every pull request. A pull request is served at `twenty-barks-app-pr-<number>.scottylabs.net`.

## Bark

The dog is Bark, the ScottyLabs mark drawn as three strokes. His drawing (`apps/web/src/bark/shape.ts` and `pose.ts`) comes from the [TartanHacks 2027 landing page](https://github.com/ScottyLabs/tartanhacks-landing-2027), where each point of the mark can move. `moods.ts` adds the game's reactions: a hop and a bark for yes, a droop and a shiver for no, a head tilt for sort of, and a run of hops for a win.

## License

Licensed under either of [Apache License 2.0](LICENSE-APACHE-2.0) or [MIT](LICENSE-MIT), at your option.
