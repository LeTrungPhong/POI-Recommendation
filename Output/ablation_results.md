# Ablation Study (K=10)

| model | k | evaluated_users | precision_at_k | recall_at_k | ndcg_at_k | ndcg_improvement_vs_cf_pct |
| --- | --- | --- | --- | --- | --- | --- |
| Hybrid | 10 | 25775 | 0.005816 | 0.016493 | 0.011649 | 10.786084 |
| CF-only | 10 | 25775 | 0.005307 | 0.014641 | 0.010515 | 0.000000 |
| Geo-only | 10 | 25775 | 0.000931 | 0.003571 | 0.002253 | -78.576860 |
| Category-only | 10 | 25775 | 0.001498 | 0.004646 | 0.003340 | -68.232499 |
