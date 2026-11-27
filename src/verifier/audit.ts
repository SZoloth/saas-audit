import type {
  ExtractedPricing,
  ReceiptRef,
  VendorAudit,
  VendorTarget,
  VerifiedTrap,
} from "../domain/types.js";

export function assertValidReceipt(receipt: ReceiptRef, context: string): void {
  if (!receipt || !/^[a-f0-9]{64}$/i.test(receipt.sha256) || !receipt.relPath.trim()) {
    throw new Error(`Invalid or missing receipt for ${context}`);
  }
}

export function auditVendor(
  target: VendorTarget,
  extracted: ExtractedPricing,
  receipt: ReceiptRef
): VendorAudit {
  assertValidReceipt(receipt, target.slug);

  const findings: VerifiedTrap[] = [];

  if (extracted.mentionsSso && extracted.hasEnterpriseWall) {
    findings.push({
      id: `${target.slug}-sso-tax`,
      kind: "sso-tax",
      vendor: target.name,
      slug: target.slug,
      headline: "SSO/SAML paired with opaque Enterprise sales wall",
      detail: `${target.name}'s pricing page pairs SAML/SSO with "Contact sales" / custom Enterprise tiers instead of publishing a flat self-serve price.`,
      pricingUrl: target.pricingUrl,
      severity: 90 + (extracted.mentionsAuditLogs ? 15 : 0),
      receipt,
    });
  }

  if (extracted.hasEnterpriseWall) {
    findings.push({
      id: `${target.slug}-ent-wall`,
      kind: "enterprise-wall",
      vendor: target.name,
      slug: target.slug,
      headline: "Top tier hidden behind 'Contact Sales'",
      detail: `${target.name} gates top-tier pricing behind a sales call rather than listing public rates.${extracted.maxPublicUsd ? ` Highest public tier shown: $${extracted.maxPublicUsd}/mo.` : ""}`,
      pricingUrl: target.pricingUrl,
      severity: 70 + (extracted.pricesUsd.length === 0 ? 30 : 0),
      receipt,
    });
  }

  if (extracted.hasAnnualDiscount) {
    findings.push({
      id: `${target.slug}-annual`,
      kind: "annual-lockin",
      vendor: target.name,
      slug: target.slug,
      headline: extracted.annualSavePct
        ? `Headline prices assume annual lock-in (${extracted.annualSavePct}% monthly penalty)`
        : "Headline prices assume annual billing",
      detail: `${target.name}'s pricing page highlights annual billing discounts; monthly checkout costs more than the headline $/mo number.`,
      pricingUrl: target.pricingUrl,
      severity: 45 + (extracted.annualSavePct ?? 15),
      receipt,
    });
  }

  if (extracted.pricesUsd.length === 0 && extracted.hasEnterpriseWall) {
    findings.push({
      id: `${target.slug}-no-prices`,
      kind: "no-public-prices",
      vendor: target.name,
      slug: target.slug,
      headline: "No standard $/mo tiers in SSR pricing HTML",
      detail: `Public pricing page HTML exposes no standard $/mo seat tiers without JS interaction or contacting sales.`,
      pricingUrl: target.pricingUrl,
      severity: 85,
      receipt,
    });
  }

  const isTransparent = !extracted.hasEnterpriseWall;
  const tags: string[] = [];
  if (extracted.hasEnterpriseWall) tags.push("ent-wall");
  if (extracted.mentionsSso && extracted.hasEnterpriseWall) tags.push("sso-tax");
  if (extracted.hasAnnualDiscount) tags.push("annual");
  if (isTransparent) tags.push("transparent");
  if (extracted.hasFreeTier) tags.push("free-tier");

  return {
    name: target.name,
    slug: target.slug,
    category: target.category,
    pricingUrl: target.pricingUrl,
    extracted,
    isTransparent,
    tags,
    findings,
    receipt,
  };
}

export function selectTopTraps(vendors: readonly VendorAudit[], limit = 15): readonly VerifiedTrap[] {
  return vendors
    .flatMap((v) => v.findings)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, limit);
}
