# Working on Tell (BlockorTalk)

## How to build: the amisha-skills plugin

The amisha-skills plugin defines the skills and agent types below. Use them for all implementation work in this repo, every session.

- **Implementation follows `/implement`** (amisha-skills `implement`):
  1. Use the **`tdd`** skill at seams the user has agreed to, and confirm the seams before writing any test.
  2. Red before green: write the failing test, watch it fail, then write the code.
  3. Run typecheck and single test files as you go, and the full suite once at the end.
  4. Review with **`code-review`**.
  5. Commit to the current branch.
- **Agent types** (`amisha-skills:<name>`):
  - `scout` finds the files, patterns, seams and check commands before work starts.
  - `researcher` answers one unverified question about a library or API.
  - `builder` implements or repairs one ticket test-first, within its owned paths.
  - `reviewer` gives an independent read-only verdict on a diff against its acceptance criteria. Use it after every green build, and send its findings back through tdd.
- Tickets from `to-tickets` run with `/run-tickets`. Bugs use `diagnosing-bugs`.
- `/implement` and `/run-tickets` only run when the user types them. Without that, follow their steps as written here.
- If the plugin isn't installed, follow the same workflow by hand.

## Checks

- `npm run typecheck`
- `npm test` (node tests, then vitest)
- Single files:
  - `npx vitest run tests/<file>.test.ts`
  - `node --test tests/<file>.test.mjs`
- Database tests need `TEST_DATABASE_URL`, a disposable Postgres.

## Before starting

- Fetch `origin/main` and check the open issues and PRs first. Other lanes own the UI, the reveal and voice, so don't repeat their work.
