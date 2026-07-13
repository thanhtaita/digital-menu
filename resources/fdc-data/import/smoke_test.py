"""
Executes each query in smoke_test.sql against the fdc schema and prints
results, as a quick end-to-end check that the import is queryable the way
apps/api would actually query it.

Usage: python smoke_test.py [--database-url postgres://...]
"""

import argparse
import os
import re
from pathlib import Path

import psycopg2

DEFAULT_DATABASE_URL = "postgres://postgres:123456@localhost:5433/digital_menu"
SQL_FILE = Path(__file__).resolve().parent / "smoke_test.sql"


def split_statements(sql_text: str):
    blocks = re.split(r"\n-- (\d+\..*)\n", "\n" + sql_text)
    statements = []
    for i in range(1, len(blocks), 2):
        title = blocks[i].strip()
        body = blocks[i + 1].strip().rstrip(";")
        statements.append((title, body))
    return statements


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))
    args = parser.parse_args()

    sql_text = SQL_FILE.read_text(encoding="utf-8")
    statements = split_statements(sql_text)

    conn = psycopg2.connect(args.database_url)
    try:
        for title, body in statements:
            print(f"\n=== {title} ===")
            with conn.cursor() as cur:
                cur.execute(body)
                cols = [d.name for d in cur.description]
                rows = cur.fetchall()
                print("  " + " | ".join(cols))
                for row in rows:
                    print("  " + " | ".join("" if v is None else str(v) for v in row))
                print(f"  ({len(rows)} row(s))")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
