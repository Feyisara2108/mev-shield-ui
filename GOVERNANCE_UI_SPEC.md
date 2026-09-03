# MEV Shield — Governance UI Spec

A drop-in description you can hand to a designer or an AI UI generator (v0, Figma AI, Lovable, etc.).
It describes **one new page — "Governance"** — plus the small nav/home changes to support it.

It is written to match the app you already have: dark-first, violet accent, a Bloomberg-terminal
data aesthetic (tiny uppercase labels, monospaced tabular numbers, thin borders, tight spacing).
**Use only the tokens defined here. Do not introduce a new palette.**

---

## 0. What this product is (context for the designer)

MEV Shield is a Uniswap v4 hook. Large swaps are auctioned to MEV searchers; the winning bid is
captured for the pool instead of leaking to bots. The **new idea** this page exposes:

> **Liquidity providers (LPs) vote on how each captured bid is split** — how much is **donated to
> LPs** vs. **rebated back to the trader** who requested the swap. Each LP's vote is **weighted by
> how much liquidity they've supplied**. The pool's live split is the liquidity-weighted average of
> all votes, and it updates instantly on-screen when anyone votes.

One sentence for the hero: **"LPs govern their own MEV. Vote your share, weighted by your liquidity."**

---

## 1. Design language (reuse exactly)

### Color tokens (CSS variables already in `globals.css`)
| Token | Dark | Meaning |
|---|---|---|
| `--color-bg` | `#0b0c0f` | page background |
| `--color-surface` | `#0f1014` | card surface |
| `--color-surface-alt` | `#13151a` | inset / nested surface |
| `--color-border` | `#1e2028` | hairline borders |
| `--color-border-hi` | `#2a2d38` | hover / emphasis border |
| `--color-primary` | `#6366f1` | violet accent (LP side, active state, CTAs) |
| `--color-primary-hover` | `#4f52d1` | CTA hover |
| `--color-success` | `#22c55e` | positive deltas, "donated to LPs" |
| `--color-amber` | `#f59e0b` | "rebated to trader", pending/live auction |
| `--color-info` | `#06b6d4` | neutral highlights, cyan data |
| `--color-error` | `#ef4444` | errors, failed tx |
| `--color-text` | `#d1d5db` | primary text |
| `--color-subtext` | `#6b7280` | secondary text |
| `--color-eyebrow` | `#4b5563` | tiny label text |

A **light theme** exists via `<html data-theme="light">` — every component must read the CSS vars, never hardcode hex.

### Semantic color mapping for THIS page
- **LP share** → violet (`--color-primary`) with `--color-success` for the "donated" outcome.
- **Trader rebate** → amber (`--color-amber`).
- Keep the two sides visually opposed everywhere (split bar, legend, stats) so the tradeoff reads instantly.

### Typography
- Sans: **Inter** (`--font-sans`). Mono: **JetBrains Mono** (`--font-mono`).
- **All numeric values are mono + tabular** (`.mono-val`): bps, %, liquidity, addresses, token amounts.
- **Section/field labels use `.eyebrow`**: 0.65rem, 600, uppercase, `letter-spacing: 0.08em`, color `--color-eyebrow`.
- Body text is small: 12–13px (`text-xs`). Headings are restrained — this is a data terminal, not a landing page.

### Layout & shape
- Content column: `max-w-5xl`, `px-4`. Sticky top nav is `h-11`.
- Cards: `border` (1px `--color-border`), `rounded-sm` (2–4px only — corners are nearly square), `--color-surface` bg.
- Dividers are 1px hairlines. Generous vertical rhythm, tight horizontal padding.
- Hover: border shifts to `--color-border-hi`; active tab shows a 1px `--color-primary` underline.
- Motion: fast and subtle (120–160ms). Value changes should **count/tween**, not jump.

---

## 2. Navigation change

Add a tab **"Governance"** to the existing nav (`Home · Swap · Auctions · Activity`), placed
between **Auctions** and **Activity**:

```
MEV Shield   Home   Swap   Auctions   Governance   Activity        ☀︎  [Wallet]
```

Route: `/governance`. Active-tab styling identical to existing tabs (violet 1px underline, text brightens).

---

## 3. The Governance page (`/governance`)

Single scrollable column, `max-w-5xl`. Six stacked sections, top to bottom.

### 3.1 Page header
- `.eyebrow`: **"POOL GOVERNANCE"**
- H1 (18–20px, `--color-text`): **"TKNA / TKNB revenue split"** (token symbols from constants).
- Sub (13px, `--color-subtext`): "LPs vote how captured MEV is shared. Your vote is weighted by your liquidity in this pool."
- Right-aligned small pill: pool fee tier `0.30%` and a truncated pool/hook address in mono with a copy icon.

### 3.2 The Split Bar — the centerpiece (the "money shot")
A single horizontal bar, full width, ~56px tall, `rounded-sm`, that visualizes the pool's **current
effective split**:

```
┌───────────────────────────────────────────────────────────────────────┐
│  LP DONATION                                    TRADER REBATE           │
│██████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│  62.0%                                          38.0%                   │
└───────────────────────────────────────────────────────────────────────┘
        violet→green fill (left)              amber fill (right)
```

- Left segment width = `effectiveLpShareBps / 100` %, filled violet (`--color-primary`); label "LP DONATION" + big mono %.
- Right segment = `traderRebateBps / 100` %, filled amber (`--color-amber`); label "TRADER REBATE" + big mono %.
- The **boundary between the two segments animates smoothly** whenever a new vote lands (tween width over ~500ms and briefly pulse a `--color-primary` glow on the moving edge). This is the visual payoff — make it satisfying.
- Below the bar, three inline stat chips (`.eyebrow` label over `.mono-val` value):
  - **EFFECTIVE LP SHARE** — `62.00%` (`effectiveLpShareBps`)
  - **TOTAL VOTING WEIGHT** — `1.4M` liquidity units (`votingWeight`)
  - **TRACKED LIQUIDITY** — `2.1M` (`totalLiquidity`)
- Empty state (no votes yet): bar is 100% violet, caption reads _"No votes yet — default is 100% to LPs."_

### 3.3 Your position & vote (only when wallet connected)
A card with two columns on desktop, stacked on mobile.

**Left — "YOUR STANDING"**
- YOUR LIQUIDITY: mono value (`lpLiquidity[pool][you]`).
- YOUR VOTE WEIGHT SHARE: `you / votingWeight` as % — how much you can move the outcome.
- YOUR CURRENT VOTE: shows your `lpVoteBps` as % if `hasVoted`, else "Not voted".

**Right — "CAST YOUR VOTE"**
- A **slider** from 0% → 100% labeled **"Share to LPs"**. The track is a violet→amber gradient so the
  thumb position literally shows the tradeoff. Current thumb value shown large in mono (e.g. `60%`).
- Live helper line under the slider updates as you drag:
  _"If this becomes the pool split: **60%** of every winning bid is donated to LPs, **40%** is rebated to traders."_
- A faint "ghost marker" on the slider shows the **current pool effective share**, so the LP sees where their vote sits vs. the crowd.
- Primary button **"Submit vote"** (violet, `--color-primary`, hover `--color-primary-hover`).
  - Disabled + tooltip "Add liquidity to this pool to gain voting weight" when `lpLiquidity == 0`.
  - States: idle → "Confirm in wallet…" (spinner) → "Voting…" (tx pending, amber) → success toast.
- On success, **the Split Bar (3.2) re-animates to the new value** and a toast shows the delta:
  _"Vote cast. Pool LP share 58% → 62% (+4.0)."_

### 3.4 Live vote ledger — "WHO'S VOTING"
A compact terminal-style table (mono, tabular, hairline row dividers), sorted by weight desc:

| LP | WEIGHT | WEIGHT % | VOTE (LP SHARE) | CONTRIBUTION |
|---|---|---|---|---|
| `0x1f…a20` (you) | 800.0k | 57.1% | 80% | violet mini-bar |
| `0x9c…03b` | 300.0k | 21.4% | 40% | violet mini-bar |
| `0x44…c1e` | 300.0k | 21.4% | 40% | violet mini-bar |

- "you" row is highlighted with a subtle `--color-surface-alt` background and a violet left border.
- **CONTRIBUTION** column = a tiny inline bar showing `weight% × vote` — visually explains how the weighted average is formed.
- Footer row: **"WEIGHTED AVERAGE = 62.00%"** in `--color-primary`, matching the Split Bar.
- Populate from `Voted` and `LiquidityTracked` events + `lpLiquidity` / `lpVoteBps` reads. Update in real time on new events (optimistic + confirmed).

### 3.5 "What changes for the next auction" explainer
A slim horizontal 3-step strip (icons + one line each), amber/violet accented, reinforcing causality:

`① Searcher wins auction → pays bid`  →  `② Hook donates LP share to in-range LPs (violet/green)`  →  `③ Hook rebates the rest to the trader (amber)`

Under it, a one-line worked example that recomputes from the current split:
_"Example: a 0.50 TKNA winning bid → **0.31 to LPs**, **0.19 back to the trader** at today's 62/38 split."_

### 3.6 Recent governed executions (optional, if time)
Reuse the Activity card style. Each row: request id, bid amount, **LP donation** (green) / **trader
rebate** (amber) split as realized on-chain, tx link. Source: `SwapExecuted(requestId, executor,
lpDonation, traderRebate)` events.

---

## 4. Data / contract binding (for the engineer implementing it)

New hook: **`GovernedMevAuctionHook`**. Relevant reads/writes:

- `getGovernanceInfo(PoolKey) → { effectiveLpShareBps, traderRebateBps, totalLiquidity, votingWeight }` — powers 3.2.
- `effectiveLpShareBps(PoolId) → uint256` — bps (0–10000). Divide by 100 for %.
- `lpLiquidity(PoolId, address) → uint256` — your weight (3.3 left).
- `lpVoteBps(PoolId, address)` + `hasVoted(PoolId, address)` — your current vote (3.3 left).
- `vote(PoolKey, lpShareBps)` — write from the slider (3.3 right). `lpShareBps` = sliderPercent × 100.
- Events: `Voted(poolId, lp, lpShareBps, newEffectiveLpShareBps)`, `LiquidityTracked(poolId, lp, newLpLiquidity, totalLiquidity)`, `SwapExecuted(requestId, executor, lpDonation, traderRebate)` — power 3.4 and 3.6 live.

Conversion helpers the UI needs everywhere: `bps → %` (`bps/100`), and always render the pair as
`LP% + rebate% = 100%` so the two never drift on screen.

---

## 5. States to design (don't skip)
- **Wallet disconnected:** Sections 3.2, 3.4, 3.5 still render (public pool data). 3.3 shows a "Connect wallet to vote" prompt using the existing WalletButton.
- **Connected, zero liquidity:** vote card visible but Submit disabled with the "add liquidity" hint; ledger still shows others.
- **Loading:** skeleton hairline bars in the Split Bar and table rows (shimmer with `--color-surface-alt`).
- **Tx pending / error:** amber pending pill; on revert show a compact `--color-error` toast with the reason (e.g. "InvalidShare").
- **Light theme:** verify contrast — violet/amber both must stay legible on `#ffffff` surfaces.

---

## 6. Responsive
- ≥1024px: two-column vote card, full-width Split Bar, full ledger table.
- <768px: everything stacks; the ledger collapses WEIGHT% and CONTRIBUTION into a single stacked cell per row; the Split Bar stays full width and remains the visual anchor.

---

## 7. One-paragraph prompt (paste into an AI UI generator)

> Design a dark-first "Governance" page for a Uniswap v4 MEV dashboard called MEV Shield, matching a
> Bloomberg-terminal aesthetic: near-black background (#0b0c0f), card surfaces (#0f1014), 1px borders
> (#1e2028), a violet accent (#6366f1), amber (#f59e0b), and success green (#22c55e); Inter for text,
> JetBrains Mono for all numbers (tabular), tiny uppercase 0.65rem labels, nearly-square corners, tight
> spacing, subtle 120–160ms motion. The page lets liquidity providers vote on how captured MEV is split
> between LPs (violet/green) and traders (amber), weighted by each LP's liquidity. Centerpiece: a single
> full-width horizontal "split bar" showing LP-donation % vs trader-rebate % that smoothly animates when
> a vote lands. Below it: a two-column "your position / cast your vote" card with a violet→amber gradient
> slider (0–100% share to LPs) and a live helper sentence, then a monospaced "who's voting" ledger table
> (LP address, weight, weight %, their vote, a contribution mini-bar) with a weighted-average footer, and
> a 3-step "searcher wins → LPs donated → trader rebated" explainer strip. Support light theme, wallet
> connected/disconnected states, loading skeletons, and mobile stacking. Use only the listed colors.
