# Co-op Take-Home

How much a University of Waterloo co-op work term actually pays after tax, for Ontario.

Payroll withholds tax as if a four-month term's pay were a full-year salary, so paycheques come out smaller than the tax actually owed, and the difference comes back as a refund in April. This app shows both sides:

- **each paycheque**: what the employer's payroll will deduct, following the CRA's T4127 formulas to the cent
- **the year**: the tax you actually owe on your 2026 return, and the refund (or balance owing) that results

It is a static site. All calculation happens in the browser. There is no backend and no analytics. Shareable state lives in the URL fragment (`#s=…`), which browsers never send to a server, and the production Content-Security-Policy sets `connect-src 'none'`, so the page cannot send data anywhere.

> Estimate only, not tax advice.

## Quick start

```sh
npm install
npm run dev        # local dev server
npm test           # Vitest: engine, params, PDOC fixtures, URL state (131 tests)
npm run typecheck  # tsc -b (strict)
npm run build      # production build in dist/
```

Deploys to Vercel as a Vite project. `vercel.json` sets the security headers and asset caching.

## Scope (v1)

Supported:

- Ontario resident on December 31, employed in Ontario by a Canadian employer
- regular periodic pay quoted hourly, weekly, biweekly or monthly (annual salaries are deliberately not accepted)
- paid weekly, biweekly, semi-monthly or monthly
- tax year 2026

Anything else produces a clear message instead of a number. This covers:

- Quebec, another province, or work outside Canada (for example a US internship)
- contractors or self-employment
- non-residents
- anyone under 18 or 70+ at any point in the year (CPP rules differ)
- terms or paycheques outside the tax year

The annual calculation assumes the person is single with no dependants and is a full-time student, so the Canada Workers Benefit does not apply.

## Project layout

```
params/
  sources/t4127-2026-01/*.csv     CRA CSV files, vendored byte-for-byte
  sources/t4127-2026-07/*.csv
  withholding/2026-01-01.json     T4127 January 2026 (122nd edition)
  withholding/2026-07-01.json     T4127 July 2026 (123rd edition)
  annual/2026.json                annual return parameters for 2026
  index.ts                        registry: one import line per file
src/engine/                       pure TypeScript, no React
  money.ts                        exact BigInt rational arithmetic, integer cents
  params/                         JSON types, parsing, edition-by-pay-date selection
  schedule/                       term dates + pay -> pay dates and cheque amounts
  withholding/                    Engine 1: T4127 Option 1 (CPP, CPP2, EI, federal, Ontario)
    bonus.ts                      Phase 2 interface stub (bonus method)
  annual/                         Engine 2: Schedule 8, T2204, Schedule 11, T1, ON428, ON428-A
  scope.ts                        out-of-scope detection
  calculator.ts                   terms -> paycheques -> annual result (+ TD1 advice)
src/ui/                           React components, form model, URL-fragment codec
tests/
  engine/*.test.ts
  fixtures/pdoc/*.json            cases to fill in from the CRA's PDOC
  pdoc.test.ts
```

## Methodology

### Money

Every dollar amount is an integer number of cents. Anything that produces a fraction of a cent (rates, rate ratios, division by pay periods) is carried as an exact rational number with BigInt numerator and denominator. It becomes cents only through an explicit rounding call. No binary floating point touches money.

Rounding follows T4127 Chapter 1:

- **Tax, CPP and EI:** round half up to the cent ("if the third digit is five or more, increase the second digit").
- **CPP basic exemption per period (3,500 / P):** truncated, so 134.61 for biweekly.
- **Rate ratios (0.0495/0.0595, 0.01/0.0595):** never rounded.
- **Each named factor** (F5, A, K1, K2, K4, T3, K1P, K2P, T4, V1, V2, S): rounded to the cent as its parenthesis resolves. T4127 Appendix 1 says this for CPP2. I applied it to every factor, and all 23 PDOC fixtures confirm it.
- **Federal and Ontario tax per period:** rounded separately, the way PDOC reports them.

### Engine 1: per-paycheque withholding (T4127 Option 1, periodic pay)

For each paycheque, with the T4127 edition in force on its pay date:

- **CPP:** `C = min(max − YTD, round(5.95% × (gross − trunc(3,500/P))))`
- **CPP2:** `C2 = min(416 − YTD2, round(4% × (PIYTD + PI − max(PIYTD, YMPE))))`
- **EI:** `min(max premium − YTD, round(1.63% × gross))`
- **Annual taxable income:** `A = P × (gross − F5)`, where `F5 = round(C × 0.01/0.0595) + C2` is the enhanced-CPP deduction.
- **Federal:** `T3 = R×A − K − K1 − K2 − K4`.
  - K1 = 14% × TD1 claim
  - K2 = 14% × annualized base CPP + 14% × annualized EI. Once a maximum is reached with an employer, the annual maximum is used, as T4127 recommends.
  - K4 = 14% × min(annual gross, Canada employment amount)
- **Ontario:** `T4 = V×A − KP − K1P − K2P`, then surtax V1, Ontario Health Premium V2 and tax reduction S: `T2 = T4 + V1 + V2 − S`.
- **TD1 "total income less than total claim amount" box (claim code E):** no income tax is withheld, except the Ontario Health Premium on annualized income over $20,000. CPP and EI still apply.
- **Per-employer caps:** CPP, CPP2 and EI caps are tracked per employer. Terms with the same employer name share year-to-date amounts. A new employer starts from zero.
  - This is why co-op students over-contribute CPP: each employer applies only `N × 3,500/P` of the exemption.

**Pay schedule.** Term gross = weekly pay × (weekdays in the term / 5) + vacation pay. A regular cheque is a full pay period, `weekly pay × 52 / P`, so $20/hr × 40 h paid biweekly is $1,600. That matches a real pay stub. Full cheques are paid until the term gross runs out, and a smaller final cheque pays the rest. The first pay date defaults to one period after the start date. The student can override the first pay date and the number of cheques; with a cheque count given, the term is split evenly.

**Phase 2.** Non-periodic payments (signing bonuses, relocation) have a typed interface in `withholding/bonus.ts` that throws `NotImplementedError`.

### Engine 2: the actual annual tax

The steps follow the return's line order:

1. **CPP (Schedule 8, Part 3).**
   - One $3,500 exemption for the year across all employers.
   - Required base = 4.95% and first additional = 1% of (earnings − 3,500), capped.
   - Actual base = box 16 × 83.1933%, the form's own ratio.
   - If more was deducted than required (Part 3a): the overpayment is refunded (line 44800), and line 30800 and line 22215 use the required amounts.
   - If less was deducted (Part 3b, simplified): you get credit for what was actually paid.
2. **EI (T2204).**
   - Required = 1.63% of insurable earnings, but zero if insurable earnings are under $2,000.
   - An overpayment is refunded only if it is more than $1.
   - Line 31200 = the lesser of the amount deducted and the amount required.
3. **Net and taxable income:** employment income − line 22215.
4. **Federal.**
   - Bracket tax on taxable income.
   - Non-refundable credits at 14%: basic personal amount (with the high-income phase-out formula), CPP base, EI, Canada employment amount, and tuition.
5. **Tuition (Schedule 11).**
   - Tuition room = taxable income − other credit amounts. Above the first bracket, line 11 is tax ÷ 14% instead of taxable income.
   - Carryforward is used first, then this year's tuition, and only as much as brings federal tax to zero.
   - The rest carries forward. There is no transfer to a parent in v1.
6. **Ontario (ON428, ON428-A).**
   - Bracket tax − 5.05% × (Ontario BPA + CPP base + EI).
   - Plus surtax.
   - Minus tax reduction: min(tax, 2 × $300 − tax).
   - Minus LIFT credit: min($875, 5.05% × employment income) − 5% × (adjusted net income − $32,500).
   - Plus Ontario Health Premium.
   - Ontario has had no tuition credit since 2017, and old Ontario carryforwards are ignored.
7. **Refund** = income tax withheld − tax owed + CPP overpayment + EI overpayment (if refunded). A negative refund is a balance owing.

## Sources

| What | Document | Where |
|---|---|---|
| Withholding formulas, rates, thresholds, constants, CPP/EI | T4127 Payroll Deductions Formulas, 122nd edition (Jan 1, 2026) and 123rd edition (Jul 1, 2026) | [Jan](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jan.html), [Jul](https://www.canada.ca/en/revenue-agency/services/forms-publications/payroll/t4127-payroll-deductions-formulas/t4127-jul.html); CSVs in `params/sources/` |
| CPP overpayment | Schedule 8 (5000-S8), Part 3 | 2025 form, 2026 values |
| EI overpayment | Form T2204 | 2025 form, 2026 values |
| Tuition | Schedule 11 (5000-S11) | 2025 form, 2026 values |
| Ontario tax, surtax, reduction, health premium | Form ON428 (5006-C) | 2025 form, 2026 values |
| LIFT credit | Schedule ON428-A (5006-A) | 2025 form |
| Independent annual cross-check | [TaxTips.ca 2025 and 2026 Canadian Tax Calculator](https://www.taxtips.ca/calculators/canadian-tax/canadian-tax-calculator.htm) | 10 cases agree within $1 |

Every value in `params/**/*.json` has a `source` string naming the document and table or line it came from.

### 2026 sanity check

Your brief listed eight 2026 figures. Each one is asserted in `tests/engine/params.test.ts`, and all of them match the CRA files exactly:

- federal rate 14% up to $58,523
- federal basic personal amount $16,452
- Canada employment amount $1,501
- CPP 5.95%, $3,500 basic exemption, YMPE $74,600
- CPP2 4% up to YAMPE $85,000
- EI 1.63% up to $68,900 of insurable earnings
- Ontario rate 5.05% up to $53,891
- Ontario basic personal amount $12,989

The July 2026 edition changed only BC, Newfoundland and Labrador, and PEI, so federal and Ontario withholding is identical in both editions. PDOC's own rates endpoint also reports CPP max $4,230.45 and EI max $1,123.07.

### Known assumptions to re-verify

- **2026 return forms.** These were not yet published when this was built (October 2026). The annual engine uses the 2025 line structure with 2026 indexed amounts from T4127. When the 2026 Schedule 8, T2204, Schedule 11, ON428 and ON428-A come out, re-check:
  - the CPP base share (83.1933%)
  - the LIFT maximum ($875) and income threshold ($32,500). These are not indexed and are assumed unchanged.
  - the Ontario tax-reduction basic amount ($300, taken from T4127's S2 factor)
- **Federal Top-Up Tax Credit (Budget 2025, 2025–2030).** This keeps 15% on credit amounts above the first bracket threshold. It is not modelled. The app warns when total credit amounts exceed $58,523, which is rare for students.
- **Intermediate rounding.** Each T4127 factor is rounded as described above. All 23 PDOC fixtures agree to the cent with this policy, including PDOC's own intermediate "Deductions for CPP additional contribution" (F5). If a future fixture disagrees by a cent, fix the formula. Do not widen the tolerance.

## Adding next year's parameters

1. **Download the new edition.** When the CRA publishes the T4127 January edition (usually in November or December), put its CSVs unchanged in `params/sources/t4127-YYYY-01/`.
2. **Create the withholding file.** Copy `params/withholding/2026-01-01.json` to `params/withholding/YYYY-01-01.json`. Update every `value`, and every `source` to name the new edition and table. Keep values as decimal strings.
3. **Create the annual file.** Do the same for `params/annual/YYYY.json`. Take the brackets and amounts from the new T4127, and check the form-only values (LIFT, CPP base share, EI thresholds, Ontario tax reduction) against that year's forms.
4. **Register both files.** Add one import line each to `params/index.ts`.
5. **Mid-year edition.** If the CRA publishes a July edition with changes, add `params/withholding/YYYY-07-01.json` the same way. The engine picks the edition by pay date automatically.
6. **Add tests.**
   - Extend `tests/engine/params.test.ts`: add the new edition to the `editions` list so its JSON is cross-checked against its CSVs, and add any sanity figures.
   - Add PDOC fixtures for the new year.
7. **The UI picks up the new year on its own.** The year menu lists every year in the registry and defaults to the newest; shared links to older years keep working. Default term dates follow the selected year.
8. **Re-run the PDOC check.** Run the seed cases through PDOC for the new year (see below), and update the TaxTips cross-check in `tests/engine/annual-taxtips.test.ts` against that year's calculator.

`tests/engine/multiyear.test.ts` proves the pipeline handles a second year with no code changes. It uses clearly-labelled synthetic 2027 data.

### 2027 status

The confirmed 2027 figures, and what's still missing, are kept in [`params/pending/2027.md`](params/pending/2027.md). That file is not loaded by the app. Confirmed so far:

- **EI:** 1.64% on up to $70,800, maximum $1,161.12
- **Base CPP:** 4.75%, down from 4.95%

The YMPE, YAMPE and indexed brackets and amounts are announced in November, and T4127-JAN-2027 follows. Until then the app shows "2027 rates aren't published yet" for any 2027 term.

## Adding a PDOC fixture

Fixtures live in `tests/fixtures/pdoc/*.json`, one paycheque each. `tests/pdoc.test.ts` reports a fixture as **todo** while any `expected` value is `null`. Once every expected value is filled in, the engine must match it **exactly**, with no tolerance. If the fixture also has `pdocNet`, the net pay is checked too.

There are 23 fixtures, all taken from PDOC version 2026-06-11 (retrieved 2026-10-05), and all of them match to the cent, including PDOC's net amount. Together they cover:

- the six seed cases: $20, $30 and $45/hr at 40 h/week, biweekly and monthly, paid 2026-05-15
- weekly, biweekly, semi-monthly and monthly pay, with odd-cent amounts
- incomes from $688/week to $4,000/week: every federal bracket used, the Ontario surtax, and every Ontario Health Premium tier, including the partial tiers
- pay dates on both sides of July 1 (January and July editions)
- year-to-date amounts:
  - CPP and EI both reaching their maximum partway through a cheque
  - CPP already maxed while CPP2 keeps running
- a federal TD1 with $7,000 of tuition added
- the TD1 "income less than claim" box (claim code E):
  - $2,400 biweekly: PDOC still withholds the Ontario Health Premium ($23.08)
  - $700 biweekly: nothing withheld

The seed results:

| Case | Gross | CPP | EI | Federal | Ontario | Net |
|---|---:|---:|---:|---:|---:|---:|
| $20/hr biweekly | 1,600.00 | 87.19 | 26.08 | 111.47 | 67.16 | 1,308.10 |
| $20/hr monthly | 3,466.67 | 188.91 | 56.51 | 241.52 | 145.51 | 2,834.22 |
| $30/hr biweekly | 2,400.00 | 134.79 | 39.12 | 223.20 | 122.74 | 1,880.15 |
| $30/hr monthly | 5,200.00 | 292.05 | 84.76 | 483.61 | 265.93 | 4,073.65 |
| $45/hr biweekly | 3,600.00 | 206.19 | 58.68 | 462.92 | 235.83 | 2,636.38 |
| $45/hr monthly | 7,800.00 | 446.75 | 127.14 | 1,002.99 | 510.96 | 5,712.16 |

To add a case, copy a seed fixture. Give it a new `id`, update `input`, then fill in `expected` from PDOC as follows:

1. Open PDOC at [canada.ca/pdoc](https://www.canada.ca/pdoc) and choose **Salary**.
2. **Step 1:**
   - **Province or territory of employment:** Ontario
   - **Pay period frequency:** for example `Biweekly (26 pay periods a year)` or `Monthly (12 pay periods a year)`
   - **Date the employee is paid:** the fixture's `input.payDate`. Pay dates before July 1 use the January edition; July 1 or later uses the July edition.
3. **Step 2:**
   - **Salary or wages income per pay period:** the fixture's `input.gross`
   - **Vacation pay:** blank
   - **Salary type:** No bonus or retroactive payment
   - Leave every other box unticked.
4. **Step 3:**
   - **Claim type:** TD1 form
     - **Total claim amount from employee's federal Form TD1:** prefilled as `16,452.00` (the 2026 basic personal amount)
     - **Total claim amount from employee's provincial or territorial Form TD1:** prefilled as `12,989.00`
   - For the "income less than claim" box instead: choose **Claim codes**, and pick **No tax (Claim Code E)** in both lists. Read Ontario from the line "Provincial tax deduction with OHP".
   - **CPP:** choose "Year-to-date amount (from your records)"
     - **Number of pensionable months:** `12` (prefilled)
     - **Pensionable earnings year-to-date**, **CPP contributions deducted year-to-date** and **Second additional CPP contributions deducted year-to-date:** leave blank for a first paycheque. PDOC rejects `0.00`; blank means nothing deducted yet. For a later paycheque, enter the fixture's `input.ytd` amounts.
   - **EI:** choose "Year-to-date amount (from your records)"
     - **Insurable earnings year-to-date** and **EI premiums deducted year-to-date:** same rule as CPP.
   - Leave **Requested additional tax deductions** blank and the employer EI rate at `1.4`.
5. Click **Calculate**. Copy these lines from the results into the fixture as dollar strings like `"87.19"`:

   | Fixture field | PDOC result line |
   |---|---|
   | `cpp` | CPP deductions |
   | `cpp2` | CPP2 deductions |
   | `ei` | EI deductions |
   | `federalTax` | Federal tax deduction |
   | `ontarioTax` | Provincial tax deduction |
   | `pdocNet` (optional) | Net amount |

6. Update the fixture's `pdoc` list to match what you entered, and run `npm test`.

## License and disclaimer

This is an estimate for planning, not tax advice. Your actual paycheques depend on your employer's payroll system, and your refund depends on everything on your return.
