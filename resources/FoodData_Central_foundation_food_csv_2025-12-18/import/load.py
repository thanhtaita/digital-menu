"""
Loads the USDA FoodData Central "Foundation Foods" CSV export into a
dedicated `fdc` Postgres schema, using native COPY (via psycopg2's
copy_expert) so quoting/embedded newlines are parsed by Postgres itself
rather than a hand-rolled parser.

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
"""

import argparse
import os
import sys
import time
from pathlib import Path

import psycopg2

DATA_DIR = Path(__file__).resolve().parent.parent
SCHEMA_SQL = Path(__file__).resolve().parent / "schema.sql"

DEFAULT_DATABASE_URL = "postgres://postgres:123456@localhost:5433/digital_menu"

# (csv filename, table name, columns in the CSV's own column order, columns to FORCE_NULL)
TABLES = [
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
    ("food.csv", "fdc.food",
     ["fdc_id", "data_type", "description", "food_category_id", "publication_date"],
     ["fdc_id", "food_category_id", "publication_date"]),
    ("lab_method_code.csv", "fdc.lab_method_code",
     ["lab_method_id", "code"], ["lab_method_id"]),
    ("lab_method_nutrient.csv", "fdc.lab_method_nutrient",
     ["lab_method_id", "nutrient_id"], ["lab_method_id", "nutrient_id"]),
    ("foundation_food.csv", "fdc.foundation_food",
     ["fdc_id", "ndb_number", "footnote"], ["fdc_id"]),
    ("sample_food.csv", "fdc.sample_food",
     ["fdc_id"], ["fdc_id"]),
    ("food_attribute.csv", "fdc.food_attribute",
     ["id", "fdc_id", "seq_num", "food_attribute_type_id", "name", "value"],
     ["id", "fdc_id", "seq_num", "food_attribute_type_id"]),
    ("food_component.csv", "fdc.food_component",
     ["id", "fdc_id", "name", "pct_weight", "is_refuse", "gram_weight", "data_points", "min_year_acquired"],
     ["id", "fdc_id", "pct_weight", "is_refuse", "gram_weight", "data_points", "min_year_acquired"]),
    ("food_nutrient.csv", "fdc.food_nutrient",
     ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id", "min", "max", "median", "footnote", "min_year_acquired"],
     ["id", "fdc_id", "nutrient_id", "amount", "data_points", "derivation_id", "min", "max", "median", "min_year_acquired"]),
    ("food_portion.csv", "fdc.food_portion",
     ["id", "fdc_id", "seq_num", "amount", "measure_unit_id", "portion_description", "modifier", "gram_weight", "data_points", "footnote", "min_year_acquired"],
     ["id", "fdc_id", "seq_num", "amount", "measure_unit_id", "gram_weight", "data_points", "min_year_acquired"]),
    ("food_nutrient_conversion_factor.csv", "fdc.food_nutrient_conversion_factor",
     ["id", "fdc_id"], ["id", "fdc_id"]),
    ("food_update_log_entry.csv", "fdc.food_update_log_entry",
     ["fdc_id", "description", "last_updated"], ["fdc_id", "last_updated"]),
    ("input_food.csv", "fdc.input_food",
     ["id", "fdc_id", "fdc_of_input_food", "seq_num", "amount", "ingredient_code", "ingredient_description", "unit", "portion_code", "portion_description", "gram_weight", "retention_code"],
     ["id", "fdc_id", "fdc_of_input_food", "seq_num", "amount", "gram_weight"]),
    ("market_acquisition.csv", "fdc.market_acquisition",
     ["fdc_id", "brand_description", "expiration_date", "label_weight", "location", "acquisition_date", "sales_type", "sample_lot_nbr", "sell_by_date", "store_city", "store_name", "store_state", "upc_code", "acquisition_number"],
     ["fdc_id", "expiration_date", "acquisition_date", "sell_by_date"]),
    ("agricultural_samples.csv", "fdc.agricultural_samples",
     ["fdc_id", "acquisition_date", "market_class", "treatment", "state"],
     ["fdc_id", "acquisition_date"]),
    ("sub_sample_food.csv", "fdc.sub_sample_food",
     ["fdc_id", "fdc_id_of_sample_food"], ["fdc_id", "fdc_id_of_sample_food"]),
    ("acquisition_samples.csv", "fdc.acquisition_samples",
     ["fdc_id_of_sample_food", "fdc_id_of_acquisition_food"],
     ["fdc_id_of_sample_food", "fdc_id_of_acquisition_food"]),
    ("food_calorie_conversion_factor.csv", "fdc.food_calorie_conversion_factor",
     ["food_nutrient_conversion_factor_id", "protein_value", "fat_value", "carbohydrate_value"],
     ["food_nutrient_conversion_factor_id", "protein_value", "fat_value", "carbohydrate_value"]),
    ("food_protein_conversion_factor.csv", "fdc.food_protein_conversion_factor",
     ["food_nutrient_conversion_factor_id", "value"],
     ["food_nutrient_conversion_factor_id", "value"]),
    ("sub_sample_result.csv", "fdc.sub_sample_result",
     ["food_nutrient_id", "adjusted_amount", "lab_method_id", "nutrient_name"],
     ["food_nutrient_id", "adjusted_amount", "lab_method_id"]),
]


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

        for filename, table, columns, force_null in TABLES:
            path = DATA_DIR / filename
            col_list = ", ".join(columns)
            force_null_list = ", ".join(force_null)
            copy_sql = (
                f"COPY {table} ({col_list}) FROM STDIN WITH "
                f"(FORMAT csv, HEADER true, NULL '', FORCE_NULL ({force_null_list}))"
            )
            start = time.time()
            with path.open("r", encoding="utf-8", newline="") as f, conn.cursor() as cur:
                cur.copy_expert(copy_sql, f)
                cur.execute(f"SELECT count(*) FROM {table}")
                (n,) = cur.fetchone()
            conn.commit()
            elapsed = time.time() - start
            print(f"{table:<45} {n:>8} rows  ({elapsed:.1f}s)")

        print("Done.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
