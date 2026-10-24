create table if not exists public.internships (
    id uuid primary key default gen_random_uuid(),
    company_name text not null,
    role text not null,
    start_date date not null,
    end_date date,
    is_current boolean not null default false,
    location text,
    description text,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    constraint internships_dates_valid check (
        end_date is null or end_date >= start_date
    ),
    constraint internships_current_has_no_end_date check (
        not is_current or end_date is null
    )
);

alter table public.internships enable row level security;

grant select on public.internships to anon, authenticated;
grant insert, update, delete on public.internships to authenticated;

drop policy if exists "Anyone can read visible internships" on public.internships;
create policy "Anyone can read visible internships"
    on public.internships
    for select
    using (is_visible);

drop policy if exists "Admins can manage internships" on public.internships;
create policy "Admins can manage internships"
    on public.internships
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.admin_users
            where admin_users.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1
            from public.admin_users
            where admin_users.user_id = (select auth.uid())
        )
    );
