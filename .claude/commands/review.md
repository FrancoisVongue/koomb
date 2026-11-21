---
description: Run the six invariant reviewers in parallel on the diff about to be committed
argument-hint: "[git ref to diff against, default: staged changes]"
---

Review a diff with the project's invariant agents. **Report only; do not fix
anything.**

## 1. Pick the diff

- No argument: the diff command is `git diff --staged`. If it prints nothing,
  say there is nothing staged and stop.
- With an argument: the diff command is `git diff $ARGUMENTS`.

## 2. Run the agents in parallel

In a single message, launch these six subagents, one call each:
`structure-reviewer`, `controller-reviewer`, `consistency-reviewer`,
`outcomes-reviewer`, `tests-reviewer`, `services-reviewer`.

- Give each one the same prompt: the diff command from step 1, and
  "Review this diff for your invariant."
- Do **not** pass a `model` override: each agent's definition pins its model.
- Pass `effort: low`: the agents check one invariant each and should be quick.

## 3. Check the findings

Before reporting, open every `file:line` an agent cites and confirm the
finding holds. Drop the ones that don't, and say how many were dropped and
why.

## 4. Report

A table, one row per agent:

| Agent | Verdict | Findings |
|-------|---------|----------|

Then the confirmed findings, grouped by agent, each as
`file:line — rule — problem — suggested fix`.
