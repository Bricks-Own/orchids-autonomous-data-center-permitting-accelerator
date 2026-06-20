CREATE TABLE IF NOT EXISTS permitos_schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  address TEXT,
  county TEXT,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  site_acres DOUBLE PRECISION,
  input_data JSONB,
  results_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sites_tenant ON sites(tenant_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  doc_type TEXT NOT NULL,
  doc_num TEXT NOT NULL,
  title TEXT,
  content JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  scenario_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL,
  output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_objects (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_length BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  malware_status TEXT NOT NULL DEFAULT 'pending',
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS production_objects_tenant_site ON production_objects(tenant_id, site_id);

CREATE TABLE IF NOT EXISTS immutable_reviews (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  discipline TEXT NOT NULL,
  reviewer_user_id TEXT,
  reviewer_name TEXT NOT NULL,
  reviewer_license TEXT,
  status TEXT NOT NULL,
  statement TEXT,
  artifact_sha256 TEXT NOT NULL,
  previous_approval_hash TEXT,
  approval_hash TEXT NOT NULL UNIQUE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS immutable_reviews_artifact ON immutable_reviews(tenant_id, site_id, artifact_type, artifact_id);

CREATE TABLE IF NOT EXISTS structured_data_snapshots (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_id TEXT,
  provider TEXT NOT NULL,
  query JSONB NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO permitos_schema_versions(version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;
