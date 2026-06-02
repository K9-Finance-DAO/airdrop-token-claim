"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { keccak256, stringToHex } from "viem";
import { base } from "viem/chains";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";

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

export const BASE_CHAIN_ID = 8453;

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const formatAddress = (addr?: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "-");

export const mockAttestationData = (address?: string) => ({
  schema: "0x7f6fb09beb1886d0b223e9f15242961198dd360021b2c9f75ac879c0f786cafd",
  recipient: address ?? "0x0000000000000000000000000000000000000000",
  expirationTime: 0,
  revocable: true,
  refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
  data: {
    termsVersion: "demo-v1.0.0",
    termsHash: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
    agreedAt: Math.floor(Date.now() / 1000),
    quizScore: "completed",
  },
});

function useAudioFeedback() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensure = () => {
    if (!ctxRef.current && typeof window !== "undefined") {
      const audioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (audioContextCtor) ctxRef.current = new audioContextCtor();
    }
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume().catch(() => undefined);
    }
    return ctxRef.current;
  };

  const playError = useCallback(() => {
    try {
      const ctx = ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      [55, 58.27, 110].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 2 ? "square" : "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.42);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.52);
      });
    } catch {
      // No-op: browsers may block audio without a user interaction.
    }
  }, []);

  const playSuccess = useCallback(() => {
    try {
      const ctx = ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        const t = now + i * 0.065;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.13, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);
      });
    } catch {
      // No-op: browsers may block audio without a user interaction.
    }
  }, []);

  return { playError, playSuccess };
}

function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Some browsers reject vibration calls in restricted contexts.
      }
    }
  }, []);

  return {
    error: () => vibrate([70, 40, 70, 40, 140]),
    success: () => vibrate([25, 30, 25]),
  };
}

function useShake() {
  const [shaking, setShaking] = useState(false);

  const trigger = useCallback(() => {
    setShaking(false);
    requestAnimationFrame(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 480);
    });
  }, []);

  return { shaking, trigger };
}

function useCountdown(durationMs: number, active: boolean, onDone?: () => void) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const start = performance.now();
    let raf = 0;
    let done = false;

    const tick = (time: number) => {
      const p = Math.min(1, (time - start) / durationMs);
      setProgress(p);
      if (p >= 1) {
        if (!done) {
          done = true;
          doneRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  const effectiveProgress = active ? progress : 0;

  return {
    progress: effectiveProgress,
    remaining: Math.max(1, Math.ceil((1 - effectiveProgress) * (durationMs / 1000))),
  };
}

function useShuffledAnswers(question: Question, randomize: boolean) {
  return useMemo(() => (randomize ? shuffle(question.answers) : question.answers), [question, randomize]);
}

function useTermsGate() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dwelled, setDwelled] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 6) setScrolled(true);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!scrolled) return;
    const start = performance.now();
    let raf = 0;

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 3000);
      setDwellProgress(progress);
      if (progress >= 1) setDwelled(true);
      else raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrolled]);

  return { scrollRef, scrolled, dwelled, dwellProgress };
}

export function useWalletAdapter() {
  const { address, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const switchToBase = useCallback(async () => {
    if (!switchChainAsync) throw new Error("Network switching is unavailable for this wallet.");
    await switchChainAsync({ chainId: base.id });
  }, [switchChainAsync]);

  const signAttestation = useCallback(
    async (data: unknown) => {
      const message = [
        "K9 Terms Quiz Acknowledgement",
        "",
        "This signature confirms that you completed the quiz and accepted the terms shown in this session.",
        "",
        JSON.stringify(data, null, 2),
      ].join("\n");

      const signature = await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 600));
      return keccak256(stringToHex(`${signature}:${Date.now()}`)) as `0x${string}`;
    },
    [signMessageAsync],
  );

  const wallet = useMemo<WalletAdapter>(
    () => ({
      address: address as `0x${string}` | undefined,
      chainId,
      switchToBase,
      signAttestation,
    }),
    [address, chainId, switchToBase, signAttestation],
  );

  return { wallet, isSwitching, isSigning };
}

function SunsetBackground() {
  return <div className="stq-bg" aria-hidden="true" />;
}

function ProgressRail({ current, total }: { current: number; total: number }) {
  return (
    <div className="stq-rail" aria-label={`Question ${current} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "stq-rail-dot",
            i < current && "stq-rail-dot-done",
            i === current - 1 && "stq-rail-dot-current",
          )}
        />
      ))}
    </div>
  );
}

function DonutCountdown({
  progress,
  remaining,
  tone,
}: {
  progress: number;
  remaining: number;
  tone: "success" | "error";
}) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * progress;
  const color = tone === "success" ? "var(--stq-success)" : "var(--stq-error)";
  return (
    <div className="stq-donut">
      <svg width="74" height="74" viewBox="0 0 74 74" overflow="visible">
        <circle cx="37" cy="37" r={r} fill="none" stroke="var(--stq-border-lit)" strokeWidth="3" />
        <circle
          cx="37"
          cy="37"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 37 37)"
          style={{
            transition: "stroke-dashoffset 80ms linear",
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
      </svg>
      <div className="stq-donut-num">{remaining}</div>
    </div>
  );
}

function BigDonut({ progress, active }: { progress: number; active: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const remaining = active ? Math.max(0, Math.ceil((1 - progress) * 3)) : 3;
  return (
    <div className="stq-big-donut">
      <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true" overflow="visible">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--stq-border-lit)" strokeWidth="2.5" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke="var(--stq-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform="rotate(-90 30 30)"
          style={{
            transition: "stroke-dashoffset 80ms linear",
            filter: "drop-shadow(0 0 6px var(--stq-accent))",
          }}
        />
      </svg>
      <div className="stq-big-donut-num">{remaining}</div>
    </div>
  );
}

function HandMark({ kind }: { kind: "correct" | "wrong" }) {
  if (kind === "correct") {
    return (
      <svg className="stq-hand-mark stq-hand-mark-correct" viewBox="0 0 80 70" aria-hidden="true">
        <path
          d="M 8 38 C 16 44, 24 52, 32 56 C 40 42, 52 22, 72 4"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="stq-draw-on"
        />
      </svg>
    );
  }
  return (
    <svg className="stq-hand-mark stq-hand-mark-wrong" viewBox="0 0 80 70" aria-hidden="true">
      <path
        d="M 12 10 C 28 22, 46 40, 68 60"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        className="stq-draw-on"
      />
      <path
        d="M 68 10 C 52 22, 32 40, 10 60"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        className="stq-draw-on-delayed"
      />
    </svg>
  );
}

function AnswerButton({
  label,
  state,
  index,
  onClick,
}: {
  label: string;
  state: AnswerState;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state !== "idle"}
      className={cn("stq-answer", `stq-answer-${state}`)}
      style={{ animationDelay: `${0.28 + index * 0.07}s` }}
    >
      <span className="stq-answer-letter">{String.fromCharCode(65 + index)}</span>
      <span className="stq-answer-text">{label}</span>
      {state === "correct" && <HandMark kind="correct" />}
      {state === "wrong" && <HandMark kind="wrong" />}
    </button>
  );
}

type SkipProps = { skipAllowed: true; onSkip: () => void } | undefined;

function TermsScreen({
  termsText,
  onStart,
  skipProps,
}: {
  termsText: string;
  onStart: () => void;
  skipProps?: SkipProps;
}) {
  const { scrollRef, scrolled, dwelled, dwellProgress } = useTermsGate();
  const [agreed, setAgreed] = useState(false);

  const canCheck = scrolled && dwelled;
  const canStart = canCheck && agreed;

  return (
    <div className="stq-screen stq-terms-screen">
      <div className="stq-terms-head stq-stagger">
        <div className="stq-eyebrow" style={{ animationDelay: "0.05s" }}>
          Terms Acknowledgement
        </div>
        <h1 className="stq-title" style={{ animationDelay: "0.14s" }}>
          Read, then <em>prove</em> it
        </h1>
        <p className="stq-caption" style={{ animationDelay: "0.24s" }}>
          Scroll through the terms, pass a short comprehension quiz, then confirm in your wallet.
        </p>
      </div>

      <div className="stq-terms-card">
        <div className="stq-terms-scroll" ref={scrollRef}>
          <div className="stq-terms-body">
            {termsText.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            <div className="stq-terms-end">- end of terms -</div>
          </div>

          <div className="stq-agree-inline">
            <div className="stq-gate-swap">
              <div className={cn("stq-gate-layer", !canCheck && "stq-gate-layer-on")} aria-hidden={canCheck}>
                <div className="stq-lock-card">
                  <BigDonut progress={scrolled ? dwellProgress : 0} active={scrolled} />
                  <div className="stq-lock-text">
                    <strong>Please actually read the terms</strong>
                    <span>Reach the end, wait 3 seconds, then unlock the quiz.</span>
                  </div>
                </div>
              </div>
              <div className={cn("stq-gate-layer", canCheck && "stq-gate-layer-on")} aria-hidden={!canCheck}>
                <button
                  type="button"
                  className="stq-check-row"
                  onClick={() => setAgreed(value => !value)}
                  aria-pressed={agreed}
                  disabled={!canCheck}
                  tabIndex={canCheck ? 0 : -1}
                >
                  <span className={cn("stq-check", agreed && "stq-check-on")}>
                    {agreed && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="stq-check-text">I have read and accept these terms.</span>
                </button>
                <p className="stq-check-hint">Please read. There will be a quiz!</p>
              </div>
            </div>
          </div>
        </div>
        {!scrolled && <div className="stq-terms-fade" />}
      </div>

      <div
        className="stq-bottom"
        style={skipProps ? { display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" } : undefined}
      >
        <button className="stq-btn-primary" disabled={!canStart} onClick={onStart}>
          <span>Start the Quiz</span>
          <ArrowRight size={18} />
        </button>
        {skipProps && <SkipToClaim onSkip={skipProps.onSkip} />}
      </div>
    </div>
  );
}

function QuizScreen({
  questions,
  randomizeAnswers,
  index,
  onAdvance,
  onFail,
  skipProps,
}: {
  questions: Question[];
  randomizeAnswers: boolean;
  index: number;
  onAdvance: () => void;
  onFail: () => void;
  skipProps?: SkipProps;
}) {
  const question = questions[index];
  const total = questions.length;
  const isLast = index === total - 1;

  const [phase, setPhase] = useState<QuizPhase>("answering");
  const [attempts, setAttempts] = useState<string[]>([]);
  const [lastId, setLastId] = useState<string | null>(null);

  const answers = useShuffledAnswers(question, randomizeAnswers);
  const lastAnswer = answers.find(answer => answer.id === lastId);

  const audio = useAudioFeedback();
  const haptics = useHaptics();
  const { shaking, trigger: triggerShake } = useShake();
  const locked = phase === "locked-wrong" || phase === "locked-correct";

  const { progress: cdProgress, remaining: cdRemaining } = useCountdown(3000, locked, () => {
    if (phase === "locked-correct") {
      setPhase("resolved-correct");
      return;
    }
    if (phase === "locked-wrong") {
      if (attempts.length >= 2) setPhase("resolved-fail");
      else setPhase("answering");
    }
  });

  const handleAnswer = (answer: Answer) => {
    if (phase !== "answering") return;
    if (attempts.includes(answer.id)) return;
    setLastId(answer.id);
    setAttempts(prev => [...prev, answer.id]);

    if (answer.correct) {
      setPhase("locked-correct");
      audio.playSuccess();
      haptics.success();
      return;
    }

    setPhase("locked-wrong");
    audio.playError();
    haptics.error();
    triggerShake();
  };

  const getButtonState = (answer: Answer): AnswerState => {
    if (answer.id === lastId && (phase === "locked-correct" || phase === "resolved-correct")) {
      return "correct";
    }
    if (attempts.includes(answer.id)) return "wrong";
    if (
      phase === "locked-wrong" ||
      phase === "locked-correct" ||
      phase === "resolved-correct" ||
      phase === "resolved-fail"
    ) {
      return "faded";
    }
    return "idle";
  };

  return (
    <div className={cn("stq-screen stq-quiz-screen", shaking && "stq-shake")}>
      <ProgressRail current={index + 1} total={total} />

      <div className="stq-stagger">
        <div className="stq-q-label" style={{ animationDelay: "0.05s" }}>
          Question {index + 1}
          <span className="stq-q-label-dim"> / {total}</span>
        </div>
        <h2 className="stq-q-prompt" style={{ animationDelay: "0.14s" }}>
          {question.prompt}
        </h2>

        <div className="stq-answers">
          {answers.map((answer, answerIndex) => (
            <AnswerButton
              key={answer.id}
              label={answer.text}
              state={getButtonState(answer)}
              index={answerIndex}
              onClick={() => handleAnswer(answer)}
            />
          ))}
        </div>

        <div className="stq-feedback">
          {lastAnswer && (
            <div
              key={lastId}
              className={cn("stq-feedback-box", lastAnswer.correct ? "stq-feedback-correct" : "stq-feedback-wrong")}
            >
              {lastAnswer.correct ? <Lightbulb size={15} strokeWidth={2} /> : <HelpCircle size={15} strokeWidth={2} />}
              <span>{lastAnswer.explanation}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="stq-bottom"
        style={skipProps ? { display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" } : undefined}
      >
        {locked && (
          <DonutCountdown
            progress={cdProgress}
            remaining={cdRemaining}
            tone={phase === "locked-correct" ? "success" : "error"}
          />
        )}

        {phase === "resolved-correct" && (
          <button className="stq-btn-primary" onClick={onAdvance}>
            <span>{isLast ? "Finish Quiz" : "Next Question"}</span>
            <ArrowRight size={18} />
          </button>
        )}

        {phase === "resolved-fail" && (
          <button className="stq-btn-primary stq-btn-warn" onClick={onFail}>
            <div className="stq-btn-stack">
              <span>Re-Read the Terms</span>
              <span className="stq-btn-sub">restart the quiz</span>
            </div>
          </button>
        )}

        {phase === "answering" && (
          <div className="stq-bottom-hint">{attempts.length === 1 ? "One chance remaining" : "Choose your answer"}</div>
        )}

        {skipProps && <SkipToClaim onSkip={skipProps.onSkip} />}
      </div>
    </div>
  );
}

function WalletPanel({
  wallet,
  onSwitch,
  switching,
  requiredChainId,
  requiredChainName,
}: {
  wallet: WalletAdapter;
  onSwitch: () => void;
  switching: boolean;
  requiredChainId: number;
  requiredChainName: string;
}) {
  const wrongChain = wallet.chainId !== undefined && wallet.chainId !== requiredChainId;
  const chainName =
    wallet.chainId === 1
      ? "Ethereum"
      : wallet.chainId === requiredChainId
        ? requiredChainName
        : wallet.chainId === 10
          ? "Optimism"
          : wallet.chainId === 137
            ? "Polygon"
            : wallet.chainId
              ? `Chain ${wallet.chainId}`
              : "Not connected";

  const addr = wallet.address ?? "0x000000";
  const h1 = parseInt(addr.slice(2, 8), 16) % 360;
  const h2 = (h1 + 60) % 360;
  const h3 = (h1 + 180) % 360;

  return (
    <div className="stq-wallet" style={{ animationDelay: "0.32s" }}>
      <div className="stq-wallet-row">
        <div className="stq-wallet-avatar">
          {wallet.ensAvatar ? (
            <img src={wallet.ensAvatar} alt="" />
          ) : (
            <div
              className="stq-wallet-blockie"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, hsl(${h1}, 75%, 60%), transparent 60%),
                  radial-gradient(circle at 70% 70%, hsl(${h3}, 70%, 50%), transparent 55%),
                  linear-gradient(135deg, hsl(${h2}, 65%, 45%), hsl(${h1}, 70%, 35%))
                `,
              }}
            />
          )}
        </div>
        <div className="stq-wallet-info">
          <div className="stq-wallet-name">{wallet.ensName ?? formatAddress(wallet.address)}</div>
          {wallet.ensName && <div className="stq-wallet-addr">{formatAddress(wallet.address)}</div>}
        </div>
        <div className={cn("stq-wallet-chain", wrongChain && "stq-wallet-chain-wrong")}>
          <div className="stq-chain-dot" />
          <span>{chainName}</span>
        </div>
      </div>

      {wrongChain && (
        <div className="stq-wallet-warning">
          <AlertCircle size={14} />
          <span>Wrong network. {requiredChainName} is required to sign.</span>
          <button onClick={onSwitch} disabled={switching} className="stq-switch-btn">
            {switching ? "Switching..." : `Switch to ${requiredChainName}`}
          </button>
        </div>
      )}
    </div>
  );
}

function RawDataBox({
  data,
  expanded,
  onToggle,
}: {
  data: ReturnType<typeof mockAttestationData>;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="stq-raw" style={{ animationDelay: "0.42s" }}>
      <button className="stq-raw-header" onClick={onToggle}>
        <span className="stq-raw-label">Attestation payload</span>
        <span className="stq-raw-toggle">
          <span className="stq-raw-toggle-text">{expanded ? "human readable" : "show raw"}</span>
          <ChevronDown
            size={13}
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 220ms",
            }}
          />
        </span>
      </button>

      {!expanded && (
        <div className="stq-raw-summary">
          <div>
            <span>schema</span>
            <code>
              {data.schema.slice(0, 10)}...{data.schema.slice(-6)}
            </code>
          </div>
          <div>
            <span>terms hash</span>
            <code>
              {data.data.termsHash.slice(0, 10)}...{data.data.termsHash.slice(-6)}
            </code>
          </div>
          <div>
            <span>version</span>
            <code>{data.data.termsVersion}</code>
          </div>
        </div>
      )}

      <div className={cn("stq-raw-body", expanded && "stq-raw-body-open")}>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function AttestationScreen({
  wallet,
  onSign,
  isSwitching,
  isSigning,
  skipProps,
  requiredChainId,
  requiredChainName,
}: {
  wallet: WalletAdapter;
  onSign: () => void;
  isSwitching: boolean;
  isSigning: boolean;
  skipProps?: SkipProps;
  requiredChainId: number;
  requiredChainName: string;
}) {
  const [rawExpanded, setRawExpanded] = useState(false);

  const wrongChain = wallet.chainId !== undefined && wallet.chainId !== requiredChainId;
  const data = useMemo(() => mockAttestationData(wallet.address), [wallet.address]);

  const handleSwitch = async () => {
    const switcher = wallet.switchToBase ?? wallet.switchToRequiredChain;
    if (!switcher) throw new Error("Network switching is unavailable for this wallet.");
    await switcher();
  };

  return (
    <div className="stq-screen">
      <div className="stq-stagger">
        <div className="stq-eyebrow" style={{ animationDelay: "0.05s" }}>
          Final Step
        </div>
        <h1 className="stq-title" style={{ animationDelay: "0.14s" }}>
          Sign your <em>acknowledgement</em>
        </h1>
        <p className="stq-caption" style={{ animationDelay: "0.22s" }}>
          This flow signs a structured wallet message with your accepted terms payload. In production, connect this
          action to your on-chain attestation write path.{" "}
          <a href="https://base.easscan.org" target="_blank" rel="noreferrer" className="stq-link">
            EAS on Base <ExternalLink size={11} />
          </a>
        </p>

        <WalletPanel
          wallet={wallet}
          onSwitch={handleSwitch}
          switching={isSwitching}
          requiredChainId={requiredChainId}
          requiredChainName={requiredChainName}
        />

        <RawDataBox data={data} expanded={rawExpanded} onToggle={() => setRawExpanded(value => !value)} />
      </div>

      <div
        className="stq-bottom"
        style={skipProps ? { display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" } : undefined}
      >
        <button
          className="stq-btn-primary stq-btn-hero"
          disabled={wrongChain || !wallet.address || isSigning}
          onClick={onSign}
        >
          <span>{isSigning ? "Awaiting Signature..." : "Sign Acknowledgement"}</span>
          {!isSigning && <ArrowRight size={18} />}
        </button>
        {skipProps && <SkipToClaim onSkip={skipProps.onSkip} />}
      </div>
    </div>
  );
}

function TxPendingScreen() {
  return (
    <div className="stq-screen stq-center">
      <div className="stq-stagger stq-pending-wrap">
        <div className="stq-pending-orb">
          <div className="stq-orb-ring stq-orb-ring-1" />
          <div className="stq-orb-ring stq-orb-ring-2" />
          <div className="stq-orb-ring stq-orb-ring-3" />
          <div className="stq-orb-core" />
        </div>
        <div className="stq-eyebrow" style={{ animationDelay: "0.12s" }}>
          Processing
        </div>
        <h2 className="stq-title-sm" style={{ animationDelay: "0.2s" }}>
          Finalizing <em>signature</em>
        </h2>
        <p className="stq-caption" style={{ animationDelay: "0.3s" }}>
          Waiting for wallet confirmation and receipt generation.
        </p>
      </div>
    </div>
  );
}

function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
      size: number;
    };

    const particles: Particle[] = [];
    const colors = ["#ff7a3d", "#ffb347", "#d94a78", "#f5ead8", "#ffd98a", "#ff5e7e"];

    const launch = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = Math.random() * width * 0.7 + width * 0.15;
      const cy = Math.random() * height * 0.4 + height * 0.15;
      const count = 44 + Math.floor(Math.random() * 24);
      const color = colors[Math.floor(Math.random() * colors.length)];

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
        const speed = 1.6 + Math.random() * 3.4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 55 + Math.random() * 35,
          color,
          size: 1.6 + Math.random() * 2,
        });
      }
    };

    let running = true;
    let launchCount = 0;
    const maxLaunches = 9;

    launch();
    const intervalId = window.setInterval(() => {
      if (launchCount < maxLaunches) {
        launch();
        launchCount += 1;
      } else {
        clearInterval(intervalId);
      }
    }, 420);

    const animate = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.055;
        particle.vx *= 0.992;
        particle.life += 1;

        const alpha = Math.max(0, 1 - particle.life / particle.maxLife);
        if (alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 10;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      running = false;
      clearInterval(intervalId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="stq-fireworks" />;
}

function TxSuccessScreen({ txHash, onEnter }: { txHash: string; onEnter: () => void }) {
  const [copied, setCopied] = useState(false);
  const audio = useAudioFeedback();
  const haptics = useHaptics();

  useEffect(() => {
    audio.playSuccess();
    haptics.success();
  }, [audio, haptics]);

  const copyHash = () => {
    navigator.clipboard
      ?.writeText(txHash)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <div className="stq-screen stq-center stq-success-screen">
      <Fireworks />
      <div className="stq-stagger stq-relative">
        <div className="stq-success-seal" style={{ animationDelay: "0.1s" }}>
          <Sparkles size={28} strokeWidth={2} />
        </div>
        <div className="stq-eyebrow stq-eyebrow-success" style={{ animationDelay: "0.22s" }}>
          Signature Captured
        </div>
        <h1 className="stq-title" style={{ animationDelay: "0.3s" }}>
          You&apos;re <em>verified</em>.
        </h1>
        <p className="stq-caption" style={{ animationDelay: "0.4s" }}>
          Your acceptance payload has been signed and can now be forwarded to an attestation backend or contract write
          path.
        </p>

        <div className="stq-tx-card" style={{ animationDelay: "0.5s" }}>
          <div className="stq-tx-label">Receipt hash</div>
          <button className="stq-tx-hash" onClick={copyHash}>
            <code>
              {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </code>
            <span className="stq-tx-copy">{copied ? "copied" : "copy"}</span>
          </button>
        </div>
      </div>

      <div className="stq-bottom stq-relative">
        <button className="stq-btn-primary stq-btn-hero" onClick={onEnter}>
          <span>Enter</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function TxErrorScreen({
  message,
  txHash,
  onRetry,
  onBack,
}: {
  message: string;
  txHash?: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="stq-screen stq-center">
      <div className="stq-stagger">
        <div className="stq-error-seal" style={{ animationDelay: "0.1s" }}>
          <X size={30} strokeWidth={2.5} />
        </div>
        <div className="stq-eyebrow stq-eyebrow-error" style={{ animationDelay: "0.2s" }}>
          Signature failed
        </div>
        <h1 className="stq-title-sm" style={{ animationDelay: "0.28s" }}>
          Something <em>slipped</em>.
        </h1>
        <p className="stq-caption" style={{ animationDelay: "0.38s" }}>
          {message}
        </p>
        {txHash && (
          <div style={{ animationDelay: "0.46s" }} className="stq-stagger-item">
            <span className="stq-caption">
              Failed digest: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </span>
          </div>
        )}
      </div>

      <div className="stq-bottom">
        <div className="stq-btn-row">
          <button className="stq-btn-secondary" onClick={onBack}>
            <RotateCcw size={15} /> Back
          </button>
          <button className="stq-btn-primary" onClick={onRetry}>
            <span>Retry</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

type SunsetTermsQuizProps = {
  questions?: Question[];
  termsText?: string;
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
  wallet: WalletAdapter;
  isSwitching?: boolean;
  isSigning?: boolean;
  requiredChainId?: number;
  requiredChainName?: string;
  onComplete?: (txHash: string) => void;
  /** When true, a green SKIP button appears alongside navigation buttons. */
  skipAllowed?: boolean;
  /** Called when the user clicks the SKIP button. */
  onSkip?: () => void;
  /**
   * Optional override for the attestation step. When provided, this replaces
   * the mock personal_sign with a real on-chain EAS attestation call.
   * Should return a tx hash string on success, or throw on failure.
   */
  onAttest?: () => Promise<string>;
};

function SkipToClaim({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      className="stq-btn-primary"
      style={{ background: "linear-gradient(135deg, #059669, #10b981)", minWidth: 140 }}
      onClick={onSkip}
    >
      <div className="stq-btn-stack">
        <span>SKIP</span>
        <span className="stq-btn-sub">to claim</span>
      </div>
    </button>
  );
}

export function SunsetTermsQuiz({
  questions = DEFAULT_QUESTIONS,
  termsText = DEFAULT_TERMS_TEXT,
  randomizeQuestions = false,
  randomizeAnswers = true,
  wallet,
  isSwitching = false,
  isSigning = false,
  requiredChainId = BASE_CHAIN_ID,
  requiredChainName = "Base",
  onComplete,
  skipAllowed = false,
  onSkip,
  onAttest,
}: SunsetTermsQuizProps) {
  const [screen, setScreen] = useState<Screen>({ kind: "terms" });
  const [runKey, setRunKey] = useState(0);

  const activeQuestions = useMemo(
    () => (randomizeQuestions ? shuffle(questions) : questions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, randomizeQuestions, runKey],
  );

  const restart = () => {
    setRunKey(key => key + 1);
    setScreen({ kind: "terms" });
  };

  const startQuiz = () => setScreen({ kind: "quiz", index: 0 });

  const advance = () => {
    if (screen.kind !== "quiz") return;
    if (screen.index + 1 >= activeQuestions.length) setScreen({ kind: "attestation" });
    else setScreen({ kind: "quiz", index: screen.index + 1 });
  };

  const signIt = async () => {
    setScreen({ kind: "pending" });
    try {
      let hash: string;
      if (onAttest) {
        hash = await onAttest();
      } else if (wallet.signAttestation) {
        hash = await wallet.signAttestation(mockAttestationData(wallet.address));
      } else if (wallet.signMessage) {
        const signature = await wallet.signMessage(
          [
            "Terms Quiz Acknowledgement",
            "",
            "This signature confirms that you completed the quiz and accepted the terms shown in this session.",
            "",
            JSON.stringify(mockAttestationData(wallet.address), null, 2),
          ].join("\n"),
        );
        hash = keccak256(stringToHex(`${signature}:${Date.now()}`));
      } else {
        throw new Error("No attestation or signing callback was provided.");
      }
      setScreen({ kind: "success", txHash: hash as `0x${string}` });
    } catch (error) {
      setScreen({
        kind: "error",
        message:
          error instanceof Error ? error.message : "The signature did not go through. You can retry or head back.",
      });
    }
  };

  const skipProps = skipAllowed && onSkip ? { skipAllowed: true as const, onSkip } : undefined;

  const renderScreen = () => {
    switch (screen.kind) {
      case "terms":
        return <TermsScreen key={`terms-${runKey}`} termsText={termsText} onStart={startQuiz} skipProps={skipProps} />;
      case "quiz":
        return (
          <QuizScreen
            key={`quiz-${runKey}-${screen.index}`}
            questions={activeQuestions}
            randomizeAnswers={randomizeAnswers}
            index={screen.index}
            onAdvance={advance}
            onFail={restart}
            skipProps={skipProps}
          />
        );
      case "attestation":
        return (
          <AttestationScreen
            key="attestation"
            wallet={wallet}
            onSign={signIt}
            isSwitching={isSwitching}
            isSigning={isSigning}
            skipProps={skipProps}
            requiredChainId={requiredChainId}
            requiredChainName={requiredChainName}
          />
        );
      case "pending":
        return <TxPendingScreen key="pending" />;
      case "success":
        return <TxSuccessScreen key="success" txHash={screen.txHash} onEnter={() => onComplete?.(screen.txHash)} />;
      case "error":
        return (
          <TxErrorScreen
            key="error"
            message={screen.message}
            txHash={screen.txHash}
            onRetry={signIt}
            onBack={() => setScreen({ kind: "attestation" })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="stq-root">
      <StyleBlock />
      <SunsetBackground />
      <div className="stq-viewport">{renderScreen()}</div>
    </div>
  );
}

export const TermsQuiz = SunsetTermsQuiz;

type TermsExperienceProps = {
  quizConfig?: Partial<TermsQuizContentConfig>;
};

export default function TermsExperience({ quizConfig }: TermsExperienceProps = {}) {
  const { wallet, isSwitching, isSigning } = useWalletAdapter();

  return (
    <SunsetTermsQuiz
      questions={quizConfig?.questions}
      termsText={quizConfig?.termsText}
      wallet={wallet}
      isSwitching={isSwitching}
      isSigning={isSigning}
      randomizeQuestions={quizConfig?.randomizeQuestions ?? false}
      randomizeAnswers={quizConfig?.randomizeAnswers ?? true}
    />
  );
}

function StyleBlock() {
  return (
    <style>{`
      .stq-root {
        --stq-bg: #0b0f1f;
        --stq-bg-2: #0f1529;
        --stq-surface: #181f39;
        --stq-surface-2: #202846;
        --stq-border: rgba(125, 140, 188, 0.3);
        --stq-border-lit: rgba(164, 176, 220, 0.45);
        --stq-text: #e8ebf7;
        --stq-text-dim: #c2cae8;
        --stq-text-mute: #8f9ac1;
        --stq-accent: #ee6e21;
        --stq-accent-2: #f29055;
        --stq-accent-3: #8d66ff;
        --stq-success: #38c793;
        --stq-success-soft: #90e9c7;
        --stq-success-bg: rgba(56, 199, 147, 0.11);
        --stq-success-border: rgba(56, 199, 147, 0.42);
        --stq-error: #ff4b76;
        --stq-error-soft: #ff8ba8;
        --stq-error-bg: rgba(255, 75, 118, 0.1);
        --stq-error-border: rgba(255, 75, 118, 0.42);

        font-family: var(--font-sans);
        color: var(--stq-text);
        background: linear-gradient(185deg, rgba(15, 21, 40, 0.97), rgba(9, 12, 24, 0.97));
        height: min(80dvh, 860px);
        min-height: 640px;
        width: 100%;
        position: relative;
        overflow: hidden;
        border-radius: 20px;
        border: 1px solid rgba(132, 143, 182, 0.22);
        box-shadow: 0 24px 70px rgba(9, 12, 24, 0.58);
        -webkit-font-smoothing: antialiased;
        -webkit-tap-highlight-color: transparent;
      }
      .stq-root, .stq-root * { box-sizing: border-box; }

      .stq-bg {
        position: absolute; inset: 0; pointer-events: none; z-index: 0;
        background:
          radial-gradient(ellipse 95% 55% at 70% -12%, rgba(238,110,33,0.24), transparent 55%),
          radial-gradient(ellipse 70% 45% at 15% 110%, rgba(141,102,255,0.2), transparent 60%),
          radial-gradient(ellipse 50% 30% at 50% 35%, rgba(242,144,85,0.08), transparent 70%),
          var(--stq-bg);
      }
      .stq-bg::before {
        content: ''; position: absolute; inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
        opacity: 0.08;
        mix-blend-mode: overlay;
      }

      .stq-viewport {
        position: relative; z-index: 1;
        max-width: 500px;
        margin: 0 auto;
        height: 100%;
        padding: 30px 22px;
        display: flex;
        flex-direction: column;
      }

      .stq-screen {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        position: relative;
        animation: stq-screen-in 520ms cubic-bezier(0.2, 0.85, 0.2, 1) both;
      }
      .stq-screen.stq-center { justify-content: center; }
      .stq-screen.stq-shake { animation: stq-shake 460ms cubic-bezier(0.36, 0.07, 0.19, 0.97); }
      .stq-success-screen { overflow: visible; }

      .stq-quiz-screen > .stq-stagger {
        flex: 0 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 28px 22px;
        margin: -28px -22px;
        scrollbar-width: thin;
        scrollbar-color: var(--stq-border-lit) transparent;
      }
      .stq-quiz-screen > .stq-stagger::-webkit-scrollbar { width: 5px; }
      .stq-quiz-screen > .stq-stagger::-webkit-scrollbar-thumb { background: var(--stq-border-lit); border-radius: 3px; }
      .stq-quiz-screen > .stq-stagger::-webkit-scrollbar-track { background: transparent; }

      @media (orientation: landscape) and (min-height: 380px) {
        .stq-viewport {
          max-width: 900px;
          padding: 22px 28px;
        }
        .stq-terms-screen,
        .stq-quiz-screen {
          display: grid;
          gap: 0;
          column-gap: 28px;
          row-gap: 12px;
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
        }
        .stq-terms-screen > .stq-terms-head {
          grid-column: 1;
          grid-row: 1;
        }
        .stq-terms-screen > .stq-terms-card {
          grid-column: 1;
          grid-row: 2;
          min-height: 0;
        }
        .stq-terms-screen > .stq-bottom {
          grid-column: 2;
          grid-row: 1 / -1;
          align-self: center;
          justify-self: stretch;
          margin-top: 0;
          padding-top: 0;
        }
        .stq-quiz-screen > .stq-rail {
          grid-column: 1 / -1;
          grid-row: 1;
          margin-bottom: 0;
        }
        .stq-quiz-screen > .stq-stagger {
          grid-column: 1;
          grid-row: 2;
        }
        .stq-quiz-screen > .stq-bottom {
          grid-column: 2;
          grid-row: 2;
          align-self: center;
          justify-self: stretch;
          margin-top: 0;
          padding-top: 0;
        }
      }

      .stq-stagger > * { animation: stq-up 620ms cubic-bezier(0.2, 0.85, 0.2, 1) both; }
      .stq-stagger-item { animation: stq-up 620ms cubic-bezier(0.2, 0.85, 0.2, 1) both; }
      .stq-relative { position: relative; z-index: 2; }

      .stq-eyebrow {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--stq-accent);
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 2px;
      }
      .stq-eyebrow::before {
        content: ''; width: 22px; height: 1px; background: currentColor; opacity: 0.7;
      }
      .stq-eyebrow-success { color: var(--stq-success-soft); }
      .stq-eyebrow-error { color: var(--stq-error-soft); }

      .stq-title {
        font-family: var(--font-sans);
        font-size: clamp(2rem, 4vw, 2.7rem);
        line-height: 1.02;
        font-weight: 700;
        letter-spacing: -0.02em;
        margin: 10px 0 10px;
        color: var(--stq-text);
      }
      .stq-title em {
        font-style: italic;
        background: linear-gradient(110deg, var(--stq-accent), var(--stq-accent-2) 45%, var(--stq-accent-3));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        padding-right: 2px;
      }
      .stq-title-sm {
        font-family: var(--font-sans);
        font-size: clamp(1.6rem, 3.2vw, 2rem);
        line-height: 1.08;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 8px 0 6px;
      }
      .stq-title-sm em {
        font-style: italic;
        background: linear-gradient(110deg, var(--stq-accent), var(--stq-accent-3));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .stq-caption {
        color: var(--stq-text-dim);
        font-size: 14px;
        line-height: 1.58;
        margin: 0 0 4px;
      }

      .stq-terms-screen { gap: 14px; }
      .stq-terms-head { flex-shrink: 0; }
      .stq-terms-head > * { animation: stq-up 620ms cubic-bezier(0.2, 0.85, 0.2, 1) both; }

      .stq-terms-card {
        position: relative;
        background: linear-gradient(180deg, var(--stq-surface), var(--stq-bg-2));
        border: 1px solid var(--stq-border);
        border-radius: 14px;
        overflow: hidden;
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        animation: stq-up 620ms cubic-bezier(0.2, 0.85, 0.2, 1) both;
        animation-delay: 0.34s;
        box-shadow: 0 20px 60px -25px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }
      .stq-terms-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 20px 20px 18px;
        scrollbar-width: thin;
        scrollbar-color: var(--stq-border-lit) transparent;
      }
      .stq-terms-scroll::-webkit-scrollbar { width: 5px; }
      .stq-terms-scroll::-webkit-scrollbar-thumb { background: var(--stq-border-lit); border-radius: 3px; }
      .stq-terms-scroll::-webkit-scrollbar-track { background: transparent; }
      .stq-terms-body p {
        font-size: 13px;
        line-height: 1.68;
        color: var(--stq-text-dim);
        margin: 0 0 14px;
      }
      .stq-terms-body p:first-child::first-letter {
        font-family: var(--font-sans);
        font-size: 38px;
        font-weight: 700;
        float: left;
        line-height: 0.88;
        padding: 4px 8px 0 0;
        color: var(--stq-accent);
      }
      .stq-terms-end {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--stq-text-mute);
        text-align: center;
        padding: 8px 0 4px;
      }
      .stq-terms-fade {
        position: absolute; left: 0; right: 0; bottom: 0;
        height: 50px;
        background: linear-gradient(180deg, transparent, var(--stq-bg-2) 80%);
        pointer-events: none;
      }

      .stq-agree-inline {
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px dashed var(--stq-border-lit);
      }
      .stq-gate-swap {
        position: relative;
        min-height: 100px;
      }
      .stq-gate-layer {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        transition: opacity 320ms cubic-bezier(0.2, 0.85, 0.2, 1);
      }
      .stq-gate-layer-on {
        opacity: 1;
        pointer-events: auto;
      }
      .stq-check-row {
        display: flex; align-items: center; gap: 13px;
        width: 100%;
        min-height: 64px;
        padding: 14px 16px;
        background: var(--stq-surface-2);
        border: 1px solid var(--stq-border-lit);
        border-radius: 12px;
        cursor: pointer;
        transition: all 200ms;
        text-align: left;
        font-family: inherit;
        color: var(--stq-text);
      }
      .stq-check-row:hover:not(:disabled) {
        border-color: var(--stq-accent);
        background: var(--stq-surface);
        box-shadow: 0 0 0 3px rgba(238, 110, 33, 0.08);
      }
      .stq-check-text { font-size: 15px; flex: 1; line-height: 1.35; }
      .stq-check-hint {
        margin: 8px 2px 0;
        font-size: 11.5px;
        line-height: 1.4;
        color: var(--stq-text-dim);
      }
      .stq-check {
        width: 22px; height: 22px;
        border-radius: 6px;
        border: 1.5px solid var(--stq-border-lit);
        background: var(--stq-bg-2);
        display: flex; align-items: center; justify-content: center;
        color: #140805;
        transition: all 200ms;
        flex-shrink: 0;
      }
      .stq-check-on {
        background: linear-gradient(180deg, var(--stq-accent-2), var(--stq-accent));
        border-color: var(--stq-accent);
        box-shadow: 0 0 24px rgba(238, 110, 33, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }

      .stq-btn-primary {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        width: 100%;
        padding: 18px 22px;
        border-radius: 12px;
        border: none;
        background-image: linear-gradient(292deg, #df391f 0%, #f4a73c 100%);
        color: #fff;
        font-family: var(--font-sans);
        font-size: 15px;
        font-weight: 700;
        letter-spacing: -0.005em;
        cursor: pointer;
        transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 180ms, filter 180ms;
        box-shadow: 0 14px 24px rgba(223, 57, 31, 0.24);
      }
      .stq-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        filter: brightness(1.05);
        box-shadow: 0 18px 30px rgba(223, 57, 31, 0.3);
      }
      .stq-btn-primary:active:not(:disabled) { transform: translateY(0); }
      .stq-btn-primary:disabled {
        background: var(--stq-surface-2);
        color: var(--stq-text-mute);
        box-shadow: none;
        cursor: not-allowed;
        border-color: var(--stq-border);
      }
      .stq-btn-hero { padding: 20px 22px; font-size: 16px; }

      .stq-btn-warn {
        background: linear-gradient(180deg, #e8578a, #a82a55);
        color: #fff5f8;
        box-shadow:
          0 12px 30px -10px rgba(217, 74, 120, 0.55),
          0 0 0 1px rgba(217, 74, 120, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.2);
      }
      .stq-btn-stack { display: flex; flex-direction: column; align-items: center; gap: 3px; line-height: 1.1; }
      .stq-btn-sub {
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 400;
        opacity: 0.75;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .stq-btn-secondary {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        padding: 18px 20px;
        border-radius: 12px;
        border: 1px solid var(--stq-border-lit);
        background: var(--stq-surface);
        color: var(--stq-text-dim);
        font-family: var(--font-sans);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 180ms;
      }
      .stq-btn-secondary:hover { background: var(--stq-surface-2); color: var(--stq-text); }
      .stq-btn-row { display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; width: 100%; }

      .stq-rail {
        display: flex; gap: 6px;
        margin-bottom: 4px;
      }
      .stq-rail-dot {
        flex: 1;
        height: 3px;
        border-radius: 2px;
        background: var(--stq-border);
        position: relative;
        overflow: hidden;
        transition: background 300ms;
      }
      .stq-rail-dot-done {
        background: linear-gradient(90deg, var(--stq-accent), var(--stq-accent-2));
        box-shadow: 0 0 8px rgba(238, 110, 33, 0.5);
      }
      .stq-rail-dot-current::after {
        content: ''; position: absolute; inset: 0;
        background: rgba(255, 255, 255, 0.35);
        animation: stq-pulse 1.6s ease-in-out infinite;
      }

      .stq-q-label {
        font-family: var(--font-mono);
        font-size: 10.5px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--stq-accent);
        margin-top: 6px;
      }
      .stq-q-label-dim { color: var(--stq-text-mute); }
      .stq-q-prompt {
        font-family: var(--font-sans);
        font-size: clamp(1.5rem, 3vw, 1.9rem);
        line-height: 1.18;
        font-weight: 700;
        margin: 8px 0 16px;
        letter-spacing: -0.01em;
        color: var(--stq-text);
      }

      .stq-answers { display: flex; flex-direction: column; gap: 10px; }
      .stq-answer {
        position: relative;
        display: flex; align-items: center; gap: 14px;
        width: 100%;
        padding: 15px 16px;
        border-radius: 12px;
        border: 1px solid var(--stq-border);
        background: linear-gradient(180deg, var(--stq-surface), var(--stq-bg-2));
        color: var(--stq-text);
        font-family: var(--font-sans);
        font-size: 14px;
        line-height: 1.35;
        text-align: left;
        cursor: pointer;
        transition: transform 200ms cubic-bezier(0.2,0.8,0.2,1), border-color 200ms, background 200ms, box-shadow 200ms, opacity 200ms;
        animation: stq-up 550ms cubic-bezier(0.2,0.85,0.2,1) both;
        overflow: visible;
      }
      .stq-answer:hover:not(:disabled) {
        border-color: var(--stq-border-lit);
        transform: translateX(3px);
      }
      .stq-answer:hover:not(:disabled) .stq-answer-letter {
        color: var(--stq-accent);
        border-color: var(--stq-accent);
      }
      .stq-answer-letter {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        border-radius: 7px;
        background: var(--stq-surface-2);
        border: 1px solid var(--stq-border-lit);
        font-family: var(--font-mono);
        font-size: 11px;
        font-weight: 500;
        color: var(--stq-text-dim);
        flex-shrink: 0;
        transition: all 200ms;
      }
      .stq-answer-text {
        flex: 1;
        padding-right: 36px;
      }

      .stq-answer-faded {
        opacity: 0.5;
        filter: grayscale(1);
        background: var(--stq-bg-2);
        border: 1px dashed var(--stq-border-lit);
        color: var(--stq-text-mute);
        cursor: not-allowed;
        box-shadow: none;
      }
      .stq-answer-faded .stq-answer-letter {
        background: var(--stq-bg);
        border: 1px dashed var(--stq-border-lit);
        color: var(--stq-text-mute);
      }
      .stq-answer-wrong {
        background: linear-gradient(180deg, rgba(255, 75, 118, 0.22), rgba(255, 75, 118, 0.08));
        border-color: var(--stq-error);
        color: var(--stq-error-soft);
        box-shadow:
          0 0 0 1px var(--stq-error),
          0 14px 38px -10px rgba(255, 75, 118, 0.55),
          inset 0 0 30px rgba(255, 75, 118, 0.08);
        cursor: not-allowed;
      }
      .stq-answer-wrong .stq-answer-letter {
        background: var(--stq-error);
        border-color: var(--stq-error);
        color: #140505;
      }
      .stq-answer-correct {
        background: linear-gradient(180deg, rgba(56, 199, 147, 0.2), rgba(56, 199, 147, 0.07));
        border-color: var(--stq-success);
        color: var(--stq-success-soft);
        box-shadow:
          0 0 0 1px var(--stq-success),
          0 14px 38px -10px rgba(56, 199, 147, 0.55),
          inset 0 0 30px rgba(56, 199, 147, 0.08);
        animation: stq-correct-pulse 650ms ease-out;
        cursor: default;
      }
      .stq-answer-correct .stq-answer-letter {
        background: var(--stq-success);
        border-color: var(--stq-success);
        color: #051408;
      }

      .stq-feedback { min-height: 4px; margin-top: 12px; }
      .stq-feedback-box {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 13px 14px;
        border-radius: 10px;
        font-size: 12.8px;
        line-height: 1.5;
        animation: stq-up 400ms cubic-bezier(0.2,0.85,0.2,1) both;
      }
      .stq-feedback-wrong {
        background: var(--stq-error-bg);
        border: 1px solid var(--stq-error-border);
        color: var(--stq-error-soft);
      }
      .stq-feedback-correct {
        background: var(--stq-success-bg);
        border: 1px solid var(--stq-success-border);
        color: var(--stq-success-soft);
      }
      .stq-feedback-box svg { flex-shrink: 0; margin-top: 2px; }

      .stq-bottom {
        margin-top: auto;
        padding-top: 22px;
        display: flex; flex-direction: column; align-items: center; gap: 12px;
      }
      .stq-bottom-hint {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--stq-text-mute);
        padding: 20px 0 4px;
      }

      .stq-donut {
        position: relative;
        width: 74px; height: 74px;
        display: flex; align-items: center; justify-content: center;
        animation: stq-up 400ms cubic-bezier(0.2,0.85,0.2,1) both;
        margin: 8px 0;
      }
      .stq-donut-num {
        position: absolute;
        font-family: var(--font-sans);
        font-size: 28px;
        font-weight: 700;
        color: var(--stq-text);
      }

      .stq-wallet {
        background: linear-gradient(180deg, var(--stq-surface), var(--stq-bg-2));
        border: 1px solid var(--stq-border);
        border-radius: 14px;
        padding: 14px;
        display: flex; flex-direction: column; gap: 12px;
        box-shadow: 0 16px 40px -20px rgba(0, 0, 0, 0.5);
      }
      .stq-wallet-row { display: flex; align-items: center; gap: 12px; }
      .stq-wallet-avatar {
        width: 44px; height: 44px;
        border-radius: 50%;
        overflow: hidden;
        background: var(--stq-surface-2);
        border: 1px solid var(--stq-border-lit);
        flex-shrink: 0;
        position: relative;
      }
      .stq-wallet-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .stq-wallet-blockie { width: 100%; height: 100%; }
      .stq-wallet-info { flex: 1; min-width: 0; }
      .stq-wallet-name {
        font-family: var(--font-sans);
        font-size: 19px;
        line-height: 1.1;
        font-weight: 700;
        color: var(--stq-text);
        letter-spacing: -0.005em;
      }
      .stq-wallet-addr {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--stq-text-mute);
        margin-top: 2px;
      }
      .stq-wallet-chain {
        display: flex; align-items: center; gap: 6px;
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--stq-text-dim);
        padding: 7px 11px;
        border-radius: 999px;
        background: var(--stq-surface-2);
        border: 1px solid var(--stq-border);
        white-space: nowrap;
      }
      .stq-chain-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--stq-success);
        box-shadow: 0 0 8px var(--stq-success);
      }
      .stq-wallet-chain-wrong {
        color: var(--stq-error-soft);
        border-color: var(--stq-error-border);
        background: var(--stq-error-bg);
      }
      .stq-wallet-chain-wrong .stq-chain-dot {
        background: var(--stq-error);
        box-shadow: 0 0 8px var(--stq-error);
      }

      .stq-wallet-warning {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--stq-error-bg);
        border: 1px solid var(--stq-error-border);
        font-size: 11.5px;
        color: var(--stq-error-soft);
      }
      .stq-wallet-warning > svg { flex-shrink: 0; }
      .stq-wallet-warning > span { flex: 1; line-height: 1.4; }
      .stq-switch-btn {
        padding: 8px 12px;
        border-radius: 7px;
        border: 1px solid var(--stq-error);
        background: var(--stq-error);
        color: #140505;
        font-family: var(--font-sans);
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: all 180ms;
      }
      .stq-switch-btn:hover:not(:disabled) { filter: brightness(1.1); }
      .stq-switch-btn:disabled { opacity: 0.6; cursor: wait; }

      .stq-raw {
        background: var(--stq-bg-2);
        border: 1px solid var(--stq-border);
        border-radius: 14px;
        overflow: hidden;
      }
      .stq-raw-header {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%;
        padding: 13px 16px;
        background: transparent;
        border: none;
        color: var(--stq-text-dim);
        cursor: pointer;
        font-family: inherit;
      }
      .stq-raw-label {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .stq-raw-toggle {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--stq-text-dim);
        transition: color 180ms;
      }
      .stq-raw-header:hover .stq-raw-toggle { color: var(--stq-accent); }
      .stq-raw-toggle-text {
        font-family: var(--font-mono);
        font-size: 9.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .stq-raw-summary {
        padding: 4px 16px 14px;
        display: flex; flex-direction: column; gap: 9px;
        border-top: 1px solid var(--stq-border);
        padding-top: 14px;
      }
      .stq-raw-summary > div {
        display: flex; justify-content: space-between; align-items: center;
        gap: 10px;
      }
      .stq-raw-summary span {
        font-family: var(--font-mono);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--stq-text-mute);
        font-size: 9.5px;
      }
      .stq-raw-summary code {
        font-family: var(--font-mono);
        color: var(--stq-text-dim);
        font-size: 11px;
      }
      .stq-raw-body {
        max-height: 0;
        overflow: hidden;
        transition: max-height 320ms ease;
        border-top: 1px solid var(--stq-border);
      }
      .stq-raw-body-open { max-height: 340px; overflow: auto; }
      .stq-raw-body pre {
        margin: 0; padding: 14px 16px;
        font-family: var(--font-mono);
        font-size: 10.5px;
        line-height: 1.6;
        color: var(--stq-text-dim);
        white-space: pre-wrap;
        word-break: break-all;
      }

      .stq-link {
        display: inline-flex; align-items: center; gap: 5px;
        color: var(--stq-accent);
        text-decoration: none;
        font-size: 12.5px;
        border-bottom: 1px solid rgba(238, 110, 33, 0.35);
        padding-bottom: 1px;
        transition: all 180ms;
        width: fit-content;
      }
      .stq-link:hover {
        color: var(--stq-accent-2);
        border-bottom-color: var(--stq-accent-2);
      }

      .stq-pending-wrap { text-align: center; }
      .stq-pending-wrap .stq-eyebrow { justify-content: center; }
      .stq-pending-wrap .stq-eyebrow::before { display: none; }
      .stq-pending-wrap .stq-caption { max-width: 320px; margin: 0 auto; }
      .stq-pending-orb {
        position: relative;
        width: 140px; height: 140px;
        margin: 0 auto 20px;
      }
      .stq-orb-ring {
        position: absolute; inset: 0;
        border-radius: 50%;
        border: 1px solid var(--stq-border-lit);
        animation: stq-orbit 2.6s linear infinite;
      }
      .stq-orb-ring-1 { border-top-color: var(--stq-accent); }
      .stq-orb-ring-2 {
        inset: 14px;
        animation-duration: 3.4s;
        animation-direction: reverse;
        border-right-color: var(--stq-accent-2);
      }
      .stq-orb-ring-3 {
        inset: 28px;
        animation-duration: 4.2s;
        border-left-color: var(--stq-accent-3);
      }
      .stq-orb-core {
        position: absolute; inset: 48px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 35%, var(--stq-accent-2), var(--stq-accent) 55%, var(--stq-accent-3));
        box-shadow: 0 0 50px rgba(238, 110, 33, 0.6);
        animation: stq-pulse-core 1.8s ease-in-out infinite;
      }

      .stq-success-seal, .stq-error-seal {
        width: 74px; height: 74px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
        animation: stq-seal-in 720ms cubic-bezier(0.2,0.85,0.2,1) both;
      }
      .stq-success-seal {
        background: radial-gradient(circle at 30% 30%, var(--stq-accent-2), var(--stq-accent) 70%);
        color: #140805;
        box-shadow:
          0 0 60px rgba(242, 144, 85, 0.65),
          0 0 0 1px rgba(242, 144, 85, 0.4),
          inset 0 2px 6px rgba(255, 255, 255, 0.4);
      }
      .stq-error-seal {
        background: var(--stq-surface);
        border: 2px solid var(--stq-error);
        color: var(--stq-error);
        box-shadow:
          0 0 50px rgba(255, 75, 118, 0.45),
          inset 0 0 20px rgba(255, 75, 118, 0.1);
      }
      .stq-success-screen .stq-stagger { text-align: center; }
      .stq-success-screen .stq-eyebrow { justify-content: center; }
      .stq-success-screen .stq-eyebrow::before { display: none; }
      .stq-success-screen .stq-caption { max-width: 320px; margin: 0 auto 4px; }

      .stq-tx-card {
        background: var(--stq-surface);
        border: 1px solid var(--stq-border);
        border-radius: 14px;
        padding: 16px;
        display: flex; flex-direction: column; gap: 10px;
        margin-top: 14px;
        text-align: left;
      }
      .stq-tx-label {
        font-family: var(--font-mono);
        font-size: 9.5px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--stq-text-mute);
      }
      .stq-tx-hash {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px;
        background: var(--stq-bg-2);
        border: 1px solid var(--stq-border);
        border-radius: 9px;
        padding: 10px 12px;
        cursor: pointer;
        font-family: inherit;
        transition: border-color 180ms;
      }
      .stq-tx-hash:hover { border-color: var(--stq-border-lit); }
      .stq-tx-hash code {
        font-family: var(--font-mono);
        font-size: 11.5px;
        color: var(--stq-text);
      }
      .stq-tx-copy {
        font-family: var(--font-mono);
        font-size: 9px;
        padding: 4px 8px;
        border-radius: 5px;
        background: var(--stq-surface-2);
        color: var(--stq-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .stq-fireworks {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
      }

      .stq-hand-mark {
        position: absolute;
        right: -14px;
        top: 50%;
        width: 58px;
        height: 50px;
        transform: translateY(-50%) rotate(-7deg);
        pointer-events: none;
        z-index: 4;
      }
      .stq-hand-mark-correct {
        color: var(--stq-success);
        filter: drop-shadow(0 0 12px rgba(56, 199, 147, 0.55));
      }
      .stq-hand-mark-wrong {
        color: var(--stq-error);
        filter: drop-shadow(0 0 12px rgba(255, 75, 118, 0.55));
      }
      .stq-draw-on {
        stroke-dasharray: 220;
        stroke-dashoffset: 220;
        animation: stq-draw 460ms cubic-bezier(0.65, 0.05, 0.36, 1) 60ms forwards;
      }
      .stq-draw-on-delayed {
        stroke-dasharray: 220;
        stroke-dashoffset: 220;
        animation: stq-draw 460ms cubic-bezier(0.65, 0.05, 0.36, 1) 280ms forwards;
      }
      .stq-lock-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border-radius: 12px;
        background:
          linear-gradient(135deg, rgba(238, 110, 33, 0.1), rgba(141, 102, 255, 0.08));
        border: 1px dashed var(--stq-accent);
        box-shadow:
          0 0 0 1px rgba(238, 110, 33, 0.12),
          0 14px 36px -18px rgba(238, 110, 33, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }
      .stq-lock-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .stq-lock-text strong {
        font-family: var(--font-sans);
        font-size: 19px;
        font-weight: 700;
        line-height: 1.1;
        color: var(--stq-accent-2);
        letter-spacing: -0.01em;
      }
      .stq-lock-text span {
        font-size: 12px;
        color: var(--stq-text-dim);
        line-height: 1.4;
      }

      .stq-big-donut {
        position: relative;
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .stq-big-donut-num {
        position: absolute;
        font-family: var(--font-sans);
        font-size: 24px;
        font-weight: 700;
        color: var(--stq-accent-2);
        line-height: 1;
      }

      @keyframes stq-up {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes stq-screen-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes stq-shake {
        10%, 90% { transform: translate3d(-2px, 0, 0); }
        20%, 80% { transform: translate3d(4px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-8px, 0, 0); }
        40%, 60% { transform: translate3d(8px, 0, 0); }
      }
      @keyframes stq-draw {
        to { stroke-dashoffset: 0; }
      }
      @keyframes stq-pulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 0; }
      }
      @keyframes stq-pulse-core {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.08); opacity: 0.85; }
      }
      @keyframes stq-orbit {
        to { transform: rotate(360deg); }
      }
      @keyframes stq-correct-pulse {
        0% { transform: scale(1); }
        35% { transform: scale(1.025); }
        100% { transform: scale(1); }
      }
      @keyframes stq-seal-in {
        from { opacity: 0; transform: scale(0.5) rotate(-15deg); }
        to { opacity: 1; transform: scale(1) rotate(0); }
      }
    `}</style>
  );
}
