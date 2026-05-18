# Notice Feature Implementation
Managers can post a notice with a title, content, and expiry (duration in hours or a specific date-time). Active, non-expired notices are displayed as an animated marquee ticker below the shared view header.

#### 1. Supabase — New notices table (SQL migration)
A SQL snippet you must run in your Supabase SQL editor to create the table:
```sql
create table notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  content     text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Row-level security
alter table notices enable row level security;

create policy "owner can do everything"
  on notices for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public anonymous read (needed by /api/share/:token route)
create policy "anon read"
  on notices for select
  using (true);
```

#### 2. Manager UI — Settings page notice card

Add a new NoticeSettingsCard component below ShareSettingsCard. It allows the manager to:

- Post a notice — Title (text input), Content (textarea), and expiry:
    - Toggle between "Duration (hours)" (number input) and "Specific date & time" (datetime-local input)
- View active notice — If one exists and is not expired, show its title, content, and expiry time.
- Delete active notice — Button to delete the current active notice.

# Fixes & Improvements
- Add fixed left Notice label with megaphone icon
- Remove megaphone icon from the scrolling notice text
- Softene the ticker from loud orange to amber styling
- Adde fade edges and more spacing before the notice text enters
- Adjust the marquee speed
- Make posting a new notice expire existing active notices first
- Adjuste Settings text to "Specific date & time"
- Rename the notice section in setting to "Post Notice"