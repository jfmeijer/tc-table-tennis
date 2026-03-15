#!/usr/bin/env node
/**
 * Recompute Elo from all matches in CSV (chronological order) and output SQL
 * to backfill matches.elo_change1/2 and players.elo_rating.
 *
 * Usage: node backfill-elo-from-csv.js [path-to-csv]
 * Default CSV: ./matches_rows.csv (or pass path, e.g. "/Users/.../matches_rows (1).csv")
 * Output: backfill-elo.sql
 */

const fs = require("fs");
const path = require("path");

const ELO_K = 32;
const ELO_INITIAL = 1000;

function eloExpected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateElo(r1, r2, player1Won) {
  const E1 = eloExpected(r1, r2);
  const E2 = eloExpected(r2, r1);
  const S1 = player1Won ? 1 : 0;
  const S2 = player1Won ? 0 : 1;
  return {
    new1: Math.round(r1 + ELO_K * (S1 - E1)),
    new2: Math.round(r2 + ELO_K * (S2 - E2)),
  };
}

function parseCsv(content) {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = {};
    header.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

const csvPath = process.argv[2] || path.join(__dirname, "matches_rows.csv");
const raw = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(raw);

const sorted = rows
  .filter((r) => r.id && r.player1_name && r.player2_name && r.created_at)
  .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

const ratings = {};
const matchUpdates = [];

for (const m of sorted) {
  const p1 = m.player1_name;
  const p2 = m.player2_name;
  const r1 = ratings[p1] ?? ELO_INITIAL;
  const r2 = ratings[p2] ?? ELO_INITIAL;
  const player1Won = Number(m.score1) > Number(m.score2);
  const { new1, new2 } = updateElo(r1, r2, player1Won);
  ratings[p1] = new1;
  ratings[p2] = new2;
  matchUpdates.push({
    id: m.id,
    elo_change1: new1 - r1,
    elo_change2: new2 - r2,
  });
}

const outPath = path.join(__dirname, "backfill-elo.sql");
const sql = [
  "-- Backfill Elo from chronological match history. Run in Supabase SQL Editor.",
  "-- Matches (elo_change1, elo_change2):",
  ...matchUpdates.map(
    (u) =>
      `UPDATE public.matches SET elo_change1 = ${u.elo_change1}, elo_change2 = ${u.elo_change2} WHERE id = ${u.id};`
  ),
  "",
  "-- Players (final elo_rating):",
  ...Object.entries(ratings).map(
    ([name, elo]) =>
      `UPDATE public.players SET elo_rating = ${elo} WHERE name = '${name.replace(/'/g, "''")}';`
  ),
].join("\n");

fs.writeFileSync(outPath, sql, "utf8");

console.log(`Processed ${sorted.length} matches, ${Object.keys(ratings).length} players.`);
console.log(`SQL written to ${outPath}`);
console.log("Final Elo:", Object.entries(ratings).sort((a, b) => b[1] - a[1]));
