# Changelog

All notable changes to the `@k9/airdrop-token-claim` registry will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial scaffolding: MIT LICENSE, README, package.json, registry template, freshness-wiring `prebuild` script, .gitignore, CHANGELOG.
- `scripts/resolve-latest-deps.mjs` resolves `wagmi`, `viem`, `@tanstack/react-query`, `lucide-react`, `class-variance-authority` to current-day latest at registry-build time and writes them to `registry.json`.

### Not yet
- Component source (`token-claim.tsx` and supporting files)
- `shadcn build` wiring
- Demo site
- GitHub Pages deploy CI
- Weekly upstream-major smoke-test cron
- Renovate config
