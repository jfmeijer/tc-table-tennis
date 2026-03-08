-- Run this in Supabase SQL Editor to add Elo support.
-- New players get elo_rating 1000; existing players will get 1000 until you backfill.

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS elo_rating integer NOT NULL DEFAULT 1000;

-- Optional: allow anonymous users to update elo_rating when saving a match
CREATE POLICY "players_update_elo"
ON public.players FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
