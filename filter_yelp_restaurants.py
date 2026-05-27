import argparse
import json
from pathlib import Path


DEFAULT_DATASET_DIR = Path(
    r"C:\Users\susan\Downloads\Yelp-JSON\Yelp JSON\yelp_dataset"
)
DEFAULT_BUSINESS_PATH = DEFAULT_DATASET_DIR / "yelp_academic_dataset_business.json"
DEFAULT_REVIEW_PATH = DEFAULT_DATASET_DIR / "yelp_academic_dataset_review.json"
DEFAULT_OUTPUT_DIR = Path("data") / "yelp_filtered"
COMPACT_JSON_SEPARATORS = (",", ":")
SLIM_REVIEW_FIELDS = ("review_id", "business_id", "stars", "date")
PHILADELPHIA_ZIPS = {
    "19101", "19102", "19103", "19104", "19105", "19106", "19107", "19108",
    "19109", "19110", "19111", "19112", "19114", "19115", "19116", "19118",
    "19119", "19120", "19121", "19122", "19123", "19124", "19125", "19126",
    "19127", "19128", "19129", "19130", "19131", "19132", "19133", "19134",
    "19135", "19136", "19137", "19138", "19139", "19140", "19141", "19142",
    "19143", "19144", "19145", "19146", "19147", "19148", "19149", "19150",
    "19151", "19152", "19153", "19154", "19160", "19176", "19190", "19192",
}


def is_blank(value) -> bool:
    return value is None or str(value).strip() == ""


def is_restaurant(record: dict) -> bool:
    categories = record.get("categories")
    if is_blank(categories):
        return False

    return "Restaurants" in {category.strip() for category in categories.split(",")}


def missing_location_city_zip(record: dict) -> bool:
    return (
        is_blank(record.get("address"))
        and is_blank(record.get("city"))
        and is_blank(record.get("postal_code"))
    )


def normalize_zip(value) -> str:
    if is_blank(value):
        return ""

    return str(value).strip().split("-", 1)[0].zfill(5)


def iter_json_records(path: Path):
    with path.open("r", encoding="utf-8") as src:
        first_char = src.read(1)
        src.seek(0)

        if first_char == "[":
            yield from json.load(src)
            return

        for line in src:
            if line.strip():
                yield json.loads(line)


def write_json_array_start(dst) -> None:
    dst.write("[\n")


def write_json_array_record(dst, record: dict, is_first: bool) -> None:
    if not is_first:
        dst.write(",\n")
    dst.write(
        json.dumps(
            record,
            ensure_ascii=False,
            separators=COMPACT_JSON_SEPARATORS,
        )
    )


def write_json_array_end(dst) -> None:
    dst.write("\n]\n")


def filter_businesses(
    business_path: Path,
    location_output_path: Path,
    philadelphia_output_path: Path,
) -> tuple[set[str], dict[str, int]]:
    philadelphia_business_ids = set()
    counts = {
        "business_records_seen": 0,
        "restaurants_seen": 0,
        "restaurants_with_location_city_or_zip_kept": 0,
        "restaurants_dropped_missing_all_three": 0,
        "philadelphia_restaurants_kept": 0,
        "restaurants_dropped_by_zip": 0,
    }

    with business_path.open("r", encoding="utf-8") as src, location_output_path.open(
        "w", encoding="utf-8", newline="\n"
    ) as location_dst, philadelphia_output_path.open(
        "w", encoding="utf-8", newline="\n"
    ) as philadelphia_dst:
        write_json_array_start(philadelphia_dst)
        first_philadelphia_record = True

        for line in src:
            counts["business_records_seen"] += 1
            record = json.loads(line)

            if not is_restaurant(record):
                continue

            counts["restaurants_seen"] += 1
            if missing_location_city_zip(record):
                counts["restaurants_dropped_missing_all_three"] += 1
                continue

            location_dst.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                    separators=COMPACT_JSON_SEPARATORS,
                )
                + "\n"
            )
            counts["restaurants_with_location_city_or_zip_kept"] += 1

            if normalize_zip(record.get("postal_code")) not in PHILADELPHIA_ZIPS:
                counts["restaurants_dropped_by_zip"] += 1
                continue

            write_json_array_record(
                philadelphia_dst,
                record,
                first_philadelphia_record,
            )
            first_philadelphia_record = False
            philadelphia_business_ids.add(record["business_id"])
            counts["philadelphia_restaurants_kept"] += 1

        write_json_array_end(philadelphia_dst)

    return philadelphia_business_ids, counts


def business_ids_from_file(path: Path) -> set[str]:
    return {
        record["business_id"]
        for record in iter_json_records(path)
        if record.get("business_id")
    }


def slim_review(record: dict) -> dict:
    return {field: record.get(field) for field in SLIM_REVIEW_FIELDS}


def filter_reviews(review_path: Path, output_path: Path, kept_business_ids: set[str]) -> dict[str, int]:
    counts = {
        "review_records_seen": 0,
        "philadelphia_restaurant_reviews_kept": 0,
    }

    with review_path.open("r", encoding="utf-8") as src, output_path.open(
        "w", encoding="utf-8", newline="\n"
    ) as dst:
        write_json_array_start(dst)
        first_review_record = True

        for line in src:
            counts["review_records_seen"] += 1
            record = json.loads(line)

            if record.get("business_id") not in kept_business_ids:
                continue

            write_json_array_record(dst, slim_review(record), first_review_record)
            first_review_record = False
            counts["philadelphia_restaurant_reviews_kept"] += 1

        write_json_array_end(dst)

    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Keep Yelp restaurant businesses unless address, city, and postal_code "
            "are all missing, then keep only reviews for those retained restaurants."
        )
    )
    parser.add_argument("--business", type=Path, default=DEFAULT_BUSINESS_PATH)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--review-businesses",
        type=Path,
        help=(
            "Optional restaurant JSON/JSONL file whose business_id values should "
            "be used to filter reviews. Defaults to the generated Philadelphia "
            "restaurants file."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    location_business_output = args.output_dir / "yelp_restaurants_with_location_city_or_zip.json"
    philadelphia_business_output = args.output_dir / "yelp_restaurants_philadelphia_zips.json"
    review_output = args.output_dir / "yelp_reviews_philadelphia_zips.json"
    summary_output = args.output_dir / "filter_summary.json"

    philadelphia_business_ids, business_counts = filter_businesses(
        args.business,
        location_business_output,
        philadelphia_business_output,
    )
    review_business_path = args.review_businesses or philadelphia_business_output
    review_business_ids = (
        business_ids_from_file(review_business_path)
        if args.review_businesses
        else philadelphia_business_ids
    )
    review_counts = filter_reviews(args.review, review_output, review_business_ids)

    summary = {
        "business_input": str(args.business),
        "review_input": str(args.review),
        "location_city_or_zip_business_output": str(location_business_output),
        "philadelphia_business_output": str(philadelphia_business_output),
        "review_business_ids_input": str(review_business_path),
        "review_output": str(review_output),
        "review_fields": list(SLIM_REVIEW_FIELDS),
        "zip_codes": sorted(PHILADELPHIA_ZIPS),
        **business_counts,
        **review_counts,
    }

    summary_output.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
