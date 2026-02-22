const DEFAULT_PLAYERS = ["Jorrit", "Tom", "Maksym", "Komeil", "Stephanus", "Cherise"];

const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

const player1Select = document.getElementById("player1");
const player2Select = document.getElementById("player2");
const player1Card = document.getElementById("player1-card");
const player2Card = document.getElementById("player2-card");
const score1Input = document.getElementById("score1");
const score2Input = document.getElementById("score2");
const matchForm = document.getElementById("match-form");
const clearMatchButton = document.getElementById("clear-match-btn");
const errorMissingPlayersMessage = document.getElementById("error-missing-players");
const errorSamePlayerMessage = document.getElementById("error-same-player");
const errorMinScoreMessage = document.getElementById("error-min-score");
const errorScoreDifferenceMessage = document.getElementById("error-score-difference");
const successMatchSavedMessage = document.getElementById("success-match-saved");
const addPlayerForm = document.getElementById("add-player-form");
const newPlayerNameInput = document.getElementById("new-player-name");
const addPlayerMessage = document.getElementById("add-player-message");
const scoreboardBody = document.getElementById("scoreboard-body");
const sortButtons = document.querySelectorAll(".sort-button");
const historyList = document.getElementById("history-list");

const supabaseConfig = window.APP_CONFIG || {};
const supabaseClient =
  typeof window.supabase !== "undefined" && supabaseConfig.SUPABASE_URL
    ? window.supabase.createClient(
        supabaseConfig.SUPABASE_URL,
        supabaseConfig.SUPABASE_ANON_KEY
      )
    : null;

let players = [];
let matches = [];
let currentScoreboardSort = {
  key: "winPercentage",
  direction: "desc",
};

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
  const selectedPlayer1 = player1Select.value;
  const selectedPlayer2 = player2Select.value;

  player1Select.innerHTML = '<option value="">Choose player</option>';
  player2Select.innerHTML = '<option value="">Choose player</option>';

  players.forEach((playerName) => {
    const optionOne = document.createElement("option");
    optionOne.value = playerName;
    optionOne.textContent = playerName;
    player1Select.appendChild(optionOne);

    const optionTwo = document.createElement("option");
    optionTwo.value = playerName;
    optionTwo.textContent = playerName;
    player2Select.appendChild(optionTwo);
  });

  if (players.includes(selectedPlayer1)) player1Select.value = selectedPlayer1;
  if (players.includes(selectedPlayer2)) player2Select.value = selectedPlayer2;
}

async function fetchPlayersFromDatabase() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("players")
    .select("name")
    .order("name", { ascending: true });

  if (error) {
    showDatabaseError("loading players", error);
    return [];
  }

  return (data || []).map((row) => row.name);
}

async function seedDefaultPlayersIfNeeded() {
  if (!supabaseClient || players.length > 0) return;

  const payload = DEFAULT_PLAYERS.map((name) => ({ name }));
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
    .select("id, player1_name, player2_name, score1, score2, match_date, created_at")
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
  }));
}

async function insertPlayerToDatabase(playerName) {
  if (!supabaseClient) return false;

  const { error } = await supabaseClient.from("players").insert({ name: playerName });
  if (error) {
    showDatabaseError("adding player", error);
    return false;
  }

  return true;
}

async function insertMatchToDatabase(match) {
  if (!supabaseClient) return false;

  const payload = {
    player1_name: match.player1,
    player2_name: match.player2,
    score1: match.score1,
    score2: match.score2,
    match_date: new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabaseClient.from("matches").insert(payload);
  if (error) {
    showDatabaseError("saving match", error);
    return false;
  }

  return true;
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
    player1Select.value === "" &&
    player2Select.value === "" &&
    score1Input.value.trim() === "" &&
    score2Input.value.trim() === ""
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
      item.appendChild(date);
      item.appendChild(deleteButton);
      historyList.appendChild(item);
    });
}

function setupHistoryActions() {
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
  });
}

function calculateScoreboardRows(matchRows) {
  const statsByPlayer = {};

  players.forEach((playerName) => {
    statsByPlayer[playerName] = {
      playerName,
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

    row.innerHTML = `
      <td>${position}</td>
      <td>${playerStats.playerName}</td>
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

function showAddPlayerMessage(messageText, messageType) {
  addPlayerMessage.textContent = messageText;
  addPlayerMessage.classList.remove("success", "error");
  addPlayerMessage.classList.add(messageType);
}

function setupAddPlayerForm() {
  addPlayerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawName = newPlayerNameInput.value.trim();
    if (!rawName) {
      showAddPlayerMessage("Please enter a player name.", "error");
      return;
    }

    const alreadyExists = players.some(
      (playerName) => playerName.toLowerCase() === rawName.toLowerCase()
    );
    if (alreadyExists) {
      showAddPlayerMessage("That player already exists.", "error");
      return;
    }

    const inserted = await insertPlayerToDatabase(rawName);
    if (!inserted) return;

    players = await fetchPlayersFromDatabase();
    populatePlayerSelects();
    renderScoreboard();

    addPlayerForm.reset();
    showAddPlayerMessage("Player added successfully.", "success");
    updateClearMatchButtonState();
  });
}

function setupMatchForm() {
  matchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessages();

    const player1 = player1Select.value;
    const player2 = player2Select.value;
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

    const winnerCardElement = score1 > score2 ? player1Card : player2Card;
    const inserted = await insertMatchToDatabase({ player1, player2, score1, score2 });
    if (!inserted) return;

    matches = await fetchMatchesFromDatabase();
    matchForm.reset();
    showMatchSavedMessage();
    renderHistory();
    renderScoreboard();
    triggerWinnerConfetti(winnerCardElement);
    updateClearMatchButtonState();
  });

  clearMatchButton.addEventListener("click", () => {
    if (isMatchFormEmpty()) return;

    const isConfirmed = window.confirm("Clear selected players and entered scores?");
    if (!isConfirmed) return;

    matchForm.reset();
    clearMessages();
    updateClearMatchButtonState();
  });

  player1Select.addEventListener("change", updateClearMatchButtonState);
  player2Select.addEventListener("change", updateClearMatchButtonState);
  score1Input.addEventListener("input", updateClearMatchButtonState);
  score2Input.addEventListener("input", updateClearMatchButtonState);
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
setupMatchForm();
setupAddPlayerForm();
setupScoreboardSorting();
setupHistoryActions();
initializeAppData();
