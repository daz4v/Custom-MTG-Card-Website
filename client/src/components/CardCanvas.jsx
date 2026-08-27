import { useEffect, useRef, useState } from "react";

// Canvas is drawn at a fixed high-res size and scaled down by CSS,
// so the exported PNG stays crisp. 750x1050 matches a real card's
// 2.5" x 3.5" aspect ratio (5:7) at 300dpi/quarter-scale.
const W = 750;
const H = 1050;

// ---------------------------------------------------------------
// Real mana symbols via the "Mana" icon font (Andrew Gioia, MIT
// license): https://github.com/andrewgioia/mana — the same font
// Scryfall itself uses to render mana costs on the web. Loaded
// straight from jsDelivr's CDN, so nothing else in the project
// needs to change. Each entry below is the font's actual glyph
// codepoint, taken from its published mana.css.
// ---------------------------------------------------------------
const MANA_FONT_URL =
  "https://cdn.jsdelivr.net/npm/mana-font@latest/fonts/mana.woff2";
const MANA_FONT_URL_FALLBACK =
  "https://cdn.jsdelivr.net/npm/mana-font@latest/fonts/mana.woff";

const GLYPH = {
  W: "\ue600",
  U: "\ue601",
  B: "\ue602",
  R: "\ue603",
  G: "\ue604",
  0: "\ue605",
  1: "\ue606",
  2: "\ue607",
  3: "\ue608",
  4: "\ue609",
  5: "\ue60a",
  6: "\ue60b",
  7: "\ue60c",
  8: "\ue60d",
  9: "\ue60e",
  10: "\ue60f",
  11: "\ue610",
  12: "\ue611",
  13: "\ue612",
  14: "\ue613",
  15: "\ue614",
  16: "\ue62a",
  17: "\ue62b",
  18: "\ue62c",
  19: "\ue62d",
  20: "\ue62e",
  X: "\ue615",
  Y: "\ue616",
  Z: "\ue617",
  C: "\ue904", // colorless
  S: "\ue619", // snow
  P: "\ue618", // phyrexian (generic glyph, tinted per color below)
};

// Real per-color mana backgrounds, taken from the font's own
// published CSS custom properties (--ms-mana-w/u/b/r/g/c).
const PIP_COLOR = {
  W: "#fdfbce",
  U: "#bcdaf7",
  B: "#a7999e",
  R: "#f19b79",
  G: "#9fcba6",
  C: "#d0c6bb",
  GENERIC: "#d0c6bb",
};

const INK_ON_LIGHT = "#16110a";

let manaFontPromise = null;
function loadManaFont() {
  if (typeof FontFace === "undefined") return Promise.resolve(null);
  if (!manaFontPromise) {
    const font = new FontFace(
      "Mana",
      `url(${MANA_FONT_URL}) format('woff2'), url(${MANA_FONT_URL_FALLBACK}) format('woff')`
    );
    manaFontPromise = font
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return loaded;
      })
      .catch(() => null);
  }
  return manaFontPromise;
}

// Frame palettes per MTG color identity. Real cards use printed
// metallic/painted frames we can't legally redistribute the art
// for, so these are original color values arranged to read the
// same way at a glance (white/blue/black/red/green/gold/colorless).
const COLOR_THEMES = {
  W: { light: "#f7f2da", mid: "#e2d5a0", dark: "#a3934a", text: "#241f0d" },
  U: { light: "#bcd9f2", mid: "#4f83b8", dark: "#17385a", text: "#0a1b28" },
  B: { light: "#9a92a0", mid: "#4b4353", dark: "#1c1622", text: "#f2ecf5" },
  R: { light: "#f3b892", mid: "#c4552a", dark: "#6e2611", text: "#241004" },
  G: { light: "#b9dcae", mid: "#4c8a4f", dark: "#204322", text: "#0c1a0d" },
  GOLD: { light: "#f2e0a4", mid: "#c9a13a", dark: "#6e4e10", text: "#241c05" },
  C: { light: "#d8d5da", mid: "#8f8c96", dark: "#403c48", text: "#161420" },
};

function getTheme(colors) {
  if (!colors || colors.length === 0) return COLOR_THEMES.C;
  if (colors.length > 1) return COLOR_THEMES.GOLD;
  return COLOR_THEMES[colors[0]] || COLOR_THEMES.C;
}

function parseManaSymbols(manaCost) {
  if (!manaCost) return [];
  const matches = manaCost.match(/\{[^}]+\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, ""));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Word-wrap for the oracle text box. Handles literal "\n" for
// paragraph breaks in the rules text (Scryfall uses \n between abilities).
function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.push(""); // blank line between paragraphs
  }
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// Draws a metallic-looking beveled bar (used for the nameplate,
// type line, and P/T box) so the frame reads as embossed rather
// than flat-filled.
function drawBeveledBar(ctx, x, y, w, h, radius, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.light);
  grad.addColorStop(0.5, theme.mid);
  grad.addColorStop(1, theme.dark);

  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  // top highlight sliver
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x, y, w, Math.max(2, h * 0.12));
  // bottom shade sliver
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + h * 0.85, w, h * 0.15);
  ctx.restore();

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#0d0a06";
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();
}

// Draws one mana pip. `token` is the raw text inside {}, e.g.
// "R", "3", "X", "W/U" (hybrid), or "R/P" (Phyrexian).
function drawManaPip(ctx, cx, cy, r, token, fontReady) {
  const parts = token.includes("/") ? token.split("/") : [token];
  const isPhyrexian = parts.length === 2 && parts.includes("P");

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();

  if (parts.length === 1) {
    ctx.fillStyle = PIP_COLOR[parts[0]] || PIP_COLOR.GENERIC;
    ctx.fill();
  } else if (isPhyrexian) {
    const colorKey = parts.find((p) => p !== "P");
    ctx.fillStyle = PIP_COLOR[colorKey] || PIP_COLOR.GENERIC;
    ctx.fill();
  } else {
    // hybrid mana: split the pip diagonally between its two colors,
    // same visual language as real hybrid symbols.
    ctx.clip();
    ctx.fillStyle = PIP_COLOR[parts[0]] || PIP_COLOR.GENERIC;
    ctx.fillRect(cx - r, cy - r, r, r * 2);
    ctx.fillStyle = PIP_COLOR[parts[1]] || PIP_COLOR.GENERIC;
    ctx.fillRect(cx, cy - r, r, r * 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0d0a06";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK_ON_LIGHT;

  if (parts.length === 1 || isPhyrexian) {
    const key = isPhyrexian ? "P" : parts[0];
    ctx.font = fontReady
      ? `${Math.floor(r * 1.6)}px Mana`
      : `bold ${Math.floor(r * 1.1)}px 'Cinzel', serif`;
    const glyph = fontReady ? GLYPH[key] || key : key;
    ctx.fillText(glyph, cx, cy + (fontReady ? 1 : 0));
  } else {
    // two-part hybrid: small glyph on each half
    const smallR = r * 0.85;
    ctx.font = fontReady
      ? `${Math.floor(smallR * 1.4)}px Mana`
      : `bold ${Math.floor(smallR)}px 'Cinzel', serif`;
    const g0 = fontReady ? GLYPH[parts[0]] || parts[0] : parts[0];
    const g1 = fontReady ? GLYPH[parts[1]] || parts[1] : parts[1];
    ctx.fillText(g0, cx - r * 0.42, cy);
    ctx.fillText(g1, cx + r * 0.42, cy);
  }
}

// Small rarity gem for the type line — an original abstraction
// (color-coded diamond) rather than any specific set's real
// expansion symbol artwork, which belongs to Wizards/the printer.
const RARITY_COLOR = {
  common: "#1c1a20",
  uncommon: "#a9b4bd",
  rare: "#c9a13a",
  mythic: "#c4552a",
  special: "#c9a13a",
  bonus: "#c9a13a",
};

function drawRarityGem(ctx, cx, cy, size, rarity) {
  const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0d0a06";
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}

export default function CardCanvas({ card, artImage, onCanvasReady }) {
  const canvasRef = useRef(null);
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadManaFont().then(() => {
      if (!cancelled) setFontReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const theme = getTheme(card?.colors);
    const cardRadius = 26; // ~3% of width, matching a real card's corner cut

    // ---- outer black bezel ----
    ctx.fillStyle = "#0d0a06";
    roundRect(ctx, 0, 0, W, H, cardRadius);
    ctx.fill();

    // ---- metallic frame ring ----
    const frameGrad = ctx.createLinearGradient(0, 0, W, H);
    frameGrad.addColorStop(0, theme.light);
    frameGrad.addColorStop(0.5, theme.mid);
    frameGrad.addColorStop(1, theme.dark);
    roundRect(ctx, 10, 10, W - 20, H - 20, cardRadius - 8);
    ctx.fillStyle = frameGrad;
    ctx.fill();

    // ---- title bar ----
    const titleBarY = 30;
    const titleBarH = 56;
    drawBeveledBar(ctx, 32, titleBarY, W - 64, titleBarH, 6, theme);

    ctx.fillStyle = theme.text;
    ctx.font = "600 29px 'Cinzel', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const cardName = card?.name || "Card Name";
    ctx.fillText(cardName, 48, titleBarY + titleBarH / 2 + 2, W - 230);

    // mana pips, right-aligned
    const pips = parseManaSymbols(card?.mana_cost);
    const pipR = 15;
    let pipX = W - 48 - pipR;
    const pipY = titleBarY + titleBarH / 2;
    for (let i = pips.length - 1; i >= 0; i--) {
      drawManaPip(ctx, pipX, pipY, pipR, pips[i], fontReady);
      pipX -= pipR * 2 + 6;
    }

    // ---- art box ----
    const artX = 42;
    const artY = titleBarY + titleBarH + 12;
    const artW = W - 84;
    const artH = 414;

    ctx.save();
    roundRect(ctx, artX, artY, artW, artH, 4);
    ctx.clip();
    ctx.fillStyle = "#111";
    ctx.fillRect(artX, artY, artW, artH);

    if (artImage) {
      const scale = Math.max(artW / artImage.width, artH / artImage.height);
      const dw = artImage.width * scale;
      const dh = artImage.height * scale;
      const dx = artX + (artW - dw) / 2;
      const dy = artY + (artH - dh) / 2;
      ctx.drawImage(artImage, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#666";
      ctx.font = "italic 22px 'Spectral', serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload art to fill this box", artX + artW / 2, artY + artH / 2);
    }

    // inner shadow ring for depth, like a recessed art window
    const innerShadow = ctx.createLinearGradient(0, artY, 0, artY + artH);
    innerShadow.addColorStop(0, "rgba(0,0,0,0.35)");
    innerShadow.addColorStop(0.08, "rgba(0,0,0,0)");
    innerShadow.addColorStop(0.92, "rgba(0,0,0,0)");
    innerShadow.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = innerShadow;
    ctx.fillRect(artX, artY, artW, artH);
    ctx.restore();

    ctx.strokeStyle = "#0d0a06";
    ctx.lineWidth = 3;
    roundRect(ctx, artX, artY, artW, artH, 4);
    ctx.stroke();

    // ---- type line ----
    const typeY = artY + artH + 10;
    const typeH = 38;
    drawBeveledBar(ctx, 32, typeY, W - 64, typeH, 5, theme);

    ctx.fillStyle = theme.text;
    ctx.font = "600 19px 'Cinzel', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(card?.type_line || "Type — Subtype", 48, typeY + typeH / 2 + 1, W - 140);

    if (card?.rarity) {
      drawRarityGem(ctx, W - 62, typeY + typeH / 2, 16, card.rarity);
    }

    // ---- rules text box ----
    const textX = 42;
    const textY = typeY + typeH + 10;
    const textW = W - 84;
    const textH = H - textY - 38;

    const textGrad = ctx.createLinearGradient(0, textY, 0, textY + textH);
    textGrad.addColorStop(0, "#f8f2e2");
    textGrad.addColorStop(1, "#ece3cc");
    roundRect(ctx, textX, textY, textW, textH, 5);
    ctx.fillStyle = textGrad;
    ctx.fill();
    ctx.strokeStyle = "#0d0a06";
    ctx.lineWidth = 3;
    roundRect(ctx, textX, textY, textW, textH, 5);
    ctx.stroke();

    ctx.fillStyle = "#1c1710";
    ctx.font = "20px 'Spectral', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, card?.oracle_text || "", textW - 32);
    let ly = textY + 20;
    const lineHeight = 27;
    for (const line of lines) {
      if (ly > textY + textH - 24) break; // avoid overflow past the box
      ctx.fillText(line, textX + 16, ly);
      ly += lineHeight;
    }

    // ---- power/toughness box ----
    if (card?.power != null && card?.toughness != null) {
      const ptW = 112;
      const ptH = 44;
      const ptX = W - 42 - ptW;
      const ptY = H - 34 - ptH;
      drawBeveledBar(ctx, ptX, ptY, ptW, ptH, 6, theme);

      ctx.fillStyle = theme.text;
      ctx.font = "700 23px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${card.power}/${card.toughness}`, ptX + ptW / 2, ptY + ptH / 2 + 2);
    } else if (card?.loyalty != null) {
      const lW = 68;
      const lH = 44;
      const lX = W - 42 - lW;
      const lY = H - 34 - lH;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(lX + lW / 2, lY + lH / 2, lW / 2, lH / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      const lGrad = ctx.createLinearGradient(0, lY, 0, lY + lH);
      lGrad.addColorStop(0, theme.light);
      lGrad.addColorStop(1, theme.dark);
      ctx.fillStyle = lGrad;
      ctx.fillRect(lX, lY, lW, lH);
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#0d0a06";
      ctx.beginPath();
      ctx.ellipse(lX + lW / 2, lY + lH / 2, lW / 2, lH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = theme.text;
      ctx.font = "700 22px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(card.loyalty), lX + lW / 2, lY + lH / 2 + 2);
    }

    // ---- footer credit line ----
    ctx.fillStyle = theme.text === "#f2ecf5" ? "#e5dfe8cc" : "#0d0a0699";
    ctx.font = "italic 12px 'Spectral', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const footer = card
      ? `Custom art on: ${card.name}${card.set_name ? " — " + card.set_name : ""}`
      : "Fan-made custom card for personal use only";
    ctx.fillText(footer, 44, H - 14, W - 88);

    onCanvasReady?.(canvas);
  }, [card, artImage, fontReady]);

  return <canvas ref={canvasRef} width={W} height={H} className="card-canvas" />;
}