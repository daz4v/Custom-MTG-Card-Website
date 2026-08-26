import { useEffect, useRef, useState } from "react";

export default function SearchBar({ onSelectCard, disabled }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.names || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function pickCard(name) {
    setQuery(name);
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/card?name=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error("Card not found");
      const card = await res.json();
      onSelectCard(card);
    } catch (err) {
      onSelectCard(null, err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim()) pickCard(query.trim());
  }

  return (
    <div className="search-wrap">
      <label className="field-label">Base card</label>
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder="Search for a card, e.g. Lightning Bolt"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="search-input"
        />
        <button type="submit" className="search-btn" disabled={disabled || loading}>
          {loading ? "Loading…" : "Use card"}
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((name) => (
            <li key={name}>
              <button type="button" onMouseDown={() => pickCard(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
