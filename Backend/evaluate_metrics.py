"""Evaluate the saved CF model on the filtered city test split."""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from app.main import ARTIFACT_DIR, load_artifacts
from app.metrics import ndcg_at_k, precision_at_k, recall_at_k


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--k", type=int, default=10, help="Top-K cutoff")
    parser.add_argument(
        "--batch-size", type=int, default=256, help="Users scored per matrix batch"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ARTIFACT_DIR / "metrics.json",
        help="JSON output path",
    )
    return parser.parse_args()


def evaluate(k: int, batch_size: int) -> dict[str, float | int]:
    if k <= 0 or batch_size <= 0:
        raise ValueError("k and batch_size must be positive")

    artifacts = load_artifacts()
    model = artifacts["cf_model"]
    train_reviews = artifacts["train_reviews"]
    test_reviews = artifacts["test_reviews"]
    item_index = model["biz_idx"]
    item_ids = np.empty(len(item_index), dtype=object)
    for business_id, index in item_index.items():
        item_ids[index] = business_id

    train_by_user = train_reviews.groupby("user_id")["business_id"].agg(set).to_dict()
    test_by_user = test_reviews.groupby("user_id")["business_id"].agg(set).to_dict()
    evaluable_users = sorted(set(train_by_user) & set(test_by_user))
    user_index = model["user_idx"]
    evaluable_users = [user_id for user_id in evaluable_users if user_id in user_index]

    user_factors = model["user_factors"]
    item_factors = model["item_factors"]
    totals = {"precision": 0.0, "recall": 0.0, "ndcg": 0.0}
    evaluated_users = 0

    for start in range(0, len(evaluable_users), batch_size):
        batch_users = evaluable_users[start : start + batch_size]
        user_indices = [user_index[user_id] for user_id in batch_users]
        scores = user_factors[user_indices] @ item_factors.T

        for row_index, user_id in enumerate(batch_users):
            seen_items = train_by_user[user_id]
            actual_items = test_by_user[user_id] & set(item_index)
            if not actual_items:
                continue

            user_scores = scores[row_index].copy()
            for business_id in seen_items:
                item_position = item_index.get(business_id)
                if item_position is not None:
                    user_scores[item_position] = -np.inf

            top_positions = np.argpartition(-user_scores, k - 1)[:k]
            top_positions = top_positions[np.argsort(-user_scores[top_positions])]
            predicted_items = [item_ids[position] for position in top_positions]
            totals["precision"] += precision_at_k(actual_items, predicted_items, k)
            totals["recall"] += recall_at_k(actual_items, predicted_items, k)
            totals["ndcg"] += ndcg_at_k(actual_items, predicted_items, k)
            evaluated_users += 1

    if evaluated_users == 0:
        raise RuntimeError("No users have both train and test interactions")

    return {
        "k": k,
        "evaluated_users": evaluated_users,
        "precision_at_k": totals["precision"] / evaluated_users,
        "recall_at_k": totals["recall"] / evaluated_users,
        "ndcg_at_k": totals["ndcg"] / evaluated_users,
    }


def main() -> None:
    args = _parse_args()
    metrics = evaluate(args.k, args.batch_size)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(f"Evaluated users: {metrics['evaluated_users']:,}")
    print(f"Precision@{args.k}: {metrics['precision_at_k']:.6f}")
    print(f"Recall@{args.k}:    {metrics['recall_at_k']:.6f}")
    print(f"NDCG@{args.k}:      {metrics['ndcg_at_k']:.6f}")
    print(f"Saved metrics to: {args.output}")


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()