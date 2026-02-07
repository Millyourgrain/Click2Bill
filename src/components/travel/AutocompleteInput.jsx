
import { useState, useEffect, useRef } from "react";
import { autocomplete } from "../../services/geoapify";

function AutocompleteInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const results = await autocomplete(value);
      setSuggestions(results);
      setShowSuggestions(true);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(suggestion) {
    onChange(suggestion.label);
    setShowSuggestions(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        style={{
          width: "100%",
          padding: "0.5rem",
          fontSize: "1rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />

      {loading && (
        <div style={{ 
          position: "absolute", 
          right: "10px", 
          top: "12px",
          fontSize: "0.9rem",
          color: "#666"
        }}>
          ...
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: "none",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderTop: "none",
            borderRadius: "0 0 4px 4px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelect(suggestion)}
              style={{
                padding: "0.75rem",
                cursor: "pointer",
                borderBottom: index < suggestions.length - 1 ? "1px solid #eee" : "none",
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#f0f0f0"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "white"}
            >
              <div style={{ fontWeight: "500" }}>{suggestion.label}</div>
              {suggestion.city && (
                <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "2px" }}>
                  {suggestion.city}, {suggestion.country}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AutocompleteInput;
