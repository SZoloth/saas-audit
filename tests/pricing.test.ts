import { describe, it, expect } from "vitest";
import { bakeHtml } from "../src/baker/bake.js";
import { extractPricingSignals } from "../src/extractor/pricing.js";
import { auditVendor } from "../src/verifier/audit.js";
import type { BakedSaasDataset, ReceiptRef, VendorTarget } from "../src/domain/types.js";

const RECEIPT: ReceiptRef = {
  slug: "acme",
  sourceUrl: "https://acme.com/pricing",
  fetchedAt: "2026-11-27T15:00:00Z",
  sha256: "c".repeat(64),
  byteLength: 1024,
  relPath: "receipts/acme.json",
};

const TARGET: VendorTarget = {
  name: "Acme",
  slug: "acme",
  category: "DevTools",
  pricingUrl: "https://acme.com/pricing",
};

describe("saas-audit pipeline", () => {
  it("extracts USD tiers, SSO tax, Contact Sales wall, and annual discount", () => {
    const html = `<html><body>
      <div>Free plan $0/mo</div>
      <div>Pro $20/month billed annually (save 20%)</div>
      <div>Enterprise: Contact sales for SAML SSO and Audit Logs</div>
    </body></html>`;
    const ex = extractPricingSignals(html);
    expect(ex.pricesUsd).toEqual([20]);
    expect(ex.hasFreeTier).toBe(true);
    expect(ex.mentionsSso).toBe(true);
    expect(ex.hasEnterpriseWall).toBe(true);
    expect(ex.annualSavePct).toBe(20);
    expect(ex.mentionsAuditLogs).toBe(true);

    const audit = auditVendor(TARGET, ex, RECEIPT);
    expect(audit.isTransparent).toBe(false);
    expect(audit.tags).toContain("sso-tax");
    expect(audit.tags).toContain("ent-wall");
  });

  it("enforces receipt integrity and plain ES5 / no-innerHTML in baked HTML", () => {
    const ex = extractPricingSignals("<div>$25/mo</div>");
    const good = auditVendor(TARGET, ex, RECEIPT);
    const ds: BakedSaasDataset = {
      generatedAt: "2026-11-27T15:00:00Z",
      vendors: [good],
      traps: good.findings,
      skipped: [],
    };
    const html = bakeHtml(ds);
    const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
    expect(js).not.toMatch(/\b(const|let)\s+/);
    expect(js).not.toContain("=>");
    expect(js).not.toContain("innerHTML");

    const badDs: BakedSaasDataset = {
      ...ds,
      vendors: [{ ...good, receipt: { ...RECEIPT, sha256: "" } }],
    };
    expect(() => bakeHtml(badDs)).toThrow(/receipt/i);
  });
});
