const API_KEY = "9decb72e3f9f4cad810c8d695fba6fe3";
const BASE = "https://api.football-data.org/v4";
const COMP = "WC";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

  try {
    const endpoints = [
      `${BASE}/competitions/${COMP}/matches`,
      `${BASE}/competitions/${COMP}/standings`,
      `${BASE}/competitions/${COMP}/scorers`
    ];

    const results = await Promise.allSettled(
      endpoints.map((url) =>
        fetch(url, { headers: { "X-Auth-Token": API_KEY } }).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
      )
    );

    const data = {
      matches: results[0].status === "fulfilled" ? results[0].value.matches : [],
      standings: results[1].status === "fulfilled" ? results[1].value.standings : [],
      scorers: results[2].status === "fulfilled" ? results[2].value.scorers : [],
      timestamp: new Date().toISOString()
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
