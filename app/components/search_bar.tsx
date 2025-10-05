"use client";

import { useState, useEffect, FormEvent, ChangeEvent, useRef, KeyboardEvent } from "react";
import { Search, ArrowUp, X, Sparkles, Clock } from "lucide-react";
import { useIntelligentSearch, useSearchSuggestions as usePersonalizedSuggestions, useSearchHistory } from "../utils/intelligentSearch";

interface GlassSearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string; // External value prop for controlled component
}

interface AutocompleteSuggestion {
  name: string;
  body?: string;
  category?: string;
}

export default function GlassSearchBar({ 
  onSearch, 
  placeholder = "Search planetary features, locations, coordinates...",
  className = "",
  value: externalValue
}: GlassSearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal state with external value when it changes
  useEffect(() => {
    if (externalValue !== undefined) {
      setQuery(externalValue);
    }
  }, [externalValue]);

  // Old backend-based suggestion fetching - replaced with instant local search
  // const fetchSuggestions = async (searchQuery: string) => {
  //   if (searchQuery.length < 2) {
  //     setSuggestions([]);
  //     setShowSuggestions(false);
  //     return;
  //   }

  //   setIsLoading(true);
  //   try {
  //     const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  //     const response = await fetch(
  //       `${backendUrl}/search/autocomplete?q=${encodeURIComponent(searchQuery)}&limit=5`
  //     );
      
  //     if (response.ok) {
  //       const data = await response.json();
  //       setSuggestions(data.suggestions.map((name: string) => ({ name })));
  //       setShowSuggestions(true);
  //       setSelectedIndex(-1);
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch suggestions:', error);
  //     setSuggestions([]);
  //   }
  //   setIsLoading(false);
  // };

  // Old debounced backend fetching - replaced with instant local search
  // useEffect(() => {
  //   if (suggestionTimeoutRef.current) {
  //     clearTimeout(suggestionTimeoutRef.current);
  //   }

  //   suggestionTimeoutRef.current = setTimeout(() => {
  //     fetchSuggestions(query);
  //   }, 300);

  //   return () => {
  //     if (suggestionTimeoutRef.current) {
  //       clearTimeout(suggestionTimeoutRef.current);
  //     }
  //   };
  // }, [query]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalQuery = selectedIndex >= 0 ? suggestions[selectedIndex].name : query.trim();
    if (finalQuery && onSearch) {
      onSearch(finalQuery);
      setShowSuggestions(false);
    }
  };

  // Use intelligent search for natural language understanding
  const { results: searchResults, isLoading: searchLoading } = useIntelligentSearch(query, 10);
  const { suggestions: personalizedSuggestions } = usePersonalizedSuggestions();
  const { history } = useSearchHistory();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    
    // Update suggestions based on intelligent search
    if (newValue.length >= 2) {
      setIsLoading(searchLoading);
      const instantSuggestions: AutocompleteSuggestion[] = searchResults.slice(0, 5).map(result => ({
        name: result.name,
        body: result.body,
        category: result.category
      }));
      setSuggestions(instantSuggestions);
      setShowSuggestions(true);
    } else if (newValue.length === 0) {
      // Show personalized suggestions when empty
      const personalizedList: AutocompleteSuggestion[] = personalizedSuggestions.map(s => ({
        name: s
      }));
      setSuggestions(personalizedList);
      setShowSuggestions(personalizedList.length > 0);
      setIsLoading(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          setQuery(suggestions[selectedIndex].name);
          setShowSuggestions(false);
        }
        break;
    }
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(suggestion.name);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full max-w-3xl ${className}`}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center w-full bg-black/40 backdrop-blur-xl rounded-full px-4 py-3 shadow-lg border border-white/30 hover:border-white/40 transition-all"
      >
        {/* Magnifying Glass Icon */}
        <Search className="text-white/70 w-5 h-5 mr-3 flex-shrink-0" />

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-grow bg-transparent outline-none text-white placeholder-white/50 text-base"
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow for clicks
            setTimeout(() => setShowSuggestions(false), 150);
          }}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-white/50 mr-2 flex-shrink-0">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Clear Button */}
        {query.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center text-white/50 hover:text-white/80 rounded-full w-7 h-7 mr-1 hover:bg-white/10 transition flex-shrink-0"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}

        {/* Enter Button */}
        <button
          type="submit"
          className="flex items-center justify-center bg-white text-gray-900 rounded-full w-9 h-9 ml-2 hover:bg-gray-200 transition flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!query.trim()}
          title="Search"
        >
          <ArrowUp size={18} />
        </button>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden z-50">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0 ${
                index === selectedIndex ? 'bg-white/10' : ''
              }`}
            >
              <div className="flex items-center">
                <Search className="text-white/50 w-4 h-4 mr-3 flex-shrink-0" />
                <span className="text-white text-sm truncate">{suggestion.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
