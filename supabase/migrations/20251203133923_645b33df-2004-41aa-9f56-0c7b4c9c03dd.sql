-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (User data with roles)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('SENIOR', 'JUNIOR', 'CLERK')) default 'JUNIOR',
  full_name text,
  whatsapp_number text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- 2. DAILY COURT DOCKET
create table public.daily_court_docket (
  id uuid default uuid_generate_v4() primary key,
  date date not null default current_date,
  court_location text check (court_location in ('JODHPUR', 'JAIPUR')),
  list_type text check (list_type in ('DAILY', 'SUPPLEMENTARY')),
  court_room_no text,
  item_no int,
  case_number text,
  petitioner_lawyer text,
  respondent_lawyer text,
  matched_profile_id uuid references public.profiles(id),
  created_at timestamp with time zone default now()
);

alter table public.daily_court_docket enable row level security;

create policy "Anyone can view docket" on public.daily_court_docket for select using (true);
create policy "Authenticated users can insert" on public.daily_court_docket for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update" on public.daily_court_docket for update using (auth.role() = 'authenticated');

-- 3. LIVE BOARD CACHE
create table public.live_board_cache (
  court_location text not null,
  court_no text not null,
  current_item int default 1,
  is_supplementary_running boolean default false,
  last_updated timestamp with time zone default now(),
  primary key (court_location, court_no)
);

alter table public.live_board_cache enable row level security;

create policy "Anyone can view live board" on public.live_board_cache for select using (true);
create policy "Authenticated users can update live board" on public.live_board_cache for update using (auth.role() = 'authenticated');
create policy "Authenticated users can insert live board" on public.live_board_cache for insert with check (auth.role() = 'authenticated');

-- 4. CASE DOCUMENTS
create table public.case_documents (
  id uuid default uuid_generate_v4() primary key,
  docket_id uuid references public.daily_court_docket(id) on delete cascade,
  file_url text,
  doc_type text,
  uploaded_at timestamp with time zone default now()
);

alter table public.case_documents enable row level security;

create policy "Anyone can view documents" on public.case_documents for select using (true);
create policy "Authenticated users can insert documents" on public.case_documents for insert with check (auth.role() = 'authenticated');

-- 5. CASE ARGUMENTS
create table public.case_arguments (
  id uuid default uuid_generate_v4() primary key,
  docket_id uuid references public.daily_court_docket(id) on delete cascade,
  title text not null,
  linked_page_number int default 1,
  highlight_coords jsonb,
  created_at timestamp with time zone default now()
);

alter table public.case_arguments enable row level security;

create policy "Anyone can view arguments" on public.case_arguments for select using (true);
create policy "Authenticated users can insert arguments" on public.case_arguments for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update arguments" on public.case_arguments for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete arguments" on public.case_arguments for delete using (auth.role() = 'authenticated');

-- 6. LIVE COURTROOM FEED (Whisper)
create table public.live_courtroom_feed (
  id uuid default uuid_generate_v4() primary key,
  docket_id uuid references public.daily_court_docket(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  message text not null,
  is_read boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.live_courtroom_feed enable row level security;

create policy "Anyone can view feed" on public.live_courtroom_feed for select using (true);
create policy "Authenticated users can insert feed" on public.live_courtroom_feed for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update feed" on public.live_courtroom_feed for update using (auth.role() = 'authenticated');

-- Enable realtime for live updates
alter publication supabase_realtime add table public.live_board_cache;
alter publication supabase_realtime add table public.live_courtroom_feed;