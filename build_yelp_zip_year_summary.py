import json
import zipfile
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BUSINESSES_PATH = ROOT / "data" / "yelp_filtered" / "yelp_restaurants_philadelphia_zips.json"
REVIEWS_ZIP_PATH = ROOT / "data" / "yelp_filtered" / "yelp_reviews_philadelphia_zips.zip"
REVIEWS_JSON_NAME = "yelp_reviews_philadelphia_zips.json"
OUTPUT_JSON_PATH = ROOT / "data" / "yelp_filtered" / "yelp_zip_year_summary.json"


def load_zip_lookup():
    businesses = json.loads(BUSINESSES_PATH.read_text(encoding="utf-8"))
    return {
        business["business_id"]: str(business.get("postal_code", "")).strip()
        for business in businesses
        if business.get("business_id") and business.get("postal_code")
    }


def build_summary(zip_lookup):
    grouped = defaultdict(lambda: {"rating_sum": 0.0, "review_count": 0, "businesses": set()})

    with zipfile.ZipFile(REVIEWS_ZIP_PATH) as archive:
        with archive.open(REVIEWS_JSON_NAME) as reviews_file:
            reviews = json.load(reviews_file)

    for review in reviews:
        business_id = review.get("business_id")
        zip_code = zip_lookup.get(business_id)
        if not zip_code:
            continue

        date = str(review.get("date", ""))
        year = date[:4]
        if not year.isdigit():
            continue

        stars = review.get("stars")
        try:
            stars = float(stars)
        except (TypeError, ValueError):
            continue

        bucket = grouped[(int(year), zip_code)]
        bucket["rating_sum"] += stars
        bucket["review_count"] += 1
        bucket["businesses"].add(business_id)

    rows = []
    years = set()
    zips = set()

    for (year, zip_code), values in sorted(grouped.items()):
        review_count = values["review_count"]
        if review_count <= 0:
            continue

        years.add(year)
        zips.add(zip_code)
        rows.append(
            {
                "year": year,
                "zip_code": zip_code,
                "avg_rating": round(values["rating_sum"] / review_count, 4),
                "review_count": review_count,
                "business_count": len(values["businesses"]),
            }
        )

    return {
        "years": sorted(years),
        "zip_codes": sorted(zips),
        "rows": rows,
    }


def main():
    zip_lookup = load_zip_lookup()
    summary = build_summary(zip_lookup)
    OUTPUT_JSON_PATH.write_text(json.dumps(summary, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(summary['rows'])} rows to {OUTPUT_JSON_PATH}")
    if summary["years"]:
        print(f"Years: {summary['years'][0]}-{summary['years'][-1]}")
    print(f"ZIP codes: {len(summary['zip_codes'])}")


if __name__ == "__main__":
    main()
