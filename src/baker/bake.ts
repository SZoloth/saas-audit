import type { BakedSaasDataset, VendorAudit, VerifiedTrap } from "../domain/types.js";
import { assertValidReceipt } from "../verifier/audit.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarizeVendor(v: VendorAudit): string {
  const e = v.extracted;
  const parts: string[] = [];
  if (e.minPaidUsd !== null) {
    parts.push(
      e.maxPublicUsd && e.maxPublicUsd > e.minPaidUsd
        ? `Public tiers <b>$${e.minPaidUsd}–$${e.maxPublicUsd}/mo</b>`
        : `From <b>$${e.minPaidUsd}/mo</b>`
    );
  } else {
    parts.push(e.hasEnterpriseWall ? `<b>No public $/mo tiers</b>` : `Usage-based pricing`);
  }
  if (e.hasEnterpriseWall) parts.push(`Contact Sales wall`);
  if (e.mentionsSso && e.hasEnterpriseWall) parts.push(`<b>SSO tax risk</b>`);
  if (e.hasAnnualDiscount) {
    parts.push(e.annualSavePct ? `Annual lock-in (${e.annualSavePct}% off)` : `Annual billing`);
  }
  return parts.join(" · ");
}

function renderVendorRow(v: VendorAudit, rank: number): string {
  assertValidReceipt(v.receipt, v.slug);
  const e = v.extracted;
  const badge = v.isTransparent
    ? `<span class="w ok">Transparent</span>`
    : e.mentionsSso && e.hasEnterpriseWall
      ? `<span class="w trap">SSO + Sales wall</span>`
      : `<span class="w warn">Sales wall</span>`;

  const lines: string[] = [];
  lines.push(
    `<p class="how">Category: <b>${esc(v.category)}</b> · Free tier: <b>${e.hasFreeTier ? "Yes" : "No/Unclear"}</b> · Audit logs/SCIM mentioned: <b>${e.mentionsAuditLogs ? "Yes" : "No"}</b>.</p>`
  );
  if (e.pricesUsd.length > 0) {
    lines.push(
      `<p class="how">Extracted public USD tiers: <code>${esc(e.pricesUsd.slice(0, 8).map((p) => `$${p}`).join(", "))}</code>.</p>`
    );
  }
  if (e.evidenceSnippets.length > 0) {
    lines.push(
      `<p class="how">Page receipt quote: <em>"${esc(e.evidenceSnippets[0] ?? "")}..."</em></p>`
    );
  }

  const checked = esc(v.receipt.fetchedAt.replace("T", " ").slice(0, 16) + " UTC");
  const hashShort = esc(v.receipt.sha256.slice(0, 12));

  return `    <li data-id="${esc(v.slug)}" data-rank="${rank}" data-k="${esc(v.name.toLowerCase())} ${esc(v.slug)} ${esc(v.category.toLowerCase())}" data-how="${esc(v.tags.join(" "))}">
      <details><summary><span class="s">${esc(v.name)}</span>${badge}<i class="chev" aria-hidden="true"></i><span class="d">${summarizeVendor(v)}</span></summary>
      <div class="more">${lines.join("")}<div class="acts"><a class="go" href="${esc(v.pricingUrl)}" rel="noopener" target="_blank">Pricing page</a><a class="rcpt" href="${esc(v.receipt.relPath)}" rel="noopener" target="_blank">JSON receipt (${hashShort})</a></div><p class="meta"><span>Category: ${esc(v.category)}</span><span>Checked ${checked}</span></p></div></details>
    </li>`;
}

function renderTrapRow(t: VerifiedTrap, rank: number): string {
  assertValidReceipt(t.receipt, t.id);
  const hashShort = esc(t.receipt.sha256.slice(0, 12));
  const checked = esc(t.receipt.fetchedAt.replace("T", " ").slice(0, 16) + " UTC");
  return `    <li data-id="${esc(t.id)}" data-rank="${rank}" data-k="${esc(t.vendor.toLowerCase())} ${esc(t.slug)} ${esc(t.kind)}" data-how="trap" data-trap="">
      <details><summary><span class="s">${esc(t.vendor)}</span><span class="w trap">Flag</span><i class="chev" aria-hidden="true"></i><span class="d">${esc(t.headline)}</span></summary>
      <div class="more"><p class="how">${esc(t.detail)}</p><div class="acts"><a class="go" href="${esc(t.pricingUrl)}" rel="noopener" target="_blank">Pricing page</a><a class="rcpt" href="${esc(t.receipt.relPath)}" rel="noopener" target="_blank">JSON receipt (${hashShort})</a></div><p class="meta"><span>Flag: ${esc(t.kind)}</span><span>Checked ${checked}</span></p></div></details>
    </li>`;
}

// Plain ES5 syntax, zero innerHTML.
const CLIENT_ES5 = `(function () {
  var groupsEl = document.getElementById('groups');
  if (!groupsEl) return;
  var res = document.getElementById('list');
  var more = document.getElementById('more');
  var sep = document.getElementById('sep');
  var q = document.getElementById('q');
  var chips = document.getElementById('chips');
  var empty = document.getElementById('empty');
  var clear = document.getElementById('clear');
  var sections = [].slice.call(groupsEl.querySelectorAll('.grp'));
  var mainUl = groupsEl.querySelector('.grp[data-key="vendors"] ul');
  var how = 'all';
  var OTHERS = 5;

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  var rows = [].slice.call(groupsEl.querySelectorAll('li'));
  rows.sort(function (a, b) { return Number(a.getAttribute('data-rank')) - Number(b.getAttribute('data-rank')); });

  rows.forEach(function (li) {
    li._home = !mainUl || li.hasAttribute('data-trap') ? li.parentNode : mainUl;
    li._tags = (li.getAttribute('data-how') || '').split(' ');
    var d = li.querySelector('.d');
    li._text = norm(li.getAttribute('data-k') + ' ' + (d ? d.textContent : ''));
    li._store = norm(li.getAttribute('data-k'));
  });

  function apply(fromSearch) {
    var term = norm(q.value);
    if (term) {
      var byStore = rows.some(function (li) { return li._store.indexOf(term) >= 0; });
      var hits = [];
      var rest = [];
      rows.forEach(function (li) { ((byStore ? li._store : li._text).indexOf(term) >= 0 ? hits : rest).push(li); });
      var others = hits.length < 3 ? rest.slice(0, OTHERS) : [];
      rows.forEach(function (li) { li.hidden = true; li._home.appendChild(li); });
      hits.forEach(function (li) { li.hidden = false; res.appendChild(li); });
      others.forEach(function (li) { li.hidden = false; more.appendChild(li); });
      groupsEl.hidden = true;
      res.hidden = !hits.length;
      more.hidden = sep.hidden = !others.length;
      empty.hidden = !!hits.length;
      if (!hits.length) empty.textContent = 'Nothing on this list for "' + q.value.trim() + '".';
      var one = hits.length === 1 ? hits[0].querySelector('details') : null;
      rows.forEach(function (li) { var d = li.querySelector('details'); if (d !== one && fromSearch) d.open = false; });
      if (one) one.open = true;
    } else {
      var any = false;
      rows.forEach(function (li) {
        li.hidden = !(how === 'all' || li._tags.indexOf(how) >= 0);
        li._home.appendChild(li);
        if (!li.hidden) any = true;
      });
      sections.forEach(function (s) {
        var ul = s.querySelector('ul');
        s.hidden = ![].some.call(ul.children, function (li) { return !li.hidden; });
      });
      groupsEl.hidden = !any;
      res.hidden = true;
      more.hidden = true;
      sep.hidden = true;
      empty.hidden = true;
      if (fromSearch) rows.forEach(function (li) { li.querySelector('details').open = false; });
    }
    if (clear) clear.hidden = !q.value;
    if (chips) chips.hidden = !!term;
  }

  q.addEventListener('input', function () { apply(true); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter') q.blur(); });
  if (clear) clear.addEventListener('click', function () { q.value = ''; apply(true); q.focus(); });

  if (chips) {
    chips.hidden = false;
    chips.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b) return;
      var pick = b.getAttribute('data-how');
      how = how === pick ? 'all' : pick;
      [].forEach.call(chips.querySelectorAll('button'), function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-how') === how));
      });
      apply(false);
    });
  }

  function onToggle(e) {
    var d = e.target;
    if (!d.open || d.className === 'tbox') return;
    rows.forEach(function (li) { var x = li.querySelector('details'); if (x !== d) x.open = false; });
  }

  [groupsEl, res, more].forEach(function (el) {
    if (el) el.addEventListener('toggle', onToggle, true);
  });

  apply(false);
})();`;

export function bakeHtml(dataset: BakedSaasDataset): string {
  for (const v of dataset.vendors) assertValidReceipt(v.receipt, v.slug);
  for (const t of dataset.traps) assertValidReceipt(t.receipt, t.id);

  const sorted = [...dataset.vendors].sort(
    (a, b) => Number(a.isTransparent) - Number(b.isTransparent) || b.findings.length - a.findings.length
  );
  const vendorRows = sorted.map((v, i) => renderVendorRow(v, i + 1)).join("\n");
  const trapRows = dataset.traps.map((t, i) => renderTrapRow(t, 1000 + i)).join("\n");
  const checkedDate = esc(dataset.generatedAt.slice(0, 10));
  const transparentCount = dataset.vendors.filter((v) => v.isTransparent).length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SaaS &amp; AI Pricing Audit — Public Pricing Receipts</title>
<meta name="description" content="SSO taxes, Contact Sales walls, and annual lock-ins audited directly from ${dataset.vendors.length} live SaaS &amp; AI pricing pages.">
<link rel="canonical" href="https://saas.samzoloth.com/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://saas.samzoloth.com/">
<meta property="og:title" content="SaaS &amp; AI Pricing Audit — ${dataset.vendors.length} live pricing pages audited">
<meta property="og:description" content="Only ${transparentCount} of ${dataset.vendors.length} top SaaS &amp; AI tools skip a Contact Sales wall. Verified SHA-256 receipts for every page.">
<meta property="og:image" content="https://saas.samzoloth.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="675">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="SaaS &amp; AI Pricing Audit — ${dataset.vendors.length} live pricing pages audited">
<meta name="twitter:description" content="SSO taxes, Contact Sales walls, and annual billing markups with SHA-256 receipts.">
<meta name="twitter:image" content="https://saas.samzoloth.com/og.png">
<meta name="color-scheme" content="light dark">
<style>
:root{--canvas:#f4f2ed;--surface:#fff;--ink:#171614;--muted:#625e57;--trapbg:#f8e7e2;--trapink:#9b2c1a;--warnbg:#f7efd8;--warnink:#7c5600;--okbg:#e3f1e8;--okink:#1c5f36;--line:#e8e4dc;--chip:#e9e6df;--accent:#2f4cf5}
@media(prefers-color-scheme:dark){:root{--canvas:#121211;--surface:#1c1b19;--ink:#f0ede6;--muted:#a39d93;--trapbg:#3a1d17;--trapink:#f49c8a;--warnbg:#332910;--warnink:#f0cc75;--okbg:#162e20;--okink:#7fd4a0;--line:#2b2926;--chip:#262421;--accent:#6c86ff}}
*{box-sizing:border-box}
[hidden]{display:none !important}
.search input::-webkit-search-cancel-button{-webkit-appearance:none}
body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:660px;margin:0 auto;padding:24px 16px 56px}
h1{margin:0 0 4px;font-size:24px;letter-spacing:-.02em}
.sub{margin:0 0 16px;color:var(--muted);font-size:14px}
.search{position:relative;margin:0 0 12px}
.search input{width:100%;padding:12px 38px 12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;outline:none}
.search input:focus{border-color:var(--accent)}
.clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--muted);font-size:18px;padding:4px 8px;cursor:pointer}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.chips button{border:0;border-radius:999px;padding:6px 12px;background:var(--chip);color:var(--ink);font:13px/1.2 inherit;cursor:pointer}
.chips button[aria-pressed="true"]{background:var(--ink);color:var(--surface)}
h2{margin:18px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.list{list-style:none;margin:0;padding:0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.list li{border-top:1px solid var(--line)}
.list li:first-child{border-top:0}
details>summary{list-style:none;display:grid;grid-template-columns:1fr auto 16px;gap:4px 8px;padding:13px 14px;cursor:pointer;align-items:center}
details>summary::-webkit-details-marker{display:none}
.s{font-weight:600}
.d{grid-column:1 / -1;color:var(--muted);font-size:14px}
.d b{color:var(--ink);font-weight:600}
.w{font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}
.w.trap{background:var(--trapbg);color:var(--trapink)}
.w.warn{background:var(--warnbg);color:var(--warnink)}
.w.ok{background:var(--okbg);color:var(--okink)}
.chev{width:8px;height:8px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:rotate(45deg);transition:transform .15s}
details[open]>summary .chev{transform:rotate(-135deg)}
.more{padding:0 14px 14px;font-size:14px}
.how{margin:0 0 8px;color:var(--ink)}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 8px}
.go,.rcpt{display:inline-block;padding:8px 12px;border-radius:9px;text-decoration:none;font-size:13px;font-weight:600}
.go{background:var(--ink);color:var(--surface)}
.rcpt{background:var(--chip);color:var(--ink)}
.meta{margin:0;display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px}
.tbox>summary{padding:12px 2px;font-weight:600;cursor:pointer;color:var(--trapink)}
.sep{margin:18px 0 8px;font-size:13px;color:var(--muted)}
.empty{padding:24px;text-align:center;color:var(--muted)}
.foot{margin:28px 0 0;font-size:12px;color:var(--muted);text-align:center}
.foot a{color:var(--ink);font-weight:600;text-decoration:none}
</style>
</head>
<body>
<main>
  <h1>SaaS &amp; AI pricing audit</h1>
  <p class="sub">${dataset.vendors.length} live pricing pages audited ${checkedDate}. Only <b>${transparentCount} of ${dataset.vendors.length}</b> skip a Contact Sales wall. Every row links to its SHA-256 receipt.</p>
  <div class="search">
    <input id="q" type="search" placeholder="Search a tool (e.g. cursor, anthropic, linear, supabase)" autocomplete="off">
    <button id="clear" class="clear" type="button" aria-label="Clear search" hidden>&times;</button>
  </div>
  <div class="chips" id="chips" hidden>
    <button type="button" data-how="sso-tax" aria-pressed="false">SSO tax</button>
    <button type="button" data-how="ent-wall" aria-pressed="false">Sales wall</button>
    <button type="button" data-how="annual" aria-pressed="false">Annual lock-in</button>
    <button type="button" data-how="transparent" aria-pressed="false">Transparent</button>
    <button type="button" data-how="free-tier" aria-pressed="false">Free tier</button>
  </div>
  <div class="groups" id="groups">
    <section class="grp" data-key="vendors">
      <h2>Most opaque pricing first</h2>
      <ul class="list">
${vendorRows}
      </ul>
    </section>
    <section class="grp tricks" data-key="traps">
      <details class="tbox" open><summary>What not to fall for (${dataset.traps.length} verified flags)</summary>
      <ul class="list">
${trapRows}
      </ul></details>
    </section>
  </div>
  <ul class="list" id="list" hidden></ul>
  <p class="sep" id="sep" hidden>Other audited tools</p>
  <ul class="list" id="more" hidden></ul>
  <p class="empty" id="empty" hidden></p>
  <p class="foot">Built by <a href="https://szoloth.com" target="_blank" rel="noopener">Sam Zoloth</a> &middot; Also see <a href="https://jobs.samzoloth.com" target="_blank" rel="noopener">Job Board Audit</a> &middot; Zero tracking, zero login</p>
</main>
<script>${CLIENT_ES5}</script>
</body>
</html>`;
}
