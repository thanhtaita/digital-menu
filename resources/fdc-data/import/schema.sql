-- USDA FoodData Central reference data (2026-04-30 full export), spanning
-- Foundation Foods + SR Legacy + Survey/FNDDS. Lives in its own `fdc` schema,
-- separate from the app's Drizzle-managed `public` schema. This is static
-- third-party reference data, not app-owned schema, so it is intentionally
-- NOT tracked by drizzle-kit.
--
-- Deliberately excluded from the load (see load.py):
--   * Branded Foods (branded_food.csv, data_type='branded_food') - ~2M rows,
--     95% of the export. A branded product's description ("Great Value Whole
--     Milk") is too specific to safely become a generic ingredient's canonical
--     nutrition match, and excluding it keeps this dataset small. load.py
--     filters every dependent table (food_nutrient, food_attribute, etc.) down
--     to non-branded fdc_ids so no FK ever points at an unloaded branded row.
--   * retention_factor.csv - its actual CSV header (`n.gid, n.code,
--     n.foodGroupId, n.description`) doesn't line up with what the vendor's
--     field-description workbook documents for this table, and nothing in the
--     app consumes it. Skipped rather than guessing at a possibly-wrong
--     column mapping; revisit if a future need for retention factors comes up.
--   * microbe.csv - 18 rows, camelCase `foodId`, unused by any app code.
--
-- Column/table layout mirrors the actual CSV headers in the sibling
-- directory (which in a few places differ slightly from the vendor's
-- "Download API Field Descriptions.xlsx", e.g. food_update_log_entry's
-- fdc_id column is literally named "id" in the CSV, and fndds_derivation.csv /
-- fndds_ingredient_nutrient_value.csv ship space-separated, mixed-case headers
-- that load.py re-maps to normal snake_case columns positionally).
--
-- Known referential gaps in the source export (left as plain indexed
-- columns instead of FK constraints, so load doesn't abort on them):
--   * food_nutrient.nutrient_id -> nutrient: had 1 orphaned nutrient_id (2066)
--     in the 2025-12-18 Foundation-only export; not reconfirmed against this
--     export, kept as a precaution.
--   * food_nutrient_conversion_factor.fdc_id -> food: in the old
--     Foundation-only export this file appeared to be shipped un-filtered
--     across all FDC download types (~94% of rows pointed outside the
--     downloaded subset). The 2026-04-30 full export's version of this file
--     is much smaller (789 rows total) and load.py filters it down further
--     (excluding branded_food) - expected to resolve mostly cleanly now, but
--     still not a hard FK since full closure hasn't been verified.
--   * sub_sample_food.fdc_id_of_sample_food -> sample_food: 1 orphan (as of
--     the 2025-12-18 export; not reconfirmed).
--   * sub_sample_result.food_nutrient_id -> food_nutrient: 17 orphans (as of
--     the 2025-12-18 export; not reconfirmed). load.py additionally filters
--     this against food_nutrient rows that survived the branded exclusion.
--   * food.food_category_id -> food_category: food_category.csv only has ~28
--     rows (the classic 4-digit USDA category codes), but food.csv's
--     food_category_id also carries values from a much larger numbering
--     scheme (seen: 9602) presumably tied to Branded/WWEIA-only categories
--     not represented in this lookup table - confirmed by a hard FK failure
--     during the 2026-04-30 load. Not FK-enforced.

CREATE SCHEMA IF NOT EXISTS fdc;

-- ---------- Level 0: no FK dependencies ----------

CREATE TABLE fdc.food_category (
  id          INTEGER PRIMARY KEY,
  code        TEXT,
  description TEXT
);

CREATE TABLE fdc.nutrient (
  id          INTEGER PRIMARY KEY,
  name        TEXT,
  unit_name   TEXT,
  nutrient_nbr TEXT,
  rank        NUMERIC
);

CREATE TABLE fdc.measure_unit (
  id   INTEGER PRIMARY KEY,
  name TEXT
);

CREATE TABLE fdc.food_attribute_type (
  id          INTEGER PRIMARY KEY,
  name        TEXT,
  description TEXT
);

CREATE TABLE fdc.lab_method (
  id          INTEGER PRIMARY KEY,
  description TEXT,
  technique   TEXT
);

CREATE TABLE fdc.food_nutrient_derivation (
  id          INTEGER PRIMARY KEY,
  code        TEXT,
  description TEXT
);

CREATE TABLE fdc.food_nutrient_source (
  id          INTEGER PRIMARY KEY,
  code        TEXT,
  description TEXT
);

CREATE TABLE fdc.wweia_food_category (
  code        INTEGER PRIMARY KEY,
  description TEXT
);

CREATE TABLE fdc.fndds_derivation (
  code        TEXT PRIMARY KEY,
  description TEXT
);

-- Not FK'd to fdc.food: keyed by SR/NDB ingredient code, not a food-level
-- record, and its own "FDC ID" column isn't guaranteed to fall inside the
-- loaded (non-branded) food set - see header comment.
CREATE TABLE fdc.fndds_ingredient_nutrient_value (
  id                        SERIAL PRIMARY KEY,
  ingredient_code           TEXT,
  ingredient_description    TEXT,
  nutrient_code             INTEGER,
  nutrient_value            NUMERIC,
  nutrient_value_source     TEXT,
  fdc_id                    INTEGER,
  derivation_code           TEXT,
  sr_addmod_year            TEXT,
  foundation_year_acquired  TEXT,
  start_date                DATE,
  end_date                  DATE
);

-- ---------- Level 1 ----------

CREATE TABLE fdc.food (
  fdc_id           INTEGER PRIMARY KEY,
  data_type        TEXT,
  description      TEXT,
  food_category_id INTEGER, -- see known gap note above; not FK-enforced
  publication_date DATE
);
CREATE INDEX food_category_id_idx ON fdc.food(food_category_id);

CREATE TABLE fdc.lab_method_code (
  lab_method_id INTEGER NOT NULL REFERENCES fdc.lab_method(id),
  code          TEXT NOT NULL,
  PRIMARY KEY (lab_method_id, code)
);

CREATE TABLE fdc.lab_method_nutrient (
  lab_method_id INTEGER NOT NULL REFERENCES fdc.lab_method(id),
  nutrient_id   INTEGER NOT NULL REFERENCES fdc.nutrient(id),
  PRIMARY KEY (lab_method_id, nutrient_id)
);

-- ---------- Level 2: depends on food ----------

CREATE TABLE fdc.foundation_food (
  fdc_id     INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  ndb_number TEXT,
  footnote   TEXT
);

CREATE TABLE fdc.sr_legacy_food (
  fdc_id     INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  ndb_number TEXT
);

CREATE TABLE fdc.survey_fndds_food (
  fdc_id              INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  food_code           TEXT,
  wweia_category_code INTEGER REFERENCES fdc.wweia_food_category(code),
  start_date          DATE,
  end_date            DATE
);

CREATE TABLE fdc.sample_food (
  fdc_id INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id)
);

CREATE TABLE fdc.food_attribute (
  id                      INTEGER PRIMARY KEY,
  fdc_id                  INTEGER REFERENCES fdc.food(fdc_id),
  seq_num                 INTEGER,
  food_attribute_type_id  INTEGER REFERENCES fdc.food_attribute_type(id),
  name                    TEXT,
  value                   TEXT
);
CREATE INDEX food_attribute_fdc_id_idx ON fdc.food_attribute(fdc_id);

CREATE TABLE fdc.food_component (
  id                INTEGER PRIMARY KEY,
  fdc_id            INTEGER REFERENCES fdc.food(fdc_id),
  name              TEXT,
  pct_weight        NUMERIC,
  is_refuse         BOOLEAN,
  gram_weight       NUMERIC,
  data_points       INTEGER,
  min_year_acquired INTEGER
);
CREATE INDEX food_component_fdc_id_idx ON fdc.food_component(fdc_id);

CREATE TABLE fdc.food_nutrient (
  id                  INTEGER PRIMARY KEY,
  fdc_id              INTEGER REFERENCES fdc.food(fdc_id),
  nutrient_id         INTEGER, -- see known gap note above; not FK-enforced
  amount              NUMERIC,
  data_points         INTEGER,
  derivation_id       INTEGER REFERENCES fdc.food_nutrient_derivation(id),
  min                 NUMERIC,
  max                 NUMERIC,
  median              NUMERIC,
  loq                 NUMERIC,
  footnote            TEXT,
  min_year_acquired   INTEGER,
  percent_daily_value NUMERIC
);
CREATE INDEX food_nutrient_fdc_id_idx ON fdc.food_nutrient(fdc_id);
CREATE INDEX food_nutrient_nutrient_id_idx ON fdc.food_nutrient(nutrient_id);

CREATE TABLE fdc.food_portion (
  id                INTEGER PRIMARY KEY,
  fdc_id            INTEGER REFERENCES fdc.food(fdc_id),
  seq_num           INTEGER,
  amount            NUMERIC,
  measure_unit_id   INTEGER REFERENCES fdc.measure_unit(id),
  portion_description TEXT,
  modifier          TEXT,
  gram_weight       NUMERIC,
  data_points       INTEGER,
  footnote          TEXT,
  min_year_acquired INTEGER
);
CREATE INDEX food_portion_fdc_id_idx ON fdc.food_portion(fdc_id);

CREATE TABLE fdc.food_nutrient_conversion_factor (
  id     INTEGER PRIMARY KEY,
  fdc_id INTEGER -- see known gap note above; not FK-enforced
);
CREATE INDEX food_nutrient_conversion_factor_fdc_id_idx ON fdc.food_nutrient_conversion_factor(fdc_id);

CREATE TABLE fdc.food_update_log_entry (
  fdc_id       INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  description  TEXT,
  last_updated DATE
);

CREATE TABLE fdc.input_food (
  id                      INTEGER PRIMARY KEY,
  fdc_id                  INTEGER REFERENCES fdc.food(fdc_id),
  fdc_id_of_input_food    INTEGER REFERENCES fdc.food(fdc_id),
  seq_num                 INTEGER,
  amount                  NUMERIC,
  sr_code                 TEXT,
  sr_description          TEXT,
  unit                    TEXT,
  portion_code            TEXT,
  portion_description     TEXT,
  gram_weight             NUMERIC,
  retention_code          TEXT
);
CREATE INDEX input_food_fdc_id_idx ON fdc.input_food(fdc_id);
CREATE INDEX input_food_fdc_id_of_input_food_idx ON fdc.input_food(fdc_id_of_input_food);

CREATE TABLE fdc.market_acquisition (
  fdc_id              INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  brand_description   TEXT,
  expiration_date      DATE,
  label_weight         TEXT,
  location             TEXT,
  acquisition_date     DATE,
  sales_type           TEXT,
  sample_lot_nbr       TEXT,
  sell_by_date         DATE,
  store_city           TEXT,
  store_name           TEXT,
  store_state          TEXT,
  upc_code             TEXT,
  acquisition_number   TEXT
);

CREATE TABLE fdc.agricultural_samples (
  fdc_id           INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  acquisition_date DATE,
  market_class     TEXT,
  treatment        TEXT,
  state            TEXT
);

-- ---------- Level 3: depends on level 2 ----------

CREATE TABLE fdc.sub_sample_food (
  fdc_id                INTEGER PRIMARY KEY REFERENCES fdc.food(fdc_id),
  fdc_id_of_sample_food INTEGER -- see known gap note above; not FK-enforced
);
CREATE INDEX sub_sample_food_sample_food_idx ON fdc.sub_sample_food(fdc_id_of_sample_food);

CREATE TABLE fdc.acquisition_samples (
  fdc_id_of_sample_food      INTEGER NOT NULL REFERENCES fdc.sample_food(fdc_id),
  fdc_id_of_acquisition_food INTEGER NOT NULL REFERENCES fdc.food(fdc_id),
  PRIMARY KEY (fdc_id_of_sample_food, fdc_id_of_acquisition_food)
);

CREATE TABLE fdc.food_calorie_conversion_factor (
  food_nutrient_conversion_factor_id INTEGER PRIMARY KEY REFERENCES fdc.food_nutrient_conversion_factor(id),
  protein_value      NUMERIC,
  fat_value           NUMERIC,
  carbohydrate_value  NUMERIC
);

CREATE TABLE fdc.food_protein_conversion_factor (
  food_nutrient_conversion_factor_id INTEGER PRIMARY KEY REFERENCES fdc.food_nutrient_conversion_factor(id),
  value NUMERIC
);

CREATE TABLE fdc.sub_sample_result (
  food_nutrient_id INTEGER PRIMARY KEY, -- see known gap note above; not FK-enforced
  adjusted_amount  NUMERIC,
  lab_method_id    INTEGER REFERENCES fdc.lab_method(id),
  nutrient_name    TEXT
);

COMMENT ON SCHEMA fdc IS 'USDA FoodData Central reference data (2026-04-30 export: Foundation Foods + SR Legacy + Survey/FNDDS; Branded Foods deliberately excluded). Static reference data, not managed by drizzle.';
