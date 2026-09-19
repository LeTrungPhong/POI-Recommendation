from contextlib import asynccontextmanager
from math import radians
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = PROJECT_ROOT / "Output"
PARQUET_ARTIFACTS = (
    "business_city",
    "reviews_city",
    "users_city",
    "train_reviews",
    "test_reviews",
)


class RecommendationRequest(BaseModel):
    user_id: str | None = None
    k: int = Field(default=10, ge=1, le=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    categories: list[str] = Field(default_factory=list)
    max_distance_km: float = Field(default=15, gt=0, le=500)
    decay_rate: float = Field(default=0.15, ge=0)
    weights: dict[str, float] | None = None


class Recommendation(BaseModel):
    business_id: str
    name: str
    latitude: float
    longitude: float
    categories: str | None = None
    stars: float
    distance_km: float
    score: float
    cf_score: float
    geo_score: float
    category_score: float


class Explanation(BaseModel):
    business_id: str
    name: str
    total_score: float
    cf_score: float
    geo_score: float
    category_score: float
    cf_contribution: float
    geo_contribution: float
    category_contribution: float
    cf_contribution_pct: float
    geo_contribution_pct: float
    category_contribution_pct: float
    distance_km: float


class WhatIfScenario(BaseModel):
    user_id: str | None = None
    k: int | None = Field(default=None, ge=1, le=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    categories: list[str] | None = None
    max_distance_km: float | None = Field(default=None, gt=0, le=500)
    decay_rate: float | None = Field(default=None, ge=0)
    weights: dict[str, float] | None = None


class WhatIfChange(BaseModel):
    business_id: str
    baseline_rank: int | None = None
    scenario_rank: int | None = None
    baseline_score: float | None = None
    scenario_score: float | None = None
    score_delta: float | None = None
    rank_delta: int | None = None


class WhatIfRequest(BaseModel):
    baseline: RecommendationRequest
    scenario: WhatIfScenario


class WhatIfResponse(BaseModel):
    baseline: list[Recommendation]
    scenario: list[Recommendation]
    changes: list[WhatIfChange]


def load_artifacts() -> dict[str, Any]:
    """Load all recommendation artifacts once for the server process."""
    artifacts: dict[str, Any] = {}

    for artifact_name in PARQUET_ARTIFACTS:
        artifact_path = ARTIFACT_DIR / f"{artifact_name}.parquet"
        if not artifact_path.is_file():
            raise FileNotFoundError(f"Missing artifact: {artifact_path}")
        artifacts[artifact_name] = pd.read_parquet(artifact_path)

    business_df = artifacts["business_city"]
    business_df["category_set"] = business_df["categories"].map(
        lambda value: {
            category.strip()
            for category in str(value).split(",")
            if category.strip() and category.strip().lower() != "nan"
        }
    )

    model_path = ARTIFACT_DIR / "cf_model.pkl"
    if not model_path.is_file():
        raise FileNotFoundError(f"Missing artifact: {model_path}")
    artifacts["cf_model"] = joblib.load(model_path)
    return artifacts


def _normalize_weights(weights: dict[str, float] | None) -> dict[str, float]:
    normalized = weights or {"cf": 0.4, "geo": 0.3, "cat": 0.3}
    if set(normalized) != {"cf", "geo", "cat"} or any(
        value < 0 for value in normalized.values()
    ):
        raise HTTPException(
            status_code=422,
            detail="weights must contain non-negative cf, geo, and cat values",
        )
    total = sum(normalized.values())
    if total <= 0:
        raise HTTPException(status_code=422, detail="weights must sum to more than 0")
    return {key: value / total for key, value in normalized.items()}


def _haversine_km(
    latitude: float,
    longitude: float,
    business_latitudes: pd.Series,
    business_longitudes: pd.Series,
) -> np.ndarray:
    earth_radius_km = 6371.0
    lat1 = radians(latitude)
    lon1 = radians(longitude)
    lat2 = np.radians(business_latitudes.to_numpy())
    lon2 = np.radians(business_longitudes.to_numpy())
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = (
        np.sin(delta_lat / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin(delta_lon / 2) ** 2
    )
    return earth_radius_km * 2 * np.arctan2(
        np.sqrt(haversine), np.sqrt(1 - haversine)
    )


def recommend(request: RecommendationRequest, artifacts: dict[str, Any]) -> list[Recommendation]:
    weights = _normalize_weights(request.weights)
    businesses = artifacts["business_city"].copy()
    model = artifacts["cf_model"]
    distances = _haversine_km(
        request.latitude,
        request.longitude,
        businesses["latitude"],
        businesses["longitude"],
    )
    businesses["distance_km"] = distances
    businesses = businesses[businesses["distance_km"] <= request.max_distance_km]

    user_idx = model["user_idx"]
    business_idx = model["biz_idx"]
    user_factors = model["user_factors"]
    item_factors = model["item_factors"]
    train_business_rating = model["train_business_rating"]
    global_mean = model["global_train_mean"]
    query_categories = {category.strip() for category in request.categories if category.strip()}
    results: list[Recommendation] = []

    for row in businesses.itertuples(index=False):
        business_id = row.business_id
        if request.user_id in user_idx and business_id in business_idx:
            raw_cf = user_factors[user_idx[request.user_id]] @ item_factors[business_idx[business_id]]
            cf_score = float(np.clip(raw_cf / 5.0, 0.0, 1.0))
        else:
            cf_score = float(
                np.clip(train_business_rating.get(business_id, global_mean) / 5.0, 0.0, 1.0)
            )

        distance_km = float(row.distance_km)
        geo_score = float(np.exp(-request.decay_rate * distance_km))
        business_categories = row.category_set
        category_union = query_categories | business_categories
        category_score = (
            len(query_categories & business_categories) / len(category_union)
            if query_categories and category_union
            else 0.0
        )
        score = (
            weights["cf"] * cf_score
            + weights["geo"] * geo_score
            + weights["cat"] * category_score
        )
        results.append(
            Recommendation(
                business_id=business_id,
                name=row.name,
                latitude=float(row.latitude),
                longitude=float(row.longitude),
                categories=row.categories,
                stars=float(row.stars),
                distance_km=round(distance_km, 2),
                score=round(score, 4),
                cf_score=round(cf_score, 4),
                geo_score=round(geo_score, 4),
                category_score=round(category_score, 4),
            )
        )

    return sorted(results, key=lambda item: item.score, reverse=True)[: request.k]


def explain_business(
    business_id: str,
    user_id: str | None,
    latitude: float,
    longitude: float,
    categories: list[str],
    decay_rate: float,
    weights: dict[str, float],
    artifacts: dict[str, Any],
) -> Explanation:
    businesses = artifacts["business_city"]
    matches = businesses[businesses["business_id"] == business_id]
    if matches.empty:
        raise HTTPException(status_code=404, detail=f"Business not found: {business_id}")

    business = matches.iloc[0]
    model = artifacts["cf_model"]
    if user_id in model["user_idx"] and business_id in model["biz_idx"]:
        raw_cf = (
            model["user_factors"][model["user_idx"][user_id]]
            @ model["item_factors"][model["biz_idx"][business_id]]
        )
        cf_score = float(np.clip(raw_cf / 5.0, 0.0, 1.0))
    else:
        cf_score = float(
            np.clip(
                model["train_business_rating"].get(
                    business_id, model["global_train_mean"]
                )
                / 5.0,
                0.0,
                1.0,
            )
        )

    distance_km = float(
        _haversine_km(
            latitude,
            longitude,
            pd.Series([business["latitude"]]),
            pd.Series([business["longitude"]]),
        )[0]
    )
    geo_score = float(np.exp(-decay_rate * distance_km))
    query_categories = {category.strip() for category in categories if category.strip()}
    category_union = query_categories | business["category_set"]
    category_score = (
        len(query_categories & business["category_set"]) / len(category_union)
        if query_categories and category_union
        else 0.0
    )

    cf_contribution = weights["cf"] * cf_score
    geo_contribution = weights["geo"] * geo_score
    category_contribution = weights["cat"] * category_score
    total_score = cf_contribution + geo_contribution + category_contribution
    percentages = (
        {
            "cf": cf_contribution / total_score * 100,
            "geo": geo_contribution / total_score * 100,
            "category": category_contribution / total_score * 100,
        }
        if total_score > 0
        else {"cf": 0.0, "geo": 0.0, "category": 0.0}
    )
    cf_percentage = round(percentages["cf"], 2)
    geo_percentage = round(percentages["geo"], 2)
    category_percentage = round(100.0 - cf_percentage - geo_percentage, 2)
    return Explanation(
        business_id=business_id,
        name=business["name"],
        total_score=round(total_score, 4),
        cf_score=round(cf_score, 4),
        geo_score=round(geo_score, 4),
        category_score=round(category_score, 4),
        cf_contribution=round(cf_contribution, 4),
        geo_contribution=round(geo_contribution, 4),
        category_contribution=round(category_contribution, 4),
        cf_contribution_pct=cf_percentage,
        geo_contribution_pct=geo_percentage,
        category_contribution_pct=category_percentage,
        distance_km=round(distance_km, 2),
    )


def _apply_whatif_scenario(
    baseline: RecommendationRequest,
    scenario: WhatIfScenario,
) -> RecommendationRequest:
    values = baseline.model_dump()
    values.update(scenario.model_dump(exclude_unset=True))
    return RecommendationRequest(**values)


def compare_recommendations(
    baseline: list[Recommendation],
    scenario: list[Recommendation],
) -> list[WhatIfChange]:
    baseline_by_id = {item.business_id: item for item in baseline}
    scenario_by_id = {item.business_id: item for item in scenario}
    baseline_ranks = {
        item.business_id: rank for rank, item in enumerate(baseline, start=1)
    }
    scenario_ranks = {
        item.business_id: rank for rank, item in enumerate(scenario, start=1)
    }

    changes: list[WhatIfChange] = []
    for business_id in set(baseline_by_id) | set(scenario_by_id):
        baseline_item = baseline_by_id.get(business_id)
        scenario_item = scenario_by_id.get(business_id)
        baseline_rank = baseline_ranks.get(business_id)
        scenario_rank = scenario_ranks.get(business_id)
        baseline_score = baseline_item.score if baseline_item else None
        scenario_score = scenario_item.score if scenario_item else None
        changes.append(
            WhatIfChange(
                business_id=business_id,
                baseline_rank=baseline_rank,
                scenario_rank=scenario_rank,
                baseline_score=baseline_score,
                scenario_score=scenario_score,
                score_delta=(
                    round(scenario_score - baseline_score, 4)
                    if baseline_score is not None and scenario_score is not None
                    else None
                ),
                rank_delta=(
                    baseline_rank - scenario_rank
                    if baseline_rank is not None and scenario_rank is not None
                    else None
                ),
            )
        )

    return sorted(
        changes,
        key=lambda item: (item.scenario_rank is None, item.scenario_rank or 0),
    )


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.artifacts = load_artifacts()
    yield
    application.state.artifacts.clear()

app = FastAPI(
    title="Yelp Backend API",
    description="Backend API for the Yelp dataset application.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/", tags=["system"])
def read_root() -> dict[str, str]:
    return {"message": "Yelp Backend API is running"}


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str | int]:
    artifacts = getattr(app.state, "artifacts", {})
    return {"status": "ok", "artifacts_loaded": len(artifacts)}


@app.post("/recommend", response_model=list[Recommendation], tags=["recommendations"])
def recommend_endpoint(request: RecommendationRequest) -> list[Recommendation]:
    artifacts = getattr(app.state, "artifacts", None)
    if not artifacts:
        raise HTTPException(status_code=503, detail="Recommendation artifacts are not loaded")
    return recommend(request, artifacts)


@app.post("/whatif", response_model=WhatIfResponse, tags=["recommendations"])
def whatif_endpoint(request: WhatIfRequest) -> WhatIfResponse:
    artifacts = getattr(app.state, "artifacts", None)
    if not artifacts:
        raise HTTPException(status_code=503, detail="Recommendation artifacts are not loaded")

    baseline_results = recommend(request.baseline, artifacts)
    scenario_request = _apply_whatif_scenario(request.baseline, request.scenario)
    scenario_results = recommend(scenario_request, artifacts)
    return WhatIfResponse(
        baseline=baseline_results,
        scenario=scenario_results,
        changes=compare_recommendations(baseline_results, scenario_results),
    )


@app.get("/explain", response_model=Explanation, tags=["recommendations"])
def explain_endpoint(
    business_id: str = Query(..., min_length=1),
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    user_id: str | None = Query(default=None),
    categories: list[str] | None = Query(default=None),
    decay_rate: float = Query(default=0.15, ge=0),
    cf_weight: float = Query(default=0.4, ge=0),
    geo_weight: float = Query(default=0.3, ge=0),
    cat_weight: float = Query(default=0.3, ge=0),
) -> Explanation:
    artifacts = getattr(app.state, "artifacts", None)
    if not artifacts:
        raise HTTPException(status_code=503, detail="Recommendation artifacts are not loaded")
    weights = _normalize_weights(
        {"cf": cf_weight, "geo": geo_weight, "cat": cat_weight}
    )
    return explain_business(
        business_id=business_id,
        user_id=user_id,
        latitude=latitude,
        longitude=longitude,
        categories=categories or [],
        decay_rate=decay_rate,
        weights=weights,
        artifacts=artifacts,
    )
