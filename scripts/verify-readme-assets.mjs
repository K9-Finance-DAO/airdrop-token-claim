#!/usr/bin/env node

import fs from "node:fs";

const required = [
  "docs/assets/readme/demo-overview.png",
  "docs/assets/readme/token-claim-states.png",
  "docs/assets/readme/terms-quiz.png",
  "docs/assets/readme/eas-terms-kit.png",
  "docs/assets/readme/eas-flow.png",
];

const missing = required.filter(file => !fs.existsSync(file));
if (missing.length > 0) {
  console.error(`Missing README asset(s):\n${missing.map(file => `- ${file}`).join("\n")}`);
  process.exit(1);
}

console.log("README assets exist.");
