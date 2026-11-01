# Omnium

Monorepo for personal projects. Frontends are Preact apps; Appwrite 2.0 is the backend for everything. Package manager is Bun (via `vp`).

## Stack

- Frontend: Preact (`@preact/preset-vite`), Vite+, TanStack Query, Zod. Do not add React, other routers/state libraries, or other validation libraries without asking.
- Backend: Appwrite 2.0 (Auth, Databases, Storage, Functions, Sites, Messaging). Prefer an Appwrite service over custom backend code or third-party services. Use `appwrite` in browsers and `node-appwrite` in Functions.

## Layout

- `apps/<name>`: Preact frontends, deployed as Appwrite Sites.
- `functions/<name>`: Appwrite Functions.
- `packages/*`: shared code. Check here before writing new helpers, and move code here once a second project needs it.
  - `packages/appwrite`: Appwrite client setup, auth helpers, typed database/storage wrappers.
  - `packages/schemas`: Zod schemas for every collection; the source of truth for data shapes.
  - `packages/query`: TanStack Query client, query-key factories, hooks built on `packages/appwrite`.
  - `packages/ui`: shared Preact components.
  - `packages/utils`: general helpers.
  - `packages/tsconfig`: shared base tsconfigs; extend these instead of writing standalone tsconfigs.
- `tools/*`: repo scripts (run with `vpx`).

Shared packages export TypeScript source (`"exports": "./src/index.ts"`) and depend on each other with `"workspace:*"`.

## Dependencies

- Every external dependency is pinned once in the root `package.json` `catalog`. Workspaces reference it as `"<pkg>": "catalog:"`; never put a version range in a workspace `package.json`.
- Add a new dependency to the catalog first, then to the workspace. Ask before adding or upgrading one.
- Keep only the root `bun.lock`; delete lockfiles found in workspaces.

## Appwrite

- Appwrite resources (databases, collections/tables, buckets, functions, sites) are defined in the root `appwrite.config.json` and deployed with the Appwrite CLI (`appwrite push`). Change them there, not only in the Console.
- Generate TypeScript types with `appwrite types`; keep `packages/schemas` in sync with them.
- Parse Appwrite responses with the Zod schemas inside `packages/appwrite`; apps should not call the SDK directly.
- Data fetching in apps goes through TanStack Query hooks from `packages/query`, using its query-key factories.
- Never commit API keys or secrets. Functions read them from Appwrite environment variables.

## Importing an existing project

1. Bring it in with history: `git subtree add --prefix=apps/<name> <repo-url> <branch>`.
2. Delete its lockfile and tooling configs (ESLint, Prettier, standalone Vite/tsconfig) in favor of the Vite+ and `packages/tsconfig` defaults.
3. Change its dependencies to `catalog:` and replace duplicated helpers with shared packages.
4. Move backend code into `functions/<name>` or replace it with Appwrite services.
5. Run the Review Checklist below before committing.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
