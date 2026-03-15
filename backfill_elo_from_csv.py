#!/usr/bin/env python3
"""
Recompute Elo from all matches in CSV (chronological order) and write SQL
to backfill matches.elo_change1/2 and players.elo_rating.

Usage: python3 backfill_elo_from_csv.py [path-to-csv]
Default CSV: matches_rows.csv in current dir.
Output: backfill-elo.sql
"""

import csv
import sys
from pathlib import Path

ELO_K = 32
ELO_INITIAL = 1000


def elo_expected(rating_a, rating_b):
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def update_elo(r1, r2, player1_won):
    e1 = elo_expected(r1, r2)
    e2 = elo_expected(r2, r1)
    s1 = 1 if player1_won else 0
    s2 = 0 if player1_won else 1
    new1 = round(r1 + ELO_K * (s1 - e1))
    new2 = round(r2 + ELO_K * (s2 - e2))
    return new1, new2


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "matches_rows.csv"
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("id") or not row.get("created_at"):
                continue
            row["score1"] = int(row.get("score1", 0))
            row["score2"] = int(row.get("score2", 0))
            rows.append(row)

    rows.sort(key=lambda m: m["created_at"])
    ratings = {}
    match_updates = []

    for m in rows:
        p1 = m["player1_name"]
        p2 = m["player2_name"]
        r1 = ratings.get(p1, ELO_INITIAL)
        r2 = ratings.get(p2, ELO_INITIAL)
        player1_won = m["score1"] > m["score2"]
        new1, new2 = update_elo(r1, r2, player1_won)
        ratings[p1] = new1
        ratings[p2] = new2
        match_updates.append({
            "id": m["id"],
            "elo_change1": new1 - r1,
            "elo_change2": new2 - r2,
        })

    out_path = Path(__file__).parent / "backfill-elo.sql"
    lines = [
        "-- Backfill Elo from chronological match history. Run in Supabase SQL Editor.",
        "-- Matches (elo_change1, elo_change2):",
    ]
    for u in match_updates:
        lines.append(f"UPDATE public.matches SET elo_change1 = {u['elo_change1']}, elo_change2 = {u['elo_change2']} WHERE id = {u['id']};")
    lines.append("")
    lines.append("-- Players (final elo_rating):")
    for name, elo in sorted(ratings.items(), key=lambda x: -x[1]):
        safe_name = name.replace("'", "''")
        lines.append(f"UPDATE public.players SET elo_rating = {elo} WHERE name = '{safe_name}';")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Processed {len(rows)} matches, {len(ratings)} players.")
    print(f"SQL written to {out_path}")
    print("Final Elo:", sorted(ratings.items(), key=lambda x: -x[1]))


if __name__ == "__main__":
    main()
