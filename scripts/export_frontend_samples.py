"""
Xuất 2 file dữ liệu tĩnh cho Frontend dùng làm dropdown/checkbox demo:
  - Frontend/src/data/sampleUsers.json  (~20 user_id mẫu)
  - Frontend/src/data/topCategories.json (top ~30 category phổ biến)

Đây vốn là 2 việc được giao cho Tấn trong TASKS.md (mục "Tấn — Data &
Scoring"). Script này chỉ ĐỌC các artifact đã có sẵn trong Output/
(users_city.parquet, train_reviews.parquet, business_city.parquet,
cf_model.pkl) -- không sửa, không chạy lại pipeline/scoring/ablation nào.

Cách chạy (từ gốc repo, dùng venv của Backend vì đã có pandas/pyarrow/
joblib sẵn):
    Backend\\.venv\\Scripts\\python.exe scripts\\export_frontend_samples.py
"""

import json
from collections import Counter
from pathlib import Path

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "Output"
FRONTEND_DATA_DIR = PROJECT_ROOT / "Frontend" / "src" / "data"

TOP_N_USERS = 20
TOP_N_CATEGORIES = 30


def export_sample_users() -> None:
    """
    Chọn user_id mẫu để demo dropdown.

    Lưu ý quan trọng (khác với đọc lướt TASKS.md): "nhiều review" phải
    tính theo số dòng user đó có trong train_reviews.parquet (dữ liệu
    CF model thực sự được train), KHÔNG phải review_count trong
    users_city.parquet (review_count đó tính trên toàn bộ Yelp, có thể
    không liên quan gì đến train set của model). Nếu chọn nhầm theo
    review_count tổng, có thể ra user_id không nằm trong cf_model.pkl
    -> CF lại fallback về rating trung bình, mất hẳn ý nghĩa demo.
    """
    model = joblib.load(OUTPUT_DIR / "cf_model.pkl")
    trained_user_ids = set(model["user_idx"].keys())

    train_reviews = pd.read_parquet(OUTPUT_DIR / "train_reviews.parquet")
    interaction_counts = (
        train_reviews.groupby("user_id").size().rename("train_interaction_count")
    )

    users = pd.read_parquet(OUTPUT_DIR / "users_city.parquet").set_index("user_id")

    candidates = interaction_counts[interaction_counts.index.isin(trained_user_ids)]
    top_users = candidates.sort_values(ascending=False).head(TOP_N_USERS)

    sample_users = []
    for user_id, interaction_count in top_users.items():
        row = users.loc[user_id]
        sample_users.append(
            {
                "user_id": user_id,
                "name": row["name"],
                "review_count": int(row["review_count"]),
                "train_interaction_count": int(interaction_count),
            }
        )

    _write_json(FRONTEND_DATA_DIR / "sampleUsers.json", sample_users)
    print(f"Đã ghi {len(sample_users)} user_id mẫu -> {FRONTEND_DATA_DIR / 'sampleUsers.json'}")


def export_top_categories() -> None:
    """Đếm tần suất category trên toàn bộ business_city.parquet (đã lọc Philadelphia)."""
    businesses = pd.read_parquet(OUTPUT_DIR / "business_city.parquet")

    counter: Counter[str] = Counter()
    for raw in businesses["categories"].dropna():
        for category in str(raw).split(","):
            name = category.strip()
            if name and name.lower() != "nan":
                counter[name] += 1

    top_categories = [
        {"name": name, "business_count": count}
        for name, count in counter.most_common(TOP_N_CATEGORIES)
    ]

    _write_json(FRONTEND_DATA_DIR / "topCategories.json", top_categories)
    print(
        f"Đã ghi {len(top_categories)} category phổ biến -> "
        f"{FRONTEND_DATA_DIR / 'topCategories.json'}"
    )


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    export_sample_users()
    export_top_categories()
