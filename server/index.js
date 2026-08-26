import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// Scryfall is the standard free public API for MTG card data.
// Docs: https://scryfall.com/docs/api
const SCRYFALL_BASE = "https://api.scryfall.com";

// Simple in-memory cache so repeated searches don't hammer Scryfall
// and so we respect their "be a good citizen" rate-limit guidance
// (they ask for ~50-100ms between requests / reasonable caching).
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

async function scryfallFetch(path) {
  const cached = getCached(path);
  if (cached) return cached;

  const res = await fetch(`${SCRYFALL_BASE}${path}`, {
    headers: {
      // Scryfall asks API consumers to identify themselves.
      "User-Agent": "MTGCardCreator/1.0 (personal project)",
      Accept: "application/json",
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.details || "Scryfall request failed");
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  setCached(path, data);
  return data;
}

app.use(cors());
app.use(express.json());

// GET /api/autocomplete?q=lightning
// Returns a short list of matching card names as the user types.
app.get("/api/autocomplete", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json({ names: [] });

  try {
    const data = await scryfallFetch(
      `/cards/autocomplete?q=${encodeURIComponent(q)}`
    );
    res.json({ names: data.data || [] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/card?name=Lightning%20Bolt
// Returns full card data (name, mana_cost, type_line, oracle_text,
// power, toughness, colors, image data) for a single card, using
// Scryfall's fuzzy-name endpoint so near-matches still resolve.
app.get("/api/card", async (req, res) => {
  const name = (req.query.name || "").toString().trim();
  if (!name) return res.status(400).json({ error: "Missing 'name' query param" });

  try {
    const data = await scryfallFetch(
      `/cards/named?fuzzy=${encodeURIComponent(name)}`
    );
    res.json(normalizeCard(data));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /api/search?q=fireball
// Returns a list of candidate cards for a broader search, useful
// when the user isn't sure of the exact name.
app.get("/api/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json({ cards: [] });

  try {
    const data = await scryfallFetch(
      `/cards/search?q=${encodeURIComponent(q)}&order=name`
    );
    const cards = (data.data || []).slice(0, 20).map(normalizeCard);
    res.json({ cards });
  } catch (err) {
    if (err.status === 404) {
      // Scryfall returns 404 when a search has zero results.
      return res.json({ cards: [] });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Trim each card down to exactly what the frontend needs to render
// the text box (name, mana cost, type line, rules text, P/T, colors).
function normalizeCard(card) {
  // Some cards (double-faced) keep their real text on card_faces[0].
  const face = card.card_faces && card.card_faces.length ? card.card_faces[0] : card;

  return {
    id: card.id,
    name: card.name,
    mana_cost: face.mana_cost || card.mana_cost || "",
    type_line: card.type_line || face.type_line || "",
    oracle_text: face.oracle_text || card.oracle_text || "",
    power: card.power ?? face.power ?? null,
    toughness: card.toughness ?? face.toughness ?? null,
    loyalty: card.loyalty ?? null,
    colors: card.colors || face.colors || [],
    rarity: card.rarity || "",
    set_name: card.set_name || "",
    collector_number: card.collector_number || "",
    artist: card.artist || "",
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`MTG Card Creator API listening on http://localhost:${PORT}`);
});
