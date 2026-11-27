#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bakeHtml } from "./baker/bake.js";
import { DEFAULT_VENDORS } from "./domain/targets.js";
import type { BakedSaasDataset, ReceiptRef, VendorAudit } from "./domain/types.js";
import { extractPricingSignals } from "./extractor/pricing.js";
import { auditVendor, selectTopTraps } from "./verifier/audit.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_PATH = join(ROOT, "data", "dataset.json");
const DIST_DIR = join(ROOT, "dist");

async function runPool<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (idx < items.length) {
        const item = items[idx++];
        if (item !== undefined) await fn(item);
      }
    })
  );
}

async function runCrawl(): Promise<void> {
  const vendors: VendorAudit[] = [];
  const skipped: { slug: string; reason: string }[] = [];
  const receiptDir = join(ROOT, "data", "receipts");
  mkdirSync(receiptDir, { recursive: true });

  await runPool(DEFAULT_VENDORS, 6, async (target) => {
    try {
      const res = await fetch(target.pricingUrl, {
        signal: AbortSignal.timeout(12_000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html,*/*",
        },
      });
      if (!res.ok) {
        skipped.push({ slug: target.slug, reason: `HTTP ${res.status}` });
        console.error(`SKIP ${target.slug}: HTTP ${res.status}`);
        return;
      }
      const html = await res.text();
      const fetchedAt = new Date().toISOString();
      const rawSha256 = createHash("sha256").update(html, "utf8").digest("hex");
      const extracted = extractPricingSignals(html);

      const fileName = `${target.slug}.json`;
      const slim = {
        vendor: target.name,
        slug: target.slug,
        sourceUrl: target.pricingUrl,
        fetchedAt,
        rawSha256,
        rawByteLength: Buffer.byteLength(html, "utf8"),
        extracted,
      };
      const slimBuf = Buffer.from(JSON.stringify(slim, null, 2), "utf8");
      writeFileSync(join(receiptDir, fileName), slimBuf);

      const receipt: ReceiptRef = {
        slug: target.slug,
        sourceUrl: target.pricingUrl,
        fetchedAt,
        sha256: rawSha256,
        byteLength: slimBuf.byteLength,
        relPath: `receipts/${fileName}`,
      };
      const audit = auditVendor(target, extracted, receipt);
      vendors.push(audit);
      console.log(
        `OK   ${target.name.padEnd(12)} | tiers: ${JSON.stringify(extracted.pricesUsd.slice(0, 4)).padEnd(20)} | entWall=${audit.extracted.hasEnterpriseWall} | sso=${audit.extracted.mentionsSso} | transparent=${audit.isTransparent}`
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skipped.push({ slug: target.slug, reason });
      console.error(`SKIP ${target.slug}: ${reason}`);
    }
  });

  const generatedAt = new Date().toISOString();
  const dataset: BakedSaasDataset = {
    generatedAt,
    vendors,
    traps: selectTopTraps(vendors, 15),
    skipped,
  };
  mkdirSync(join(ROOT, "data", "history"), { recursive: true });
  writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2));
  writeFileSync(
    join(ROOT, "data", "history", `${generatedAt.slice(0, 10)}.json`),
    JSON.stringify(
      {
        date: generatedAt.slice(0, 10),
        vendors: vendors.map((v) => ({
          slug: v.slug,
          pricesUsd: v.extracted.pricesUsd,
          entWall: v.extracted.hasEnterpriseWall,
          sso: v.extracted.mentionsSso,
          sha256: v.receipt.sha256,
        })),
      },
      null,
      2
    )
  );
  console.log(`\nSaved dataset: ${vendors.length} vendors -> ${DATASET_PATH}`);
}

function runBake(): void {
  const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf8")) as BakedSaasDataset;
  const html = bakeHtml(dataset);
  mkdirSync(join(DIST_DIR, "receipts"), { recursive: true });
  writeFileSync(join(DIST_DIR, "index.html"), html, "utf8");
  for (const v of dataset.vendors) {
    copyFileSync(join(ROOT, "data", v.receipt.relPath), join(DIST_DIR, v.receipt.relPath));
  }
  console.log(
    `Baked ${join(DIST_DIR, "index.html")} (${(Buffer.byteLength(html, "utf8") / 1024).toFixed(1)} KB) + ${dataset.vendors.length} slim receipts`
  );
}

function runVerify(): void {
  const html = readFileSync(join(DIST_DIR, "index.html"), "utf8");
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > 250_000) throw new Error(`HTML too large: ${bytes}`);
  const js = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
  if (/\b(const|let)\s+/.test(js) || js.includes("=>") || js.includes("innerHTML")) {
    throw new Error("Inline JS failed ES5 / no-innerHTML invariant!");
  }
  const dataset = JSON.parse(readFileSync(DATASET_PATH, "utf8")) as BakedSaasDataset;
  for (const v of dataset.vendors) {
    if (!existsSync(join(DIST_DIR, v.receipt.relPath))) throw new Error(`Missing receipt: ${v.receipt.relPath}`);
  }
  console.log(`VERIFY PASS: ${(bytes / 1024).toFixed(1)} KB ES5 HTML, ${dataset.vendors.length} vendors, ${dataset.traps.length} flags, all receipts verified.`);
}

const cmd = process.argv[2];
if (cmd === "crawl") await runCrawl();
else if (cmd === "bake") runBake();
else if (cmd === "verify") runVerify();
else {
  console.log("Usage: saas-audit <crawl|bake|verify>");
  process.exit(1);
}
