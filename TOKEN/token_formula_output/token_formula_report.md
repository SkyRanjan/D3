# Output-token formulas by prompt classification

Source `it_llm_token_budget_dataset_5col_20000.csv`: 20,000 records used (0 dropped for missing or invalid token counts), 12 classifications. Group `prompt_classification`, input `input_tokens`, output `output_tokens`.
Selection rule: a formula must pass the reliability check (never below 0 for inputs of 1 token or more; never more than doubling when the input doubles, up to 10× the longest prompt). Among those, the simplest whose cross-validated RMSE is within 2% of the most accurate is chosen (linear < logarithmic < power < polynomial). 5-fold CV stratified by classification, seed 42.

## 1. Classification Groups

| Classification | Records | % of total | Input tokens min / median / mean / max | Output tokens min / median / mean / max | Mean output/input ratio | Pearson r | Spearman ρ |
|---|---|---|---|---|---|---|---|
| Troubleshooting | 3,666 | 18.3% | 4 / 23 / 30.5 / 108 | 65 / 120 / 150.5 / 662 | 7.06 | 0.812 | 0.719 |
| Developer | 3,617 | 18.1% | 4 / 22 / 28.9 / 105 | 51 / 121 / 151.8 / 773 | 7.20 | 0.803 | 0.712 |
| How-To | 2,420 | 12.1% | 6 / 25 / 31.8 / 105 | 46 / 102 / 131.3 / 555 | 5.21 | 0.797 | 0.717 |
| Descriptive | 1,918 | 9.6% | 4 / 24 / 30.8 / 103 | 61 / 121 / 144.1 / 599 | 6.79 | 0.799 | 0.729 |
| Business | 1,617 | 8.1% | 4 / 27 / 33.1 / 110 | 62 / 111 / 128.7 / 465 | 5.32 | 0.793 | 0.720 |
| Architecture | 1,422 | 7.1% | 4 / 25 / 31.8 / 104 | 58 / 151 / 189.0 / 917 | 7.38 | 0.786 | 0.694 |
| QA | 1,348 | 6.7% | 7 / 26 / 33.0 / 109 | 56 / 129 / 163.6 / 693 | 5.82 | 0.818 | 0.721 |
| DevOps-Cloud | 1,209 | 6.0% | 4 / 23 / 29.1 / 101 | 55 / 120 / 153.1 / 750 | 7.15 | 0.805 | 0.707 |
| Data-SQL | 1,191 | 6.0% | 6 / 27 / 33.8 / 108 | 54 / 111 / 143.9 / 585 | 5.10 | 0.820 | 0.721 |
| Documentation | 808 | 4.0% | 5 / 27 / 33.2 / 105 | 60 / 137 / 174.2 / 722 | 6.51 | 0.800 | 0.703 |
| Analysis-Optimization | 572 | 2.9% | 4 / 24 / 29.7 / 103 | 54 / 130 / 163.6 / 656 | 7.35 | 0.765 | 0.703 |
| Communication | 212 | 1.1% | 7 / 27 / 32.8 / 100 | 56 / 83.5 / 103.8 / 336 | 4.02 | 0.823 | 0.709 |

## 2. Formula Analysis

Formulas are least-squares fits on all records of the class; CV R², MAE and RMSE are measured on held-out records (5-fold cross-validation). Reliability check: the formula must never go below 0 for an input of 1 token or more and must never more than double when the input doubles, checked up to 10× the longest prompt in the class.

### Troubleshooting (3,666 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.3110 × Input + 49.5566 | 0.658 | 36.8 | 51.0 | pass | yes |
| Logarithmic | Output = 71.9252 × ln(Input) - 74.9977 | 0.441 | 48.2 | 65.2 | negative for inputs of 1-3 tokens | no |
| Power | Output = 13.2300 × Input^0.7185 | 0.608 | 40.9 | 54.6 | pass | no |
| Polynomial | Output = 0.03024 × Input² + 0.8852 × Input + 81.5830 | 0.690 | 34.6 | 48.6 | more than doubles when the input doubles, from 37 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 37 input tokens). Input tokens explain 66% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 244 influential records (6.7%, Cook's distance > 4/n). Refit without them: estimate at median input (23) 126 → 123 (-2.0%), at P95 input (72) 288 → 262 (-8.9%); held-out MAE 36.8 → 35.7, RMSE 51.0 → 52.3 (all records scored). Not material; the final formula keeps all records.

### Developer (3,617 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.8537 × Input + 40.5077 | 0.643 | 42.9 | 58.8 | pass | yes |
| Logarithmic | Output = 81.7781 × ln(Input) - 99.9138 | 0.448 | 54.3 | 73.0 | negative for inputs of 1-3 tokens | no |
| Power | Output = 10.6918 × Input^0.7927 | 0.612 | 45.8 | 61.2 | pass | no |
| Polynomial | Output = 0.02788 × Input² + 1.7222 × Input + 67.1187 | 0.660 | 41.5 | 57.3 | more than doubles when the input doubles, from 35 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 35 input tokens). Input tokens explain 64% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 235 influential records (6.5%, Cook's distance > 4/n). Refit without them: estimate at median input (22) 125 → 122 (-2.4%), at P95 input (68) 303 → 275 (-9.1%); held-out MAE 42.9 → 42.1, RMSE 58.8 → 60.0 (all records scored). Not material; the final formula keeps all records.

### How-To (2,420 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.1025 × Input + 32.7811 | 0.635 | 37.4 | 50.6 | pass | yes |
| Logarithmic | Output = 78.7108 × ln(Input) - 121.4371 | 0.473 | 46.0 | 60.7 | negative for inputs of 1-5 tokens | no |
| Power | Output = 8.2525 × Input^0.8039 | 0.609 | 39.6 | 52.3 | pass | no |
| Polynomial | Output = 0.02610 × Input² + 0.9579 × Input + 62.5042 | 0.658 | 35.8 | 48.9 | more than doubles when the input doubles, from 35 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-5 tokens); polynomial (more than doubles when the input doubles, from 35 input tokens). Input tokens explain 63% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 184 influential records (7.6%, Cook's distance > 4/n). Refit without them: estimate at median input (25) 110 → 107 (-2.6%), at P95 input (72) 256 → 231 (-9.6%); held-out MAE 37.4 → 36.8, RMSE 50.6 → 51.9 (all records scored). Not material; the final formula keeps all records.

### Descriptive (1,918 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 2.9352 × Input + 53.8459 | 0.637 | 35.0 | 48.0 | pass | yes |
| Logarithmic | Output = 65.3394 × ln(Input) - 61.0674 | 0.441 | 44.8 | 59.5 | negative for inputs of 1-3 tokens | no |
| Power | Output = 16.1065 × Input^0.6505 | 0.582 | 38.9 | 51.5 | pass | no |
| Polynomial | Output = 0.02443 × Input² + 0.9755 × Input + 79.5484 | 0.662 | 33.4 | 46.3 | more than doubles when the input doubles, from 40 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 40 input tokens). Input tokens explain 64% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 124 influential records (6.5%, Cook's distance > 4/n). Refit without them: estimate at median input (24) 124 → 122 (-1.9%), at P95 input (73) 268 → 247 (-8.0%); held-out MAE 35.0 → 34.2, RMSE 48.0 → 48.9 (all records scored). Not material; the final formula keeps all records.

### Business (1,617 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 2.3308 × Input + 51.6452 | 0.628 | 28.6 | 39.3 | pass | yes |
| Logarithmic | Output = 58.5948 × ln(Input) - 62.0809 | 0.445 | 35.6 | 48.0 | negative for inputs of 1-3 tokens | no |
| Power | Output = 15.5144 × Input^0.6156 | 0.571 | 31.7 | 42.2 | pass | no |
| Polynomial | Output = 0.02196 × Input² + 0.4685 × Input + 78.6567 | 0.658 | 27.2 | 37.7 | more than doubles when the input doubles, from 42 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 42 input tokens). Input tokens explain 63% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 109 influential records (6.7%, Cook's distance > 4/n). Refit without them: estimate at median input (27) 115 → 112 (-1.8%), at P95 input (75) 226 → 210 (-7.3%); held-out MAE 28.6 → 28.1, RMSE 39.3 → 40.0 (all records scored). Not material; the final formula keeps all records.

### Architecture (1,422 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.7282 × Input + 38.6198 | 0.615 | 58.1 | 79.1 | pass | yes |
| Logarithmic | Output = 118.8843 × ln(Input) - 194.2851 | 0.444 | 70.7 | 95.2 | negative for inputs of 1-5 tokens | no |
| Power | Output = 9.5017 × Input^0.8645 | 0.597 | 60.1 | 81.0 | pass | no |
| Polynomial | Output = 0.03200 × Input² + 2.0474 × Input + 77.1316 | 0.631 | 56.0 | 77.6 | more than doubles when the input doubles, from 35 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-5 tokens); polynomial (more than doubles when the input doubles, from 35 input tokens). Input tokens explain 62% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 108 influential records (7.6%, Cook's distance > 4/n). Refit without them: estimate at median input (25) 157 → 152 (-2.8%), at P95 input (72.95) 384 → 343 (-10.5%); held-out MAE 58.1 → 56.9, RMSE 79.1 → 81.2 (all records scored). Material; the final formula keeps all records.

### QA (1,348 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.0848 × Input + 28.8191 | 0.668 | 45.9 | 62.3 | pass | yes |
| Logarithmic | Output = 113.8761 × ln(Input) - 209.2739 | 0.517 | 57.1 | 75.1 | negative for inputs of 1-6 tokens | no |
| Power | Output = 7.3797 × Input^0.8861 | 0.654 | 47.7 | 63.6 | pass | no |
| Polynomial | Output = 0.02996 × Input² + 1.5156 × Input + 66.9326 | 0.686 | 44.3 | 60.5 | more than doubles when the input doubles, from 34 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-6 tokens); polynomial (more than doubles when the input doubles, from 34 input tokens). Input tokens explain 67% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 96 influential records (7.1%, Cook's distance > 4/n). Refit without them: estimate at median input (26) 135 → 132 (-2.4%), at P95 input (76.65) 342 → 312 (-8.7%); held-out MAE 45.9 → 45.2, RMSE 62.3 → 63.6 (all records scored). Not material; the final formula keeps all records.

### DevOps-Cloud (1,209 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.9529 × Input + 38.0684 | 0.645 | 45.4 | 61.9 | pass | yes |
| Logarithmic | Output = 86.4186 × ln(Input) - 113.1142 | 0.445 | 58.4 | 77.5 | negative for inputs of 1-4 tokens | no |
| Power | Output = 9.5207 × Input^0.8254 | 0.616 | 48.4 | 64.4 | pass | no |
| Polynomial | Output = 0.03311 × Input² + 1.3457 × Input + 71.0780 | 0.670 | 43.0 | 59.7 | more than doubles when the input doubles, from 33 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-4 tokens); polynomial (more than doubles when the input doubles, from 33 input tokens). Input tokens explain 65% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 87 influential records (7.2%, Cook's distance > 4/n). Refit without them: estimate at median input (23) 129 → 125 (-2.8%), at P95 input (70.6) 317 → 282 (-11.1%); held-out MAE 45.4 → 44.3, RMSE 61.9 → 63.8 (all records scored). Material; the final formula keeps all records.

### Data-SQL (1,191 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.4619 × Input + 26.8357 | 0.671 | 38.8 | 52.6 | pass | yes |
| Logarithmic | Output = 94.3278 × ln(Input) - 167.7547 | 0.490 | 49.6 | 65.5 | negative for inputs of 1-6 tokens | no |
| Power | Output = 6.2326 × Input^0.8900 | 0.653 | 40.7 | 54.0 | pass | no |
| Polynomial | Output = 0.03087 × Input² + 0.7652 × Input + 68.1647 | 0.702 | 36.1 | 50.1 | more than doubles when the input doubles, from 34 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-6 tokens); polynomial (more than doubles when the input doubles, from 34 input tokens). Input tokens explain 67% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 84 influential records (7.1%, Cook's distance > 4/n). Refit without them: estimate at median input (27) 120 → 118 (-2.3%), at P95 input (77) 293 → 266 (-9.3%); held-out MAE 38.8 → 37.7, RMSE 52.6 → 54.0 (all records scored). Not material; the final formula keeps all records.

### Documentation (808 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.1675 × Input + 35.9274 | 0.638 | 52.0 | 68.7 | pass | yes |
| Logarithmic | Output = 107.7624 × ln(Input) - 177.7345 | 0.459 | 64.5 | 84.0 | negative for inputs of 1-5 tokens | no |
| Power | Output = 8.1951 × Input^0.8717 | 0.616 | 54.5 | 70.7 | pass | no |
| Polynomial | Output = 0.04044 × Input² + 0.6979 × Input + 87.0764 | 0.672 | 48.8 | 65.4 | more than doubles when the input doubles, from 33 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-5 tokens); polynomial (more than doubles when the input doubles, from 33 input tokens). Input tokens explain 64% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 64 influential records (7.9%, Cook's distance > 4/n). Refit without them: estimate at median input (27) 148 → 145 (-2.1%), at P95 input (77) 357 → 327 (-8.3%); held-out MAE 52.0 → 51.6, RMSE 68.7 → 69.7 (all records scored). Not material; the final formula keeps all records.

### Analysis-Optimization (572 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.0039 × Input + 44.6457 | 0.583 | 49.9 | 67.1 | pass | yes |
| Logarithmic | Output = 86.1721 × ln(Input) - 106.1053 | 0.415 | 59.8 | 79.5 | negative for inputs of 1-3 tokens | no |
| Power | Output = 12.0256 × Input^0.7746 | 0.553 | 53.0 | 69.4 | pass | no |
| Polynomial | Output = 0.02222 × Input² + 2.3248 × Input + 66.1519 | 0.587 | 48.9 | 66.8 | more than doubles when the input doubles, from 39 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 39 input tokens). Input tokens explain 58% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 36 influential records (6.3%, Cook's distance > 4/n). Refit without them: estimate at median input (24) 141 → 138 (-1.8%), at P95 input (68) 317 → 300 (-5.3%); held-out MAE 49.9 → 49.3, RMSE 67.1 → 67.4 (all records scored). Not material; the final formula keeps all records.

### Communication (212 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 1.9841 × Input + 38.7861 | 0.669 | 21.4 | 28.7 | pass | yes |
| Logarithmic | Output = 52.5883 × ln(Input) - 68.8604 | 0.482 | 27.0 | 35.9 | negative for inputs of 1-4 tokens | no |
| Power | Output = 10.7304 × Input^0.6586 | 0.608 | 24.2 | 31.2 | pass | no |
| Polynomial | Output = 0.02811 × Input² - 0.3805 × Input + 74.0694 | 0.720 | 17.8 | 26.4 | more than doubles when the input doubles, from 37 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-4 tokens); polynomial (more than doubles when the input doubles, from 37 input tokens). Input tokens explain 67% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 18 influential records (8.5%, Cook's distance > 4/n). Refit without them: estimate at median input (27) 92 → 90 (-2.9%), at P95 input (73) 184 → 155 (-15.4%); held-out MAE 21.4 → 20.0, RMSE 28.7 → 31.2 (all records scored). Material; the final formula keeps all records.

## 3. Final Classification → Formula Mapping

| Classification | Samples | Formula | R² | MAE | RMSE | Notes |
|---|---|---|---|---|---|---|
| Troubleshooting | 3,666 | Output = 3.3110 × Input + 49.5566 | 0.658 | 36.8 | 51.0 | - |
| Developer | 3,617 | Output = 3.8537 × Input + 40.5077 | 0.643 | 42.9 | 58.8 | - |
| How-To | 2,420 | Output = 3.1025 × Input + 32.7811 | 0.635 | 37.4 | 50.6 | - |
| Descriptive | 1,918 | Output = 2.9352 × Input + 53.8459 | 0.637 | 35.0 | 48.0 | - |
| Business | 1,617 | Output = 2.3308 × Input + 51.6452 | 0.628 | 28.6 | 39.3 | - |
| Architecture | 1,422 | Output = 4.7282 × Input + 38.6198 | 0.615 | 58.1 | 79.1 | sensitive to influential records: refitting without 108 of them (7.6%) moves the estimate at median/P95 input by -2.8%/-10.5%; all records retained |
| QA | 1,348 | Output = 4.0848 × Input + 28.8191 | 0.668 | 45.9 | 62.3 | - |
| DevOps-Cloud | 1,209 | Output = 3.9529 × Input + 38.0684 | 0.645 | 45.4 | 61.9 | sensitive to influential records: refitting without 87 of them (7.2%) moves the estimate at median/P95 input by -2.8%/-11.1%; all records retained |
| Data-SQL | 1,191 | Output = 3.4619 × Input + 26.8357 | 0.671 | 38.8 | 52.6 | - |
| Documentation | 808 | Output = 4.1675 × Input + 35.9274 | 0.638 | 52.0 | 68.7 | - |
| Analysis-Optimization | 572 | Output = 4.0039 × Input + 44.6457 | 0.583 | 49.9 | 67.1 | - |
| Communication | 212 | Output = 1.9841 × Input + 38.7861 | 0.669 | 21.4 | 28.7 | sensitive to influential records: refitting without 18 of them (8.5%) moves the estimate at median/P95 input by -2.9%/-15.4%; all records retained |

R², MAE and RMSE are cross-validated (held-out records). The formulas give estimates, not exact counts: expect a single prompt to be off by roughly the MAE.

**Calibrated range:** input tokens 4-110. Every final formula passed the reliability check (never below 0 for inputs of 1 token or more; doubling the input at most doubles the estimate, checked up to 10× the longest prompt), so estimates for longer prompts grow at most in proportion to the input. They are still extrapolations.

**Statistically similar classifications** (final formulas within ±10% of each other across their shared P5-P95 input range; kept separate because the application classifies by these labels):
- Troubleshooting ≈ Descriptive: largest gap 8.2% over input 5-72 tokens
- Developer ≈ DevOps-Cloud: largest gap 3.3% over input 5-68 tokens
- Developer ≈ Documentation: largest gap 5.4% over input 8-68 tokens
- Developer ≈ Analysis-Optimization: largest gap 7.9% over input 5-68 tokens
- How-To ≈ Data-SQL: largest gap 7.5% over input 8-72 tokens
- DevOps-Cloud ≈ Documentation: largest gap 4.0% over input 8-70.6 tokens

**Classification-specific vs one global formula** (same held-out records, n = 20,000): per-class formulas MAE 40.7, RMSE 56.5, R² 0.652; single global linear formula (Output = 3.4721 × Input + 42.3777) MAE 43.4, RMSE 60.5, R² 0.600.

## 4. Implementation-Ready Formula Registry

Saved as `formula_registry.json`. Parameters per `formula_type` (x = input tokens): constant `c`; linear `a*x + b`; logarithmic `a*ln(x) + b`; power `a*x^b`; polynomial `a*x^2 + b*x + c`.

```json
{
  "Troubleshooting": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.31104,
      "b": 49.5566
    },
    "expression": "3.3110 * input_tokens + 49.5566",
    "samples": 3666,
    "input_range": [
      4,
      108
    ],
    "cv_metrics": {
      "r2": 0.658,
      "mae": 36.836,
      "rmse": 50.9954
    },
    "notes": []
  },
  "Developer": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.8537,
      "b": 40.5077
    },
    "expression": "3.8537 * input_tokens + 40.5077",
    "samples": 3617,
    "input_range": [
      4,
      105
    ],
    "cv_metrics": {
      "r2": 0.6427,
      "mae": 42.9059,
      "rmse": 58.7562
    },
    "notes": []
  },
  "How-To": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.10254,
      "b": 32.7811
    },
    "expression": "3.1025 * input_tokens + 32.7811",
    "samples": 2420,
    "input_range": [
      6,
      105
    ],
    "cv_metrics": {
      "r2": 0.6346,
      "mae": 37.4121,
      "rmse": 50.5841
    },
    "notes": []
  },
  "Descriptive": {
    "formula_type": "linear",
    "parameters": {
      "a": 2.93516,
      "b": 53.8459
    },
    "expression": "2.9352 * input_tokens + 53.8459",
    "samples": 1918,
    "input_range": [
      4,
      103
    ],
    "cv_metrics": {
      "r2": 0.6371,
      "mae": 34.9682,
      "rmse": 47.9575
    },
    "notes": []
  },
  "Business": {
    "formula_type": "linear",
    "parameters": {
      "a": 2.33084,
      "b": 51.6452
    },
    "expression": "2.3308 * input_tokens + 51.6452",
    "samples": 1617,
    "input_range": [
      4,
      110
    ],
    "cv_metrics": {
      "r2": 0.6279,
      "mae": 28.5831,
      "rmse": 39.3118
    },
    "notes": []
  },
  "Architecture": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.72824,
      "b": 38.6198
    },
    "expression": "4.7282 * input_tokens + 38.6198",
    "samples": 1422,
    "input_range": [
      4,
      104
    ],
    "cv_metrics": {
      "r2": 0.6155,
      "mae": 58.0968,
      "rmse": 79.1387
    },
    "notes": [
      "sensitive to influential records: refitting without 108 of them (7.6%) moves the estimate at median/P95 input by -2.8%/-10.5%; all records retained"
    ]
  },
  "QA": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.08481,
      "b": 28.8191
    },
    "expression": "4.0848 * input_tokens + 28.8191",
    "samples": 1348,
    "input_range": [
      7,
      109
    ],
    "cv_metrics": {
      "r2": 0.668,
      "mae": 45.8764,
      "rmse": 62.2763
    },
    "notes": []
  },
  "DevOps-Cloud": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.95287,
      "b": 38.0684
    },
    "expression": "3.9529 * input_tokens + 38.0684",
    "samples": 1209,
    "input_range": [
      4,
      101
    ],
    "cv_metrics": {
      "r2": 0.6454,
      "mae": 45.395,
      "rmse": 61.9013
    },
    "notes": [
      "sensitive to influential records: refitting without 87 of them (7.2%) moves the estimate at median/P95 input by -2.8%/-11.1%; all records retained"
    ]
  },
  "Data-SQL": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.46193,
      "b": 26.8357
    },
    "expression": "3.4619 * input_tokens + 26.8357",
    "samples": 1191,
    "input_range": [
      6,
      108
    ],
    "cv_metrics": {
      "r2": 0.6711,
      "mae": 38.7946,
      "rmse": 52.5955
    },
    "notes": []
  },
  "Documentation": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.16746,
      "b": 35.9274
    },
    "expression": "4.1675 * input_tokens + 35.9274",
    "samples": 808,
    "input_range": [
      5,
      105
    ],
    "cv_metrics": {
      "r2": 0.6381,
      "mae": 52.0386,
      "rmse": 68.6795
    },
    "notes": []
  },
  "Analysis-Optimization": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.00386,
      "b": 44.6457
    },
    "expression": "4.0039 * input_tokens + 44.6457",
    "samples": 572,
    "input_range": [
      4,
      103
    ],
    "cv_metrics": {
      "r2": 0.5825,
      "mae": 49.9035,
      "rmse": 67.1169
    },
    "notes": []
  },
  "Communication": {
    "formula_type": "linear",
    "parameters": {
      "a": 1.98407,
      "b": 38.7861
    },
    "expression": "1.9841 * input_tokens + 38.7861",
    "samples": 212,
    "input_range": [
      7,
      100
    ],
    "cv_metrics": {
      "r2": 0.6686,
      "mae": 21.4003,
      "rmse": 28.6957
    },
    "notes": [
      "sensitive to influential records: refitting without 18 of them (8.5%) moves the estimate at median/P95 input by -2.9%/-15.4%; all records retained"
    ]
  }
}
```

Evaluator for the web app:

```js
// estimateOutputTokens(registry, "<classification>", inputTokens) -> estimated output tokens
// Calibrated for f.input_range; outside it the estimate is an extrapolation.
function estimateOutputTokens(registry, classification, inputTokens) {
  const f = registry[classification];
  if (!f) throw new Error(`No formula for classification "${classification}"`);
  const p = f.parameters;
  const x = Math.max(inputTokens, 1);
  const y = {
    constant: () => p.c,
    linear: () => p.a * x + p.b,
    logarithmic: () => p.a * Math.log(x) + p.b, // natural log
    power: () => p.a * Math.pow(x, p.b),
    polynomial: () => p.a * x * x + p.b * x + p.c,
  }[f.formula_type]();
  return Math.round(y);
}
```
