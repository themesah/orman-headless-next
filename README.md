# @orman/headless-next

Frontend kit for Next.js sites on Orman Headless (`Orman/Headless` in the Orman monorepo; contract and plan: `docs/addons-headless-plan.md`).
Typed read client, `proxy.ts` helpers, and the first unstyled components. ESM, Next 16, React 19.

## Install

Consumers install by git tag; `dist/` is committed, there is no build on install.

```bash
pnpm add github:themesah/orman-headless-next#v0.1.0
```

While developing both side by side: `pnpm add link:../orman-headless-next`, and run `pnpm build` in the kit after each change (the frontends read `dist/`).
If the frontend's tests import the kit and fail with `Cannot find module 'next/server'`, the kit is being loaded by Node instead of Vite: it already imports
`next/server.js` for that reason, so this only happens with an older tag.

## Release (kit maintainers)

```bash
pnpm typecheck && pnpm test && pnpm build   # dist/ changes: commit it
git add -A && git commit -m "release vX.Y.Z" && git tag vX.Y.Z
```

## Entry points

| Import | For | Runs on |
| :-- | :-- | :-- |
| `@orman/headless-next` | all response types (`PageResponse`, `SiteResponse`, `BardValue`, …) | anywhere |
| `@orman/headless-next/client` | `createOrmanClient`, `tagsForPath` | **server only** (imports `server-only`: the read token never reaches a client bundle) |
| `@orman/headless-next/proxy` | `forwardToOrman`, `clientIp`, gates | `proxy.ts` |
| `@orman/headless-next/csrf` | `api()`: JSON/multipart calls to `/!/` routes with a fresh CSRF token | browser |
| `@orman/headless-next/form` | `<Form>`, `<FieldError>`, `useFormState` | client component |
| `@orman/headless-next/captcha` | `<Captcha>`: Turnstile or Kaptcha, chosen from `/site` | client component |
| `@orman/headless-next/form-fields` | `<FormFields>`: the form drawn from `client.form(handle)` | client component |
| `@orman/headless-next/maintenance-page` | `<MaintenancePage site>` | server or client |
| `@orman/headless-next/login` | `<Login>`: credentials → code / recovery code → waiting for approval → signed in | client component |
| `@orman/headless-next/two-factor` | `<TwoFactor>`: status, turn on (QR), turn off, recovery codes (.txt built in the browser) | client component |
| `@orman/headless-next/sessions` | `<Sessions>`: history, active sessions, sign out, approve / deny, own rule | client component |
| `@orman/headless-next/comments` | `<Comments block site>` (approved comments + form), `<MyComments>` | client component |
| `@orman/headless-next/inbox` | `<Inbox>`: seen / accept / snooze / dismiss, live over Mercure, polling fallback | client component |
| `@orman/headless-next/stream` | `followStream()`: the person's own Mercure topic (bearer token, no URL token) | browser |
| `@orman/headless-next/roadmap` | `COMPONENT_ROADMAP`: what is planned and in which wave | anywhere |

## Read client

```ts
import 'server-only'
import { createOrmanClient } from '@orman/headless-next/client'

const orman = createOrmanClient({ origin: process.env.ORMAN_ORIGIN!, token: process.env.ORMAN_READ_TOKEN! })
const page = await orman.page('/about')          // PageResponse; a 404 is { type: 'not_found' }, not an exception
const site = await orman.site()                  // { contract_version, site, addons: { seo: {}, … } }
if (page.type === 'entry') page.addons?.seo      // addons.<handle> blocks
```

Every call is tagged for `revalidateTag` (`orman:all`, `path:/about`, `paths`, `site`, `collection:x`, `nav:x`, `global:x`) and cached forever until a tag is revalidated.
Pass `{ previewToken }` (and only when both the draft cookie and the token are present) for an uncached draft read. Network failures are retried 3 times; HTTP error
statuses throw `Orman <status> for <path>`.

## `proxy.ts`

```ts
import { forwardToOrman } from '@orman/headless-next/proxy'
import type { NextRequest } from 'next/server'

// Next reads the matcher statically at build time: write it out, do not spread it from the kit.
export const config = { matcher: ['/!/:path*', '/img/:path*', '/assets/:path*'] }
export const proxy = (req: NextRequest) => forwardToOrman(req)
```

Set `ORMAN_ORIGIN` and `ORMAN_EDGE_SECRET` (the same secret Orman has as `headless.edge_secret_sha256`; `php please orman-headless:install --domain=<site>` prints both).
`forwardToOrman` rewrites to Orman and leaves the answer alone, so `Set-Cookie` and `Cache-Control` reach the visitor exactly as Orman sent them. Header rules:

- `X-Orman-Edge` is set from the secret, overwriting what the client sent.
- `X-Forwarded-Host` / `-Proto` come from the request. `X-Forwarded-For` is exactly one platform IP.
- `X-Orman-Client-IP` is **always deleted** from the client's request and set from the platform's IP **only when an edge secret is configured**. Orman believes it only together with a valid `X-Orman-Edge`.
- No origin or no secret: a 502 (fail closed). `requireEdgeSecret: false` is for a dev setup without a secret; nothing is then trusted by Orman.

**Gates** are the hook for request-level decisions (Maintenance in 6.4, Sessions in 6.5): a gate returns a `Response` to answer or nothing to let the request through.

```ts
import { gated, forwardToOrman, noopGate, type ProxyGate } from '@orman/headless-next/proxy'
export const proxy = gated([noopGate /* , maintenanceGate */], req => forwardToOrman(req))
```

A gate that blocks pages must keep `/!/csrf-token` reachable.

## Browser calls and `<Form>`

`api(method, url, data?)` fetches `/!/csrf-token` first for every non-GET, sends `X-CSRF-TOKEN`, never throws, and returns `{ ok, status, body }` or
`{ ok: false, status, message, errors? }` (`errors` = Laravel's per-field 422 messages). Wording of the messages the kit writes itself: `{ messages: { network, … } }`.

```tsx
'use client'
import { Form, FieldError } from '@orman/headless-next/form'

<Form action="/!/forms/contact" onSuccess={() => setSent(true)}>
  <input name="email" /> <FieldError name="email" />
  <button type="submit">Send</button>
</Form>
```

Class hooks: `orman-form`, `--pending`, `--done`, `orman-form__message` (general failure), `orman-form__error` with `data-field`. `prepare(formData)` is where a captcha adds its token.

## Forms from the blueprint: `client.form`, `<FormFields>`, `<Captcha>`

```tsx
// app/contact/page.tsx (server)
const { data: form } = await orman.form('contact')   // tag form:contact: a blueprint change revalidates it
const { addons } = await orman.site()

<Form action="/!/forms/contact" onSuccess={...}>
  <FormFields form={form} />                       {/* fields, labels, instructions, options, honeypot */}
  <Captcha site={addons} form={form} surface="forms" />   {/* adds the token under the field names the Blade forms use */}
  <button type="submit">Send</button>
</Form>
```

`<Captcha>` renders nothing when the site has no captcha for that surface. Turnstile loads Cloudflare's script on demand; Kaptcha fetches a challenge from
`/!/kaptcha/challenge` and shows its image. Both put their token into the post through `<Form>`'s hooks and reset after every request. Only the public
key and settings come from `/site`; secrets stay in Orman.

## Maintenance: `maintenanceGate`

```ts
// proxy.ts
import { maintenanceGate } from '@orman/headless-next/proxy'
const gate = maintenanceGate(() => orman.site(), { origin: process.env.ORMAN_ORIGIN, edgeSecret: process.env.ORMAN_EDGE_SECRET })
export async function proxy(request: NextRequest) {
  return (await gate(request)) ?? NextResponse.next()
}
```

While `gates.maintenance.active` is true every page answers with the status the CP chose (503 + `Retry-After` by default, `noindex`, `no-store`) and the page built from
`addons.maintenance`. Always open: `/!/*` (so `/!/csrf-token`, the subscribe form and the unlock form work), `/img/*`, `/assets/*`, `/_next/*`, the editor's allowed
paths and `options.allow`. A visitor with the bypass cookie, or a link carrying the key, is asked at `/!/maintenance/check` (Orman keeps the secrets) and passes.
If `/site` cannot be read the gate lets requests through and logs it. Pass `render` to answer with your own page.

## Not built yet

`COMPONENT_ROADMAP` lists `<AddToCart>`/`<Cart>`, `<CodeCheck>` (6.7). There is no `<SessionGate>`: Orman enforces the Sessions rules itself, and a revoked session
answers 401 on the next `/!/` call, which every per-user component treats as signed out.
