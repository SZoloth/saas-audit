export interface VendorTarget {
  readonly name: string;
  readonly slug: string;
  readonly category: "AI" | "DevTools" | "Productivity" | "Data & Infra";
  readonly pricingUrl: string;
}

export interface ReceiptRef {
  readonly slug: string;
  readonly sourceUrl: string;
  readonly fetchedAt: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly relPath: string;
}

export interface ExtractedPricing {
  readonly pricesUsd: readonly number[];
  readonly minPaidUsd: number | null;
  readonly maxPublicUsd: number | null;
  readonly hasFreeTier: boolean;
  readonly mentionsSso: boolean;
  readonly hasEnterpriseWall: boolean;
  readonly hasAnnualDiscount: boolean;
  readonly annualSavePct: number | null;
  readonly mentionsAuditLogs: boolean;
  readonly evidenceSnippets: readonly string[];
}

export type SaasFlagKind =
  | "sso-tax"
  | "enterprise-wall"
  | "annual-lockin"
  | "no-public-prices";

export interface VerifiedTrap {
  readonly id: string;
  readonly kind: SaasFlagKind;
  readonly vendor: string;
  readonly slug: string;
  readonly headline: string;
  readonly detail: string;
  readonly pricingUrl: string;
  readonly severity: number;
  readonly receipt: ReceiptRef;
}

export interface VendorAudit {
  readonly name: string;
  readonly slug: string;
  readonly category: VendorTarget["category"];
  readonly pricingUrl: string;
  readonly extracted: ExtractedPricing;
  readonly isTransparent: boolean;
  readonly tags: readonly string[];
  readonly findings: readonly VerifiedTrap[];
  readonly receipt: ReceiptRef;
}

export interface BakedSaasDataset {
  readonly generatedAt: string;
  readonly vendors: readonly VendorAudit[];
  readonly traps: readonly VerifiedTrap[];
  readonly skipped: readonly { slug: string; reason: string }[];
}
