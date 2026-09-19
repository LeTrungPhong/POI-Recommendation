"""Standard Top-K recommender-system metrics."""

from collections.abc import Iterable, Sequence
from math import log2


def _validate_k(k: int) -> None:
    if not isinstance(k, int) or isinstance(k, bool) or k <= 0:
        raise ValueError("k must be a positive integer")


def _top_k(predicted: Sequence, k: int) -> list:
    _validate_k(k)
    return list(predicted[:k])


def precision_at_k(actual: Iterable, predicted: Sequence, k: int) -> float:
    """Return relevant recommendations divided by the requested K."""
    predicted_at_k = _top_k(predicted, k)
    actual_set = set(actual)
    if not predicted_at_k:
        return 0.0
    hits = sum(item in actual_set for item in predicted_at_k)
    return hits / k


def recall_at_k(actual: Iterable, predicted: Sequence, k: int) -> float:
    """Return relevant recommendations divided by the number of actual items."""
    actual_set = set(actual)
    if not actual_set:
        return 0.0
    hits = sum(item in actual_set for item in _top_k(predicted, k))
    return hits / len(actual_set)


def ndcg_at_k(actual: Iterable, predicted: Sequence, k: int) -> float:
    """Return binary-relevance NDCG for the first K predicted items."""
    actual_set = set(actual)
    predicted_at_k = _top_k(predicted, k)
    if not actual_set or not predicted_at_k:
        return 0.0

    dcg = sum(
        1 / log2(rank + 2)
        for rank, item in enumerate(predicted_at_k)
        if item in actual_set
    )
    ideal_hits = min(len(actual_set), k)
    idcg = sum(1 / log2(rank + 2) for rank in range(ideal_hits))
    return dcg / idcg if idcg else 0.0