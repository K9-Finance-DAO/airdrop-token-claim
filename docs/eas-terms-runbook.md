# EAS Terms Runbook

This runbook prepares a canonical terms document, pins it to IPFS, registers the terms schema on Base EAS, and gives a frontend the config needed to submit attestations.

The v1 kit is Base-first by default. It does not expose an environment chain enum for Ethereum or BNB Chain because explorer and indexer behavior can differ by network. If another network is needed later, add it deliberately with tested constants and API handling.

## 1. Install the kit

```bash
pnpm dlx shadcn@latest add K9-Finance-DAO/airdrop-token-claim/eas-terms-kit
```

## 2. Prepare the terms document

Edit `terms/terms-v1.md`. Do not publish placeholder terms.

```bash
node scripts/prepare-eas-terms.mjs \
  --input terms/terms-v1.md \
  --version 1 \
  --airdrop-id 1 \
  --claim-contract 0x0000000000000000000000000000000000000000 \
  --no-upload
```

Remove `--no-upload` after configuring Pinata:

```bash
PINATA_JWT=... node scripts/prepare-eas-terms.mjs \
  --input terms/terms-v1.md \
  --version 1 \
  --airdrop-id 1 \
  --claim-contract 0xYourClaimContract
```

The script writes `terms/terms-manifest-v1.json` with `termsHash`, `termsURI`, gateway links, and claim contract bindings.

## 3. Register the EAS schema

```bash
BASE_MAINNET_RPC_URL=https://... \
DEPLOYER_PRIVATE_KEY=0x... \
node scripts/register-eas-terms-schema.mjs
```

The script prints:

```bash
NEXT_PUBLIC_EAS_TERMS_SCHEMA_UID=0x...
```

The schema definition is:

```solidity
bytes32 termsHash,string termsURI,uint32 termsVersion,uint256 airdropId,address[] claimContracts,string statement
```

## 4. Configure the frontend

Read values from `terms/terms-manifest-v1.json` and set:

```bash
NEXT_PUBLIC_EAS_TERMS_SCHEMA_UID=0x...
NEXT_PUBLIC_EAS_TERMS_HASH=0x...
NEXT_PUBLIC_EAS_TERMS_URI=ipfs://...
NEXT_PUBLIC_EAS_TERMS_VERSION=1
NEXT_PUBLIC_EAS_AIRDROP_ID=1
NEXT_PUBLIC_EAS_CLAIM_CONTRACTS=0x...
NEXT_PUBLIC_EAS_TERMS_STATEMENT="I have read and agree to the airdrop terms."
```

## 5. Wire the UI

Install `terms-quiz`, pass your final terms/questions, and use `useEasTermsAttest(config)` as the quiz `onAttest` callback.

Use `useHasTermsAttestation(config, address)` to let users skip the quiz when a non-revoked attestation already exists.

## 6. Version changes

When terms change:

1. Create `terms/terms-v2.md`.
2. Run `prepare-eas-terms.mjs --version 2`.
3. Keep the same schema if the payload shape did not change.
4. Update frontend config to the new hash, URI, and version.
5. Require users to attest again for the new version.
