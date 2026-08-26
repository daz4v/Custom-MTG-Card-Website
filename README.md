# Custom Card Forge

Upload your own art, search for any Magic: The Gathering card, and generate
a custom card image that keeps the original's name, mana cost, type line,
rules text, and power/toughness — with your art in the art box.

The card frame is an **original design drawn in code** (rounded panels,
color-themed by the card's mana color, custom mana pips). It is not a copy
of Wizards of the Coast's official card frame artwork — Magic's card frame
and symbols are their IP, so this tool reimplements the *layout*, not the
*artwork*.

## How it works

- **`server/`** — a small Express API that proxies the free
  [Scryfall API](https://scryfall.com/docs/api) for card search/autocomplete
  and returns just the fields the frontend needs (name, mana cost, type
  line, oracle text, power/toughness, colors). Responses are cached in
  memory for 10 minutes to be a good API citizen.
- **`client/`** — a Vite + React app. You upload an image (stays entirely
  in the browser — nothing is uploaded to any server), search for a card,
  and a `<canvas>` composites your art with the fetched text into the card
  frame. You can then download the result as a PNG.

## Setup

Requires Node.js 18+ (for built-in `fetch`).

```bash
# 1. start the backend
cd server
npm install
npm start          # runs on http://localhost:4000

# 2. in a second terminal, start the frontend
cd client
npm install
npm run dev         # runs on http://localhost:5173
```

Open http://localhost:5173 — the Vite dev server proxies `/api/*` requests
to the Express backend automatically (see `client/vite.config.js`).

## Customizing the frame

All the drawing logic lives in `client/src/components/CardCanvas.jsx`:

- `COLOR_THEMES` — palette per mana color (change to restyle the frame)
- `MANA_SYMBOL_COLORS` — pip colors for `{W}{U}{B}{R}{G}`
- the big `useEffect` — draws title bar → art box → type line → rules text
  box → power/toughness, in order, onto a 750×1050 canvas

## Notes / next steps you might want

- Add server-side image upload (multer) if you want to store/share
  generated cards instead of everything staying client-side.
- Swap Scryfall for a local dataset if you want this to work fully offline.
- Add a "flavor text" toggle, foil/holo shader effect, or multiple frame
  styles (e.g., a distinct look for instants/sorceries vs. creatures).
