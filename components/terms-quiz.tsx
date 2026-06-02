"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";

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

export type WalletAdapter = {
  address?: `0x${string}`;
  chainId?: number;
  switchToRequiredChain?: () => Promise<void>;
  signMessage?: (message: string) => Promise<string>;
};

export interface TermsQuizProps {
  wallet: WalletAdapter;
  termsText?: string;
  questions?: Question[];
  requiredChainId?: number;
  requiredChainName?: string;
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
  onAttest?: () => Promise<string>;
  onComplete?: (receipt: string) => void;
  className?: string;
}

type Screen = "terms" | "quiz" | "attest" | "pending" | "success" | "error";

export const DEFAULT_TERMS_TEXT = `These demo terms are intentionally fake.

They exist so the reusable TermsQuiz component can be installed, rendered, and tested without importing any project's legal copy.

Replace this text with your approved terms before using the component in production.`;

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: "demo-q1",
    prompt: "What should a production app do before asking users to agree?",
    answers: [
      {
        id: "demo-q1-a",
        text: "Show the final approved terms",
        correct: true,
        explanation: "Correct. Users should review the terms that match the signed or attested payload.",
      },
      {
        id: "demo-q1-b",
        text: "Hide the terms until after signing",
        correct: false,
        explanation: "Agreement should happen after disclosure, not before it.",
      },
      {
        id: "demo-q1-c",
        text: "Use placeholder text in production",
        correct: false,
        explanation: "Placeholders are only for development and examples.",
      },
    ],
  },
  {
    id: "demo-q2",
    prompt: "Why include a quiz before signing?",
    answers: [
      {
        id: "demo-q2-a",
        text: "To confirm basic comprehension",
        correct: true,
        explanation: "Correct. The quiz is a lightweight check that the user understood the main points.",
      },
      {
        id: "demo-q2-b",
        text: "To change the terms after the user passes",
        correct: false,
        explanation: "The accepted terms should be stable and auditable.",
      },
      {
        id: "demo-q2-c",
        text: "To replace legal review",
        correct: false,
        explanation: "A quiz is a product flow, not legal advice or legal review.",
      },
    ],
  },
];

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function TermsQuiz({
  wallet,
  termsText = DEFAULT_TERMS_TEXT,
  questions = DEFAULT_QUESTIONS,
  requiredChainId,
  requiredChainName = "the required network",
  randomizeQuestions = false,
  randomizeAnswers = true,
  onAttest,
  onComplete,
  className,
}: TermsQuizProps) {
  const [screen, setScreen] = useState<Screen>("terms");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const activeQuestions = useMemo(
    () => (randomizeQuestions ? shuffle(questions) : questions),
    [questions, randomizeQuestions],
  );
  const question = activeQuestions[index];
  const answers = useMemo(
    () => (question && randomizeAnswers ? shuffle(question.answers) : question?.answers ?? []),
    [question, randomizeAnswers],
  );
  const wrongChain = requiredChainId !== undefined && wallet.chainId !== undefined && wallet.chainId !== requiredChainId;

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setError(null);
    setReceipt(null);
    setScreen("terms");
  };

  const continueQuiz = () => {
    setSelected(null);
    if (index + 1 >= activeQuestions.length) setScreen("attest");
    else setIndex(value => value + 1);
  };

  const attest = async () => {
    setScreen("pending");
    setError(null);
    try {
      let result: string;
      if (onAttest) {
        result = await onAttest();
      } else if (wallet.signMessage) {
        result = await wallet.signMessage("I completed the terms quiz and accept the terms shown in this session.");
      } else {
        throw new Error("No attestation or signing callback was provided.");
      }
      setReceipt(result);
      setScreen("success");
      onComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing was not completed.");
      setScreen("error");
    }
  };

  return (
    <section className={cx("mx-auto max-w-2xl rounded-xl border bg-card p-6 text-card-foreground shadow-sm", className)}>
      {screen === "terms" ? (
        <div className="space-y-5">
          <Header eyebrow="Step 1" title="Review the terms" />
          <div className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-4 text-sm leading-6">
            {termsText.split("\n\n").map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} className="mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
          <PrimaryButton onClick={() => setScreen("quiz")}>Start quiz</PrimaryButton>
        </div>
      ) : null}

      {screen === "quiz" && question ? (
        <div className="space-y-5">
          <Header eyebrow={`Question ${index + 1} of ${activeQuestions.length}`} title={question.prompt} />
          <div className="space-y-3">
            {answers.map(answer => {
              const isSelected = selected?.id === answer.id;
              return (
                <button
                  key={answer.id}
                  type="button"
                  disabled={Boolean(selected)}
                  onClick={() => setSelected(answer)}
                  className={cx(
                    "w-full rounded-lg border p-4 text-left text-sm transition",
                    isSelected && answer.correct && "border-emerald-500 bg-emerald-500/10",
                    isSelected && !answer.correct && "border-destructive bg-destructive/10",
                    !isSelected && "hover:bg-muted",
                  )}
                >
                  {answer.text}
                </button>
              );
            })}
          </div>
          {selected ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{selected.correct ? "Correct" : "Not quite"}</p>
              <p className="mt-1 text-muted-foreground">{selected.explanation}</p>
            </div>
          ) : null}
          {selected?.correct ? (
            <PrimaryButton onClick={continueQuiz}>
              {index + 1 >= activeQuestions.length ? "Continue to signing" : "Next question"}
            </PrimaryButton>
          ) : selected ? (
            <PrimaryButton onClick={restart} variant="secondary">
              Re-read terms
            </PrimaryButton>
          ) : null}
        </div>
      ) : null}

      {screen === "attest" ? (
        <div className="space-y-5">
          <Header eyebrow="Final step" title="Sign your acknowledgement" />
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>Connected wallet: {wallet.address ?? "Not connected"}</p>
            {requiredChainId ? <p className="mt-1">Required chain: {requiredChainName}</p> : null}
          </div>
          {wrongChain ? (
            <PrimaryButton onClick={() => wallet.switchToRequiredChain?.()} variant="secondary">
              Switch to {requiredChainName}
            </PrimaryButton>
          ) : (
            <PrimaryButton disabled={!wallet.address} onClick={attest}>
              Sign acknowledgement
            </PrimaryButton>
          )}
        </div>
      ) : null}

      {screen === "pending" ? (
        <Centered icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Waiting for confirmation" />
      ) : null}

      {screen === "success" ? (
        <Centered icon={<Check className="h-6 w-6" />} title="Acknowledgement complete" detail={receipt ?? undefined} />
      ) : null}

      {screen === "error" ? (
        <div className="space-y-5">
          <Header eyebrow="Error" title="Signing was not completed" />
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3">
            <PrimaryButton onClick={() => setScreen("attest")} variant="secondary">
              <RotateCcw className="h-4 w-4" />
              Back
            </PrimaryButton>
            <PrimaryButton onClick={attest}>Retry</PrimaryButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border bg-background hover:bg-muted",
      )}
    >
      {children}
      {variant === "primary" ? <ArrowRight className="h-4 w-4" /> : null}
    </button>
  );
}

function Centered({ icon, title, detail }: { icon: ReactNode; title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="text-primary">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {detail ? <p className="max-w-md break-all text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
