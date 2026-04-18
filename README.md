# `@k9/airdrop-token-claim` — shadcn registry

Drop-in React component for the [K9 Finance](https://k9finance.com) `TokenClaim` merkle airdrop contract, distributed via the [shadcn CLI registry](https://ui.shadcn.com/docs/registry).

> **Status: scaffolding.** The registry infrastructure (build pipeline, freshness wiring, MIT license) is in place. The component itself is not yet published. See [SDK plan](#status-and-roadmap) for the open decisions and timeline.

## What this is

A single-token claim widget that any React/Tailwind dapp can install with one command:

```bash
npx shadcn@latest add @k9/airdrop-token-claim
```

The component takes a contract address, a chain ID, and a proofs JSON URL — and renders an "Eligible / Claim / Already Claimed" UI that handles wallet connection, chain switching, allocation lookup, and the on-chain `claim()` call. Consumers own the source files after install (the shadcn idiom) and can restyle / rebrand freely.

For the K9 use case, render two `<TokenClaim />` components side by side (one for KNINE, one for esKNINE).

## Why this exists

K9 Finance ships a public token claim flow. Other projects launching merkle airdrops have asked to reuse the UI rather than rebuild it. This repo packages it for drop-in use, with no coupling back to the K9 dapp's brand, scaffold-eth wrappers, or RainbowKit-specific assumptions.

## Roadmap

This initial commit ships:

- MIT LICENSE
- `package.json` + `tsconfig.json` for the registry's own dev tooling
- `registry.template.json` — schema-valid template with the dependency manifest, but no component yet
- `scripts/resolve-latest-deps.mjs` — **freshness wiring**: rewrites the `dependencies` array in the template to whatever the latest stable version of each tracked package is on npm at registry-build time. Means a fresh `npx shadcn add` always installs the *current* latest of `wagmi`, `viem`, `@tanstack/react-query`, etc. — never a months-stale caret range.
- `.gitignore`, `CHANGELOG.md`

Not yet shipped (planned next):

- The component source files (`token-claim.tsx`, `use-merkle-proofs.ts`, `token-claim-abi.ts`, `format-token-amount.ts`, `is-user-rejected.ts`)
- A live demo site (Next.js, deployed to GitHub Pages or Vercel) at the registry's homepage
- CI: `prebuild → shadcn build → deploy public/r/ to gh-pages` on every push to `main`
- CI: weekly cron that scaffolds the component into a fresh Next 15 + RainbowKit project and runs a smoke test, catching breakage from upstream wagmi/viem majors before users do
- Renovate or Dependabot for the registry's dev-deps

See the [SDK architecture plan](https://github.com/K9-Finance-DAO/airdrop-token-claim/issues/1) (TBD: file as a tracking issue once the repo's settled) for the seven open architectural decisions and the per-phase effort estimate (~3.5–4.5 days for v1).

## Freshness model (the staleness fix)

Naive shadcn registries hand-pin caret ranges (`wagmi@^2.12.0`) in the published JSON. Six months later, a fresh `shadcn add` still installs that 2.x range even though the latest is 3.x. We avoid that with two layers:

**1. Build-time `prebuild` script** — `scripts/resolve-latest-deps.mjs` queries `npm view <pkg> version` for every tracked dep at registry-build time and writes the resolved `<pkg>@^<latest>` into `registry.json`. Every push to `main` rebuilds the published registry from current npm state.

**2. Renovate (planned)** — keeps the registry's own dev-deps and the demo site current. Patch/minor PRs auto-merge once CI passes; majors get a manual review with a smoke-test against a fresh Next + RainbowKit project.

The combination means consumers always get current-day latest at install, the registry source itself stays current, and breaking-change discovery happens in our CI before it reaches downstream installs.

## Distribution mechanics

- **Hosting:** GitHub Pages serves `public/r/*.json` (output of `shadcn build`) at `https://k9-finance-dao.github.io/airdrop-token-claim/r/`. A custom domain may be added later.
- **Versioning:** shadcn registries are fetch-time, no lockfile. Pin a specific version by URL: `https://k9-finance-dao.github.io/airdrop-token-claim/r/v1/token-claim.json`. The `…/r/token-claim.json` alias always points at latest.
- **Consumer install (once the component ships):**
  ```bash
  npx shadcn@latest add @k9/airdrop-token-claim
  # or by URL:
  npx shadcn@latest add https://k9-finance-dao.github.io/airdrop-token-claim/r/token-claim.json
  ```

## License

[MIT](./LICENSE). Copyright © 2026 K9 Finance DAO.

## Maintainer

K9 Finance DAO. See git history for individual contributors.
