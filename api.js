const API_CONFIG = {
  proxyUrl: "/api/football",
  refreshInterval: 5 * 60 * 1000,
  timezone: "Asia/Singapore"
};

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

    const existing = staticMatches.find(
      (m) =>
        m.home.toLowerCase() === home.toLowerCase() &&
        m.away.toLowerCase() === away.toLowerCase()
    );

    return {
      id: `api-${apiMatch.id}`,
      date: apiMatch.utcDate.slice(0, 10),
      kickoff: apiMatch.utcDate,
      stage: this.stageName(apiMatch.stage, apiMatch.group),
      venue: apiMatch.venue || "TBD",
      home,
      away,
      priority: existing?.priority || (isLive ? "LIVE" : "Scheduled"),
      watchScore: existing?.watchScore || 50,
      confidence: existing?.confidence || 50,
      confidenceLabel: existing?.confidenceLabel || "Medium",
      prediction: label || existing?.prediction || "Awaiting kickoff",
      valueFlag: existing?.valueFlag || (isLive ? "In play" : "No pick"),
      importance: existing?.importance || "",
      odds: existing?.odds || { home: 0, draw: 0, away: 0 },
      recommendation: existing?.recommendation || "",
      bettingPicks: existing?.bettingPicks || [],
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
