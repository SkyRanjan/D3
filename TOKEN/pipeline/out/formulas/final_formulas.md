| Classification | Final Formula | R² | MAE | RMSE |
|---|---|---:|---:|---:|
| Troubleshooting | 3.2987 × Input Tokens + 39.1285 | 0.641 | 29.5 | 40.6 |
| Developer | 3.7818 × Input Tokens + 34.5689 | 0.621 | 34.3 | 46.8 |
| How-To | 3.0753 × Input Tokens + 27.6279 | 0.614 | 30.0 | 40.3 |
| Descriptive | 2.9076 × Input Tokens + 42.9130 | 0.620 | 27.9 | 38.1 |
| Business | 2.2508 × Input Tokens + 36.2669 | 0.609 | 22.4 | 30.7 |
| Architecture | 4.6626 × Input Tokens + 29.5941 | 0.597 | 45.9 | 62.3 |
| QA | 4.0350 × Input Tokens + 17.6021 | 0.648 | 36.9 | 49.6 |
| DevOps-Cloud | 3.8955 × Input Tokens + 29.5709 | 0.636 | 35.1 | 47.8 |
| Data-SQL | 3.4248 × Input Tokens + 22.9474 | 0.650 | 31.2 | 42.1 |
| Documentation | 3.9821 × Input Tokens + 24.3423 | 0.607 | 41.7 | 54.7 |
| Analysis-Optimization | 3.9381 × Input Tokens + 33.2993 | 0.564 | 39.3 | 52.5 |
| Communication | 1.9590 × Input Tokens + 31.9685 | 0.648 | 16.9 | 22.6 |

R², MAE and RMSE are from 5-fold cross-validation (records not used to fit the formula).

Classification: Troubleshooting  
Formula:  
Estimated Output Tokens = 3.2987 × Input Tokens + 39.1285

Classification: Developer  
Formula:  
Estimated Output Tokens = 3.7818 × Input Tokens + 34.5689

Classification: How-To  
Formula:  
Estimated Output Tokens = 3.0753 × Input Tokens + 27.6279

Classification: Descriptive  
Formula:  
Estimated Output Tokens = 2.9076 × Input Tokens + 42.9130

Classification: Business  
Formula:  
Estimated Output Tokens = 2.2508 × Input Tokens + 36.2669

Classification: Architecture  
Formula:  
Estimated Output Tokens = 4.6626 × Input Tokens + 29.5941

Classification: QA  
Formula:  
Estimated Output Tokens = 4.0350 × Input Tokens + 17.6021

Classification: DevOps-Cloud  
Formula:  
Estimated Output Tokens = 3.8955 × Input Tokens + 29.5709

Classification: Data-SQL  
Formula:  
Estimated Output Tokens = 3.4248 × Input Tokens + 22.9474

Classification: Documentation  
Formula:  
Estimated Output Tokens = 3.9821 × Input Tokens + 24.3423

Classification: Analysis-Optimization  
Formula:  
Estimated Output Tokens = 3.9381 × Input Tokens + 33.2993

Classification: Communication  
Formula:  
Estimated Output Tokens = 1.9590 × Input Tokens + 31.9685

```json
{
    "Troubleshooting": "3.2987 * input_tokens + 39.1285",
    "Developer": "3.7818 * input_tokens + 34.5689",
    "How-To": "3.0753 * input_tokens + 27.6279",
    "Descriptive": "2.9076 * input_tokens + 42.9130",
    "Business": "2.2508 * input_tokens + 36.2669",
    "Architecture": "4.6626 * input_tokens + 29.5941",
    "QA": "4.0350 * input_tokens + 17.6021",
    "DevOps-Cloud": "3.8955 * input_tokens + 29.5709",
    "Data-SQL": "3.4248 * input_tokens + 22.9474",
    "Documentation": "3.9821 * input_tokens + 24.3423",
    "Analysis-Optimization": "3.9381 * input_tokens + 33.2993",
    "Communication": "1.9590 * input_tokens + 31.9685"
}
```
