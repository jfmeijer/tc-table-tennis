-- Run this in Supabase SQL Editor to store Elo change per match.
-- Existing rows will have NULL; new matches will store the delta for each player.

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS elo_change1 integer;

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS elo_change2 integer;
