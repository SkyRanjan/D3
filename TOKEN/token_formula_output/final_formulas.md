| Classification | Final Formula | R² | MAE | RMSE |
|---|---|---:|---:|---:|
| Troubleshooting | 3.3110 × Input Tokens + 49.5566 | 0.658 | 36.8 | 51.0 |
| Developer | 3.8537 × Input Tokens + 40.5077 | 0.643 | 42.9 | 58.8 |
| How-To | 3.1025 × Input Tokens + 32.7811 | 0.635 | 37.4 | 50.6 |
| Descriptive | 2.9352 × Input Tokens + 53.8459 | 0.637 | 35.0 | 48.0 |
| Business | 2.3308 × Input Tokens + 51.6452 | 0.628 | 28.6 | 39.3 |
| Architecture | 4.7282 × Input Tokens + 38.6198 | 0.615 | 58.1 | 79.1 |
| QA | 4.0848 × Input Tokens + 28.8191 | 0.668 | 45.9 | 62.3 |
| DevOps-Cloud | 3.9529 × Input Tokens + 38.0684 | 0.645 | 45.4 | 61.9 |
| Data-SQL | 3.4619 × Input Tokens + 26.8357 | 0.671 | 38.8 | 52.6 |
| Documentation | 4.1675 × Input Tokens + 35.9274 | 0.638 | 52.0 | 68.7 |
| Analysis-Optimization | 4.0039 × Input Tokens + 44.6457 | 0.583 | 49.9 | 67.1 |
| Communication | 1.9841 × Input Tokens + 38.7861 | 0.669 | 21.4 | 28.7 |

R², MAE and RMSE are from 5-fold cross-validation (records not used to fit the formula).

Classification: Troubleshooting  
Formula:  
Estimated Output Tokens = 3.3110 × Input Tokens + 49.5566

Classification: Developer  
Formula:  
Estimated Output Tokens = 3.8537 × Input Tokens + 40.5077

Classification: How-To  
Formula:  
Estimated Output Tokens = 3.1025 × Input Tokens + 32.7811

Classification: Descriptive  
Formula:  
Estimated Output Tokens = 2.9352 × Input Tokens + 53.8459

Classification: Business  
Formula:  
Estimated Output Tokens = 2.3308 × Input Tokens + 51.6452

Classification: Architecture  
Formula:  
Estimated Output Tokens = 4.7282 × Input Tokens + 38.6198

Classification: QA  
Formula:  
Estimated Output Tokens = 4.0848 × Input Tokens + 28.8191

Classification: DevOps-Cloud  
Formula:  
Estimated Output Tokens = 3.9529 × Input Tokens + 38.0684

Classification: Data-SQL  
Formula:  
Estimated Output Tokens = 3.4619 × Input Tokens + 26.8357

Classification: Documentation  
Formula:  
Estimated Output Tokens = 4.1675 × Input Tokens + 35.9274

Classification: Analysis-Optimization  
Formula:  
Estimated Output Tokens = 4.0039 × Input Tokens + 44.6457

Classification: Communication  
Formula:  
Estimated Output Tokens = 1.9841 × Input Tokens + 38.7861

```json
{
    "Troubleshooting": "3.3110 * input_tokens + 49.5566",
    "Developer": "3.8537 * input_tokens + 40.5077",
    "How-To": "3.1025 * input_tokens + 32.7811",
    "Descriptive": "2.9352 * input_tokens + 53.8459",
    "Business": "2.3308 * input_tokens + 51.6452",
    "Architecture": "4.7282 * input_tokens + 38.6198",
    "QA": "4.0848 * input_tokens + 28.8191",
    "DevOps-Cloud": "3.9529 * input_tokens + 38.0684",
    "Data-SQL": "3.4619 * input_tokens + 26.8357",
    "Documentation": "4.1675 * input_tokens + 35.9274",
    "Analysis-Optimization": "4.0039 * input_tokens + 44.6457",
    "Communication": "1.9841 * input_tokens + 38.7861"
}
```
