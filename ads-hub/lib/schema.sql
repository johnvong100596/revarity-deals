-- Revarity Ads Hub — Postgres schema (Vercel Postgres / Neon).
-- Run once against your database (psql, or the Neon/Vercel SQL console) before STORE_DRIVER=cloud.

CREATE TABLE IF NOT EXISTS creatives (
  id          TEXT PRIMARY KEY,          -- "ANGLE/base", e.g. AD1_DEAL_LIST/A-meta_feed_square
  angle_id    TEXT NOT NULL,
  variant     TEXT,
  spec        TEXT,
  dimensions  TEXT,
  headline    TEXT,
  body        TEXT,
  cta         TEXT,
  pricing_flag TEXT,
  qa          TEXT,                       -- pass | fail | uncertain | PENDING_*
  qa_reasons  JSONB DEFAULT '[]'::jsonb,
  qa_model    TEXT,
  vertical    BOOLEAN DEFAULT FALSE,
  image_url   TEXT,                       -- Vercel Blob public URL
  run_id      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id          TEXT PRIMARY KEY,           -- FK-ish to creatives.id
  decision    TEXT NOT NULL,              -- approve | hold | reject
  decided_by  TEXT,                       -- Clerk user (who pushed it)
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creatives_angle_idx ON creatives (angle_id);
CREATE INDEX IF NOT EXISTS creatives_qa_idx ON creatives (qa);
