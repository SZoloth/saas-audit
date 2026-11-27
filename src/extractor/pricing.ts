import type { ExtractedPricing } from "../domain/types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function grabSnippet(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (!m) return null;
  const start = Math.max(0, m.index - 35);
  const end = Math.min(text.length, m.index + m[0].length + 55);
  return text.slice(start, end).trim();
}

export function extractPricingSignals(html: string): ExtractedPricing {
  const text = stripHtml(html);

  const priceSet = new Set<number>();
  const priceRe = /\$\s*(\d{1,4})(?:\.\d{2})?\s*(?:\/|\s*per\s*)(?:mo|month|user|seat|member)/gi;
  let m: RegExpExecArray | null;
  while ((m = priceRe.exec(text)) !== null) {
    const val = Number.parseInt(m[1] ?? "0", 10);
    if (val >= 1 && val <= 2000) priceSet.add(val);
  }
  const pricesUsd = [...priceSet].sort((a, b) => a - b);

  const hasFreeTier = /\b(free plan|free tier|\$0\b|start for free|hobby\s*free)\b/i.test(text);
  const ssoRe = /\b(saml\s*sso|saml|single sign-on|sso)\b/i;
  const entRe = /\b(contact sales|talk to sales|custom pricing|get a quote)\b/i;
  const annualRe = /\b(billed annually|billed yearly|annual billing|save\s+(\d{1,2})%)\b/i;
  const auditRe = /\b(audit logs?|scim)\b/i;

  const mentionsSso = ssoRe.test(text);
  const hasEnterpriseWall = entRe.test(text);
  const hasAnnualDiscount = annualRe.test(text);
  const saveMatch = /save\s+(?:up\s+to\s+)?(\d{1,2})%/i.exec(text);
  const annualSavePct = saveMatch?.[1] ? Number.parseInt(saveMatch[1], 10) : null;
  const mentionsAuditLogs = auditRe.test(text);

  const snippets: string[] = [];
  for (const re of [ssoRe, entRe, annualRe, auditRe]) {
    const s = grabSnippet(text, re);
    if (s) snippets.push(s);
  }

  return {
    pricesUsd,
    minPaidUsd: pricesUsd[0] ?? null,
    maxPublicUsd: pricesUsd.length > 0 ? (pricesUsd[pricesUsd.length - 1] ?? null) : null,
    hasFreeTier,
    mentionsSso,
    hasEnterpriseWall,
    hasAnnualDiscount,
    annualSavePct,
    mentionsAuditLogs,
    evidenceSnippets: snippets,
  };
}
