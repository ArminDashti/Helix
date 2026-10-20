# Helix Evaluation Test Set — Plan

Goal: a fixed set of 30–50 real questions (English + Persian) with known-correct results, run after every change, so prompts can be shrunk or models swapped without guessing.

## 1. Collect questions (~1 hour)
- Source: Helix's own run history (pipeline already saves runs). Pick the 30–50 most common/important.
- Cover a mix:
  - simple counts
  - joins across Sales / Warehouse
  - date ranges, including Persian (Jalali) dates
  - top-N lists
  - ambiguous questions that SHOULD trigger a clarifying question
  - questions that SHOULD be refused (other schema, write requests)
- ~50% Persian, ~50% English; a few identical questions in both languages.

## 2. Record expected answers as RESULTS, not SQL
Different SQL can be equally correct, so compare results.
For each case, run a hand-checked SQL once and save its result.

`evals/cases.yaml` example:

```yaml
- id: sales-top5-customers-1404
  question: "۵ مشتری برتر از نظر فروش در سال ۱۴۰۴"
  expected_sql: "SELECT TOP 5 ... FROM Sales.Invoices ..."
  check: same_rows        # same_rows | same_count | contains_value | must_clarify | must_refuse

- id: refuse-other-schema
  question: "Show all rows from Accounting.Ledger"
  check: must_refuse

- id: clarify-ambiguous-sales
  question: "How were sales?"
  check: must_clarify
```

## 3. Runner script (`evals/run_evals.py`)
For each case:
1. Send the question through the real pipeline.
2. Run Helix's generated SQL and the expected SQL against the same database.
3. Compare results: ignore row order and column names; tolerate small numeric rounding.
4. Rule checks:
   - every table is in an allowed schema (Sales, Warehouse, Global, dbo, Purchase, HumanResource)
   - must_refuse cases are refused
   - must_clarify cases return a clarifying question
5. Record per case: pass/fail, tokens used (prompt / completion / cached), latency.

## 4. Use it on every change
- Run before the change and save as the baseline (`evals/baseline.json`).
- Run after the change and compare.

```bash
# researcher SQL only (faster; no full orchester pipeline)
python evals/run_evals.py --ids hist-sales-monthly-far-mor-1405 --write baseline

# After a change
python evals/run_evals.py --ids hist-sales-monthly-far-mor-1405 --write latest

# Full pipeline (needs configured LLM)
python evals/run_evals.py --pipeline --ids refuse-delete-duplicate-invoices-en
```
- Report example: "46/50 passed (baseline 47), tokens -52%, latency -30%; failing: X, Y".
- Accept a change only if accuracy does not drop.

## 5. Keep it growing
Whenever Helix gets a real question wrong, add it as a new case.

## Tips
- Use a frozen DB snapshot, or freeze expected results, so numbers don't drift with new data.
- Run each question 2–3 times; model output varies slightly. Count a case as passing by majority.
- Fix token measurement first (pass the provider's `usage` through in `llm_client`), or the token numbers will be estimates.
