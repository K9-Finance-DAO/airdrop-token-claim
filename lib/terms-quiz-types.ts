export type Answer = {
  id: string;
  text: string;
  correct: boolean;
  explanation: string;
};

export type Question = {
  id: string;
  prompt: string;
  answers: Answer[];
};

export type TermsQuizContentConfig = {
  termsText: string;
  questions: Question[];
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
};

export type Screen =
  | { kind: "terms" }
  | { kind: "quiz"; index: number }
  | { kind: "attestation" }
  | { kind: "pending" }
  | { kind: "success"; txHash: `0x${string}` }
  | { kind: "error"; message: string; txHash?: `0x${string}` };

export type AnswerState = "idle" | "faded" | "wrong" | "correct";

export type QuizPhase = "answering" | "locked-wrong" | "locked-correct" | "resolved-correct" | "resolved-fail";

export type WalletAdapter = {
  address?: `0x${string}`;
  ensName?: string;
  ensAvatar?: string;
  chainId?: number;
  switchToBase?: () => Promise<void>;
  switchToRequiredChain?: () => Promise<void>;
  signAttestation?: (data: unknown) => Promise<`0x${string}`>;
  signMessage?: (message: string) => Promise<string>;
};
