# Contributing to Emlawtech

Thanks for helping. This guide covers setup, workflow and what a good pull
request looks like.

## Setup

You need Node.js 22 or newer and Git.

```bash
git clone https://github.com/Emlawtech-dev/Emlawtech.git
cd Emlawtech
npm install
npm test
```

To run the API locally:

```bash
npm run dev
```

It listens on `http://localhost:4000`. Copy `.env.example` to `.env` if you
want to change the port.

## Workflow

1. Pick an issue, or open one first for anything larger than a small fix.
2. Comment on the issue so others know you are working on it.
3. Fork the repo and create a branch: `git checkout -b feat/short-description`.
4. Make small, focused commits.
5. Run `npm run build` and `npm run test` before pushing.
6. Open a pull request and fill in the template. Link the issue with `Closes #123`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add milestone support to escrows
fix(backend): return 404 for unknown escrow ids
docs: clarify the dispute flow
test(core): cover the review window boundary
```

One logical change per commit. Commits that mix unrelated work are hard to
review.

## Code standards

- TypeScript with `strict` enabled. Avoid `any`.
- Money is always integer stroops (`bigint`), never floating point.
- Business rules belong in `packages/escrow-core`, not in HTTP handlers.
- Every behavior change needs a test. Tests live in the `test/` folder of the
  package they cover and run with Node's built-in test runner.

## Pull request checklist

- The change does what the issue asks and nothing unrelated.
- `npm run build` and `npm run test` pass.
- Tests cover new behavior, including failure cases.
- Docs are updated when behavior or setup changes.

## Reporting security problems

Please do not open a public issue. See [SECURITY.md](SECURITY.md).
