const DEFAULT_PLAYERS = ["Jorrit", "Tom", "Maksym", "Komeil", "Stephanus", "Cherise"];

const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

const score1Input = document.getElementById("score1");
const score2Input = document.getElementById("score2");
const matchForm = document.getElementById("match-form");
const clearMatchButton = document.getElementById("clear-match-btn");
const errorMissingPlayersMessage = document.getElementById("error-missing-players");
const errorSamePlayerMessage = document.getElementById("error-same-player");
const errorMinScoreMessage = document.getElementById("error-min-score");
const errorScoreDifferenceMessage = document.getElementById("error-score-difference");
const successMatchSavedMessage = document.getElementById("success-match-saved");
const scoreboardBody = document.getElementById("scoreboard-body");
const sortButtons = document.querySelectorAll(".sort-button");
const historyList = document.getElementById("history-list");
const matchupPlayer1Select = document.getElementById("matchup-player1");
const matchupPlayer2Select = document.getElementById("matchup-player2");
const matchupElo1 = document.getElementById("matchup-elo1");
const matchupElo2 = document.getElementById("matchup-elo2");
const matchupChance1 = document.getElementById("matchup-chance1");
const matchupChance2 = document.getElementById("matchup-chance2");
const matchupPlayer1Last5 = document.getElementById("matchup-player1-last5");
const matchupPlayer2Last5 = document.getElementById("matchup-player2-last5");
const matchupEloGain1 = document.getElementById("matchup-elo-gain1");
const matchupEloGain2 = document.getElementById("matchup-elo-gain2");
const matchupPlayer1Block = document.getElementById("matchup-player1-block");
const matchupPlayer2Block = document.getElementById("matchup-player2-block");
const score1Label = document.getElementById("score1-label");
const score2Label = document.getElementById("score2-label");
const dashboardPlayerSelect = document.getElementById("dashboard-player");
const dashboardWinrate = document.getElementById("dashboard-winrate");
const dashboardAvgPoints = document.getElementById("dashboard-avg-points");
const dashboardWinstreak = document.getElementById("dashboard-winstreak");
const dashboardTotalMatches = document.getElementById("dashboard-total-matches");
const dashboardEloGraph = document.getElementById("dashboard-elo-graph");
const dashboardEloSvg = document.getElementById("dashboard-elo-svg");
const dashboardEloEmpty = document.getElementById("dashboard-elo-empty");
const dashboardMatchHistory = document.getElementById("dashboard-match-history");

const supabaseConfig = window.APP_CONFIG || {};
const supabaseClient =
  typeof window.supabase !== "undefined" && supabaseConfig.SUPABASE_URL
    ? window.supabase.createClient(
        supabaseConfig.SUPABASE_URL,
        supabaseConfig.SUPABASE_ANON_KEY
      )
    : null;

const ELO_K = 32;
const ELO_INITIAL = 1000;

let players = [];
let matches = [];
let isSavingMatch = false;
let currentScoreboardSort = {
  key: "winPercentage",
  direction: "desc",
};

function eloExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateEloAfterMatch(rating1, rating2, player1Won) {
  const E1 = eloExpectedScore(rating1, rating2);
  const E2 = eloExpectedScore(rating2, rating1);
  const S1 = player1Won ? 1 : 0;
  const S2 = player1Won ? 0 : 1;
  const new1 = Math.round(rating1 + ELO_K * (S1 - E1));
  const new2 = Math.round(rating2 + ELO_K * (S2 - E2));
  return { new1, new2 };
}

const CONFETTI_BASE_OPTIONS = {
  fullScreen: { zIndex: 10 },
  particles: {
    number: { value: 0 },
    color: { value: ["#00FFFC", "#FC00FF", "#fffc00"] },
    shape: { type: "circle", options: {} },
    opacity: {
      value: { min: 0, max: 1 },
      animation: { enable: true, speed: 2, startValue: "max", destroy: "min" },
    },
    size: { value: { min: 2, max: 4 } },
    links: { enable: false },
    life: { duration: { sync: true, value: 5 }, count: 1 },
    move: {
      enable: true,
      gravity: { enable: true, acceleration: 10 },
      speed: { min: 10, max: 20 },
      decay: 0.1,
      direction: "none",
      straight: false,
      outModes: { default: "destroy", top: "none" },
    },
    rotate: {
      value: { min: 0, max: 360 },
      direction: "random",
      move: true,
      animation: { enable: true, speed: 60 },
    },
    tilt: {
      direction: "random",
      enable: true,
      move: true,
      value: { min: 0, max: 360 },
      animation: { enable: true, speed: 60 },
    },
    roll: {
      darken: { enable: true, value: 25 },
      enable: true,
      speed: { min: 15, max: 25 },
    },
    wobble: {
      distance: 30,
      enable: true,
      move: true,
      speed: { min: -15, max: 15 },
    },
  },
  emitters: {
    life: { count: 1, duration: 0.1, delay: 0.4 },
    rate: { delay: 0.1, quantity: 150 },
    size: { width: 0, height: 0 },
  },
};

function showDatabaseError(action, error) {
  console.error(`Supabase error while ${action}:`, error);
  window.alert(`Database error while ${action}. Check console for details.`);
}

function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanels.forEach((panel) => panel.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });
}

function populatePlayerSelects() {
  populateMatchupSelects();
  populateDashboardSelect();
}

function populateMatchupSelects() {
  if (!matchupPlayer1Select || !matchupPlayer2Select) return;
  const sel1 = matchupPlayer1Select.value;
  const sel2 = matchupPlayer2Select.value;

  matchupPlayer1Select.innerHTML = '<option value="">Choose player</option>';
  matchupPlayer2Select.innerHTML = '<option value="">Choose player</option>';

  players.forEach((player) => {
    const name = typeof player === "string" ? player : player.name;
    const opt1 = document.createElement("option");
    opt1.value = name;
    opt1.textContent = name;
    matchupPlayer1Select.appendChild(opt1);
    const opt2 = document.createElement("option");
    opt2.value = name;
    opt2.textContent = name;
    matchupPlayer2Select.appendChild(opt2);
  });

  const names = players.map((p) => (typeof p === "string" ? p : p.name));
  if (names.includes(sel1)) matchupPlayer1Select.value = sel1;
  if (names.includes(sel2)) matchupPlayer2Select.value = sel2;
  updateMatchupDisplay();
}

function updateMatchupDisplay() {
  const name1 = matchupPlayer1Select?.value?.trim() || "";
  const name2 = matchupPlayer2Select?.value?.trim() || "";
  if (score1Label) score1Label.textContent = name1 ? `${name1} Score` : "Player 1 Score";
  if (score2Label) score2Label.textContent = name2 ? `${name2} Score` : "Player 2 Score";
  if (!matchupElo1 || !matchupElo2 || !matchupChance1 || !matchupChance2) return;

  if (!name1 || !name2) {
    matchupElo1.textContent = "";
    matchupElo2.textContent = "";
    matchupChance1.textContent = "";
    matchupChance2.textContent = "";
    if (matchupEloGain1) matchupEloGain1.textContent = "";
    if (matchupEloGain2) matchupEloGain2.textContent = "";
    renderMatchupHistory(name1, name2);
    return;
  }
  if (name1 === name2) {
    matchupElo1.textContent = `Elo: ${getPlayerElo(name1)}`;
    matchupElo2.textContent = `Elo: ${getPlayerElo(name2)}`;
    matchupChance1.textContent = "Same player — choose two different players.";
    matchupChance2.textContent = "";
    if (matchupEloGain1) matchupEloGain1.textContent = "";
    if (matchupEloGain2) matchupEloGain2.textContent = "";
    renderMatchupHistory(name1, name2);
    return;
  }

  const elo1 = getPlayerElo(name1);
  const elo2 = getPlayerElo(name2);
  const chance1 = eloExpectedScore(elo1, elo2);
  const chance2 = 1 - chance1;

  const if1Wins = updateEloAfterMatch(elo1, elo2, true);
  const if2Wins = updateEloAfterMatch(elo1, elo2, false);
  const gain1IfWin = if1Wins.new1 - elo1;
  const gain2IfWin = if2Wins.new2 - elo2;

  matchupElo1.textContent = `Elo: ${elo1}`;
  matchupElo2.textContent = `Elo: ${elo2}`;
  matchupChance1.textContent = `${(chance1 * 100).toFixed(1)}% chance to win`;
  matchupChance2.textContent = `${(chance2 * 100).toFixed(1)}% chance to win`;
  if (matchupEloGain1) matchupEloGain1.textContent = `+${gain1IfWin} if you win`;
  if (matchupEloGain2) matchupEloGain2.textContent = `+${gain2IfWin} if you win`;

  renderMatchupHistory(name1, name2);
}

function getMatchesForPlayer(playerName) {
  const name = playerName.trim().toLowerCase();
  return matches.filter(
    (m) =>
      m.player1.toLowerCase() === name || m.player2.toLowerCase() === name
  );
}

function getHeadToHeadMatches(name1, name2) {
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  return matches.filter((m) => {
    const p1 = m.player1.toLowerCase();
    const p2 = m.player2.toLowerCase();
    return (p1 === n1 && p2 === n2) || (p1 === n2 && p2 === n1);
  });
}

function getWinsAndLosses(matchesForPlayer, playerName) {
  const name = playerName.trim().toLowerCase();
  let wins = 0;
  let losses = 0;
  matchesForPlayer.forEach((m) => {
    const isPlayer1 = m.player1.toLowerCase() === name;
    const won = isPlayer1 ? m.score1 > m.score2 : m.score2 > m.score1;
    if (won) wins += 1;
    else losses += 1;
  });
  return { wins, losses };
}

function recentFormLetters(matchesForPlayer, playerName, limit = 5) {
  const name = playerName.trim().toLowerCase();
  return matchesForPlayer
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map((m) => {
      const isP1 = m.player1.toLowerCase() === name;
      const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1;
      return won ? "W" : "L";
    });
}

function renderLast5Html(letters) {
  if (!letters.length) return "Last 5: —";
  const spans = letters
    .map((l) => `<span class="form-${l.toLowerCase()}">${l}</span>`)
    .join(" ");
  return `Last 5: ${spans}`;
}

function renderMatchupHistory(name1, name2) {
  if (!matchupPlayer1Last5 || !matchupPlayer2Last5) return;

  if (!name1 || !name2 || name1 === name2) {
    matchupPlayer1Last5.innerHTML = "";
    matchupPlayer2Last5.innerHTML = "";
    return;
  }

  const p1Matches = getMatchesForPlayer(name1);
  const p2Matches = getMatchesForPlayer(name2);
  const p1Letters = recentFormLetters(p1Matches, name1);
  const p2Letters = recentFormLetters(p2Matches, name2);

  matchupPlayer1Last5.innerHTML = renderLast5Html(p1Letters);
  matchupPlayer2Last5.innerHTML = renderLast5Html(p2Letters);
}

function setupMatchupTab() {
  if (!matchupPlayer1Select || !matchupPlayer2Select) return;
  matchupPlayer1Select.addEventListener("change", updateMatchupDisplay);
  matchupPlayer2Select.addEventListener("change", updateMatchupDisplay);
}

function computePlayerDashboardStats(playerName) {
  const name = playerName.trim().toLowerCase();
  const playerMatches = matches.filter(
    (m) => m.player1.toLowerCase() === name || m.player2.toLowerCase() === name
  );
  const total = playerMatches.length;
  if (total === 0) {
    return { winRate: null, avgPointsPerGame: null, currentWinStreak: 0, totalMatches: 0 };
  }
  let wins = 0;
  let totalPointsScored = 0;
  playerMatches.forEach((m) => {
    const isP1 = m.player1.toLowerCase() === name;
    const won = isP1 ? m.score1 > m.score2 : m.score2 > m.score1;
    if (won) wins += 1;
    totalPointsScored += isP1 ? m.score1 : m.score2;
  });
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const avgPointsPerGame = total > 0 ? totalPointsScored / total : 0;
  const sorted = playerMatches.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const isP1 = m.player1.toLowerCase() === name;
    if ((isP1 && m.score1 > m.score2) || (!isP1 && m.score2 > m.score1)) streak += 1;
    else break;
  }
  return {
    winRate,
    avgPointsPerGame: Math.round(avgPointsPerGame * 10) / 10,
    currentWinStreak: streak,
    totalMatches: total,
  };
}

function computeEloHistory(playerName) {
  const name = playerName.trim().toLowerCase();
  const matchesWithElo = matches
    .filter((m) => {
      const p1 = m.player1.toLowerCase() === name;
      const p2 = m.player2.toLowerCase() === name;
      if (!p1 && !p2) return false;
      return p1 ? m.eloChange1 != null : m.eloChange2 != null;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (matchesWithElo.length === 0) return [];

  const deltas = matchesWithElo.map((m) =>
    m.player1.toLowerCase() === name ? m.eloChange1 : m.eloChange2
  );
  const totalKnownDelta = deltas.reduce((sum, delta) => sum + delta, 0);

  let runningElo = getPlayerElo(playerName) - totalKnownDelta;
  const points = [{ date: matchesWithElo[0].date, elo: runningElo }];

  matchesWithElo.forEach((m, idx) => {
    runningElo += deltas[idx];
    points.push({ date: m.date, elo: runningElo });
  });

  return points;
}

function renderDashboardStats(stats) {
  if (!dashboardWinrate || !dashboardAvgPoints || !dashboardWinstreak || !dashboardTotalMatches) return;
  if (stats.totalMatches === 0) {
    dashboardWinrate.textContent = "—";
    dashboardAvgPoints.textContent = "—";
    dashboardWinstreak.textContent = "0";
    dashboardTotalMatches.textContent = "0";
    return;
  }
  dashboardWinrate.textContent = `${stats.winRate.toFixed(1)}%`;
  dashboardAvgPoints.textContent = String(stats.avgPointsPerGame);
  dashboardWinstreak.textContent = String(stats.currentWinStreak);
  dashboardTotalMatches.textContent = String(stats.totalMatches);
}

function renderDashboardEloGraph(eloHistory) {
  if (!dashboardEloSvg || !dashboardEloGraph || !dashboardEloEmpty) return;
  if (!eloHistory || eloHistory.length === 0) {
    dashboardEloGraph.style.display = "none";
    dashboardEloEmpty.style.display = "block";
    dashboardEloEmpty.textContent = "No match history — Elo will appear after matches.";
    return;
  }

  const toDate = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date(value) : date;
  };

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);

  const last30DayHistory = eloHistory.filter((p) => {
    const d = toDate(p.date);
    return d >= startDate && d <= endDate;
  });

  if (last30DayHistory.length === 0) {
    dashboardEloGraph.style.display = "none";
    dashboardEloEmpty.style.display = "block";
    dashboardEloEmpty.textContent = "No Elo-tracked matches in the last 30 days.";
    return;
  }

  dashboardEloEmpty.style.display = "none";
  dashboardEloGraph.style.display = "block";
  const padding = { top: 20, right: 18, bottom: 46, left: 48 };
  const w = 640;
  const h = 320;
  const elos = last30DayHistory.map((p) => p.elo);
  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);
  const range = maxElo - minElo || 1;
  const eloMin = Math.floor(minElo - range * 0.1);
  const eloMax = Math.ceil(maxElo + range * 0.1);
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();
  const tsRange = endTs - startTs || 1;
  const xScale = (dateValue) => {
    const ts = toDate(dateValue).getTime();
    return padding.left + ((ts - startTs) / tsRange) * chartW;
  };
  const yScale = (elo) => padding.top + chartH - ((elo - eloMin) / (eloMax - eloMin)) * chartH;
  let pathD = "";
  last30DayHistory.forEach((p, i) => {
    const x = xScale(p.date);
    const y = yScale(p.elo);
    pathD += (i === 0 ? "M" : "L") + `${x},${y}`;
  });
  const yTicks = [eloMin, Math.round((eloMin + eloMax) / 2), eloMax];
  const xTicks = [0, 10, 20, 29].map((offsetDays) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + offsetDays);
    return d;
  });
  const formatXAxisDate = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  let svg = `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${h - padding.bottom}" stroke="#e2e8f0" stroke-width="1"/>`;
  svg += `<line x1="${padding.left}" y1="${h - padding.bottom}" x2="${w - padding.right}" y2="${h - padding.bottom}" stroke="#e2e8f0" stroke-width="1"/>`;
  yTicks.forEach((t) => {
    const y = yScale(t);
    svg += `<line x1="${padding.left}" y1="${y}" x2="${w - padding.right}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
    svg += `<text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${t}</text>`;
  });
  xTicks.forEach((tickDate) => {
    const x = xScale(tickDate.toISOString().slice(0, 10));
    svg += `<line x1="${x}" y1="${h - padding.bottom}" x2="${x}" y2="${h - padding.bottom + 5}" stroke="#94a3b8" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${h - 10}" text-anchor="middle" font-size="10" fill="#64748b">${formatXAxisDate(tickDate)}</text>`;
  });
  if (last30DayHistory.length > 1) {
    svg += `<path d="${pathD}" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  last30DayHistory.forEach((p) => {
    const x = xScale(p.date);
    const y = yScale(p.elo);
    svg += `<circle cx="${x}" cy="${y}" r="3.5" fill="#4F46E5"/>`;
  });
  dashboardEloSvg.innerHTML = svg;
}

function renderDashboardMatchHistory(playerName) {
  if (!dashboardMatchHistory) return;
  const name = playerName.trim().toLowerCase();
  const playerMatches = matches
    .filter((m) => m.player1.toLowerCase() === name || m.player2.toLowerCase() === name)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (playerMatches.length === 0) {
    dashboardMatchHistory.innerHTML = '<p class="panel-note">No matches yet.</p>';
    return;
  }
  dashboardMatchHistory.innerHTML = "";
  playerMatches.forEach((m) => {
    const isP1 = m.player1.toLowerCase() === name;
    const opponent = isP1 ? m.player2 : m.player1;
    const myScore = isP1 ? m.score1 : m.score2;
    const oppScore = isP1 ? m.score2 : m.score1;
    const won = myScore > oppScore;
    const row = document.createElement("div");
    row.className = "dashboard-history-row";
    row.innerHTML = `
      <span class="dashboard-history-result ${won ? "win" : "loss"}">${won ? "W" : "L"}</span>
      <span class="dashboard-history-opponent">vs ${opponent}</span>
      <span class="dashboard-history-score">${myScore}-${oppScore}</span>
      <span class="dashboard-history-date">${formatMatchDate(m.date)}</span>
    `;
    dashboardMatchHistory.appendChild(row);
  });
}

function updateDashboard() {
  const playerName = dashboardPlayerSelect?.value?.trim() || "";
  if (!playerName) {
    if (dashboardWinrate) dashboardWinrate.textContent = "—";
    if (dashboardAvgPoints) dashboardAvgPoints.textContent = "—";
    if (dashboardWinstreak) dashboardWinstreak.textContent = "—";
    if (dashboardTotalMatches) dashboardTotalMatches.textContent = "—";
    if (dashboardEloEmpty) {
      dashboardEloEmpty.style.display = "block";
      dashboardEloEmpty.textContent = "Select a player to see Elo history.";
    }
    if (dashboardEloGraph) dashboardEloGraph.style.display = "none";
    if (dashboardMatchHistory) dashboardMatchHistory.innerHTML = '<p class="panel-note">Select a player to see their matches.</p>';
    return;
  }
  const stats = computePlayerDashboardStats(playerName);
  const eloHistory = computeEloHistory(playerName);
  renderDashboardStats(stats);
  renderDashboardEloGraph(eloHistory);
  renderDashboardMatchHistory(playerName);
}

function populateDashboardSelect() {
  if (!dashboardPlayerSelect) return;
  const sel = dashboardPlayerSelect.value;
  dashboardPlayerSelect.innerHTML = '<option value="">Choose player</option>';
  players.forEach((player) => {
    const name = typeof player === "string" ? player : player.name;
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    dashboardPlayerSelect.appendChild(opt);
  });
  const names = players.map((p) => (typeof p === "string" ? p : p.name));
  if (names.includes(sel)) dashboardPlayerSelect.value = sel;
  updateDashboard();
}

function setupDashboardTab() {
  if (!dashboardPlayerSelect) return;
  dashboardPlayerSelect.addEventListener("change", updateDashboard);
}

async function fetchPlayersFromDatabase() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("players")
    .select("name, elo_rating")
    .order("name", { ascending: true });

  if (error) {
    showDatabaseError("loading players", error);
    return [];
  }

  return (data || []).map((row) => ({
    name: row.name,
    eloRating: row.elo_rating != null ? row.elo_rating : ELO_INITIAL,
  }));
}

async function seedDefaultPlayersIfNeeded() {
  if (!supabaseClient || players.length > 0) return;

  const payload = DEFAULT_PLAYERS.map((name) => ({ name, elo_rating: ELO_INITIAL }));
  const { error } = await supabaseClient
    .from("players")
    .upsert(payload, { onConflict: "name", ignoreDuplicates: true });

  if (error) {
    showDatabaseError("seeding default players", error);
  }
}

async function fetchMatchesFromDatabase() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("matches")
    .select("id, player1_name, player2_name, score1, score2, match_date, elo_change1, elo_change2, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    showDatabaseError("loading matches", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    player1: row.player1_name,
    player2: row.player2_name,
    score1: row.score1,
    score2: row.score2,
    date: row.match_date,
    eloChange1: row.elo_change1 != null ? row.elo_change1 : null,
    eloChange2: row.elo_change2 != null ? row.elo_change2 : null,
  }));
}

async function insertPlayerToDatabase(playerName) {
  if (!supabaseClient) return false;

  const { error } = await supabaseClient
    .from("players")
    .insert({ name: playerName, elo_rating: ELO_INITIAL });
  if (error) {
    showDatabaseError("adding player", error);
    return false;
  }

  return true;
}

async function updatePlayerEloInDatabase(playerName, newElo) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient
    .from("players")
    .update({ elo_rating: newElo })
    .eq("name", playerName);
  if (error) {
    showDatabaseError("updating Elo", error);
    return false;
  }
  return true;
}

async function insertMatchToDatabase(match) {
  if (!supabaseClient) return false;

  const rating1 = getPlayerElo(match.player1);
  const rating2 = getPlayerElo(match.player2);
  const player1Won = match.score1 > match.score2;
  const { new1, new2 } = updateEloAfterMatch(rating1, rating2, player1Won);
  const eloChange1 = new1 - rating1;
  const eloChange2 = new2 - rating2;

  const payload = {
    player1_name: match.player1,
    player2_name: match.player2,
    score1: match.score1,
    score2: match.score2,
    match_date: new Date().toISOString().slice(0, 10),
    elo_change1: eloChange1,
    elo_change2: eloChange2,
  };

  const { error } = await supabaseClient.from("matches").insert(payload);
  if (error) {
    showDatabaseError("saving match", error);
    return false;
  }

  const ok1 = await updatePlayerEloInDatabase(match.player1, new1);
  const ok2 = await updatePlayerEloInDatabase(match.player2, new2);
  if (!ok1 || !ok2) return true;

  return true;
}

function getPlayerElo(playerName) {
  const p = players.find(
    (x) => (typeof x === "string" ? x : x.name).toLowerCase() === playerName.toLowerCase()
  );
  if (!p) return ELO_INITIAL;
  return typeof p === "string" ? ELO_INITIAL : p.eloRating;
}

async function deleteMatchFromDatabase(matchId) {
  if (!supabaseClient) return false;

  const { error } = await supabaseClient.from("matches").delete().eq("id", matchId);
  if (error) {
    showDatabaseError("deleting match", error);
    return false;
  }

  return true;
}

function clearMessages() {
  errorMissingPlayersMessage.textContent = "";
  errorSamePlayerMessage.textContent = "";
  errorMinScoreMessage.textContent = "";
  errorScoreDifferenceMessage.textContent = "";
  successMatchSavedMessage.textContent = "";

  errorMissingPlayersMessage.classList.remove("visible");
  errorSamePlayerMessage.classList.remove("visible");
  errorMinScoreMessage.classList.remove("visible");
  errorScoreDifferenceMessage.classList.remove("visible");
  successMatchSavedMessage.classList.remove("visible");
}

function showMissingPlayersMessage() {
  clearMessages();
  errorMissingPlayersMessage.textContent = "Please choose two players.";
  errorMissingPlayersMessage.classList.add("visible");
}

function showSamePlayerMessage() {
  clearMessages();
  errorSamePlayerMessage.textContent = "Please choose two different players.";
  errorSamePlayerMessage.classList.add("visible");
}

function showMinScoreMessage() {
  clearMessages();
  errorMinScoreMessage.textContent = "At least one player must score 21 or more points.";
  errorMinScoreMessage.classList.add("visible");
}

function showScoreDifferenceMessage() {
  clearMessages();
  errorScoreDifferenceMessage.textContent = "The winner must be at least 2 points ahead.";
  errorScoreDifferenceMessage.classList.add("visible");
}

function showMatchSavedMessage() {
  clearMessages();
  successMatchSavedMessage.textContent = "Match saved successfully.";
  successMatchSavedMessage.classList.add("visible");
}

function isMatchFormEmpty() {
  return (
    (!matchupPlayer1Select || matchupPlayer1Select.value === "") &&
    (!matchupPlayer2Select || matchupPlayer2Select.value === "") &&
    (!score1Input || score1Input.value.trim() === "") &&
    (!score2Input || score2Input.value.trim() === "")
  );
}

function updateClearMatchButtonState() {
  clearMatchButton.disabled = isMatchFormEmpty();
}

function triggerWinnerConfetti(winnerCardElement) {
  if (!winnerCardElement || typeof tsParticles === "undefined") return;

  const bounds = winnerCardElement.getBoundingClientRect();
  const xPercent = ((bounds.left + bounds.width / 2) / window.innerWidth) * 100;
  const yPercent = ((bounds.top + bounds.height / 2) / window.innerHeight) * 100;

  const confettiOptions = JSON.parse(JSON.stringify(CONFETTI_BASE_OPTIONS));
  confettiOptions.emitters.position = { x: xPercent, y: yPercent };

  tsParticles.load({
    id: "tsparticles",
    options: confettiOptions,
  });
}

function formatMatchDate(dateValue) {
  if (!dateValue) return "";

  const parsedDate = new Date(dateValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleDateString();
  }

  return String(dateValue);
}

function renderHistory() {
  if (matches.length === 0) {
    historyList.innerHTML = '<p class="panel-note">No saved matches yet.</p>';
    return;
  }

  historyList.innerHTML = "";

  matches
    .slice()
    .reverse()
    .forEach((match) => {
      const item = document.createElement("div");
      item.className = "history-item";

      const matchup = document.createElement("div");
      matchup.className = "history-cell history-matchup";
      matchup.textContent = `${match.player1} - ${match.player2}`;

      const score = document.createElement("div");
      score.className = "history-cell history-score";
      score.textContent = `${match.score1} - ${match.score2}`;

      const eloCell = document.createElement("div");
      eloCell.className = "history-cell history-elo";
      if (match.eloChange1 != null && match.eloChange2 != null) {
        const s1 = match.eloChange1 >= 0 ? `+${match.eloChange1}` : String(match.eloChange1);
        const s2 = match.eloChange2 >= 0 ? `+${match.eloChange2}` : String(match.eloChange2);
        eloCell.textContent = `${s1} / ${s2}`;
      } else {
        eloCell.textContent = "—";
      }

      const date = document.createElement("div");
      date.className = "history-cell history-date";
      date.textContent = formatMatchDate(match.date);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "history-delete-btn";
      deleteButton.dataset.matchId = String(match.id);
      deleteButton.title = "Delete match";
      deleteButton.setAttribute("aria-label", "Delete match");
      deleteButton.innerHTML = '<img src="assets/trash-2.svg" alt="" class="history-delete-icon" />';

      item.appendChild(matchup);
      item.appendChild(score);
      item.appendChild(eloCell);
      item.appendChild(date);
      item.appendChild(deleteButton);
      historyList.appendChild(item);
    });
}

function setupHistoryActions() {
  if (!historyList) return;
  historyList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".history-delete-btn");
    if (!deleteButton) return;

    const matchId = Number(deleteButton.dataset.matchId);
    if (Number.isNaN(matchId)) return;

    const isConfirmed = window.confirm("Are you sure you want to delete this match?");
    if (!isConfirmed) return;

    const deleted = await deleteMatchFromDatabase(matchId);
    if (!deleted) return;

    matches = await fetchMatchesFromDatabase();
    renderHistory();
    renderScoreboard();
    updateDashboard();
    updateMatchupDisplay();
  });
}

function calculateScoreboardRows(matchRows) {
  const statsByPlayer = {};

  players.forEach((player) => {
    const name = typeof player === "string" ? player : player.name;
    const eloRating = typeof player === "string" ? ELO_INITIAL : player.eloRating;
    statsByPlayer[name] = {
      playerName: name,
      eloRating,
      games: 0,
      wins: 0,
      losses: 0,
      pointsScored: 0,
      pointsLost: 0,
      winPercentage: 0,
    };
  });

  matchRows.forEach((match) => {
    const { player1, player2, score1, score2 } = match;

    if (!statsByPlayer[player1]) {
      statsByPlayer[player1] = {
        playerName: player1,
        eloRating: getPlayerElo(player1),
        games: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsLost: 0,
        winPercentage: 0,
      };
    }

    if (!statsByPlayer[player2]) {
      statsByPlayer[player2] = {
        playerName: player2,
        eloRating: getPlayerElo(player2),
        games: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsLost: 0,
        winPercentage: 0,
      };
    }

    const playerOneStats = statsByPlayer[player1];
    const playerTwoStats = statsByPlayer[player2];

    playerOneStats.games += 1;
    playerTwoStats.games += 1;
    playerOneStats.pointsScored += score1;
    playerOneStats.pointsLost += score2;
    playerTwoStats.pointsScored += score2;
    playerTwoStats.pointsLost += score1;

    if (score1 > score2) {
      playerOneStats.wins += 1;
      playerTwoStats.losses += 1;
    } else if (score2 > score1) {
      playerTwoStats.wins += 1;
      playerOneStats.losses += 1;
    }
  });

  return Object.values(statsByPlayer).map((playerStats) => ({
    ...playerStats,
    winPercentage: playerStats.games === 0 ? 0 : (playerStats.wins / playerStats.games) * 100,
  }));
}

function sortScoreboardRows(rows) {
  const { key, direction } = currentScoreboardSort;
  const sortedRows = [...rows];

  sortedRows.sort((a, b) => {
    const valueA = a[key];
    const valueB = b[key];

    if (typeof valueA === "string" && typeof valueB === "string") {
      const stringCompare = valueA.localeCompare(valueB);
      return direction === "asc" ? stringCompare : -stringCompare;
    }

    const numberCompare = valueA - valueB;
    return direction === "asc" ? numberCompare : -numberCompare;
  });

  return sortedRows;
}

function updateSortButtonLabels() {
  sortButtons.forEach((button) => {
    const key = button.dataset.sortKey;
    const storedBaseLabel = button.dataset.baseLabel;
    const baseLabel =
      storedBaseLabel || button.textContent.replace(" ↑", "").replace(" ↓", "").trim();

    button.dataset.baseLabel = baseLabel;
    button.textContent = baseLabel;
    button.classList.remove("active");

    if (key === currentScoreboardSort.key) {
      button.classList.add("active");
      const arrow = currentScoreboardSort.direction === "asc" ? " ↑" : " ↓";
      button.textContent = `${baseLabel}${arrow}`;
    }
  });
}

function setupScoreboardSorting() {
  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const clickedKey = button.dataset.sortKey;

      if (currentScoreboardSort.key === clickedKey) {
        currentScoreboardSort.direction =
          currentScoreboardSort.direction === "asc" ? "desc" : "asc";
      } else {
        currentScoreboardSort.key = clickedKey;
        currentScoreboardSort.direction = "asc";
      }

      renderScoreboard();
    });
  });
}

function renderScoreboard() {
  const rows = calculateScoreboardRows(matches);
  const sortedRows = sortScoreboardRows(rows);

  scoreboardBody.innerHTML = "";
  updateSortButtonLabels();

  sortedRows.forEach((playerStats, index) => {
    const row = document.createElement("tr");
    const roundedWinPercent = `${playerStats.winPercentage.toFixed(1)}%`;
    const position = index + 1;
    const elo = playerStats.eloRating != null ? playerStats.eloRating : ELO_INITIAL;

    row.innerHTML = `
      <td>${position}</td>
      <td>${playerStats.playerName}</td>
      <td>${elo}</td>
      <td>${playerStats.games}</td>
      <td>${playerStats.wins}</td>
      <td>${playerStats.losses}</td>
      <td>${playerStats.pointsScored}</td>
      <td>${playerStats.pointsLost}</td>
      <td>${roundedWinPercent}</td>
    `;

    scoreboardBody.appendChild(row);
  });
}

function setupMatchForm() {
  const saveMatchButton = matchForm?.querySelector('button[type="submit"]');

  matchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSavingMatch) return;
    clearMessages();

    const player1 = matchupPlayer1Select?.value ?? "";
    const player2 = matchupPlayer2Select?.value ?? "";
    const score1 = Number(score1Input.value);
    const score2 = Number(score2Input.value);

    if (!player1 || !player2) {
      showMissingPlayersMessage();
      return;
    }

    if (player1 === player2) {
      showSamePlayerMessage();
      return;
    }

    if (score1 < 21 && score2 < 21) {
      showMinScoreMessage();
      return;
    }

    if (Math.abs(score1 - score2) < 2) {
      showScoreDifferenceMessage();
      return;
    }

    const winnerBlockElement = score1 > score2 ? matchupPlayer1Block : matchupPlayer2Block;
    isSavingMatch = true;
    if (saveMatchButton) saveMatchButton.disabled = true;
    clearMatchButton.disabled = true;
    try {
      const inserted = await insertMatchToDatabase({ player1, player2, score1, score2 });
      if (!inserted) return;

      players = await fetchPlayersFromDatabase();
      matches = await fetchMatchesFromDatabase();
      matchForm.reset();
      showMatchSavedMessage();
      renderHistory();
      renderScoreboard();
      updateMatchupDisplay();
      triggerWinnerConfetti(winnerBlockElement);
      updateClearMatchButtonState();
    } finally {
      isSavingMatch = false;
      if (saveMatchButton) saveMatchButton.disabled = false;
      updateClearMatchButtonState();
    }
  });

  clearMatchButton.addEventListener("click", () => {
    if (isMatchFormEmpty()) return;

    const isConfirmed = window.confirm("Clear entered scores?");
    if (!isConfirmed) return;

    matchForm.reset();
    clearMessages();
    updateClearMatchButtonState();
  });

  if (matchupPlayer1Select) matchupPlayer1Select.addEventListener("change", updateClearMatchButtonState);
  if (matchupPlayer2Select) matchupPlayer2Select.addEventListener("change", updateClearMatchButtonState);
  if (score1Input) score1Input.addEventListener("input", updateClearMatchButtonState);
  if (score2Input) score2Input.addEventListener("input", updateClearMatchButtonState);
  updateClearMatchButtonState();
}

async function initializeAppData() {
  if (!supabaseClient) {
    window.alert("Supabase is not configured. Please check APP_CONFIG in index.html.");
    return;
  }

  players = await fetchPlayersFromDatabase();
  await seedDefaultPlayersIfNeeded();
  if (players.length === 0) {
    players = await fetchPlayersFromDatabase();
  }

  matches = await fetchMatchesFromDatabase();
  populatePlayerSelects();
  renderHistory();
  renderScoreboard();
  updateClearMatchButtonState();
}

setupTabs();
setupMatchupTab();
setupDashboardTab();
setupMatchForm();
setupScoreboardSorting();
setupHistoryActions();
initializeAppData();
