# Carrier insights (`/insights`)

Anonymous totals for T-Mobile by Category × Tactic × outcome (fell for, caught, false alarm, trusted real), with the average time on call. The page, API and CSV read the **synthetic demo dataset only**, with no label on screen (see the update in `docs/adr/0002`); present the numbers as illustrative. Rules come from `docs/adr/0002`; the numbers come from `insightTotals` in `lib/season/analysis.ts`.

- **Access.** The password is `tmobile` (`INSIGHTS_PASSWORD` in `access.ts`); no Worker secret is needed. The page shows only a password prompt until it is typed; then an HttpOnly, SameSite=Strict cookie (`tell_insights`, 7 days) holds an HMAC of the password, never the password. The password is in the public repo, so it only keeps out casual visitors; the page shows anonymous totals only.
- **Privacy.** A group with fewer than 5 distinct Players is returned as `hidden` with no counts and shown as "Fewer than 5 Players". Groups are rebuilt field by field, so no Player id, scenario id, email, nickname or transcript reaches the JSON, the page or the CSV.
- **Data.** Synthetic rows only; any `?synthetic=` or other query is ignored. Each synthetic call has a realistic length within the 3-minute cap, and each visible group carries its average seconds (calls with no recorded length are left out of the average).
- **Page.** Black background. Key-number tiles (calls analysed, fail rate, catch rate, false-alarm rate, average time on call), the Nemotron analysis, a pie of how calls ended, bars for average time by outcome and by Category, fail-rate bars by Category and by Tactic, and the full table. Pie and outcome bars share the validated dark categorical colours; every chart also prints its values as text.
- **Analysis.** The Insights analyst (`analyst.ts`, NVIDIA Nemotron) writes a six-section report for carriers: Overview, Scams people fall for most, Pressure tactics that work, Real calls people doubted, Time on the call, and What carriers can do. It is given the visible totals plus rates that code computes in `report.ts` (overall fail, catch and false-alarm rates; fail rate by Category and by Tactic; average call time overall, by outcome and by Category), and every number in its text must be one of those. It is stored in `insights_summaries` with its time and synthetic flag, and rewritten on open when older than 15 minutes. If the model fails, the last stored analysis is shown (marked as not just written), or a fixed sentence. The page shows the same code-computed rates as key-number tiles and bars.
- **CSV.** `/api/insights/csv` is built from the same view as the page, so it is exactly the totals on screen.

## Synthetic data

```bash
npm run insights:seed     # ~200 synthetic Players and their calls, all synthetic = true; safe to repeat
npm run insights:unseed   # removes every synthetic row (and synthetic summaries), nothing else
```

Both use `DATABASE_URL_DIRECT`. Synthetic Players use `@synthetic.invalid` addresses. The Leaderboard and the Player analysis already ignore synthetic rows.

## Manual check

1. Open `/insights` without the password: only the prompt. Type a wrong password: "That password didn’t work. Please try again."
2. Type `tmobile`: synthetic totals with charts and average call times, and no "synthetic" label anywhere.
3. Download the CSV: the same totals, with an "Average seconds on call" column.

After changing the synthetic generator, re-run `npm run insights:seed` so stored calls get the new lengths.
