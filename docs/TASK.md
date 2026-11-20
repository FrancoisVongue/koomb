# Backend Technical Test 2026 — Web Scraper (AI-Assisted Edition)

> **Company:** Koombea AI — *The Leading Mobile & Web App Development Partner* · [koombea.com](https://koombea.com)

---

## Table of contents

1. [Why this test changed](#1-why-this-test-changed)
2. [Purpose](#2-purpose)
3. [The application](#3-the-application)
   - [3.1 Required features](#31-required-features)
   - [3.2 Nice to have](#32-nice-to-have)
   - [3.3 UI guidelines](#33-ui-guidelines)
4. [AI-assisted development requirements](#4-ai-assisted-development-requirements)
5. [Rules](#5-rules)
6. [How you will be evaluated](#6-how-you-will-be-evaluated)
7. [Submission](#7-submission)

---

## 1. Why this test changed

At Koombea every developer builds with Claude. We still evaluate how you solve problems and write code, but we now **also** evaluate how you set up and drive your AI tooling:

- the **context** you give it,
- the **guardrails** you put around it,
- and how you **verify** what it produces.

Using AI is **expected, not penalized**. What we look for is judgment: an engineer who directs the AI, not one who is directed by it.

---

## 2. Purpose

This test evaluates your ability to:

- solve problems,
- apply best practices,
- review functional requirements.

Please **do not focus on the frontend**; a nice look and feel is welcome but is **not evaluated**.

We pay extra attention to:

- Readability of your solution
- Testing performed and completeness of the test suite
- Use of best practices and patterns
- Instructions for us to run the project
- **New:** how you configured your AI harness and how you verified the AI's work

---

## 3. The application

A simple application where a user adds a link to a web page, and the application scrapes that page and stores a list of all the links on it.

**Scope:** only `<a>` tags. Links created any other way (for example via JavaScript) can be ignored.

### 3.1 Required features

| # | Feature | User story / requirement |
|---|---------|--------------------------|
| 1 | **Pages list** | As a user, I can see a list of all the pages I have scraped, with the number of links found on each. |
| 2 | **Page detail** | As a user, I can see all the links of a particular page: the URL and the name of each link. |
| 3 | **Add a URL** | As a user, I can add a URL and the system finds all its links and stores them. |
| 4 | **Slow pages / processing status** *(now required)* | Some pages take longer than others to scrape. Scraping must not block the request, and the pages list must show which pages are still being processed. |
| 5 | **Pagination** *(now required)* | On both the pages list and the links list. |

#### Details for feature 3 — Add a URL

For a link like:

```html
<a href='https://www.w3schools.com'>Visit W3Schools.com!</a>
```

- the `href` is the **link**;
- the body is the **name**;
- the body is sometimes not plain text and may contain other HTML elements; in those cases you may store **a portion of the HTML**;
- the page `title` is the **page name**.

#### Note on features 4 and 5

Items 4 and 5 were nice-to-haves in the previous version. With AI assistance they are cheap to build, so we now expect them.

> We value a finished, well-verified solution over extra features.

### 3.2 Nice to have

- One-command setup (Docker Compose or equivalent)
- CI pipeline running lint and tests
- Failure handling: timeouts, unreachable pages, an error state visible in the list, retry
- Resolving relative URLs and handling duplicate links
- Per-user pages (authentication)

### 3.3 UI guidelines

Two screens:

| Screen | Contents |
|--------|----------|
| **Landing page** | The URL input and the list of scraped pages (**name**, **link count**, **status**) |
| **Internal page** | The links of one page (**name**, **URL**) |

Plain styling is fine.

We will expect something like this in the landing page:

![Landing page mockup](ui-mockup.png)

Text version of the mockup:

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   [ Add new page                   ]   [   Scrape   ]    │
│                                                          │
│   ┌───────────────────────────────┬──────────────────┐   │
│   │ Name                          │ Total links      │   │
│   ├───────────────────────────────┼──────────────────┤   │
│   │ Google product                │ 20               │   │
│   │ Amazon DYI page               │ 6                │   │
│   │ Facebook user anatoly         │ 32               │   │
│   │ Blog posts 24                 │ 33               │   │
│   │ Sample page                   │ 13               │   │
│   │ page processing               │ in progress      │   │
│   └───────────────────────────────┴──────────────────┘   │
│                                                          │
│            [Previous] [1] [2] [3] [Next]                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

What the mockup shows:

- a text input with the placeholder **"Add new page"** and a **"Scrape"** button next to it;
- a table with two columns, **Name** and **Total links**;
- a page that is still being scraped appears as a row named **"page processing"** with **"in progress"** in place of the link count;
- pagination controls under the table: **Previous**, page numbers **1 2 3**, **Next**.

---

## 4. AI-assisted development requirements

Your repository **must** include the following. These are evaluated **as part of the test, not as extras**.

| # | Deliverable | What we expect |
|---|-------------|----------------|
| 1 | `CLAUDE.md` at the repo root | Project-specific context: architecture overview, folder map, exact commands to run, test and lint, coding conventions, and things Claude must not do. Keep it concise. The unedited output of `/init` does not count. |
| 2 | `.claude/settings.json` (committed) | Permissions that fit the project: an allow-list for the commands Claude may run on its own (tests, linter, formatter) and deny rules for secrets (`.env`) and destructive operations. No blanket allow-all, no permission bypass. |
| 3 | A verification loop | At least one mechanism that makes Claude check its own work, for example a hook that runs the formatter or linter after edits, or a custom command in `.claude/commands/` such as `/test` or `/review`. Explain your choice in the README. |
| 4 | `docs/PLAN.md` | Written **before implementation**: your breakdown of the requirements, ambiguities you found and the decisions you made, data model, how you handle slow pages, and your test strategy. It can be drafted with AI, but the decisions must be yours. |
| 5 | `AI_USAGE.md` | An honest report: your workflow, 3 to 5 key prompts, at least two concrete cases where Claude was wrong or suboptimal and how you caught and fixed it, what you wrote or rewrote by hand, and a rough time split. |
| 6 | Git history | Small, meaningful commits through the whole process, not a single final dump. Keep the co-author trailers Claude adds; they are not penalized. |
| 7 | Session transcripts *(optional, bonus)* | Exports of your key Claude Code sessions in `docs/sessions/`. |

### Deliverables as checklists

#### 1. `CLAUDE.md` (repo root)

- [ ] Architecture overview
- [ ] Folder map
- [ ] Exact commands to run, test and lint
- [ ] Coding conventions
- [ ] Things Claude must not do
- [ ] Concise
- [ ] Not the unedited output of `/init`

#### 2. `.claude/settings.json` (committed)

- [ ] Allow-list for the commands Claude may run on its own (tests, linter, formatter)
- [ ] Deny rules for secrets (`.env`)
- [ ] Deny rules for destructive operations
- [ ] No blanket allow-all
- [ ] No permission bypass

#### 3. Verification loop

- [ ] At least one mechanism that makes Claude check its own work, for example:
  - a hook that runs the formatter or linter after edits, **or**
  - a custom command in `.claude/commands/` such as `/test` or `/review`
- [ ] The choice is explained in the README

#### 4. `docs/PLAN.md` (written before implementation)

- [ ] Breakdown of the requirements
- [ ] Ambiguities found and the decisions made
- [ ] Data model
- [ ] How slow pages are handled
- [ ] Test strategy
- [ ] May be drafted with AI, but the decisions are yours

#### 5. `AI_USAGE.md` (an honest report)

- [ ] Your workflow
- [ ] 3 to 5 key prompts
- [ ] At least two concrete cases where Claude was wrong or suboptimal, and how you caught and fixed it
- [ ] What you wrote or rewrote by hand
- [ ] A rough time split

#### 6. Git history

- [ ] Small, meaningful commits through the whole process
- [ ] Not a single final dump
- [ ] Co-author trailers Claude adds are kept (they are not penalized)

#### 7. Session transcripts (optional, bonus)

- [ ] Exports of key Claude Code sessions in `docs/sessions/`

---

## 5. Rules

- **Any** language, framework and AI tool is allowed. List every tool you used in the README.
- Do **not** commit secrets. Provide a `.env.example`.
- You must be able to **explain every line** in the follow-up interview. Code you cannot explain counts against you, regardless of who wrote it.
- Your recruiter will confirm the deadline.

---

## 6. How you will be evaluated

| Area | Weight |
|------|-------:|
| Functional completeness | 20 |
| Code quality and architecture | 15 |
| Testing | 15 |
| AI harness setup (`CLAUDE.md`, permissions, verification loop) | 20 |
| AI process and judgment (planning, commits, critical review of AI output) | 20 |
| Documentation and developer experience | 10 |
| **Total** | **100** |

---

## 7. Submission

Share a **GitHub repository link** (public, or invite the address your recruiter gives you).

The README must include:

- setup and run instructions,
- how to run the tests,
- the tools you used,
- the trade-offs you made.