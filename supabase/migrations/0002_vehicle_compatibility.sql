alter table vehicles
  add column if not exists engine text,
  add column if not exists body_type text,
  add column if not exists transmission text,
  add column if not exists catalog_product_id text;

alter table marketplace_results
  add column if not exists compatibility_status text not null default 'unknown',
  add column if not exists compatibility_source text,
  add column if not exists matched_vehicle_name text,
  add column if not exists compatible_vehicle_names jsonb not null default '[]'::jsonb,
  add column if not exists compatibility_note text,
  add column if not exists position_compatible boolean,
  add column if not exists compatibility_reputation_level text,
  add column if not exists catalog_compatibility_count integer,
  add column if not exists compatibility_checked_at timestamptz;

alter table quotes
  add column if not exists bodywork_paint_subtotal numeric(14,2) not null default 0;

create index if not exists idx_marketplace_results_compatibility
  on marketplace_results(damage_id, compatibility_status);
