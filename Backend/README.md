# Yelp Backend API

FastAPI backend for the Yelp dataset application.

## Run locally

From this directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`.

- Health check: `GET /health`
- Recommendations: `POST /recommend`
- What-if simulation: `POST /whatif`
- Explanation: `GET /explain`
- Interactive docs: `http://127.0.0.1:8000/docs`

At startup, the server loads the recommendation Parquet files and `Output/cf_model.pkl`
into memory once. The server fails fast with the missing artifact path if an artifact is
not available.

## API usage

### `POST /recommend`

Returns the top `k` places ranked by the hybrid recommendation score. The score
combines collaborative filtering (`cf`), geographic proximity (`geo`), and
category similarity (`cat`). `user_id` and `categories` are optional; an
anonymous or unknown user uses the training average rating as the CF fallback.

```powershell
curl -X POST http://127.0.0.1:8000/recommend `
    -H "Content-Type: application/json" `
    -d '{
        "user_id": null,
        "k": 10,
        "latitude": 39.9526,
        "longitude": -75.1652,
        "categories": ["Coffee & Tea"],
        "max_distance_km": 15
    }'
```

Important request fields:

- `user_id`: optional Yelp user ID.
- `k`: number of results, from 1 to 100.
- `latitude`, `longitude`: current location.
- `categories`: preferred categories.
- `max_distance_km`: maximum search distance.
- `weights`: optional object with `cf`, `geo`, and `cat` values.

Each result includes business information, `distance_km`, the combined `score`,
and the component scores `cf_score`, `geo_score`, and `category_score`.

### `POST /whatif`

Simulates a change without modifying the loaded data or the baseline request.
The `scenario` object overrides only the fields supplied in `baseline`.
This is useful for testing a hypothetical location, category preference, search
radius, decay rate, or weighting strategy.

The response contains:

- `baseline`: ranked results for the original request.
- `scenario`: ranked results after applying the hypothetical changes.
- `changes`: score and rank differences for businesses in either result list.

Example request with a new location, category, and stronger geographic weight:

```json
{
    "baseline": {
        "user_id": null,
        "k": 10,
        "latitude": 39.9526,
        "longitude": -75.1652,
        "categories": ["Coffee & Tea"]
    },
    "scenario": {
        "latitude": 39.98,
        "longitude": -75.15,
        "categories": ["Italian"],
        "weights": { "cf": 0.2, "geo": 0.6, "cat": 0.2 }
    }
}
```

The response contains both ranked lists and `changes`, including score and rank
deltas for businesses present in either result.

### `GET /explain`

Explains why one business received its score in a specific context. The endpoint
uses the same scoring formula as `/recommend` and returns raw component scores,
weighted contributions, and contribution percentages.

```text
GET /explain?business_id=LzgxfMu24HbJbUi1cCk70Q&latitude=39.9526&longitude=-75.1652&categories=Coffee%20%26%20Tea&cf_weight=0.4&geo_weight=0.3&cat_weight=0.3
```

Query parameters:

- `business_id`: required business to explain.
- `latitude`, `longitude`: current or hypothetical location.
- `user_id`: optional user ID used for collaborative filtering.
- `categories`: optional category preferences; may be repeated in the query.
- `cf_weight`, `geo_weight`, `cat_weight`: non-negative component weights.
- `decay_rate`: geographic distance decay rate.

The response includes `total_score`, `cf_score`, `geo_score`,
`category_score`, each weighted contribution, `distance_km`, and
`cf_contribution_pct`, `geo_contribution_pct`, and
`category_contribution_pct`. The three percentages sum to 100% after rounding.

## Offline evaluation

The standard Top-K metrics are implemented in `app/metrics.py`:

- `precision_at_k(actual, predicted, k)`: relevant recommendations divided by K.
- `recall_at_k(actual, predicted, k)`: relevant recommendations divided by all
  relevant test items for the user.
- `ndcg_at_k(actual, predicted, k)`: ranking quality with higher gain for
  relevant items appearing earlier in the list.

The interactive evaluation notebook is [app/evaluate_metrics.ipynb](app/evaluate_metrics.ipynb).
Open it in VS Code or Jupyter and run all cells from top to bottom. It loads the
filtered Parquet files and `cf_model.pkl`, removes training items from each
user's candidate set, scores users in batches, and writes `Output/metrics.json`.

The notebook prints averaged `Precision@10`, `Recall@10`, and `NDCG@10` for the
real test split. To run the same evaluation non-interactively from the `Backend`
directory, use the compatibility script:

```powershell
.\.venv\Scripts\python.exe evaluate_metrics.py --k 10
```

The script produces the same metrics and output file. Use `--output` to change
the result path when running the script.

## Ablation study

Run the controlled comparison of the four scoring variants:

```powershell
.\.venv\Scripts\python.exe ablation_study.py --k 10
```

The experiment uses the same train/test users and candidate filtering as the
standard evaluation. It compares Hybrid (`CF + Geo + Category`), CF-only,
Geo-only, and Category-only. User location is the mean location of businesses
seen in that user's training history; the category profile is built from the
same history. Results are written to `Output/ablation_results.csv` and
`Output/ablation_results.md`, including percentage improvement in NDCG@K over
CF-only.

With `K=10` and the default Hybrid weights (`0.4/0.3/0.3`), the current real-data
run produced:

| Model         | Precision@10 | Recall@10 |  NDCG@10 | NDCG change vs CF-only |
| ------------- | -----------: | --------: | -------: | ---------------------: |
| Hybrid        |     0.003123 |  0.008587 | 0.006507 |                -38.14% |
| CF-only       |     0.005307 |  0.014641 | 0.010518 |                  0.00% |
| Geo-only      |     0.000931 |  0.003571 | 0.002253 |                -78.58% |
| Category-only |     0.001498 |  0.004646 | 0.003340 |                -68.24% |

This benchmark does not show Hybrid superiority yet: CF-only is the strongest
variant under this offline protocol. The result should be reported as-is; it
indicates that the Hybrid weights or the inferred Geo/Category user context
need tuning before claiming an improvement over CF-only.
