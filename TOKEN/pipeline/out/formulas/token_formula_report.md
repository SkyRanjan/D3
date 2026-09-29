# Output-token formulas by prompt classification

Source `dataset_o200k_base.csv`: 20,000 records used (0 dropped for missing or invalid token counts), 12 classifications. Group `prompt_classification`, input `input_tokens`, output `output_tokens`.
Selection rule: a formula must pass the reliability check (never below 0 for inputs of 1 token or more; never more than doubling when the input doubles, up to 10× the longest prompt). Among those, the simplest whose cross-validated RMSE is within 2% of the most accurate is chosen (linear < logarithmic < power < polynomial). 5-fold CV stratified by classification, seed 42.

## 1. Classification Groups

| Classification | Records | % of total | Input tokens min / median / mean / max | Output tokens min / median / mean / max | Mean output/input ratio | Pearson r | Spearman ρ |
|---|---|---|---|---|---|---|---|
| Troubleshooting | 3,666 | 18.3% | 3 / 19 / 24.7 / 83 | 54 / 97 / 120.8 / 515 | 6.72 | 0.802 | 0.716 |
| Developer | 3,617 | 18.1% | 3 / 19 / 23.1 / 83 | 44 / 98 / 122.1 / 585 | 7.19 | 0.789 | 0.708 |
| How-To | 2,420 | 12.1% | 5 / 21 / 26.0 / 84 | 41 / 85 / 107.6 / 440 | 5.03 | 0.784 | 0.712 |
| Descriptive | 1,918 | 9.6% | 3 / 20 / 24.6 / 84 | 49 / 97 / 114.4 / 460 | 6.45 | 0.788 | 0.730 |
| Business | 1,617 | 8.1% | 3 / 22 / 26.2 / 86 | 45 / 83 / 95.3 / 355 | 4.91 | 0.781 | 0.719 |
| Architecture | 1,422 | 7.1% | 3 / 21 / 25.2 / 84 | 46 / 118 / 147.0 / 705 | 7.25 | 0.774 | 0.692 |
| QA | 1,348 | 6.7% | 6 / 22 / 26.5 / 83 | 40 / 98 / 124.4 / 523 | 5.41 | 0.806 | 0.713 |
| DevOps-Cloud | 1,209 | 6.0% | 3 / 18 / 23.0 / 81 | 45 / 94 / 119.2 / 571 | 6.85 | 0.799 | 0.707 |
| Data-SQL | 1,191 | 6.0% | 5 / 23 / 27.4 / 86 | 46 / 92 / 116.9 / 456 | 5.01 | 0.807 | 0.716 |
| Documentation | 808 | 4.0% | 3 / 23 / 26.8 / 84 | 44 / 103 / 131.2 / 546 | 6.02 | 0.781 | 0.694 |
| Analysis-Optimization | 572 | 2.9% | 3 / 20 / 23.8 / 80 | 43 / 101 / 127.1 / 497 | 6.81 | 0.753 | 0.701 |
| Communication | 212 | 1.1% | 6 / 22 / 26.2 / 78 | 47 / 68 / 83.3 / 254 | 3.93 | 0.811 | 0.695 |

## 2. Formula Analysis

Formulas are least-squares fits on all records of the class; CV R², MAE and RMSE are measured on held-out records (5-fold cross-validation). Reliability check: the formula must never go below 0 for an input of 1 token or more and must never more than double when the input doubles, checked up to 10× the longest prompt in the class.

### Troubleshooting (3,666 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.2987 × Input + 39.1285 | 0.641 | 29.5 | 40.6 | pass | yes |
| Logarithmic | Output = 58.1731 × ln(Input) - 51.0506 | 0.431 | 38.1 | 51.2 | negative for inputs of 1-2 tokens | no |
| Power | Output = 12.0235 × Input^0.7253 | 0.592 | 32.6 | 43.3 | pass | no |
| Polynomial | Output = 0.03923 × Input² + 0.7961 × Input + 66.3707 | 0.675 | 27.8 | 38.7 | more than doubles when the input doubles, from 29 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-2 tokens); polynomial (more than doubles when the input doubles, from 29 input tokens). Input tokens explain 64% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 241 influential records (6.6%, Cook's distance > 4/n). Refit without them: estimate at median input (19) 102 → 100 (-2.1%), at P95 input (56) 224 → 203 (-9.2%); held-out MAE 29.5 → 28.6, RMSE 40.6 → 41.7 (all records scored). Not material; the final formula keeps all records.

### Developer (3,617 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.7818 × Input + 34.5689 | 0.621 | 34.3 | 46.8 | pass | yes |
| Logarithmic | Output = 63.2199 × ln(Input) - 59.4932 | 0.429 | 42.9 | 57.3 | negative for inputs of 1-3 tokens | no |
| Power | Output = 10.9402 × Input^0.7727 | 0.586 | 36.8 | 48.8 | pass | no |
| Polynomial | Output = 0.03427 × Input² + 1.7123 × Input + 55.5116 | 0.638 | 33.2 | 45.7 | more than doubles when the input doubles, from 29 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 29 input tokens). Input tokens explain 62% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 225 influential records (6.2%, Cook's distance > 4/n). Refit without them: estimate at median input (19) 106 → 103 (-3.2%), at P95 input (53) 235 → 212 (-9.6%); held-out MAE 34.3 → 33.7, RMSE 46.8 → 47.9 (all records scored). Not material; the final formula keeps all records.

### How-To (2,420 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.0753 × Input + 27.6279 | 0.614 | 30.0 | 40.3 | pass | yes |
| Logarithmic | Output = 65.3360 × ln(Input) - 91.2127 | 0.466 | 36.0 | 47.5 | negative for inputs of 1-4 tokens | no |
| Power | Output = 8.2814 × Input^0.7914 | 0.590 | 31.5 | 41.6 | pass | no |
| Polynomial | Output = 0.03137 × Input² + 0.9958 × Input + 51.8861 | 0.636 | 28.9 | 39.2 | more than doubles when the input doubles, from 29 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-4 tokens); polynomial (more than doubles when the input doubles, from 29 input tokens). Input tokens explain 61% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 182 influential records (7.5%, Cook's distance > 4/n). Refit without them: estimate at median input (21) 92 → 90 (-2.8%), at P95 input (57.05) 203 → 184 (-9.3%); held-out MAE 30.0 → 29.5, RMSE 40.3 → 41.3 (all records scored). Not material; the final formula keeps all records.

### Descriptive (1,918 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 2.9076 × Input + 42.9130 | 0.620 | 27.9 | 38.1 | pass | yes |
| Logarithmic | Output = 53.3508 × ln(Input) - 42.4935 | 0.440 | 34.9 | 46.2 | negative for inputs of 1-2 tokens | no |
| Power | Output = 14.9132 × Input^0.6475 | 0.569 | 30.7 | 40.5 | pass | no |
| Polynomial | Output = 0.02765 × Input² + 1.1438 × Input + 61.8400 | 0.640 | 27.0 | 37.0 | more than doubles when the input doubles, from 34 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-2 tokens); polynomial (more than doubles when the input doubles, from 34 input tokens). Input tokens explain 62% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 125 influential records (6.5%, Cook's distance > 4/n). Refit without them: estimate at median input (20) 101 → 99 (-2.2%), at P95 input (56.15) 206 → 191 (-7.5%); held-out MAE 27.9 → 27.5, RMSE 38.1 → 38.7 (all records scored). Not material; the final formula keeps all records.

### Business (1,617 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 2.2508 × Input + 36.2669 | 0.609 | 22.4 | 30.7 | pass | yes |
| Logarithmic | Output = 43.9747 × ln(Input) - 38.0144 | 0.424 | 27.5 | 37.2 | negative for inputs of 1-2 tokens | no |
| Power | Output = 12.0233 × Input^0.6437 | 0.555 | 24.6 | 32.7 | pass | no |
| Polynomial | Output = 0.02608 × Input² + 0.5077 × Input + 56.5065 | 0.637 | 21.2 | 29.5 | more than doubles when the input doubles, from 33 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-2 tokens); polynomial (more than doubles when the input doubles, from 33 input tokens). Input tokens explain 61% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 106 influential records (6.6%, Cook's distance > 4/n). Refit without them: estimate at median input (22) 86 → 84 (-2.5%), at P95 input (59) 169 → 155 (-8.5%); held-out MAE 22.4 → 22.0, RMSE 30.7 → 31.3 (all records scored). Not material; the final formula keeps all records.

### Architecture (1,422 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.6626 × Input + 29.5941 | 0.597 | 45.9 | 62.3 | pass | yes |
| Logarithmic | Output = 90.6469 × ln(Input) - 124.9684 | 0.423 | 55.5 | 74.6 | negative for inputs of 1-4 tokens | no |
| Power | Output = 8.8433 × Input^0.8708 | 0.579 | 47.5 | 63.7 | pass | no |
| Polynomial | Output = 0.03942 × Input² + 2.0777 × Input + 59.2204 | 0.612 | 44.3 | 61.2 | more than doubles when the input doubles, from 28 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-4 tokens); polynomial (more than doubles when the input doubles, from 28 input tokens). Input tokens explain 60% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 102 influential records (7.2%, Cook's distance > 4/n). Refit without them: estimate at median input (21) 128 → 123 (-3.8%), at P95 input (56) 291 → 259 (-10.7%); held-out MAE 45.9 → 44.9, RMSE 62.3 → 64.0 (all records scored). Material; the final formula keeps all records.

### QA (1,348 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 4.0350 × Input + 17.6021 | 0.648 | 36.9 | 49.6 | pass | yes |
| Logarithmic | Output = 88.9226 × ln(Input) - 148.4158 | 0.497 | 45.5 | 59.3 | negative for inputs of 1-5 tokens | no |
| Power | Output = 5.8385 × Input^0.9308 | 0.638 | 38.1 | 50.3 | pass | yes |
| Polynomial | Output = 0.03890 × Input² + 1.3990 × Input + 49.2575 | 0.668 | 35.7 | 48.2 | more than doubles when the input doubles, from 25 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-5 tokens); polynomial (more than doubles when the input doubles, from 25 input tokens). Input tokens explain 65% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 101 influential records (7.5%, Cook's distance > 4/n). Refit without them: estimate at median input (22) 106 → 103 (-3.1%), at P95 input (60) 260 → 237 (-8.9%); held-out MAE 36.9 → 36.5, RMSE 49.6 → 50.6 (all records scored). Not material; the final formula keeps all records.

### DevOps-Cloud (1,209 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.8955 × Input + 29.5709 | 0.636 | 35.1 | 47.8 | pass | yes |
| Logarithmic | Output = 68.2490 × ln(Input) - 76.2957 | 0.444 | 44.7 | 59.1 | negative for inputs of 1-3 tokens | no |
| Power | Output = 9.1014 × Input^0.8222 | 0.609 | 37.3 | 49.6 | pass | no |
| Polynomial | Output = 0.03823 × Input² + 1.5274 × Input + 53.7250 | 0.657 | 33.4 | 46.4 | more than doubles when the input doubles, from 27 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 27 input tokens). Input tokens explain 64% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 87 influential records (7.2%, Cook's distance > 4/n). Refit without them: estimate at median input (18) 100 → 97 (-2.8%), at P95 input (55) 244 → 216 (-11.4%); held-out MAE 35.1 → 34.2, RMSE 47.8 → 49.3 (all records scored). Material; the final formula keeps all records.

### Data-SQL (1,191 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.4248 × Input + 22.9474 | 0.650 | 31.2 | 42.1 | pass | yes |
| Logarithmic | Output = 76.7722 × ln(Input) - 122.3687 | 0.481 | 39.0 | 51.3 | negative for inputs of 1-5 tokens | no |
| Power | Output = 6.4837 × Input^0.8729 | 0.632 | 32.8 | 43.2 | pass | no |
| Polynomial | Output = 0.03634 × Input² + 0.8798 × Input + 55.1897 | 0.677 | 29.3 | 40.5 | more than doubles when the input doubles, from 28 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-5 tokens); polynomial (more than doubles when the input doubles, from 28 input tokens). Input tokens explain 65% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 85 influential records (7.1%, Cook's distance > 4/n). Refit without them: estimate at median input (23) 102 → 99 (-2.9%), at P95 input (61) 232 → 210 (-9.2%); held-out MAE 31.2 → 30.3, RMSE 42.1 → 43.2 (all records scored). Not material; the final formula keeps all records.

### Documentation (808 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.9821 × Input + 24.3423 | 0.607 | 41.7 | 54.7 | pass | yes |
| Logarithmic | Output = 80.6976 × ln(Input) - 116.1445 | 0.426 | 50.7 | 66.1 | negative for inputs of 1-4 tokens | no |
| Power | Output = 6.6350 × Input^0.9037 | 0.589 | 43.2 | 56.0 | pass | no |
| Polynomial | Output = 0.04878 × Input² + 0.6472 × Input + 64.4076 | 0.642 | 38.9 | 52.2 | more than doubles when the input doubles, from 26 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-4 tokens); polynomial (more than doubles when the input doubles, from 26 input tokens). Input tokens explain 61% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 65 influential records (8.0%, Cook's distance > 4/n). Refit without them: estimate at median input (23) 116 → 112 (-3.0%), at P95 input (61) 267 → 243 (-9.1%); held-out MAE 41.7 → 41.1, RMSE 54.7 → 55.6 (all records scored). Not material; the final formula keeps all records.

### Analysis-Optimization (572 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 3.9381 × Input + 33.2993 | 0.564 | 39.3 | 52.5 | pass | yes |
| Logarithmic | Output = 69.5852 × ln(Input) - 77.1248 | 0.410 | 46.3 | 61.1 | negative for inputs of 1-3 tokens | no |
| Power | Output = 10.7315 × Input^0.7843 | 0.538 | 41.4 | 54.1 | pass | no |
| Polynomial | Output = 0.02680 × Input² + 2.3342 × Input + 50.0957 | 0.567 | 38.6 | 52.3 | more than doubles when the input doubles, from 31 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 31 input tokens). Input tokens explain 56% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 32 influential records (5.6%, Cook's distance > 4/n). Refit without them: estimate at median input (20) 112 → 110 (-2.1%), at P95 input (52) 238 → 223 (-6.2%); held-out MAE 39.3 → 38.7, RMSE 52.5 → 52.9 (all records scored). Not material; the final formula keeps all records.

### Communication (212 records)

| Model | Formula | CV R² | CV MAE | CV RMSE | Reliability check | Within 2% of best eligible RMSE |
|---|---|---|---|---|---|---|
| **Linear** (selected) | Output = 1.9590 × Input + 31.9685 | 0.648 | 16.9 | 22.6 | pass | yes |
| Logarithmic | Output = 42.1551 × ln(Input) - 46.5655 | 0.475 | 20.8 | 27.6 | negative for inputs of 1-3 tokens | no |
| Power | Output = 10.4484 × Input^0.6442 | 0.590 | 18.9 | 24.4 | pass | no |
| Polynomial | Output = 0.03514 × Input² - 0.3681 × Input + 60.1155 | 0.694 | 14.2 | 21.0 | more than doubles when the input doubles, from 29 input tokens | no |

**Selected: linear**, the most accurate formula that passes the reliability check. Failed the reliability check: logarithmic (negative for inputs of 1-3 tokens); polynomial (more than doubles when the input doubles, from 29 input tokens). Input tokens explain 65% of output-token variance on held-out records, so an input-based formula is justified.

Outliers: 19 influential records (9.0%, Cook's distance > 4/n). Refit without them: estimate at median input (22) 75 → 73 (-3.3%), at P95 input (58) 146 → 122 (-16.5%); held-out MAE 16.9 → 15.8, RMSE 22.6 → 24.8 (all records scored). Material; the final formula keeps all records.

## 3. Final Classification → Formula Mapping

| Classification | Samples | Formula | R² | MAE | RMSE | Notes |
|---|---|---|---|---|---|---|
| Troubleshooting | 3,666 | Output = 3.2987 × Input + 39.1285 | 0.641 | 29.5 | 40.6 | - |
| Developer | 3,617 | Output = 3.7818 × Input + 34.5689 | 0.621 | 34.3 | 46.8 | - |
| How-To | 2,420 | Output = 3.0753 × Input + 27.6279 | 0.614 | 30.0 | 40.3 | - |
| Descriptive | 1,918 | Output = 2.9076 × Input + 42.9130 | 0.620 | 27.9 | 38.1 | - |
| Business | 1,617 | Output = 2.2508 × Input + 36.2669 | 0.609 | 22.4 | 30.7 | - |
| Architecture | 1,422 | Output = 4.6626 × Input + 29.5941 | 0.597 | 45.9 | 62.3 | sensitive to influential records: refitting without 102 of them (7.2%) moves the estimate at median/P95 input by -3.8%/-10.7%; all records retained |
| QA | 1,348 | Output = 4.0350 × Input + 17.6021 | 0.648 | 36.9 | 49.6 | - |
| DevOps-Cloud | 1,209 | Output = 3.8955 × Input + 29.5709 | 0.636 | 35.1 | 47.8 | sensitive to influential records: refitting without 87 of them (7.2%) moves the estimate at median/P95 input by -2.8%/-11.4%; all records retained |
| Data-SQL | 1,191 | Output = 3.4248 × Input + 22.9474 | 0.650 | 31.2 | 42.1 | - |
| Documentation | 808 | Output = 3.9821 × Input + 24.3423 | 0.607 | 41.7 | 54.7 | - |
| Analysis-Optimization | 572 | Output = 3.9381 × Input + 33.2993 | 0.564 | 39.3 | 52.5 | - |
| Communication | 212 | Output = 1.9590 × Input + 31.9685 | 0.648 | 16.9 | 22.6 | sensitive to influential records: refitting without 19 of them (9.0%) moves the estimate at median/P95 input by -3.3%/-16.5%; all records retained |

R², MAE and RMSE are cross-validated (held-out records). The formulas give estimates, not exact counts: expect a single prompt to be off by roughly the MAE.

**Calibrated range:** input tokens 3-86. Every final formula passed the reliability check (never below 0 for inputs of 1 token or more; doubling the input at most doubles the estimate, checked up to 10× the longest prompt), so estimates for longer prompts grow at most in proportion to the input. They are still extrapolations.

**Statistically similar classifications** (final formulas within ±10% of each other across their shared P5-P95 input range; kept separate because the application classifies by these labels):
- Troubleshooting ≈ Developer: largest gap 9.4% over input 4-53 tokens
- Troubleshooting ≈ Descriptive: largest gap 8.4% over input 5-56 tokens
- Developer ≈ DevOps-Cloud: largest gap 9.6% over input 4-53 tokens
- Developer ≈ Analysis-Optimization: largest gap 2.9% over input 5-52 tokens
- How-To ≈ Data-SQL: largest gap 7.2% over input 8-57.05 tokens
- DevOps-Cloud ≈ Documentation: largest gap 8.5% over input 7-55 tokens
- DevOps-Cloud ≈ Analysis-Optimization: largest gap 7.7% over input 5-52 tokens

**Classification-specific vs one global formula** (same held-out records, n = 20,000): per-class formulas MAE 32.5, RMSE 44.7, R² 0.632; single global linear formula (Output = 3.4071 × Input + 33.5917) MAE 34.6, RMSE 47.8, R² 0.580.

## 4. Implementation-Ready Formula Registry

Saved as `formula_registry.json`. Parameters per `formula_type` (x = input tokens): constant `c`; linear `a*x + b`; logarithmic `a*ln(x) + b`; power `a*x^b`; polynomial `a*x^2 + b*x + c`.

```json
{
  "Troubleshooting": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.29869,
      "b": 39.1285
    },
    "expression": "3.2987 * input_tokens + 39.1285",
    "samples": 3666,
    "input_range": [
      3,
      83
    ],
    "cv_metrics": {
      "r2": 0.6414,
      "mae": 29.537,
      "rmse": 40.6356
    },
    "notes": []
  },
  "Developer": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.78184,
      "b": 34.5689
    },
    "expression": "3.7818 * input_tokens + 34.5689",
    "samples": 3617,
    "input_range": [
      3,
      83
    ],
    "cv_metrics": {
      "r2": 0.6205,
      "mae": 34.3351,
      "rmse": 46.7589
    },
    "notes": []
  },
  "How-To": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.07525,
      "b": 27.6279
    },
    "expression": "3.0753 * input_tokens + 27.6279",
    "samples": 2420,
    "input_range": [
      5,
      84
    ],
    "cv_metrics": {
      "r2": 0.6144,
      "mae": 29.9659,
      "rmse": 40.3449
    },
    "notes": []
  },
  "Descriptive": {
    "formula_type": "linear",
    "parameters": {
      "a": 2.90756,
      "b": 42.913
    },
    "expression": "2.9076 * input_tokens + 42.9130",
    "samples": 1918,
    "input_range": [
      3,
      84
    ],
    "cv_metrics": {
      "r2": 0.6199,
      "mae": 27.9259,
      "rmse": 38.0595
    },
    "notes": []
  },
  "Business": {
    "formula_type": "linear",
    "parameters": {
      "a": 2.2508,
      "b": 36.2669
    },
    "expression": "2.2508 * input_tokens + 36.2669",
    "samples": 1617,
    "input_range": [
      3,
      86
    ],
    "cv_metrics": {
      "r2": 0.6091,
      "mae": 22.3891,
      "rmse": 30.6586
    },
    "notes": []
  },
  "Architecture": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.66262,
      "b": 29.5941
    },
    "expression": "4.6626 * input_tokens + 29.5941",
    "samples": 1422,
    "input_range": [
      3,
      84
    ],
    "cv_metrics": {
      "r2": 0.597,
      "mae": 45.9419,
      "rmse": 62.3362
    },
    "notes": [
      "sensitive to influential records: refitting without 102 of them (7.2%) moves the estimate at median/P95 input by -3.8%/-10.7%; all records retained"
    ]
  },
  "QA": {
    "formula_type": "linear",
    "parameters": {
      "a": 4.03495,
      "b": 17.6021
    },
    "expression": "4.0350 * input_tokens + 17.6021",
    "samples": 1348,
    "input_range": [
      6,
      83
    ],
    "cv_metrics": {
      "r2": 0.6484,
      "mae": 36.9394,
      "rmse": 49.5995
    },
    "notes": []
  },
  "DevOps-Cloud": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.89552,
      "b": 29.5709
    },
    "expression": "3.8955 * input_tokens + 29.5709",
    "samples": 1209,
    "input_range": [
      3,
      81
    ],
    "cv_metrics": {
      "r2": 0.6362,
      "mae": 35.0952,
      "rmse": 47.8066
    },
    "notes": [
      "sensitive to influential records: refitting without 87 of them (7.2%) moves the estimate at median/P95 input by -2.8%/-11.4%; all records retained"
    ]
  },
  "Data-SQL": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.4248,
      "b": 22.9474
    },
    "expression": "3.4248 * input_tokens + 22.9474",
    "samples": 1191,
    "input_range": [
      5,
      86
    ],
    "cv_metrics": {
      "r2": 0.65,
      "mae": 31.2385,
      "rmse": 42.1281
    },
    "notes": []
  },
  "Documentation": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.98207,
      "b": 24.3423
    },
    "expression": "3.9821 * input_tokens + 24.3423",
    "samples": 808,
    "input_range": [
      3,
      84
    ],
    "cv_metrics": {
      "r2": 0.6073,
      "mae": 41.6866,
      "rmse": 54.6935
    },
    "notes": []
  },
  "Analysis-Optimization": {
    "formula_type": "linear",
    "parameters": {
      "a": 3.93809,
      "b": 33.2993
    },
    "expression": "3.9381 * input_tokens + 33.2993",
    "samples": 572,
    "input_range": [
      3,
      80
    ],
    "cv_metrics": {
      "r2": 0.5636,
      "mae": 39.3339,
      "rmse": 52.5171
    },
    "notes": []
  },
  "Communication": {
    "formula_type": "linear",
    "parameters": {
      "a": 1.95905,
      "b": 31.9685
    },
    "expression": "1.9590 * input_tokens + 31.9685",
    "samples": 212,
    "input_range": [
      6,
      78
    ],
    "cv_metrics": {
      "r2": 0.6483,
      "mae": 16.9294,
      "rmse": 22.5505
    },
    "notes": [
      "sensitive to influential records: refitting without 19 of them (9.0%) moves the estimate at median/P95 input by -3.3%/-16.5%; all records retained"
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
