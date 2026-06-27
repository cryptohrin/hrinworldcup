const dataAdapter = {
  async load() {
    const staticData = window.WORLD_CUP_DATA;
    const liveData = await LiveData.load(staticData);
    return liveData || staticData;
  }
};

const singaporeTime = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function impliedProbability(odds) {
  return `${((1 / odds) * 100).toFixed(1)}%`;
}

function confidenceTone(score) {
  if (score >= 70) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function matchTitle(match) {
  return `${match.home} vs ${match.away}`;
}

function picksFor(match) {
  return match.bettingPicks || [];
}

function riskClass(risk) {
  return `pick--${String(risk || "balanced").toLowerCase().replace(/\s+/g, "-")}`;
}

function hasPick(match, test) {
  return picksFor(match).some(test);
}

function pickMatchesFilter(match, filter) {
  if (filter === "all") return true;
  if (filter === "today") return match.today;
  if (filter === "safer") return hasPick(match, (pick) => pick.risk === "Safer");
  if (filter === "value") return hasPick(match, (pick) => pick.risk === "Value" || /value/i.test(pick.label));
  if (filter === "goals") return hasPick(match, (pick) => /goal|both teams/i.test(`${pick.type} ${pick.selection}`));
  if (filter === "spicy") return hasPick(match, (pick) => pick.risk === "Spicy");
  return true;
}

function renderPick(pick, featured = false) {
  return `
    <div class="pick ${featured ? "pick--featured" : ""} ${riskClass(pick.risk)}">
      <div class="pick__top">
        <span class="pick__label">${pick.label}</span>
        <span class="pick__risk">${pick.risk}</span>
      </div>
      <strong>${pick.selection}</strong>
      <div class="pick__meta">
        <span>${pick.type}</span>
        <span>${pick.confidence}% confidence</span>
        <span>${pick.odds}</span>
      </div>
      <p>${pick.reason}</p>
    </div>
  `;
}

function renderConfidence(match) {
  const label = match.confidenceLabel || confidenceTone(match.confidence);
  return `
    <div class="confidence" aria-label="Prediction confidence ${label}">
      <div class="confidence__label">
        <span>Prediction confidence</span>
        <span>${label} · ${match.confidence}%</span>
      </div>
      <div class="confidence__bar"><span class="confidence__fill" style="width: ${match.confidence}%"></span></div>
    </div>
  `;
}

function isUpcoming(match) {
  if (match.status === "FINISHED") return false;
  if (match.status === "IN_PLAY" || match.status === "PAUSED") return true;
  return new Date(match.kickoff) > new Date();
}

function renderHeroMatches(matches) {
  const featured = matches.filter(isUpcoming).slice(0, 5);
  document.querySelector("#heroMatches").innerHTML = featured.map((match) => `
    <article class="score-card">
      <div>
        <strong>${matchTitle(match)}</strong>
        <span>${picksFor(match)[0]?.selection || match.prediction} · ${singaporeTime.format(new Date(match.kickoff))}</span>
      </div>
      <span class="priority">${picksFor(match)[0]?.risk || match.priority}</span>
    </article>
  `).join("");
}

function renderTicker(stories) {
  document.querySelector("#storyTicker").innerHTML = stories.map((story) => `<span>${story}</span>`).join("");
}

function renderMetrics(matches) {
  const picks = matches.flatMap((match) => picksFor(match).map((pick) => ({ ...pick, match })));
  const bestChance = picks
    .filter((pick) => pick.risk !== "Avoid")
    .sort((a, b) => b.confidence - a.confidence)[0];

  document.querySelector("#bestChancePick").textContent = bestChance?.selection || "--";
  document.querySelector("#saferPickCount").textContent = picks.filter((pick) => pick.risk === "Safer").length;
  document.querySelector("#valueWatchCount").textContent = picks.filter((pick) => pick.risk === "Value" || /value/i.test(pick.label)).length;
  document.querySelector("#spicyPickCount").textContent = picks.filter((pick) => pick.risk === "Spicy").length;
}

function matchCard(match, index) {
  const picks = picksFor(match);
  const bestPick = picks[0];
  const secondaryPicks = picks.slice(1, 4);
  return `
    <article class="match-card" data-match-index="${index}">
      <div class="match-card__top">
        <div>
          <h3>${matchTitle(match)}</h3>
          <p class="meta">${singaporeTime.format(new Date(match.kickoff))} · ${match.stage} · ${match.venue}</p>
        </div>
        <span class="priority">${match.priority}</span>
      </div>
      <div class="tag-row">
        <span class="tag tag--deep">${match.prediction}</span>
        <span class="tag ${match.valueFlag.toLowerCase().includes("value") ? "tag--value" : ""}">${match.valueFlag}</span>
      </div>
      ${bestPick ? renderPick(bestPick, true) : renderConfidence(match)}
      ${secondaryPicks.length ? `<div class="pick-list">${secondaryPicks.map((pick) => renderPick(pick)).join("")}</div>` : ""}
      <p class="match-note">${match.importance}</p>
    </article>
  `;
}

function renderMatches(matches) {
  const grid = document.querySelector("#matchesGrid");
  grid.innerHTML = matches.map(matchCard).join("");

  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const filter = button.dataset.filter;
      grid.querySelectorAll(".match-card").forEach((card) => {
        const match = matches[Number(card.dataset.matchIndex)];
        card.hidden = !pickMatchesFilter(match, filter);
      });
    });
  });
}

function renderTables(groups) {
  document.querySelector("#tablesGrid").innerHTML = groups.map((group) => `
    <article class="table-card">
      <h3>${group.group}</h3>
      <table>
        <thead>
          <tr><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
        </thead>
        <tbody>
          ${group.rows.map((row) => `
            <tr>
              <td><strong>${row[0]}</strong></td>
              <td>${row[1]}</td>
              <td>${row[2]}</td>
              <td>${row[3]}</td>
              <td>${row[4]}</td>
              <td>${row[5]}</td>
              <td><strong>${row[6]}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </article>
  `).join("");
}

function renderCalendar(events) {
  document.querySelector("#calendarGrid").innerHTML = events.map((event) => `
    <article class="event-card">
      <strong>${event.date} · ${event.title}</strong>
      <span>${event.detail}</span>
    </article>
  `).join("");
}

function renderTeams(teams) {
  document.querySelector("#teamIntel").innerHTML = teams.map((team) => `
    <article class="team-card">
      <h3>${team.name}</h3>
      <p>${team.note}</p>
    </article>
  `).join("");
}

function renderWatchList(matches) {
  const watchMatches = [...matches]
    .filter((match) => hasPick(match, (pick) => pick.risk === "Value" || pick.risk === "Spicy"))
    .sort((a, b) => b.watchScore - a.watchScore)
    .slice(0, 4);
  document.querySelector("#watchList").innerHTML = watchMatches.map((match) => `
    <article class="watch-card">
      <div class="watch-card__top">
        <div>
          <h3>${matchTitle(match)}</h3>
          <p class="meta">${match.priority} · ${picksFor(match)[0]?.selection || match.prediction}</p>
        </div>
        <span class="tag tag--hot">${match.watchScore}</span>
      </div>
      ${picksFor(match).slice(0, 2).map((pick, index) => renderPick(pick, index === 0)).join("")}
      <p class="match-note">${match.importance}</p>
    </article>
  `).join("");
}

function renderOdds(matches) {
  document.querySelector("#oddsGrid").innerHTML = matches.slice(0, 6).map((match) => `
    <article class="odds-card">
      <div class="odds-card__top">
        <div>
          <h3>${matchTitle(match)}</h3>
          <p class="meta">${match.stage} · best pick: ${picksFor(match)[0]?.selection || match.prediction}</p>
        </div>
        <span class="tag">${match.prediction}</span>
      </div>
      <div class="odds-row" aria-label="Decimal odds and implied probabilities">
        <div class="odds-box">
          <span>${match.home}</span>
          <strong>${match.odds.home}</strong>
          <span>${impliedProbability(match.odds.home)}</span>
        </div>
        <div class="odds-box">
          <span>Draw</span>
          <strong>${match.odds.draw}</strong>
          <span>${impliedProbability(match.odds.draw)}</span>
        </div>
        <div class="odds-box">
          <span>${match.away}</span>
          <strong>${match.odds.away}</strong>
          <span>${impliedProbability(match.odds.away)}</span>
        </div>
      </div>
      <div class="odds-picks">
        ${picksFor(match).slice(0, 2).map((pick) => `
          <div>
            <strong>${pick.label}</strong>
            <span>${pick.selection} · ${pick.risk} · ${pick.confidence}%</span>
          </div>
        `).join("")}
      </div>
      <p class="bet-note">${match.recommendation}</p>
    </article>
  `).join("");
}

function renderSignals(trackers) {
  const renderList = (items) => items.map(([title, note]) => `
    <div class="signal">
      <strong>${title}</strong>
      <span>${note}</span>
    </div>
  `).join("");

  document.querySelector("#darkHorseList").innerHTML = renderList(trackers.darkHorses);
  document.querySelector("#upsetList").innerHTML = renderList(trackers.upsets);
  document.querySelector("#goldenBootList").innerHTML = renderList(trackers.goldenBoot);
}

function renderLiveBadge(meta) {
  const el = document.querySelector("#liveBadge");
  if (!el) return;
  if (meta.live) {
    const time = new Date(meta.updated).toLocaleTimeString("en-SG", {
      timeZone: "Asia/Singapore",
      hour: "2-digit",
      minute: "2-digit"
    });
    el.innerHTML = `<span class="live-dot"></span> Live · updated ${time}`;
    el.hidden = false;
  } else {
    el.innerHTML = "Static snapshot";
    el.hidden = false;
  }
}

function renderAll(cupData) {
  const allMatches = [...cupData.matches].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const upcoming = allMatches.filter(isUpcoming);
  renderHeroMatches(upcoming);
  renderTicker(cupData.stories);
  renderMetrics(upcoming);
  renderMatches(upcoming);
  renderTables(cupData.standings);
  renderCalendar(cupData.events);
  renderTeams(cupData.teams);
  renderWatchList(upcoming);
  renderOdds(upcoming);
  renderSignals(cupData.trackers);
  renderLiveBadge(cupData.meta);
}

async function init() {
  const cupData = await dataAdapter.load();
  renderAll(cupData);

  setInterval(async () => {
    const fresh = await dataAdapter.load();
    renderAll(fresh);
  }, API_CONFIG.refreshInterval);
}

init();
