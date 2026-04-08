-- Smart Event Scheduler tables
-- Run this in Supabase SQL Editor

-- Stores each user's available time blocks for a community
-- day: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
-- hour: 0-23
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day INT NOT NULL CHECK (day >= 0 AND day <= 6),
  hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(community_id, user_id, day, hour)
);

-- Stores suggested/confirmed meeting slots
CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  day INT NOT NULL CHECK (day >= 0 AND day <= 6),
  start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
  duration_hours FLOAT NOT NULL,
  overlap_count INT DEFAULT 0,
  scheduled_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;

-- Anyone in the community can see availability (for overlap calculation)
CREATE POLICY "Community members can view availability" ON availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = availability.community_id
      AND user_id = auth.uid()
    )
  );

-- Users can only insert/update their own availability
CREATE POLICY "Users manage own availability" ON availability
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own availability" ON availability
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own availability" ON availability
  FOR DELETE USING (auth.uid() = user_id);

-- Community members can read meetings
CREATE POLICY "Community members can view meetings" ON scheduled_meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = scheduled_meetings.community_id
      AND user_id = auth.uid()
    )
  );

-- Any member can create a meeting suggestion
CREATE POLICY "Members can create meeting suggestions" ON scheduled_meetings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = scheduled_meetings.community_id
      AND user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_availability_community_user ON availability(community_id, user_id);
CREATE INDEX IF NOT EXISTS idx_availability_day_hour ON availability(day, hour);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_community ON scheduled_meetings(community_id);
