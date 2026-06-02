import { CheckCircle2, CircleAlert, ClipboardCheck, Database, FileCheck2, KeyRound, Wallet } from "lucide-react";
import { TermsQuiz } from "../../components/terms-quiz";
import { formatTokenAmount, lookupProof, parseProofsPayload } from "../../lib/token-claim";
import { BASE_EAS_TERMS_DEFAULTS, TERMS_SCHEMA_DEFINITION } from "../../lib/eas-terms";
import type { ReactNode } from "react";
import type { Address } from "viem";

const demoProofs = parseProofsPayload({
  root: "0x6f659e4f369e303c7f12ab62f4c7016fc5df2059c5e14fc6ec6a5b142ac0c436",
  proofs: [
    {
      address: "0x1111111111111111111111111111111111111111",
      amount: "1250000000000000000000",
      proof: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
    },
  ],
});

const eligible = demoProofs.ok
  ? lookupProof(demoProofs, "0x1111111111111111111111111111111111111111" as Address)
  : {};

const demoWallet = {
  address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  chainId: BASE_EAS_TERMS_DEFAULTS.chainId,
  signMessage: async () => "demo-signature-0x1111",
};

export function App() {
  return (
    <main>
      <section className="hero" data-screenshot="overview">
        <nav>
          <span className="brand">K9 Airdrop Toolkit</span>
          <div>
            <a href="#claim">Claim widget</a>
            <a href="#terms">Terms quiz</a>
            <a href="#eas">EAS kit</a>
          </div>
        </nav>
        <div className="heroGrid">
          <div>
            <p className="eyebrow">shadcn source registry</p>
            <h1>Reusable airdrop claim and terms tooling for Base.</h1>
            <p className="lede">
              Install only the pieces you need: a Merkle claim widget, a terms comprehension quiz, and Base-first EAS
              terms attestation helpers.
            </p>
            <div className="installBox">
              <code>pnpm dlx shadcn@latest add K9-Finance-DAO/airdrop-toolkit/token-claim</code>
              <code>pnpm dlx shadcn@latest add K9-Finance-DAO/airdrop-toolkit/terms-quiz</code>
              <code>pnpm dlx shadcn@latest add K9-Finance-DAO/airdrop-toolkit/eas-terms-kit</code>
            </div>
          </div>
          <div className="heroPanel">
            <Metric label="Registry items" value="3" />
            <Metric label="Default EAS network" value="Base" />
            <Metric label="Data source" value="Static proofs JSON" />
          </div>
        </div>
      </section>

      <section id="claim" className="section" data-screenshot="token-claim-states">
        <div className="sectionHead">
          <p className="eyebrow">token-claim</p>
          <h2>Claim states without a backend</h2>
          <p>Proof data is static JSON. The widget turns that into eligibility states and a claim transaction.</p>
        </div>
        <div className="cards">
          <ClaimStateCard
            icon={<CheckCircle2 />}
            title="Eligible"
            detail={`${formatTokenAmount(eligible.amount)} TOKEN ready to claim`}
            tone="success"
          />
          <ClaimStateCard icon={<CircleAlert />} title="Not eligible" detail="No allocation found for this wallet." />
          <ClaimStateCard
            icon={<FileCheck2 />}
            title="Already claimed"
            detail="The claim contract reports this wallet has claimed."
          />
          <ClaimStateCard
            icon={<CircleAlert />}
            title="Malformed proofs"
            detail="Bad JSON is surfaced as an operational error, not hidden as not eligible."
            tone="warning"
          />
        </div>
      </section>

      <section id="terms" className="section split" data-screenshot="terms-quiz">
        <div className="sectionHead">
          <p className="eyebrow">terms-quiz</p>
          <h2>Fake defaults, real extension points</h2>
          <p>
            The reusable quiz ships with placeholder terms and questions, so external teams never inherit K9 legal copy.
            Production apps pass their own content and attestation callback.
          </p>
        </div>
        <TermsQuiz
          wallet={demoWallet}
          requiredChainId={BASE_EAS_TERMS_DEFAULTS.chainId}
          requiredChainName="Base"
          randomizeAnswers={false}
        />
      </section>

      <section id="eas" className="section" data-screenshot="eas-terms-kit">
        <div className="sectionHead">
          <p className="eyebrow">eas-terms-kit</p>
          <h2>Base-first EAS terms flow</h2>
          <p>The kit prepares a canonical terms hash, stores the document on IPFS, and writes a public EAS record.</p>
        </div>
        <div className="flowCards">
          <FlowStep icon={<FileCheck2 />} label="Read terms" />
          <FlowStep icon={<ClipboardCheck />} label="Pass quiz" />
          <FlowStep icon={<Database />} label="Encode payload" />
          <FlowStep icon={<Wallet />} label="Submit EAS attestation" />
          <FlowStep icon={<KeyRound />} label="Unlock claim" />
        </div>
        <div className="schemaBox">
          <span>Schema</span>
          <code>{TERMS_SCHEMA_DEFINITION}</code>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ClaimStateCard({
  icon,
  title,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <article className={`claimCard ${tone}`}>
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{detail}</p>
    </article>
  );
}

function FlowStep({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flowStep">
      <div className="icon">{icon}</div>
      <span>{label}</span>
    </div>
  );
}
