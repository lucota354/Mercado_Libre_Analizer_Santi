create extension if not exists pgcrypto;

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year integer not null,
  version text,
  vin text,
  plate text,
  created_at timestamptz not null default now()
);

create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  customer_name text,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists damages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  part_name text not null,
  position text,
  notes text,
  requested_brand text,
  requested_condition text not null default 'new',
  package_type text,
  confirmed boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists marketplace_results (
  id uuid primary key default gen_random_uuid(),
  damage_id uuid not null references damages(id) on delete cascade,
  marketplace text not null default 'mercadolibre',
  site_id text not null default 'MLA',
  external_item_id text not null,
  title text not null,
  url text not null,
  observed_price numeric(14,2),
  currency_id text,
  brand text,
  condition text,
  oem_code text,
  package_type text,
  originality_score integer,
  compatibility_score integer,
  visual_condition text,
  is_valid boolean not null default false,
  rejection_reasons jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  unique (damage_id, external_item_id)
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  parts_subtotal numeric(14,2) not null default 0,
  labor numeric(14,2) not null default 0,
  paint numeric(14,2) not null default 0,
  other numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  damage_id uuid not null references damages(id) on delete cascade,
  reference_price numeric(14,2),
  price_min numeric(14,2),
  price_max numeric(14,2),
  confidence text,
  manual_review boolean not null default false,
  source_item_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_damages_claim_id on damages(claim_id);
create index if not exists idx_marketplace_results_damage_id on marketplace_results(damage_id);
create index if not exists idx_quotes_claim_id on quotes(claim_id);
