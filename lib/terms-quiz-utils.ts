export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const formatAddress = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—");

export const BASE_CHAIN_ID = 8453;

export const mockAttestationData = (address?: string) => ({
  schema: "0x7f6fb09beb1886d0b223e9f15242961198dd360021b2c9f75ac879c0f786cafd",
  recipient: address ?? "0x0000000000000000000000000000000000000000",
  expirationTime: 0,
  revocable: true,
  refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
  data: {
    termsVersion: "sunset-v1.0.0",
    termsHash: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
    agreedAt: Math.floor(Date.now() / 1000),
    quizScore: "5/5",
  },
});
