-- V19 hardening: print job lease/claim, conflict-safe payment support and log retention.
alter table if exists print_jobs add column if not exists worker_id text;
alter table if exists print_jobs add column if not exists lease_until timestamptz;
create index if not exists print_jobs_claim_idx on print_jobs(restaurant_id,status,created_at);

create or replace function claim_next_print_job(p_restaurant_id uuid, p_worker_id text, p_lease_seconds integer default 30)
returns setof print_jobs
language plpgsql
security definer
as $$
declare r print_jobs;
begin
  select * into r from print_jobs
  where restaurant_id=p_restaurant_id
    and (status='pendente' or (status='imprimindo' and lease_until is not null and lease_until < now()))
  order by created_at asc
  for update skip locked limit 1;
  if not found then return; end if;
  update print_jobs set status='imprimindo', attempts=coalesce(attempts,0)+1,
    worker_id=p_worker_id, lease_until=now() + make_interval(secs=>greatest(5,p_lease_seconds)), updated_at=now()
  where id=r.id returning * into r;
  return next r;
end;
$$;

-- Retenção conservadora: mantém 90 dias de logs e eventos realtime.
create index if not exists error_logs_created_at_idx on error_logs(created_at desc);
create index if not exists admin_login_logs_created_at_idx on admin_login_logs(created_at desc);
create index if not exists realtime_events_created_at_idx on realtime_events(created_at desc);
