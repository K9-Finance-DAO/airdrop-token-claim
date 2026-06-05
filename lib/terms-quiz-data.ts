import { type Question } from "./terms-quiz-types";

export const DEFAULT_TERMS_TEXT = `By proceeding, you accept these terms in their entirety, including the parts you skimmed and the parts you blatantly ignored. Our lawyers would like it known that reading this section confers no special legal protection, but it does confer approximately 3% more moral high ground in arguments with your friends.

The Sunset Protocol ("we," "us," "the crab") provides services on an as-is basis, which is legalese for "it works until it doesn't." By clicking that charming little checkbox below, you agree not to sue us over things we warned you about, including but not limited to: gas fees, impermanent loss, permanent loss, the color orange, and the existential dread of watching a pending transaction.

You agree that you are not a bot. If you are a bot, you agree to pretend to be a human for the duration of this interaction, and to file taxes accordingly. You further agree that you will not attempt to teach our quiz to a language model, unless that language model is cute, in which case we'll allow it.

You understand that on-chain actions are permanent. Permanent as in "still there when the sun burns out." Permanent as in "your grandchildren's notarized family historian will find this." Permanent as in "please do not sign things you do not mean."

You acknowledge that clicking "I agree" without reading these terms would make you just like everyone else on the internet, and that we are, together, here, trying to be slightly better than that. Not by much. But slightly.

You agree not to use the protocol to: launder regret, automate bad decisions, yell at the contract, or build anything that would make a 2014 Vitalik cringe. You are welcome to build things that would make a 2014 Vitalik mildly concerned. That's just innovation.

Finally, you accept that this quiz exists because we genuinely want you to understand what you are signing, and also because it's funny. Both things can be true. Proceed when ready.`;

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt: "What does signing this attestation actually do?",
    answers: [
      {
        id: "q1a",
        text: "Writes a public record on Base that you agreed to these terms",
        correct: true,
        explanation: "Exactly. An EAS attestation is a signed on-chain record — public, verifiable, and permanent.",
      },
      {
        id: "q1b",
        text: "Sends a copy of the terms to your grandma via certified mail",
        correct: false,
        explanation: "Your grandma remains blissfully unaware. This is an on-chain record, not a postal service.",
      },
      {
        id: "q1c",
        text: "Nothing. It's just a UI flourish for vibes",
        correct: false,
        explanation: "It's a real transaction that costs real gas and creates a real attestation. Very not-vibes.",
      },
      {
        id: "q1d",
        text: "Mints an NFT of you reading the terms",
        correct: false,
        explanation: "Tempting, but no. It's an attestation — structured data — not an image token.",
      },
    ],
  },
  {
    id: "q2",
    prompt: "If the transaction confirms, can you undo it later?",
    answers: [
      {
        id: "q2a",
        text: "Yes, just click 'unsign' in the wallet menu",
        correct: false,
        explanation: "'Unsign' is not a thing. Wallets sign; they do not retroactively unsign.",
      },
      {
        id: "q2b",
        text: "No. On-chain records are permanent by design",
        correct: true,
        explanation: "Correct. That permanence is the whole point — it's what makes an attestation mean something.",
      },
      {
        id: "q2c",
        text: "Yes, but only during a full moon",
        correct: false,
        explanation: "Blockchains do not observe lunar cycles. The chain is indifferent to the moon.",
      },
      {
        id: "q2d",
        text: "Only if you ask very politely",
        correct: false,
        explanation: "The chain is famously unmoved by politeness. Permanence is permanence.",
      },
    ],
  },
  {
    id: "q3",
    prompt: "Which network does this attestation land on?",
    answers: [
      {
        id: "q3a",
        text: "Whatever network your wallet happens to be on",
        correct: false,
        explanation: "Nope — that's why we block signing when you're on the wrong chain. Specificity matters.",
      },
      {
        id: "q3b",
        text: "Bitcoin, obviously",
        correct: false,
        explanation: "Bitcoin does not have an attestation service. Bitcoin has opinions, but not attestations.",
      },
      {
        id: "q3c",
        text: "Base — an Ethereum L2 built by Coinbase",
        correct: true,
        explanation: "Correct. Base, an EVM L2 — cheap gas, fast finality, EAS deployed.",
      },
      {
        id: "q3d",
        text: "A private Excel sheet that Shima maintains",
        correct: false,
        explanation: "Shima does maintain an impressive number of spreadsheets, but none of them are this.",
      },
    ],
  },
  {
    id: "q4",
    prompt: "Who pays the gas for this attestation?",
    answers: [
      {
        id: "q4a",
        text: "The Sunset Protocol covers it via a paymaster",
        correct: false,
        explanation: "Not in this version. Maybe one day. Today the signer pays.",
      },
      {
        id: "q4b",
        text: "You do, from your connected wallet",
        correct: true,
        explanation: "Yes. It's a normal transaction, signed and paid for by the connected wallet.",
      },
      {
        id: "q4c",
        text: "Vitalik, personally",
        correct: false,
        explanation: "Vitalik does not pay your gas. Vitalik has a lot going on.",
      },
      {
        id: "q4d",
        text: "Gas? On an L2? Surely you jest",
        correct: false,
        explanation: "Gas on Base is cheap, but it still exists. 'Cheap' is not 'free.'",
      },
    ],
  },
  {
    id: "q5",
    prompt: "Why are we gating the terms behind a quiz at all?",
    answers: [
      {
        id: "q5a",
        text: "Because reading matters when you're signing permanent records",
        correct: true,
        explanation: "That's the whole thesis. Comprehension before commitment. Welcome in.",
      },
      {
        id: "q5b",
        text: "To annoy users into leaving",
        correct: false,
        explanation: "If we wanted to drive users away, we'd have a much easier tool than a quiz.",
      },
      {
        id: "q5c",
        text: "It's a federally mandated crab ritual",
        correct: false,
        explanation: "No federal body mandates crab rituals. We checked. Twice.",
      },
      {
        id: "q5d",
        text: "To train a secret AI on your answer patterns",
        correct: false,
        explanation: "Your answers live only in this session. No patterns harvested, no models trained.",
      },
    ],
  },
];
