# AI usage

## Workflow
I started with a short plan and a CLAUDE.md, both written before any code. The
first PLAN.md was only the order of work; I didn't know the stack or the edge
cases yet and didn't want to pretend I did. From there it grew one part at a
time: before building a part, Claude and I talked through the open questions, I
made the calls, they went into DEVELOPMENT_PLAN.md, and then Claude wrote the code. I read
what came back, and a fair amount of the session is me pushing back: on the
number of tests, on how controllers were written, on a `scrape` model that
wasn't a model. Claude committed only when I told it to. When the plan turned
out wrong, the plan was changed in its own commit, so the git history shows the
decisions in the order I actually made them.

Three things checked the work besides me. A Stop hook runs lint and typecheck
after Claude finishes, so broken code doesn't sit unnoticed. Six small reviewer
agents, each checking one rule from CLAUDE.md (structure, controller
readability, services, outcomes, consistency with the plan), run in parallel
through `/review` before a commit. And every time Claude got something wrong or
I rewrote something by hand, it went into this file at that moment, which is
where the cases below come from.

## Key prompts

## 1. Review agents, one invariant each

> Lets create a couple of agents that would check certain abstract invariants about our system.. I will suggest a couple you can suggest a couple too. 1. structure agent - check that everything we add is in the right place (subset of our claude.md but with a single purpose so that we are more confident) 2. controllers agent - makes sure that controllers are readable (as said inr our claude.md) 3. consistency agent - makes sure that overall diff that we introduce in the commit is consistent with what we declare in task/plan. and then we could run them in parallel by creating some command in claude/commands ? what you think

Result: six single-purpose reviewer agents and the `/review` command.

## 2. Cut scope, put everything external behind services

> no, no CI . no peruser, don't overcomplicate .. SSRF - ok, we can account for it. .. about testing strategy.. we should have a servcie container that we ingect in routes/controllers to make testing way easier and also we should have our own page fetcher (simple functions that uses fetch under the hood) as a service to make sure everything async, everything external comes from servcies that we can easily substitute for testing ! also we should have a separate agent document that would check for that and update this knowledge in claude.md! does it make things ways clearer and nice for you now?

Result: one typed service container, tests with fakes instead of module mocks, and a services reviewer.

## 3. Fewer, meaningful tests

> background is a servcie? scheduler is a service? explain them to me shortly ... what was wrong with venum? why so many tests? don't test 2+2 is 4 please make sure they are meaningful and to the point 3-7 tests per model is okay usually , too many tests make it hard to verify and read all of that, its only our first wave with writeing code haveing 128 tests won't help! it should be simple and straightforward, not 128 tests... most of the common errors should be caught by type system and validation and only something that really needs testing should be tested! what do you mean has no internet? we have internet here!

Result: 124 tests cut to about 30 that cover cases that can actually break.

## 4. One step per line in routes and controllers

> export const listPages = async (services: Services, pagination: Pagination) => venum('ok', await services.db.pages.list(pagination)); ----- how can you say ok if its not ok? what if db is not connected or returns error for any reason? don't this is big mistake in controllers as it will render any erorrs untraceable you won't understand what broken with code like this .. sperad it into multpile lines and assigne values to varialbes at each step when necessary and dno't put (await blabla) inside other fucntions, rather store it in a variable and then pass the varialbe, its way better for debugging ! fix it in all routes and controllers, don't try to save space on code rather make it explicit and easy to read !

Result: every awaited result is a named variable; the rule went into `CLAUDE.md` and the controller reviewer.

## 5. Models are things; the app has two entrances

> no , models is not features, features are what you do with models and they can be defined in controllers! so if you want to parse the page you have PageController.parse and it may return links that you can then pass to links controller for examples it would make more sence to have pages and links and a separate entity that uses these controllers to do the job in the background like cron.ts (sibling of index.ts) because it feels more close to another entrance of the app (same as http) that tells the app what to do then a "servcie" that you use inside of controllers.. you know.. and its way easier to read.. you see two input that allow to invoce our app's usecases - index.ts (by client) and cron.ts (by time) .. makes sense?

Result: the `scrape` model was removed; `pages` and `links` remain, driven from HTTP and from `cron.ts`.

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
CLAUDE.md, DEVELOPMENT_PLAN.md and the structure and services reviewers now describe it.

## What I wrote or rewrote by hand

- **The first `docs/PLAN.md`.** The three lists (in parallel, sequential, at the
  end) are mine. Claude later restructured the file and recorded decisions in
  it, but each decision was made by me in the conversation first.
- **`CLAUDE.md`.** Claude produced an empty skeleton with section headings. I
  filled it in myself, starting from the conventions file of my previous
  project, then had Claude check it for contradictions and fix the ones it
  found (folder paths, typos).
- **`.claude/settings.json`.** Claude created a minimal file; I wrote the allow
  and deny rules. Claude then found two problems that stopped the hook from
  working and fixed them with my approval.
- **Application code: none.** I did not type code into the source files. Every
  change to the code went through a prompt, and I read the diffs. Where I
  disagreed with the code, the rewrite is logged above as a case, with the
  prompt that caused it.

## Time split

About 6 hours in total, counted from the session timestamps.

| Phase | Time | Share |
|-------|------|-------|
| Planning: reading the task, first plan, decisions per part | ~1 h 40 min | 28% |
| Harness: `CLAUDE.md`, settings, hook, Biome, reviewer agents | ~2 h 15 min | 37% |
| Implementation: backend, frontend, Docker, last features | ~1 h 25 min | 24% |
| Review and fixes after it | ~40 min | 11% |

Setting up the harness took longer than writing the app. Most of that hour went
into `CLAUDE.md` and the reviewer agents, and it paid back during
implementation: the backend came out in one 15-minute run and the reviews
caught the rest.
