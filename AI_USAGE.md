# AI usage

## Workflow

<!-- How I worked with Claude Code. -->

## Key prompts

<!-- 3 to 5 prompts. -->

## Where Claude was wrong or suboptimal

### 1. Claude pushed back on TypeScript namespaces, and I pushed back harder

In `CLAUDE.md` I wrote that pure functions are defined on types, in a
namespace, so code reads as `Page.action(page)`. Claude replaced this with a
"companion object" (`type Page` + `const Page = { … }`) and banned the
`namespace` keyword, citing a typescript-eslint lint rule and Node's native
type stripping, which can't run namespaces. It then built the tooling to
enforce its version: `erasableSyntaxOnly` in both tsconfigs and Biome's
`noNamespace` as an error. The problem showed as soon as the data model got a
`status`: an object can hold functions but not types, so `Page.Status` was
impossible and would have become a separate top-level `PageStatus`. The model
would have been split across several names again, which is exactly what the
convention was meant to prevent.

The usual advice, "don't use namespaces, use ES modules", is about organizing
files; namespaces came before modules. It gets repeated as a blanket rule, and
an essential TypeScript feature for grouping a type with its sub-types and
pure functions is frowned upon for no real reason. Used for that purpose, it
makes code better: `Page.Status`, `Page.linkCount(page)` read like the domain,
it's obvious where things belong, and what is pure. I pushed back. Claude
agreed, tested both namespace variants against `tsc`, Node and Biome, and
showed that every blocker was a setting it had chosen itself. We switched the
backend to `tsx`, removed `erasableSyntaxOnly` and turned `noNamespace` off.
Lesson: tool defaults are trade-offs to state, not reasons to change the
design.

### 2. A link count that was right by coincidence

Claude wrote the "links per page" count as a Drizzle subquery. Drizzle
rendered the columns without table names (`where "page_id" = "id"`), so
inside the subquery `id` meant `links.id`, not `pages.id`. The first database
test still passed, because page 1 happened to have link 1. A controller test
with two links got a count of 1 and exposed it. The fix qualifies the columns
by hand, and a regression test now uses pages and links whose ids don't line
up.

### 3. An SSRF fix that blocked the whole internet

To catch `http://[::ffff:127.0.0.1]/`, which `URL` rewrites as
`::ffff:7f00:1`, Claude blocked the IPv4-mapped IPv6 range. Node's
`BlockList` applies that range to plain IPv4 addresses too, so every IPv4
address, `8.8.8.8` included, became "private". The `isPrivateAddress` tests
with public addresses failed straight away. The fix unwraps mapped addresses
to IPv4 and checks them as IPv4.

### 4. Small slips caught by the harness

- A `cd` into a folder that didn't exist yet wrote four service files into
  `backend/` instead of `backend/src/services/`. Caught on the next `ls`.
- After adding the `shared` workspace, `npm run typecheck` failed because
  `shared` has no `typecheck` script. The Stop hook (`verify.sh`) caught it
  and blocked; fixed with `--if-present`.
- A cleanup step with `rm -rf` was refused by the project's own deny rules.

### 5. Too many tests, and a wrong "no internet" claim

The first backend wave came with 124 tests (`it.each` included): many of them
checked things the types and input validation already guarantee. I asked for
3 to 7 meaningful tests per model; it went down to 30, each covering a rule
that can really break (deduplication, link counts, claiming, retries, SSRF,
the SSE stream). Claude also reported "this environment has no internet"
because `example.com` didn't resolve; only that host failed on this machine's
DNS. Scraping `w3schools.com` worked (190 links).

### 6. Compact code that hides the steps

Controllers and routes were written as dense one-liners, e.g.
`venum('ok', await services.db.pages.list(pagination))`, and routes as nested
`match` calls with `await` inside. A thrown error still reached the global
error handler, but there was no intermediate value to inspect, and each line
did several things. I asked for one step per line with named variables and no
`await` inside other calls; routes and controllers were rewritten, the error
log now includes the request, and the rule is in CLAUDE.md and the controller
reviewer.

### 7. A "scrape" model that wasn't a model

Claude put the background job in `models/scrape/`, treating it as a feature
folder next to `models/pages/`, and ran the cron schedule through a
`scheduler` service. But models are things (pages, links); what we do with
them are use cases, i.e. controller functions, and controllers may call each
other. I asked for `models/pages/` and `models/links/`, with the scraping use
cases in the pages controller, and for `cron.ts` next to `index.ts`: cron is
a second entrance into the app (by time), like HTTP is (by clients), not a
service used inside controllers. The code was restructured that way, and
CLAUDE.md, PLAN.md and the structure and services reviewers now describe it.

## What I wrote or rewrote by hand

<!-- e.g. CLAUDE.md, docs/PLAN.md decisions. -->

## Time split

<!-- Rough split: planning / harness setup / implementation / review. -->
