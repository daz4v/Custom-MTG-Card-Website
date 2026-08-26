import { useEffect, useRef } from "react";

// Canvas is drawn at a fixed high-res size and scaled down by CSS,
// so the exported PNG stays crisp.
const W = 750;
const H = 1050;

// Frame palettes per MTG color identity. This is an original palette,
// not a reproduction of Wizards of the Coast's card frame art.
const COLOR_THEMES = {
  W: { frame: "#e8dfc0", frameDark: "#b8a968", text: "#2a2413", accent: "#c9a24b" },
  U: { frame: "#a9c9e8", frameDark: "#2f5e8c", text: "#0d2436", accent: "#3c78b4" },
  B: { frame: "#6b6470", frameDark: "#231c2b", text: "#f2ecf5", accent: "#4a3f57" },
  R: { frame: "#e8a98a", frameDark: "#a8341a", text: "#2c0f06", accent: "#c94a26" },
  G: { frame: "#a9d3a0", frameDark: "#2e6b34", text: "#0f2410", accent: "#3f7d3f" },
  GOLD: { frame: "#e8cf8a", frameDark: "#a8821a", text: "#241d06", accent: "#c9a024" },
  C: { frame: "#c9c6cc", frameDark: "#6b6875", text: "#1c1a20", accent: "#8a8792" },
};

const MANA_SYMBOL_COLORS = {
  W: "#f8f4e3",
  U: "#3c78b4",
  B: "#3a3540",
  R: "#c94a26",
  G: "#3f7d3f",
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

// Basic word-wrap for the oracle text box. Handles literal "\n" for
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

function drawManaPip(ctx, cx, cy, r, symbol) {
  const isColor = MANA_SYMBOL_COLORS[symbol];
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = isColor || "#cfcac0";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#20180a";
  ctx.stroke();

  ctx.fillStyle = ["W"].includes(symbol) ? "#20180a" : "#f5f2ea";
  ctx.font = `bold ${Math.floor(r * 1.1)}px 'Cinzel', serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol.length > 2 ? symbol[0] : symbol, cx, cy + 1);
}

export default function CardCanvas({ card, artImage, onCanvasReady }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const theme = getTheme(card?.colors);

    // ---- outer frame ----
    ctx.fillStyle = theme.frameDark;
    roundRect(ctx, 0, 0, W, H, 34);
    ctx.fill();

    ctx.fillStyle = theme.frame;
    roundRect(ctx, 14, 14, W - 28, H - 28, 26);
    ctx.fill();

    // ---- title bar ----
    const titleBarY = 34;
    const titleBarH = 58;
    ctx.fillStyle = theme.accent;
    roundRect(ctx, 34, titleBarY, W - 68, titleBarH, 10);
    ctx.fill();
    ctx.strokeStyle = "#20180a";
    ctx.lineWidth = 2;
    roundRect(ctx, 34, titleBarY, W - 68, titleBarH, 10);
    ctx.stroke();

    ctx.fillStyle = theme.text === "#f2ecf5" ? "#f2ecf5" : "#20180a";
    ctx.font = "600 30px 'Cinzel', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const cardName = card?.name || "Card Name";
    ctx.fillText(cardName, 50, titleBarY + titleBarH / 2 + 2, W - 240);

    // mana pips, right-aligned
    const pips = parseManaSymbols(card?.mana_cost);
    const pipR = 15;
    let pipX = W - 50 - pipR;
    const pipY = titleBarY + titleBarH / 2;
    for (let i = pips.length - 1; i >= 0; i--) {
      drawManaPip(ctx, pipX, pipY, pipR, pips[i]);
      pipX -= pipR * 2 + 6;
    }

    // ---- art box ----
    const artX = 44;
    const artY = titleBarY + titleBarH + 14;
    const artW = W - 88;
    const artH = 420;

    ctx.save();
    roundRect(ctx, artX, artY, artW, artH, 6);
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
      ctx.fillStyle = "#555";
      ctx.font = "italic 22px 'Spectral', serif";
      ctx.textAlign = "center";
      ctx.fillText("Upload art to fill this box", artX + artW / 2, artY + artH / 2);
    }
    ctx.restore();

    ctx.strokeStyle = "#20180a";
    ctx.lineWidth = 3;
    roundRect(ctx, artX, artY, artW, artH, 6);
    ctx.stroke();

    // ---- type line ----
    const typeY = artY + artH + 12;
    const typeH = 40;
    ctx.fillStyle = theme.accent;
    roundRect(ctx, 34, typeY, W - 68, typeH, 8);
    ctx.fill();
    ctx.strokeStyle = "#20180a";
    ctx.lineWidth = 2;
    roundRect(ctx, 34, typeY, W - 68, typeH, 8);
    ctx.stroke();

    ctx.fillStyle = theme.text === "#f2ecf5" ? "#f2ecf5" : "#20180a";
    ctx.font = "600 20px 'Cinzel', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(card?.type_line || "Type — Subtype", 50, typeY + typeH / 2 + 1, W - 100);

    // ---- rules text box ----
    const textX = 44;
    const textY = typeY + typeH + 12;
    const textW = W - 88;
    const textH = H - textY - 40;

    ctx.fillStyle = "#f4efe0";
    roundRect(ctx, textX, textY, textW, textH, 6);
    ctx.fill();
    ctx.strokeStyle = "#20180a";
    ctx.lineWidth = 3;
    roundRect(ctx, textX, textY, textW, textH, 6);
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
      const ptW = 110;
      const ptH = 46;
      const ptX = W - 44 - ptW;
      const ptY = H - 40 - ptH + 4;

      ctx.fillStyle = theme.accent;
      roundRect(ctx, ptX, ptY, ptW, ptH, 8);
      ctx.fill();
      ctx.strokeStyle = "#20180a";
      ctx.lineWidth = 3;
      roundRect(ctx, ptX, ptY, ptW, ptH, 8);
      ctx.stroke();

      ctx.fillStyle = theme.text === "#f2ecf5" ? "#f2ecf5" : "#20180a";
      ctx.font = "700 24px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${card.power}/${card.toughness}`, ptX + ptW / 2, ptY + ptH / 2 + 2);
    } else if (card?.loyalty != null) {
      const lW = 70;
      const lH = 46;
      const lX = W - 44 - lW;
      const lY = H - 40 - lH + 4;

      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.ellipse(lX + lW / 2, lY + lH / 2, lW / 2, lH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#20180a";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#20180a";
      ctx.font = "700 22px 'Cinzel', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(card.loyalty), lX + lW / 2, lY + lH / 2 + 2);
    }

    // ---- footer credit line ----
    ctx.fillStyle = theme.text === "#f2ecf5" ? "#e5dfe8cc" : "#20180a99";
    ctx.font = "italic 13px 'Spectral', serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const footer = card
      ? `Custom art on: ${card.name}${card.set_name ? " — " + card.set_name : ""}`
      : "Fan-made custom card — not an official Wizards of the Coast product";
    ctx.fillText(footer, 44, H - 16, W - 88);

    onCanvasReady?.(canvas);
  }, [card, artImage]);

  return <canvas ref={canvasRef} width={W} height={H} className="card-canvas" />;
}
