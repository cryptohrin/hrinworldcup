const API_CONFIG = {
  proxyUrl: "/api/football",
  refreshInterval: 5 * 60 * 1000,
  timezone: "Asia/Singapore"
};

const TEAM_TIERS = {
  // Tier 1 — elite favorites
  "Brazil": 95, "France": 94, "Argentina": 93, "England": 92, "Spain": 91,
  "Germany": 90, "Portugal": 89, "Netherlands": 88,
  // Tier 2 — strong contenders
  "Belgium": 84, "Croatia": 83, "Uruguay": 82, "Colombia": 81,
  "Italy": 80, "Denmark": 79, "Switzerland": 78, "United States": 77,
  "Mexico": 76, "Senegal": 75, "Japan": 75, "South Korea": 74,
  // Tier 3 — competitive sides
  "Serbia": 72, "Poland": 72, "Turkey": 71, "Morocco": 73,
  "Ecuador": 70, "Wales": 69, "Austria": 69, "Czech Republic": 68, "Czechia": 68,
  "Scotland": 67, "Ukraine": 71, "Nigeria": 70, "Cameroon": 69,
  "Ghana": 68, "Egypt": 70, "Tunisia": 67, "Algeria": 68,
  "Iran": 66, "Australia": 65, "Canada": 66, "Peru": 67,
  "Chile": 68, "Paraguay": 65, "Venezuela": 64, "Costa Rica": 63,
  "Jamaica": 60, "Honduras": 58, "Panama": 62, "Qatar": 62,
  // Tier 4 — underdogs
  "Saudi Arabia": 64, "Iraq": 63, "Jordan": 61, "Uzbekistan": 60,
  "Bahrain": 56, "Bolivia": 58, "Trinidad and Tobago": 55,
  "Haiti": 54, "Curaçao": 53, "Curacao": 53,
  "New Zealand": 57, "Indonesia": 50,
  "Mali": 64, "Burkina Faso": 62, "Congo DR": 63,
  "Ivory Coast": 72, "South Africa": 63, "Tanzania": 52,
  "Bosnia-Herzegovina": 66, "Bosnia and Herzegovina": 66,
  "North Macedonia": 60, "Albania": 62, "Georgia": 60,
  "Slovenia": 63, "Slovakia": 64, "Iceland": 61, "Finland": 62,
  "Norway": 68, "Sweden": 70, "Romania": 65, "Hungary": 66,
  "Russia": 68, "China PR": 55, "India": 50, "Thailand": 52,
  "Belarus": 55, "Congo": 58
};

function getTeamRating(name) {
  return TEAM_TIERS[name] || 58;
}

function generatePrediction(home, away, stage) {
  const hr = getTeamRating(home);
  const ar = getTeamRating(away);
  const diff = hr - ar;
  const isKnockout = !stage.includes("Group");

  const homeEdge = diff + 3;

  if (homeEdge > 12) return { lean: home, conf: 78, type: "strong" };
  if (homeEdge > 6) return { lean: home, conf: 68, type: "clear" };
  if (homeEdge > 2) return { lean: home, conf: 58, type: "slight" };
  if (homeEdge > -2) return { lean: "Draw lean", conf: 48, type: "toss-up" };
  if (homeEdge > -6) return { lean: away, conf: 58, type: "slight" };
  if (homeEdge > -12) return { lean: away, conf: 68, type: "clear" };
  return { lean: away, conf: 78, type: "strong" };
}

function generateOdds(home, away) {
  const hr = getTeamRating(home);
  const ar = getTeamRating(away);
  const hProb = 0.35 + (hr - ar) * 0.012 + 0.04;
  const dProb = 0.26 - Math.abs(hr - ar) * 0.004;
  const aProb = 1 - hProb - dProb;
  const margin = 1.08;
  return {
    home: +(margin / Math.max(hProb, 0.05)).toFixed(2),
    draw: +(margin / Math.max(dProb, 0.08)).toFixed(2),
    away: +(margin / Math.max(aProb, 0.05)).toFixed(2)
  };
}

function generatePicks(home, away, stage) {
  const pred = generatePrediction(home, away, stage);
  const odds = generateOdds(home, away);
  const fav = pred.lean.includes("Draw") ? home : pred.lean;
  const dog = fav === home ? away : home;
  const isClose = pred.type === "toss-up" || pred.type === "slight";
  const picks = [];

  if (pred.type === "strong" || pred.type === "clear") {
    picks.push({
      label: "Best Pick",
      type: "Match Result",
      selection: `${fav} to win`,
      risk: "Safer",
      confidence: pred.conf,
      odds: fav === home ? `${odds.home}` : `${odds.away}`,
      reason: `${fav} have a clear quality edge and should control this fixture.`
    });
    picks.push({
      label: "Goals Pick",
      type: "Team Goals",
      selection: `${fav} over 1.5 team goals`,
      risk: "Balanced",
      confidence: pred.conf - 8,
      odds: "Check market",
      reason: `${fav}'s attacking quality should create enough to score at least twice.`
    });
    picks.push({
      label: "Spicy Pick",
      type: "Correct Score",
      selection: `${fav} 2-0`,
      risk: "Spicy",
      confidence: Math.max(pred.conf - 30, 25),
      odds: "Higher payout",
      reason: `A clean sheet win is live if ${fav} control possession early.`
    });
  } else if (isClose) {
    picks.push({
      label: "Best Pick",
      type: "Draw No Bet",
      selection: `${fav} draw-no-bet`,
      risk: "Balanced",
      confidence: pred.conf + 8,
      odds: "Check market",
      reason: `${fav} have a slight edge but the gap is narrow — protect your stake.`
    });
    picks.push({
      label: "Goals Pick",
      type: "Both Teams To Score",
      selection: "Yes",
      risk: "Balanced",
      confidence: 62,
      odds: "Check market",
      reason: `Close matchups often see both sides find the net as the game opens up.`
    });
    picks.push({
      label: "Value Pick",
      type: "Double Chance",
      selection: `${dog} or draw`,
      risk: "Value",
      confidence: 55,
      odds: "Check market",
      reason: `${dog} are competitive enough to take something from this.`
    });
  }

  return picks;
}

function generateAnalysis(home, away, stage) {
  const pred = generatePrediction(home, away, stage);
  const fav = pred.lean.includes("Draw") ? null : pred.lean;
  const dog = fav ? (fav === home ? away : home) : null;

  let importance, recommendation, priority, valueFlag;

  if (pred.type === "strong") {
    importance = `${fav} are clear favourites and should dictate the tempo from the start. ${dog} will need a disciplined low block to stay in this.`;
    recommendation = `${fav} win is the likely outcome, but the short price means limited value. Consider team goals markets for a better angle.`;
    priority = "Star watch";
    valueFlag = "Low value";
  } else if (pred.type === "clear") {
    importance = `${fav} carry more quality but ${dog} have the tools to make this uncomfortable if they stay compact.`;
    recommendation = `Lean towards ${fav} but consider draw-no-bet to manage the risk. Wait for lineup news.`;
    priority = "Must-watch";
    valueFlag = "Lean favourite";
  } else if (pred.type === "slight") {
    importance = `A tight matchup where margins are thin. Both sides have paths to winning this.`;
    recommendation = `Small-stake lean on ${fav} draw-no-bet. The gap is not wide enough for a confident straight win bet.`;
    priority = "Upset alert";
    valueFlag = "Value watch";
  } else {
    importance = `A genuine coin-flip. Neither side has a convincing edge on paper.`;
    recommendation = `No strong pre-match lean. Consider watching the first 15 minutes before committing to any live market.`;
    priority = "Prime-time drama";
    valueFlag = "No bet";
  }

  return {
    prediction: fav ? `${fav} ${pred.type === "strong" ? "win" : pred.type === "clear" ? "win" : "lean"}` : "Too close to call",
    confidence: pred.conf,
    confidenceLabel: pred.conf >= 70 ? "High" : pred.conf >= 55 ? "Medium" : "Low",
    importance,
    recommendation,
    priority,
    valueFlag,
    watchScore: 50 + pred.conf * 0.4 + (pred.type === "toss-up" ? 15 : 0)
  };
}

const LiveData = {
  cache: { timestamp: 0, result: null },

  isToday(utcDate) {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: API_CONFIG.timezone });
    return fmt.format(new Date(utcDate)) === fmt.format(new Date());
  },

  stageName(stage, group) {
    const names = {
      GROUP_STAGE: group ? group.replace("GROUP_", "Group ") : "Group Stage",
      LAST_32: "Round of 32",
      LAST_16: "Round of 16",
      QUARTER_FINALS: "Quarter-final",
      SEMI_FINALS: "Semi-final",
      THIRD_PLACE: "Third Place",
      FINAL: "Final"
    };
    return names[stage] || stage;
  },

  liveLabel(status, score) {
    if (status === "FINISHED")
      return `FT ${score.fullTime.home}-${score.fullTime.away}`;
    if (status === "IN_PLAY")
      return `LIVE ${score.fullTime.home}-${score.fullTime.away}`;
    if (status === "PAUSED")
      return `HT ${score.halfTime.home}-${score.halfTime.away}`;
    return null;
  },

  transformMatch(apiMatch, staticMatches) {
    const home = apiMatch.homeTeam?.name || "TBD";
    const away = apiMatch.awayTeam?.name || "TBD";
    if (home === "TBD" && away === "TBD") return null;
    const isLive = apiMatch.status === "IN_PLAY" || apiMatch.status === "PAUSED";
    const isFinished = apiMatch.status === "FINISHED";
    const label = this.liveLabel(apiMatch.status, apiMatch.score);
    const stageName = this.stageName(apiMatch.stage, apiMatch.group);

    const existing = staticMatches.find(
      (m) =>
        m.home.toLowerCase() === home.toLowerCase() &&
        m.away.toLowerCase() === away.toLowerCase()
    );

    const hasStaticPicks = existing?.bettingPicks?.length > 0;
    const auto = !hasStaticPicks ? generateAnalysis(home, away, stageName) : null;
    const autoPicks = !hasStaticPicks ? generatePicks(home, away, stageName) : [];
    const autoOdds = !hasStaticPicks ? generateOdds(home, away) : null;

    return {
      id: `api-${apiMatch.id}`,
      date: apiMatch.utcDate.slice(0, 10),
      kickoff: apiMatch.utcDate,
      stage: stageName,
      venue: apiMatch.venue || "TBD",
      home,
      away,
      priority: existing?.priority || auto?.priority || (isLive ? "LIVE" : "Scheduled"),
      watchScore: existing?.watchScore || auto?.watchScore || 50,
      confidence: existing?.confidence || auto?.confidence || 50,
      confidenceLabel: existing?.confidenceLabel || auto?.confidenceLabel || "Medium",
      prediction: label || existing?.prediction || auto?.prediction || "Awaiting kickoff",
      valueFlag: existing?.valueFlag || auto?.valueFlag || "No pick",
      importance: existing?.importance || auto?.importance || "",
      odds: existing?.odds || autoOdds || { home: 0, draw: 0, away: 0 },
      recommendation: existing?.recommendation || auto?.recommendation || "",
      bettingPicks: hasStaticPicks ? existing.bettingPicks : autoPicks,
      today: this.isToday(apiMatch.utcDate),
      liveScore: isLive || isFinished ? apiMatch.score : null,
      status: apiMatch.status
    };
  },

  transformStandings(apiStandings) {
    return (apiStandings || [])
      .filter((s) => s.type === "TOTAL" && s.stage === "GROUP_STAGE")
      .map((s) => ({
        group: s.group ? s.group.replace("GROUP_", "Group ") : "Group",
        rows: s.table.map((row) => [
          row.team.name,
          row.playedGames,
          row.won,
          row.draw,
          row.lost,
          row.goalDifference >= 0 ? `+${row.goalDifference}` : `${row.goalDifference}`,
          row.points
        ])
      }));
  },

  transformScorers(apiScorers) {
    return (apiScorers || []).slice(0, 6).map((s) => [
      `${s.player.name} (${s.team.name})`,
      `${s.goals} goal${s.goals !== 1 ? "s" : ""}${s.assists ? `, ${s.assists} assist${s.assists !== 1 ? "s" : ""}` : ""}`
    ]);
  },

  async load(staticData) {
    const now = Date.now();
    if (this.cache.timestamp && now - this.cache.timestamp < API_CONFIG.refreshInterval) {
      return this.cache.result;
    }

    try {
      const res = await fetch(API_CONFIG.proxyUrl);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      const data = await res.json();

      const matches = (data.matches || [])
        .map((m) => this.transformMatch(m, staticData.matches))
        .filter(Boolean);

      const standings = this.transformStandings(data.standings);
      const scorers = this.transformScorers(data.scorers);

      const result = {
        ...staticData,
        meta: {
          ...staticData.meta,
          updated: data.timestamp || new Date().toISOString(),
          source: "football-data.org",
          live: true
        },
        matches: matches.length > 0 ? matches : staticData.matches,
        standings: standings.length > 0 ? standings : staticData.standings,
        trackers: {
          ...staticData.trackers,
          goldenBoot: scorers.length > 0 ? scorers : staticData.trackers.goldenBoot
        }
      };

      this.cache = { timestamp: now, result };
      return result;
    } catch (err) {
      console.warn("Live API unavailable, using static data:", err.message);
      return null;
    }
  }
};
