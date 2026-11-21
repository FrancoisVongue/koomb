> This is the plan as written before any code, kept as it was. The decisions
> for each part (requirements breakdown, ambiguities, data model, slow pages,
> test strategy) were then written step by step in
> [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

# Plan
20 Nov 2026 · @Francois Vongue
This is the starting plan: how the work will go. Decisions (stack, data model, slow pages, tests) are added to this file step by step, each one before the part it concerns is implemented.
In parallel with everything
1.  Log the work; notice and log bad answers from Claude.
2.  Anything written by hand goes into AI_USAGE.md too.
3.  Keep git history and commits clean.
# Sequential
1.  Define CLAUDE.md.
2.  Define .claude/settings.json.
3.  Choose and install a linter (ESLint or a Rust-based one).
4.  Choose a verification loop and explain it in the README.
5.  Break the work into parts; write the decisions for each part here before building it.
6.  Do each part, write tests and commit.
# At the end
1.  Create new separate agents and evaluate the work from different perspectives.
2.  Update the repo based on the agent reviews.
3.  Define the trade-offs made.
4.  Add session transcripts to docs/sessions/.
5.  List the stack and every tool used in the README.
6.  Make sure the app starts with one command and the README says clearly how: setup and run, how to run the tests, tools used, trade-offs.
7.  Create the repo and push.
