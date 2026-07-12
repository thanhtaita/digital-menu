-- USDA FoodData Central "Foundation Foods" reference data.
-- Lives in its own `fdc` schema, separate from the app's Drizzle-managed
-- `public` schema. This is static third-party reference data, not
-- app-owned schema, so it is intentionally NOT tracked by drizzle-kit.
--
-- Column/table layout mirrors the actual CSV headers in the sibling
-- directory (which in a few places differ slightly from the vendor's
-- "Download API Field Descriptions.xlsx", e.g. food_update_log_entry's
-- fdc_id column is literally named "id" in the CSV).
--
-- Known referential gaps in the source export (left as plain indexed
-- columns instead of FK constraints, so load doesn't abort on them):
--   * food_nutrient.nutrient_id -> nutrient: 1 orphaned nutrient_id (2066)
--   * food_nutrient_conversion_factor.fdc_id -> food: ~94% of rows reference
--     foods that are not part of this Foundation-only download (this file
--     appears to be shipped un-filtered across all FDC download types)
--   * sub_sample_food.fdc_id_of_sample_food -> sample_food: 1 orphan
--   * sub_sample_result.food_nutrient_id -> food_nutrient: 17 orphans

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

-- ---------- Level 1 ----------

CREATE TABLE fdc.food (
  fdc_id           INTEGER PRIMARY KEY,
  data_type        TEXT,
  description      TEXT,
  food_category_id INTEGER REFERENCES fdc.food_category(id),
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
  id                INTEGER PRIMARY KEY,
  fdc_id            INTEGER REFERENCES fdc.food(fdc_id),
  nutrient_id       INTEGER, -- see known gap note above; not FK-enforced
  amount            NUMERIC,
  data_points       INTEGER,
  derivation_id     INTEGER, -- food_nutrient_derivation lookup not included in this download
  min               NUMERIC,
  max               NUMERIC,
  median            NUMERIC,
  footnote          TEXT,
  min_year_acquired INTEGER
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
  id                  INTEGER PRIMARY KEY,
  fdc_id              INTEGER REFERENCES fdc.food(fdc_id),
  fdc_of_input_food   INTEGER REFERENCES fdc.food(fdc_id),
  seq_num             INTEGER,
  amount              NUMERIC,
  ingredient_code     TEXT,
  ingredient_description TEXT,
  unit                TEXT,
  portion_code        TEXT,
  portion_description TEXT,
  gram_weight         NUMERIC,
  retention_code      TEXT
);
CREATE INDEX input_food_fdc_id_idx ON fdc.input_food(fdc_id);
CREATE INDEX input_food_fdc_of_input_food_idx ON fdc.input_food(fdc_of_input_food);

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

COMMENT ON SCHEMA fdc IS 'USDA FoodData Central Foundation Foods reference data (2025-12-18 export). Static reference data, not managed by drizzle.';
