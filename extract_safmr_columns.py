import csv
import re
from pathlib import Path


DATA_DIR = Path("data")
SOURCE_DIR = DATA_DIR / "safmrs_all_counties"
OUTPUT_DIR = DATA_DIR / "extracted_safmr_columns"
MASTER_OUTPUT = DATA_DIR / "philadelphia_safmr_master.csv"
ZIP_CODES = [
    "19101","19102","19103","19104","19105","19106","19107","19108","19109","19110","19111","19112","19114","19115",
    "19116","19118","19119","19120","19121","19122","19123","19124","19125","19126","19127","19128","19129","19130",
    "19131","19132","19133","19134","19135","19136","19137","19138","19139","19140","19141","19142","19143","19144",
    "19145","19146","19147","19148","19149","19150","19151","19152","19153","19154","19160","19176","19190","19192",]


def normalize_name(name: str) -> str:
    """Collapse whitespace and punctuation so header matching is resilient."""
    cleaned = re.sub(r"[\s\r\n\t]+", " ", name.strip().lower())
    cleaned = cleaned.replace("-", " ")
    cleaned = re.sub(r"[^a-z0-9 ]+", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


TARGET_COLUMNS = {
    "zip_code": {
        "zip code",
        "zipcode",
        "zip",
        "zip_code",
        "zcta",
    },
    "safmr_0br": {
        "safmr 0br",
        "safmr0br",
        "safmr_0br",
        "area_rent_br0",
        "efficiency",
    },
    "safmr_1br": {
        "safmr 1br",
        "safmr1br",
        "safmr_1br",
        "area_rent_br1",
        "one bedroom",
        "onebedroom",
    },
    "safmr_2br": {
        "safmr 2br",
        "safmr2br",
        "safmr_2br",
        "area_rent_br2",
        "two bedroom",
        "twobedroom",
    },
    "safmr_3br": {
        "safmr 3br",
        "safmr3br",
        "safmr_3br",
        "area_rent_br3",
        "three bedroom",
        "threebedroom",
    },
    "safmr_4br": {
        "safmr 4br",
        "safmr4br",
        "safmr_4br",
        "area_rent_br4",
        "four bedroom",
        "fourbedroom",
    },
}


def match_columns(fieldnames: list[str]) -> dict[str, str]:
    """Map standardized output column names to the matching source headers."""
    normalized_to_original = {normalize_name(name): name for name in fieldnames}
    matched = {}
    for target_name, aliases in TARGET_COLUMNS.items():
        for alias in aliases:
            original = normalized_to_original.get(normalize_name(alias))
            if original:
                matched[target_name] = original
                break
    return matched


def clean_value(value: str) -> str:
    """Strip currency formatting while leaving plain numeric strings intact."""
    return value.replace("$", "").strip()


def normalize_zip(value: str) -> str:
    """Normalize ZIP-like values so cross-file matching is reliable."""
    cleaned = clean_value(value).replace(",", "")
    return cleaned.zfill(5) if cleaned.isdigit() and len(cleaned) <= 5 else cleaned


def extract_file(csv_path: Path, allowed_zips: set[str]) -> tuple[bool, str]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as src_file:
        reader = csv.DictReader(src_file)
        if not reader.fieldnames:
            return False, "missing header row"

        matches = match_columns(reader.fieldnames)
        required = {"safmr_0br", "safmr_1br", "safmr_2br", "safmr_3br", "safmr_4br"}
        missing = sorted(required - matches.keys())
        if missing:
            return False, f"missing columns: {', '.join(missing)}"

        output_columns = ["zip_code", "safmr_0br", "safmr_1br", "safmr_2br", "safmr_3br", "safmr_4br"]
        if "zip_code" not in matches:
            output_columns = output_columns[1:]

        OUTPUT_DIR.mkdir(exist_ok=True)
        output_path = OUTPUT_DIR / f"{csv_path.stem}_safmr_columns.csv"
        with output_path.open("w", encoding="utf-8", newline="") as out_file:
            writer = csv.DictWriter(out_file, fieldnames=output_columns)
            writer.writeheader()
            for row in reader:
                if "zip_code" in matches:
                    zip_value = normalize_zip(row[matches["zip_code"]]) if row.get(matches["zip_code"]) else ""
                    if zip_value not in allowed_zips:
                        continue
                writer.writerow(
                    {
                        column: normalize_zip(row[matches[column]])
                        if column == "zip_code" and row.get(matches[column])
                        else clean_value(row[matches[column]]) if row.get(matches[column]) else ""
                        for column in output_columns
                    }
                )

    return True, str(output_path)


def extract_year(path: Path) -> str:
    """Read the fiscal year from filenames like fy2017_safmrs_revised.csv."""
    match = re.search(r"fy(\d{4})", path.stem, re.IGNORECASE)
    return match.group(1) if match else ""


def build_master_file() -> None:
    """Combine extracted CSVs into one master file with a Year column."""
    extracted_files = sorted(OUTPUT_DIR.glob("*_safmr_columns.csv"))
    fieldnames = ["Year", "zip_code", "safmr_0br", "safmr_1br", "safmr_2br", "safmr_3br", "safmr_4br"]

    with MASTER_OUTPUT.open("w", encoding="utf-8", newline="") as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        writer.writeheader()

        for extracted_path in extracted_files:
            year = extract_year(extracted_path)
            if not year:
                continue

            with extracted_path.open("r", encoding="utf-8-sig", newline="") as src_file:
                reader = csv.DictReader(src_file)
                for row in reader:
                    writer.writerow(
                        {
                            "Year": year,
                            "zip_code": row.get("zip_code", ""),
                            "safmr_0br": row.get("safmr_0br", ""),
                            "safmr_1br": row.get("safmr_1br", ""),
                            "safmr_2br": row.get("safmr_2br", ""),
                            "safmr_3br": row.get("safmr_3br", ""),
                            "safmr_4br": row.get("safmr_4br", ""),
                        }
                    )


def main() -> None:
    allowed_zips = {normalize_zip(zip_code) for zip_code in ZIP_CODES}
    csv_files = sorted(
        path
        for path in SOURCE_DIR.glob("*.csv")
        if not path.name.endswith("_safmr_columns.csv") and path.name != MASTER_OUTPUT.name
    )
    if not csv_files:
        print("No CSV files found in source directory.")
        return

    for csv_path in csv_files:
        ok, message = extract_file(csv_path, allowed_zips)
        status = "OK" if ok else "SKIP"
        print(f"{status}\t{csv_path.name}\t{message}")

    build_master_file()
    print(f"OK\tmaster\t{MASTER_OUTPUT}")


if __name__ == "__main__":
    main()
