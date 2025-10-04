"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { Search, ArrowUp } from "lucide-react";

interface GlassSearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export default function GlassSearchBar({ 
  onSearch, 
  placeholder = "Search planetary features, locations, coordinates...",
  className = ""
}: GlassSearchBarProps) {
  const [query, setQuery] = useState<string>("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center w-full max-w-3xl bg-white/10 backdrop-blur-md rounded-full px-4 py-3 shadow-lg border border-white/20 hover:border-white/30 transition-all ${className}`}
    >
      {/* Magnifying Glass Icon */}
      <Search className="text-white/70 w-5 h-5 mr-3 flex-shrink-0" />

      {/* Input Field */}
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        className="flex-grow bg-transparent outline-none text-white placeholder-white/50 text-base"
      />

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
  );
}
