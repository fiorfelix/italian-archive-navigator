/** SQLite schema. Bump SCHEMA_VERSION whenever a table changes; the server refuses older databases. */
export const SCHEMA_VERSION = 5;

export const SCHEMA_SQL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  page_url TEXT NOT NULL,
  download_url TEXT NOT NULL,
  metadata_url TEXT,
  route TEXT NOT NULL,            -- 'download' | 'api' | 'manual'
  file_name TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  rows INTEGER NOT NULL,
  downloaded_at TEXT NOT NULL,    -- ISO 8601
  licence TEXT NOT NULL,
  licence_url TEXT NOT NULL
);

-- Comuni existing today (ISTAT list).
CREATE TABLE comuni (
  istat_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_it TEXT NOT NULL,
  name_other TEXT,
  cadastral_code TEXT NOT NULL,
  province_code TEXT NOT NULL,
  province_abbr TEXT NOT NULL,
  province_name TEXT NOT NULL,
  region_code TEXT NOT NULL,
  region_name TEXT NOT NULL
);

-- Every comune-level change since 17/03/1861 (SITUAS reports 98, 100, 103, 104, 105).
-- name/province_* describe the comune at (or just before) the event; rel_* the other party.
CREATE TABLE comune_events (
  report INTEGER NOT NULL,
  type TEXT NOT NULL,
  event_date TEXT NOT NULL,       -- yyyy-mm-dd
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_other TEXT,
  province_abbr TEXT,
  province_code TEXT,
  rel_code TEXT,
  rel_name TEXT,
  rel_province_abbr TEXT,
  rel_province_code TEXT,
  flag TEXT
);
CREATE INDEX comune_events_code ON comune_events(code);
CREATE INDEX comune_events_rel ON comune_events(rel_code);

-- Province-level changes since 1861 (SITUAS reports 112, 113, 114).
CREATE TABLE province_events (
  report INTEGER NOT NULL,
  type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  abbr TEXT,
  rel_code TEXT,
  rel_name TEXT,
  rel_abbr TEXT
);
CREATE INDEX province_events_code ON province_events(code);

-- Inhabited places from the ISTAT 2021 census (centri and nuclei abitati), excluding each
-- comune's main centre. istat_code is the comune code in 2021.
CREATE TABLE localities (
  loc_id TEXT NOT NULL,
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  type INTEGER NOT NULL,          -- 1 centro abitato, 2 nucleo abitato
  istat_code TEXT NOT NULL
);
CREATE INDEX localities_norm ON localities(norm);

-- IndicePA contacts. Lists of addresses are stored as JSON arrays.
CREATE TABLE comune_contacts (
  istat_code TEXT PRIMARY KEY,
  ipa_code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  cap TEXT,
  pec TEXT NOT NULL,
  website TEXT,
  updated TEXT
);
CREATE TABLE comune_offices (
  istat_code TEXT NOT NULL,
  uo_code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  cap TEXT,
  emails TEXT NOT NULL,
  updated TEXT
);
CREATE INDEX comune_offices_code ON comune_offices(istat_code);
CREATE TABLE state_offices (
  aoo_code TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  cap TEXT,
  comune TEXT,
  province_abbr TEXT,
  pec TEXT NOT NULL
);
-- Which Archivio di Stato serves each current province (offices.yaml + same-province default).
CREATE TABLE archive_map (
  province_abbr TEXT PRIMARY KEY,
  aoo_code TEXT,
  basis TEXT NOT NULL,            -- 'curated' | 'same_province'
  verified INTEGER NOT NULL,
  note TEXT,
  source_url TEXT NOT NULL
);
-- Office types without per-comune data: the official directory to consult (JSON).
CREATE TABLE pointers (office_type TEXT PRIMARY KEY, data TEXT NOT NULL);

CREATE TABLE aliases (
  alias TEXT NOT NULL,
  kind TEXT NOT NULL,             -- 'frazione' | 'historical_alias'
  istat_code TEXT NOT NULL,
  note TEXT,
  source_url TEXT NOT NULL,
  verified INTEGER NOT NULL
);

-- One row per searchable name. ref = the comune code the name belonged to.
CREATE TABLE name_index (
  name TEXT NOT NULL,
  norm TEXT NOT NULL,
  variant TEXT NOT NULL,
  kind TEXT NOT NULL,             -- 'current' | 'current_other_language' | 'historical' | 'alias' | 'locality'
  ref TEXT NOT NULL,
  -- A date on which the name belonged to the comune with code ref. ISTAT codes have been
  -- reused by different comuni over time, so a code alone does not identify a comune.
  ref_date TEXT NOT NULL
);
CREATE INDEX name_index_norm ON name_index(norm);
CREATE INDEX name_index_variant ON name_index(variant);
`;
