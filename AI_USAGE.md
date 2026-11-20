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

## What I wrote or rewrote by hand

<!-- e.g. CLAUDE.md, docs/PLAN.md decisions. -->

## Time split

<!-- Rough split: planning / harness setup / implementation / review. -->
