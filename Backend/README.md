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
category similarity (`cat`) using a **weighted geometric mean (product rule)**:

```
score = (cf_score + ε) ^ w_cf * (geo_score + ε) ^ w_geo * (category_score + ε) ^ w_cat
```

where `ε = 1e-6` keeps a zero component (e.g. no category overlap) from
collapsing the whole score to zero, and `w_cf + w_geo + w_cat = 1` after
normalization. This follows the product-rule fusion used by GeoSoCa
(Zhang & Chow, 2015, Eq. 18) instead of a plain weighted sum — see
"Ablation study" below for why. `user_id` and `categories` are optional; an
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
`category_contribution_pct`. Because the score is a product, not a sum, the
percentages are each factor's share of `log(total_score)`
(`w_i * log(score_i + ε)`, which sums exactly to `log(total_score)`) rather
than a share of `total_score` itself — a factor scoring near 1 contributes
close to 0% (it didn't hurt the ranking), while a factor near 0 dominates the
percentage (it's the reason the POI ranked low). The three percentages still
sum to 100% after rounding.

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
Geo-only, and Category-only, all computed with the same weighted-geometric-mean
formula described above — a variant's weight vector just zeroes out the
factors it excludes (e.g. CF-only is `w = (1, 0, 0)`), so no separate
sum-based code path is needed. User location is the mean location of businesses
seen in that user's training history; the category profile is built from the
same history. Results are written to `Output/ablation_results.csv` and
`Output/ablation_results.md`, including percentage improvement in NDCG@K over
CF-only.

With `K=10` and the default Hybrid weights (`0.4/0.3/0.3`), the current real-data
run produced:

| Model         | Precision@10 | Recall@10 |  NDCG@10 | NDCG change vs CF-only |
| ------------- | -----------: | --------: | -------: | ---------------------: |
| Hybrid        |     0.005816 |  0.016493 | 0.011649 |                +10.79% |
| CF-only       |     0.005307 |  0.014641 | 0.010515 |                  0.00% |
| Geo-only      |     0.000931 |  0.003571 | 0.002253 |                -78.58% |
| Category-only |     0.001498 |  0.004646 | 0.003340 |                -68.23% |

Hybrid now beats CF-only on all three metrics. It did not with a plain weighted
**sum** of the same three components (NDCG -38% vs CF-only) — switching only the
fusion rule from sum to **product** (this table) flipped the result. This
matches the paper's own finding: GeoSoCa explicitly uses a product rule (Eq. 18)
and argues a linear weighted sum "is not advisable... since some users are
affected by social friends more and other users may rely on the geographical
influence more" (Section 4.2.1, discussing the weaker USG baseline, which uses
linear sum). Worth citing directly in the report as the reason for this design
choice, not just an empirical tweak.
