"""
Loads the USDA FoodData Central full multi-source CSV export (Foundation Foods +
SR Legacy + Survey/FNDDS - Branded Foods deliberately excluded, see schema.sql's
header comment for why) into a dedicated `fdc` Postgres schema, using native COPY
(via psycopg2's copy_expert) so quoting/embedded newlines are parsed by Postgres
itself rather than a hand-rolled parser.

This is a one-off reference-data import, deliberately kept outside the
Node/Drizzle toolchain (see schema.sql header comment for why).

Usage:
    pip install psycopg2-binary
    python load.py [--database-url postgres://...] [--reset]

Defaults to $DATABASE_URL, falling back to the same local dev default
used by packages/db/scripts/reset-schema.ts.

Every field in these CSVs is quoted, so a blank value is a quoted empty
string (""), not an unquoted empty field - Postgres COPY only treats the
latter as NULL by default. FORCE_NULL makes quoted "" become NULL too,
but it's only applied to numeric/date/int columns below: text columns
(and lab_method_code.code, which is blank for some real rows and is part
of its primary key) keep "" as an actual empty string.

branded_food.csv sits alongside the other CSVs but is never loaded (excluded
by design). Several other tables carry an fdc_id (or a once-removed id) that
CAN point at any food regardless of source, including branded ones - loading
those un-filtered would violate the FK to fdc.food (which never gets branded
rows). This script filters exactly those tables down to rows whose reference
survived the branded exclusion, streaming each source CSV to a temp file
rather than holding multi-GB files in memory (food_nutrient.csv alone is
~1.8GB). Detail tables that are inherently restricted to a single non-branded
data_type (foundation_food, sr_legacy_food, survey_fndds_food, sample_food,
market_acquisition, agricultural_samples, sub_sample_food) don't need
filtering - every row in them already refers to a food outside the excluded
set, by construction.
"""

import argparse
import csv
import os
import sys
import tempfile
import time
from pathlib import Path

import psycopg2

DATA_DIR = Path(__file__).resolve().parent.parent
SCHEMA_SQL = Path(__file__).resolve().parent / "schema.sql"

DEFAULT_DATABASE_URL = "postgres://postgres:123456@localhost:5433/digital_menu"

# A few branded/FNDDS text fields (ingredient lists, descriptions) run long.
csv.field_size_limit(10_000_000)

# ---------------------------------------------------------------------------
# Level 0: no FK to fdc.food at all - safe to load before or after food.csv.
# (csv filename, table name, columns in the CSV's own column order, FORCE_NULL columns)
# ---------------------------------------------------------------------------
LEVEL0_TABLES = [
    ("food_category.csv", "fdc.food_category",
     ["id", "code", "description"], ["id"]),
    ("nutrient.csv", "fdc.nutrient",
     ["id", "name", "unit_name", "nutrient_nbr", "rank"], ["id", "rank"]),
    ("measure_unit.csv", "fdc.measure_unit",
     ["id", "name"], ["id"]),
    ("food_attribute_type.csv", "fdc.food_attribute_type",
     ["id", "name", "description"], ["id"]),
    ("lab_method.csv", "fdc.lab_method",
     ["id", "description", "technique"], ["id"]),
    ("food_nutrient_derivation.csv", "fdc.food_nutrient_derivation",
     ["id", "code", "description"], ["id"]),
    ("food_nutrient_source.csv", "fdc.food_nutrient_source",
     ["id", "code", "description"], ["id"]),
    ("wweia_food_category.csv", "fdc.wweia_food_category",
     ["code", "description"], ["code"]),
    ("fndds_derivation.csv", "fdc.fndds_derivation",
     ["code", "description"], []),
    ("lab_method_code.csv", "fdc.lab_method_code",
     ["lab_method_id", "code"], ["lab_method_id"]),
    ("lab_method_nutrient.csv", "fdc.lab_method_nutrient",
     ["lab_method_id", "nutrient_id"], ["lab_method_id", "nutrient_id"]),
    ("fndds_ingredient_nutrient_value.csv", "fdc.fndds_ingredient_nutrient_value",
     ["ingredient_code", "ingredient_description", "nutrient_code", "nutrient_value",
      "nutrient_value_source", "fdc_id", "derivation_code", "sr_addmod_year",
      "foundation_year_acquired", "start_date", "end_date"],
     ["nutrient_code", "nutrient_value", "fdc_id", "start_date", "end_date"]),
]

# ---------------------------------------------------------------------------
# Level 2: FK's to fdc.food, but every row is inherently restricted to a
# single non-branded data_type - safe to load unfiltered once food.csv exists.
# ---------------------------------------------------------------------------
LEVEL2_SAFE_TABLES = [
    ("foundation_food.csv", "fdc.foundation_food",
     ["fdc_id", "ndb_number", "footnote"], ["fdc_id"]),
    ("sr_legacy_food.csv", "fdc.sr_legacy_food",
     ["fdc_id", "ndb_number"], ["fdc_id"]),
    ("survey_fndds_food.csv", "fdc.survey_fndds_food",
     ["fdc_id", "food_code", "wweia_category_code", "start_date", "end_date"],
     ["fdc_id", "wweia_category_code", "start_date", "end_date"]),
    ("sample_food.csv", "fdc.sample_food",
     ["fdc_id"], ["fdc_id"]),
    ("market_acquisition.csv", "fdc.market_acquisition",
     ["fdc_id", "brand_description", "expiration_date", "label_weight", "location",
      "acquisition_date", "sales_type", "sample_lot_nbr", "sell_by_date", "store_city",
      "store_name", "store_state", "upc_code", "acquisition_number"],
     ["fdc_id", "expiration_date", "acquisition_date", "sell_by_date"]),
    ("agricultural_samples.csv", "fdc.agricultural_samples",
     ["fdc_id", "acquisition_date", "market_class", "treatment", "state"],
     ["fdc_id", "acquisition_date"]),
]

# ---------------------------------------------------------------------------
# Level 3: same story as level 2 - FK to food only, inherently non-branded.
# ---------------------------------------------------------------------------
LEVEL3_SAFE_TABLES = [
    ("sub_sample_food.csv", "fdc.sub_sample_food",
     ["fdc_id", "fdc_id_of_sample_food"], ["fdc_id", "fdc_id_of_sample_food"]),
]

# ---------------------------------------------------------------------------
# Level 2/3 tables that CAN reference a branded fdc_id and must be filtered.
# Each entry: (csv filename, table name, csv_columns (raw header order/names,
# used to read the row), table_columns (target column names in the same
# order, used in the COPY statement - differs from csv_columns only for
# food_update_log_entry, whose CSV header literally calls fdc_id "id"),
# force_null (target names), filters: [(csv_column, allowed_set_key), ...]
# - a row is kept only if every referenced value is blank or present in
# allowed_sets[allowed_set_key], capture_column (csv name) + capture_key -
# if set, the table_columns-mapped id column's surviving values are collected
# into allowed_sets[capture_key] for later tables to filter against.
# ---------------------------------------------------------------------------
FILTERED_TABLES = [
    ("food_attribute.csv", "fdc.food_attribute",
     ["id", "fdc_id", "seq_num", "food_attribute_type_id", "name", "value"],
     ["id", "fdc_id", "seq_num", "food_attribute_type_id", "name", "value"],
     ["id", "fdc_id", "seq_num", "food_attribute_type_id"],
     [("fdc_id", "fdc_id")], None, None),
    ("food_component.csv", "fdc.food_component",
     ["id", "fdc_id", "name", "pct_weight", "is_refuse", "gram_weight", "data_points", "min_year_acquired"],
     ["id", "fdc_id", "name", "pct_weight", "is_refuse", "gram_weight", "data_points", "min_year_acquired"],
     ["id", "fdc_id", "pct_weight", "is_refuse", "gram_weight", "data_points", "min_year_acquired"],
     [("fdc_id", "fdc_id")], None, None),
    ("food_nutrient.csv", "fdc.food_nutrient",
     ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id", "min", "max",
      "median", "loq", "footnote", "min_year_acquired", "percent_daily_value"],
     ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id", "min", "max",
      "median", "loq", "footnote", "min_year_acquired", "percent_daily_value"],
     ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id", "min", "max",
      "median", "loq", "min_year_acquired", "percent_daily_value"],
     [("fdc_id", "fdc_id")], "id", "food_nutrient_id"),
    ("food_portion.csv", "fdc.food_portion",
     ["id", "fdc_id", "seq_num", "amount", "measure_unit_id", "portion_description", "modifier",
      "gram_weight", "data_points", "footnote", "min_year_acquired"],
     ["id", "fdc_id", "seq_num", "amount", "measure_unit_id", "portion_description", "modifier",
      "gram_weight", "data_points", "footnote", "min_year_acquired"],
     ["id", "fdc_id", "seq_num", "amount", "measure_unit_id", "gram_weight", "data_points", "min_year_acquired"],
     [("fdc_id", "fdc_id")], None, None),
    ("food_nutrient_conversion_factor.csv", "fdc.food_nutrient_conversion_factor",
     ["id", "fdc_id"], ["id", "fdc_id"], ["id", "fdc_id"],
     [("fdc_id", "fdc_id")], "id", "conversion_factor_id"),
    ("food_update_log_entry.csv", "fdc.food_update_log_entry",
     ["id", "description", "last_updated"], ["fdc_id", "description", "last_updated"],
     ["fdc_id", "last_updated"],
     [("id", "fdc_id")], None, None),
    ("input_food.csv", "fdc.input_food",
     ["id", "fdc_id", "fdc_id_of_input_food", "seq_num", "amount", "sr_code", "sr_description",
      "unit", "portion_code", "portion_description", "gram_weight", "retention_code"],
     ["id", "fdc_id", "fdc_id_of_input_food", "seq_num", "amount", "sr_code", "sr_description",
      "unit", "portion_code", "portion_description", "gram_weight", "retention_code"],
     ["id", "fdc_id", "fdc_id_of_input_food", "seq_num", "amount", "gram_weight"],
     [("fdc_id", "fdc_id"), ("fdc_id_of_input_food", "fdc_id")], None, None),
    ("acquisition_samples.csv", "fdc.acquisition_samples",
     ["fdc_id_of_sample_food", "fdc_id_of_acquisition_food"],
     ["fdc_id_of_sample_food", "fdc_id_of_acquisition_food"],
     ["fdc_id_of_sample_food", "fdc_id_of_acquisition_food"],
     [("fdc_id_of_acquisition_food", "fdc_id")], None, None),
    ("food_calorie_conversion_factor.csv", "fdc.food_calorie_conversion_factor",
     ["food_nutrient_conversion_factor_id", "protein_value", "fat_value", "carbohydrate_value"],
     ["food_nutrient_conversion_factor_id", "protein_value", "fat_value", "carbohydrate_value"],
     ["food_nutrient_conversion_factor_id", "protein_value", "fat_value", "carbohydrate_value"],
     [("food_nutrient_conversion_factor_id", "conversion_factor_id")], None, None),
    ("food_protein_conversion_factor.csv", "fdc.food_protein_conversion_factor",
     ["food_nutrient_conversion_factor_id", "value"],
     ["food_nutrient_conversion_factor_id", "value"],
     ["food_nutrient_conversion_factor_id", "value"],
     [("food_nutrient_conversion_factor_id", "conversion_factor_id")], None, None),
    ("sub_sample_result.csv", "fdc.sub_sample_result",
     ["food_nutrient_id", "adjusted_amount", "lab_method_id", "nutrient_name"],
     ["food_nutrient_id", "adjusted_amount", "lab_method_id", "nutrient_name"],
     ["food_nutrient_id", "adjusted_amount", "lab_method_id"],
     [("food_nutrient_id", "food_nutrient_id")], None, None),
]


def load_plain(cur, filename, table, columns, force_null):
    """Direct COPY, no row-level filtering. `columns` must match the CSV's own
    column order (not necessarily its literal header text - HEADER true just
    skips line 1)."""
    path = DATA_DIR / filename
    col_list = ", ".join(columns)
    force_null_clause = f", FORCE_NULL ({', '.join(force_null)})" if force_null else ""
    copy_sql = f"COPY {table} ({col_list}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL ''{force_null_clause})"
    start = time.time()
    with path.open("r", encoding="utf-8", newline="") as f:
        cur.copy_expert(copy_sql, f)
        cur.execute(f"SELECT count(*) FROM {table}")
        (n,) = cur.fetchone()
    print(f"{table:<45} {n:>8} rows  ({time.time() - start:.1f}s)")


def load_food_csv(cur):
    """Loads food.csv, excluding branded_food rows. Returns the set of loaded fdc_ids."""
    path = DATA_DIR / "food.csv"
    columns = ["fdc_id", "data_type", "description", "food_category_id", "publication_date"]
    allowed_fdc_ids = set()
    total = kept = 0
    start = time.time()
    with path.open("r", encoding="utf-8", newline="") as src, tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", suffix=".csv", delete=False
    ) as tmp:
        reader = csv.DictReader(src)
        writer = csv.writer(tmp, quoting=csv.QUOTE_ALL)
        for row in reader:
            total += 1
            if row["data_type"] == "branded_food":
                continue
            allowed_fdc_ids.add(int(row["fdc_id"]))
            writer.writerow([row[c] for c in columns])
            kept += 1
        tmp_path = Path(tmp.name)
    try:
        copy_sql = (
            "COPY fdc.food (fdc_id, data_type, description, food_category_id, publication_date) "
            "FROM STDIN WITH (FORMAT csv, HEADER false, NULL '', "
            "FORCE_NULL (fdc_id, food_category_id, publication_date))"
        )
        with tmp_path.open("r", encoding="utf-8", newline="") as f:
            cur.copy_expert(copy_sql, f)
        cur.execute("SELECT count(*) FROM fdc.food")
        (n,) = cur.fetchone()
    finally:
        tmp_path.unlink(missing_ok=True)
    print(f"fdc.food{'':<37} {n:>8} rows  ({time.time() - start:.1f}s)  ({kept} of {total} kept, branded_food excluded)")
    return allowed_fdc_ids


def load_filtered(cur, filename, table, csv_columns, table_columns, force_null, filters,
                   capture_column, capture_key, allowed_sets):
    """Streams filename, keeping rows where every (csv_column, set_key) in `filters` has a
    blank value or a value present in allowed_sets[set_key]. Writes matches (re-ordered to
    table_columns) to a temp CSV, then COPYs that into `table`. If capture_column is given,
    collects that column's surviving values into allowed_sets[capture_key] for later tables."""
    path = DATA_DIR / filename
    captured = set() if capture_column else None
    total = kept = 0
    start = time.time()
    with path.open("r", encoding="utf-8", newline="") as src, tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", suffix=".csv", delete=False
    ) as tmp:
        reader = csv.DictReader(src)
        writer = csv.writer(tmp, quoting=csv.QUOTE_ALL)
        for row in reader:
            total += 1
            ok = True
            for column, set_key in filters:
                value = row[column]
                if value and int(value) not in allowed_sets[set_key]:
                    ok = False
                    break
            if not ok:
                continue
            writer.writerow([row[c] for c in csv_columns])
            if capture_column and row[capture_column]:
                captured.add(int(row[capture_column]))
            kept += 1
        tmp_path = Path(tmp.name)
    try:
        col_list = ", ".join(table_columns)
        force_null_clause = f", FORCE_NULL ({', '.join(force_null)})" if force_null else ""
        copy_sql = f"COPY {table} ({col_list}) FROM STDIN WITH (FORMAT csv, HEADER false, NULL ''{force_null_clause})"
        with tmp_path.open("r", encoding="utf-8", newline="") as f:
            cur.copy_expert(copy_sql, f)
        cur.execute(f"SELECT count(*) FROM {table}")
        (n,) = cur.fetchone()
    finally:
        tmp_path.unlink(missing_ok=True)
    print(f"{table:<45} {n:>8} rows  ({time.time() - start:.1f}s)  ({kept} of {total} kept)")
    if capture_column:
        allowed_sets[capture_key] = captured


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--reset", action="store_true", help="Drop the fdc schema before recreating it")
    args = parser.parse_args()

    conn = psycopg2.connect(args.database_url)
    try:
        with conn.cursor() as cur:
            if args.reset:
                print("Dropping existing fdc schema...")
                cur.execute("DROP SCHEMA IF EXISTS fdc CASCADE")
            print("Applying schema.sql...")
            cur.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
        conn.commit()

        with conn.cursor() as cur:
            for filename, table, columns, force_null in LEVEL0_TABLES:
                load_plain(cur, filename, table, columns, force_null)
        conn.commit()

        with conn.cursor() as cur:
            allowed_sets = {"fdc_id": load_food_csv(cur)}
        conn.commit()

        with conn.cursor() as cur:
            for filename, table, columns, force_null in LEVEL2_SAFE_TABLES:
                load_plain(cur, filename, table, columns, force_null)
        conn.commit()

        with conn.cursor() as cur:
            for filename, table, csv_columns, table_columns, force_null, filters, capture_column, capture_key in FILTERED_TABLES:
                load_filtered(cur, filename, table, csv_columns, table_columns, force_null, filters,
                               capture_column, capture_key, allowed_sets)
        conn.commit()

        with conn.cursor() as cur:
            for filename, table, columns, force_null in LEVEL3_SAFE_TABLES:
                load_plain(cur, filename, table, columns, force_null)
        conn.commit()

        print("Done.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
