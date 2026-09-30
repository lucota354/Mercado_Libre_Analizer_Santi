alter table quotes
  add column if not exists parts_bodywork numeric(14,2) not null default 0,
  add column if not exists parts_mechanical_other numeric(14,2) not null default 0,
  add column if not exists bodywork_days numeric(10,2) not null default 0,
  add column if not exists bodywork_rate_per_day numeric(14,2) not null default 0,
  add column if not exists bodywork_subtotal numeric(14,2) not null default 0,
  add column if not exists paint_panels numeric(10,2) not null default 0,
  add column if not exists paint_rate_per_panel numeric(14,2) not null default 0,
  add column if not exists paint_subtotal numeric(14,2) not null default 0,
  add column if not exists mechanic_hours numeric(10,2) not null default 0,
  add column if not exists mechanic_rate_per_hour numeric(14,2) not null default 0,
  add column if not exists mechanic_subtotal numeric(14,2) not null default 0,
  add column if not exists labor_rate_band text;

alter table claims
  add column if not exists branch_number text,
  add column if not exists claim_number text,
  add column if not exists expediente text,
  add column if not exists insured_name text,
  add column if not exists valuation_date date,
  add column if not exists valued_by text;
