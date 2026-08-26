import { useRef, useState } from "react";
import SearchBar from "./components/SearchBar.jsx";
import ImageUploader from "./components/ImageUploader.jsx";
import CardCanvas from "./components/CardCanvas.jsx";

export default function App() {
  const [card, setCard] = useState(null);
  const [artImage, setArtImage] = useState(null);
  const [error, setError] = useState("");
  const canvasElRef = useRef(null);

  function handleSelectCard(selected, err) {
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setCard(selected);
  }

  function handleDownload() {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(card?.name || "custom-card").replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Custom Card Forge</h1>
        <p className="subtitle">
          Upload your own art, search for any Magic card, and forge a custom
          version that keeps the original's name, mana cost, type, rules
          text, and power/toughness.
        </p>
      </header>

      <main className="layout">
        <section className="controls">
          <SearchBar onSelectCard={handleSelectCard} />
          {error && <p className="error-text">{error}</p>}

          <ImageUploader onImage={setArtImage} />

          {card && (
            <div className="card-meta">
              <h3>{card.name}</h3>
              <p>{card.type_line}</p>
              {card.set_name && (
                <p className="muted">
                  {card.set_name} · #{card.collector_number}
                  {card.artist ? ` · original art by ${card.artist}` : ""}
                </p>
              )}
            </div>
          )}

          <button
            className="download-btn"
            onClick={handleDownload}
            disabled={!card}
          >
            Download PNG
          </button>

          <p className="disclaimer">
            Fan-made cards for personal use. Magic: The Gathering and its
            card data are property of Wizards of the Coast; card text is
            fetched live from the public Scryfall API. This tool draws an
            original frame design — it does not use or redistribute
            Wizards' official card artwork or frame assets.
          </p>
        </section>

        <section className="preview">
          <CardCanvas
            card={card}
            artImage={artImage}
            onCanvasReady={(c) => (canvasElRef.current = c)}
          />
        </section>
      </main>
    </div>
  );
}
