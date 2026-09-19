"""Run a fair Top-K ablation study for the four recommender variants."""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from app.main import ARTIFACT_DIR, load_artifacts
from app.metrics import ndcg_at_k, precision_at_k, recall_at_k


VARIANT_WEIGHTS = {
    "Hybrid": (0.4, 0.3, 0.3),
    "CF-only": (1.0, 0.0, 0.0),
    "Geo-only": (0.0, 1.0, 0.0),
    "Category-only": (0.0, 0.0, 1.0),
}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--k", type=int, default=10, help="Top-K cutoff")
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument(
        "--csv-output", type=Path, default=ARTIFACT_DIR / "ablation_results.csv"
    )
    parser.add_argument(
        "--markdown-output",
        type=Path,
        default=ARTIFACT_DIR / "ablation_results.md",
    )
    return parser.parse_args()


def _haversine_matrix(
    user_latitudes: np.ndarray,
    user_longitudes: np.ndarray,
    item_latitudes: np.ndarray,
    item_longitudes: np.ndarray,
) -> np.ndarray:
    earth_radius_km = 6371.0
    lat1 = np.radians(user_latitudes)[:, None]
    lon1 = np.radians(user_longitudes)[:, None]
    lat2 = np.radians(item_latitudes)[None, :]
    lon2 = np.radians(item_longitudes)[None, :]
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = (
        np.sin(delta_lat / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin(delta_lon / 2) ** 2
    )
    return earth_radius_km * 2 * np.arctan2(
        np.sqrt(haversine), np.sqrt(1 - haversine)
    )


def _prepare_category_matrix(
    business_df: pd.DataFrame,
    item_ids: np.ndarray,
) -> tuple[np.ndarray, dict[str, int], np.ndarray]:
    business_by_id = business_df.set_index("business_id")
    item_categories = [business_by_id.loc[item_id, "category_set"] for item_id in item_ids]
    vocabulary = sorted(set().union(*item_categories))
    category_index = {category: index for index, category in enumerate(vocabulary)}
    matrix = np.zeros((len(item_ids), len(vocabulary)), dtype=np.float32)
    for item_position, categories in enumerate(item_categories):
        for category in categories:
            matrix[item_position, category_index[category]] = 1.0
    category_counts = matrix.sum(axis=1)
    return matrix, category_index, category_counts


def _user_profiles(
    train_by_user: dict[str, set[str]],
    business_df: pd.DataFrame,
    item_categories: np.ndarray,
    category_index: dict[str, int],
    user_ids: list[str],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    business_by_id = business_df.set_index("business_id")
    latitudes = []
    longitudes = []
    category_profiles = np.zeros((len(user_ids), len(category_index)), dtype=np.float32)
    for user_position, user_id in enumerate(user_ids):
        seen = [business_id for business_id in train_by_user[user_id] if business_id in business_by_id.index]
        if seen:
            latitudes.append(float(business_by_id.loc[seen, "latitude"].mean()))
            longitudes.append(float(business_by_id.loc[seen, "longitude"].mean()))
        else:
            latitudes.append(float(business_df["latitude"].mean()))
            longitudes.append(float(business_df["longitude"].mean()))
        for business_id in seen:
            for category in business_by_id.loc[business_id, "category_set"]:
                category_profiles[user_position, category_index[category]] = 1.0
    return (
        np.asarray(latitudes),
        np.asarray(longitudes),
        category_profiles,
    )


def evaluate_ablation(k: int, batch_size: int) -> pd.DataFrame:
    if k <= 0 or batch_size <= 0:
        raise ValueError("k and batch_size must be positive")

    artifacts = load_artifacts()
    model = artifacts["cf_model"]
    business_df = artifacts["business_city"]
    train_reviews = artifacts["train_reviews"]
    test_reviews = artifacts["test_reviews"]
    item_index = model["biz_idx"]
    item_ids = np.empty(len(item_index), dtype=object)
    for business_id, index in item_index.items():
        item_ids[index] = business_id

    train_by_user = train_reviews.groupby("user_id")["business_id"].agg(set).to_dict()
    test_by_user = test_reviews.groupby("user_id")["business_id"].agg(set).to_dict()
    user_index = model["user_idx"]
    users = sorted(set(train_by_user) & set(test_by_user) & set(user_index))
    users = [user_id for user_id in users if test_by_user[user_id] & set(item_index)]
    item_categories, category_index, item_category_counts = _prepare_category_matrix(
        business_df, item_ids
    )
    user_latitudes, user_longitudes, user_categories = _user_profiles(
        train_by_user, business_df, item_categories, category_index, users
    )
    business_by_id = business_df.set_index("business_id")
    item_latitudes = np.asarray([business_by_id.loc[item_id, "latitude"] for item_id in item_ids])
    item_longitudes = np.asarray([business_by_id.loc[item_id, "longitude"] for item_id in item_ids])

    totals = {
        variant: {metric: 0.0 for metric in ("precision_at_k", "recall_at_k", "ndcg_at_k")}
        for variant in VARIANT_WEIGHTS
    }
    evaluated_users = 0
    user_factors = model["user_factors"]
    item_factors = model["item_factors"]

    for start in range(0, len(users), batch_size):
        batch_users = users[start : start + batch_size]
        positions = range(start, start + len(batch_users))
        cf_scores = user_factors[[user_index[user_id] for user_id in batch_users]] @ item_factors.T
        cf_scores = np.clip(cf_scores / 5.0, 0.0, 1.0)
        distances = _haversine_matrix(
            user_latitudes[start : start + len(batch_users)],
            user_longitudes[start : start + len(batch_users)],
            item_latitudes,
            item_longitudes,
        )
        geo_scores = np.exp(-0.15 * distances)
        overlaps = user_categories[start : start + len(batch_users)] @ item_categories.T
        user_category_counts = user_categories[start : start + len(batch_users)].sum(axis=1)[:, None]
        category_scores = np.divide(
            overlaps,
            user_category_counts + item_category_counts[None, :] - overlaps,
            out=np.zeros_like(overlaps),
            where=user_category_counts + item_category_counts[None, :] - overlaps > 0,
        )
        component_scores = (cf_scores, geo_scores, category_scores)

        for row_offset, user_id in zip(positions, batch_users):
            actual = test_by_user[user_id] & set(item_index)
            if not actual:
                continue
            seen = train_by_user[user_id]
            row_scores = {
                variant: sum(weight * scores[row_offset - start] for weight, scores in zip(weights, component_scores))
                for variant, weights in VARIANT_WEIGHTS.items()
            }
            for scores in row_scores.values():
                for business_id in seen:
                    item_position = item_index.get(business_id)
                    if item_position is not None:
                        scores[item_position] = -np.inf
            for variant, scores in row_scores.items():
                top_positions = np.argpartition(-scores, k - 1)[:k]
                top_positions = top_positions[np.argsort(-scores[top_positions])]
                predicted = [item_ids[position] for position in top_positions]
                totals[variant]["precision_at_k"] += precision_at_k(actual, predicted, k)
                totals[variant]["recall_at_k"] += recall_at_k(actual, predicted, k)
                totals[variant]["ndcg_at_k"] += ndcg_at_k(actual, predicted, k)
            evaluated_users += 1

    rows = []
    for variant, values in totals.items():
        row = {"model": variant, "k": k, "evaluated_users": evaluated_users}
        row.update({metric: value / evaluated_users for metric, value in values.items()})
        rows.append(row)
    results = pd.DataFrame(rows)
    cf_ndcg = results.loc[results["model"] == "CF-only", "ndcg_at_k"].iloc[0]
    results["ndcg_improvement_vs_cf_pct"] = np.where(
        cf_ndcg > 0,
        (results["ndcg_at_k"] - cf_ndcg) / cf_ndcg * 100,
        np.nan,
    )
    return results


def _to_markdown(results: pd.DataFrame) -> str:
    columns = list(results.columns)
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    rows = []
    for values in results.itertuples(index=False, name=None):
        formatted = [
            f"{value:.6f}" if isinstance(value, (float, np.floating)) else str(value)
            for value in values
        ]
        rows.append("| " + " | ".join(formatted) + " |")
    return "\n".join([header, separator, *rows])


def main() -> None:
    args = _parse_args()
    results = evaluate_ablation(args.k, args.batch_size)
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    results.to_csv(args.csv_output, index=False)
    markdown = _to_markdown(results)
    args.markdown_output.write_text(
        f"# Ablation Study (K={args.k})\n\n{markdown}\n",
        encoding="utf-8",
    )
    print(markdown)
    print(f"Saved CSV to: {args.csv_output}")
    print(f"Saved Markdown to: {args.markdown_output}")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()