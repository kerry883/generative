# Generative

Turn any prompt, PDF, or doc into a narrated [Manim](https://www.manim.community/) educational video — powered by [Qwen](https://chat.qwen.ai/). Built for **Hack for Humanity with Qwen**.

No sign-in required to generate. Accounts (optional) let you keep your videos across devices.

## Architecture

```
Browser (Next.js 16, App Router)
  └─ POST /api/generate (guest) | /api/generate-auth (signed in)
       ├─ Extracts text from PDF (unpdf) / DOCX (mammoth) as context
       └─ Convex mutation (guest.schedulevideogeneration | videos.scheduleauthvideo)
            ├─ Inserts `videos` doc {status: "generating"}
            └─ Schedules Convex action videos.triggerVideoGeneration
                 └─ POST https://api.trigger.dev/api/v1/tasks/generate-video/trigger
                      └─ Trigger.dev task (trigger/generate-video.ts):
                           1. Qwen (Plus)  → extracts a web-search query
                           2. Google CSE   → optional research + sources (graceful fallback)
                           3. Qwen (Max)   → Director: writes a structured production script
                           4. Qwen (Plus)  → selects Manim "skills" (trigger/skills/*.md)
                           5. Qwen (Max)   → writes the Manim scene code
                           6. Manim microservice (external Python API) renders the video,
                              with an AI self-healing retry loop (up to 4 attempts)
                           7. Convex mutation videos.updateVideo → status "ready" + URL
Frontend updates in realtime via Convex reactive queries (no polling)
```

- **Auth:** [Better Auth](https://better-auth.com) (email + password) via the
  [`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component.
  Auth routes are served by Convex and proxied through `/api/auth/[...all]`.
- **Database/backend:** Convex (realtime queries, mutations, scheduled actions).
- **LLM:** Qwen (`Qwen-Ambassador/Qwen3.8-Max` / `Qwen3.7-Plus`) through the
  OpenAI-compatible ModelScope endpoint. Structured output is requested as plain
  JSON and validated with zod (some endpoints reject tool-calling modes).
- **Video storage:** Cloudflare R2 behind a custom domain (set by the render service).

## Getting started

Prereqs: [Bun](https://bun.sh), a Convex account, a Trigger.dev account, and a
running Manim render microservice.

```bash
bun install

# 1. Create a fresh Convex deployment and generate types
bunx convex dev        # use --new to create a new deployment

# 2. Set Convex deployment env vars
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set SITE_URL http://localhost:3000
bunx convex env set TRIGGER_SECRET_KEY <trigger.dev secret key>

# 3. Configure the app env
cp .env.example .env.local   # fill in your Convex URLs

# 4. Run everything
bun run dev                  # Next.js on :3000
bunx convex dev              # Convex functions (keep running)
bunx trigger.dev@latest dev  # Trigger.dev tasks (keep running)
```

Trigger.dev project: set `TRIGGER_PROJECT_REF` (or edit `trigger.config.ts`),
and add `MODELSCOPE_API_KEY` + `NEXT_PUBLIC_CONVEX_URL` to the Trigger.dev env.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start Next.js dev server |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript (`tsc --noEmit`) |

## Project structure

```
app/                  # Next.js App Router (landing, /watch/[id], /videovault, API routes)
components/           # UI components (generator, player, cards, auth dialog)
convex/               # Convex backend (schema, videos, guest, auth)
lib/                  # auth-client, auth-server, guest id hook, utils
providers/            # Convex + Better Auth + theme providers
trigger/              # Trigger.dev generate-video task + Manim skill library
```

## Notes

- Generation works without an account; videos are tied to a local guest id and
  are automatically claimed when the user later signs up.
- Like/dislike feedback (with reason tags) is stored per video in Convex.
