# Ablation Study (K=10)

| model | k | evaluated_users | precision_at_k | recall_at_k | ndcg_at_k | ndcg_improvement_vs_cf_pct |
| --- | --- | --- | --- | --- | --- | --- |
| Hybrid | 10 | 25775 | 0.003123 | 0.008587 | 0.006507 | -38.139972 |
| CF-only | 10 | 25775 | 0.005307 | 0.014641 | 0.010518 | 0.000000 |
| Geo-only | 10 | 25775 | 0.000931 | 0.003571 | 0.002253 | -78.583278 |
| Category-only | 10 | 25775 | 0.001498 | 0.004646 | 0.003340 | -68.242018 |
