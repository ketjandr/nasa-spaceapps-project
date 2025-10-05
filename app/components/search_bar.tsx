"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { Search, ChevronDown, Moon, Circle } from "lucide-react";

interface GlassSearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string; // External value prop for controlled component
  selectedFilter?: string | null;
  onFilterChange?: (filter: string | null) => void;
}

export default function GlassSearchBar({ 
  onSearch, 
  placeholder = "Search planetary features, locations, coordinates...",
  className = "",
  value: externalValue,
  selectedFilter,
  onFilterChange
}: GlassSearchBarProps) {
  const [query, setQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync internal state with external value when it changes
  useEffect(() => {
    if (externalValue !== undefined) {
      setQuery(externalValue);
    }
  }, [externalValue]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query.trim());
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleFilterSelect = (filter: string | null) => {
    if (onFilterChange) {
      onFilterChange(filter);
    }
    setIsDropdownOpen(false);
  };

  const getFilterDisplay = () => {
    switch (selectedFilter) {
      case "moon":
        return <><Moon size={16} /> Moon</>;
      case "mars":
        return <><Circle size={16} fill="currentColor" /> Mars</>;
      case "mercury":
        return <><Circle size={16} /> Mercury</>;
      default:
        return <>-</>;
    }
  };

  const getFilterColor = () => {
    switch (selectedFilter) {
      case "moon":
        return "bg-blue-500 hover:bg-blue-600";
      case "mars":
        return "bg-red-500 hover:bg-red-600";
      case "mercury":
        return "bg-gray-400 hover:bg-gray-500";
      default:
        return "bg-white hover:bg-gray-200";
    }
  };

  const getFilterTextColor = () => {
    return selectedFilter ? "text-white" : "text-gray-900";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center w-full max-w-3xl bg-black/40 backdrop-blur-xl rounded-full px-4 py-3 shadow-lg border border-white/30 hover:border-white/40 transition-all ${className}`}
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

      {/* Filter Dropdown Button */}
      <div className="relative ml-2">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`flex items-center justify-center gap-1.5 ${getFilterColor()} ${getFilterTextColor()} rounded-full px-4 py-2 transition flex-shrink-0 text-sm font-medium`}
          title="Select filter"
        >
          {getFilterDisplay()}
          <ChevronDown size={14} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsDropdownOpen(false)}
            />
            
            {/* Dropdown content */}
            <div className="absolute right-0 mt-2 w-40 bg-gray-900 rounded-lg shadow-xl border border-white/20 overflow-hidden z-20">
              <button
                type="button"
                onClick={() => handleFilterSelect(null)}
                className={`w-full px-4 py-2.5 text-left text-sm transition flex items-center gap-2 ${
                  selectedFilter === null
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="w-4 text-center">-</span>
                None (Default)
              </button>
              <button
                type="button"
                onClick={() => handleFilterSelect("moon")}
                className={`w-full px-4 py-2.5 text-left text-sm transition flex items-center gap-2 ${
                  selectedFilter === "moon"
                    ? "bg-blue-500/20 text-blue-300"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Moon size={16} />
                Moon
              </button>
              <button
                type="button"
                onClick={() => handleFilterSelect("mars")}
                className={`w-full px-4 py-2.5 text-left text-sm transition flex items-center gap-2 ${
                  selectedFilter === "mars"
                    ? "bg-red-500/20 text-red-300"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Circle size={16} fill="currentColor" />
                Mars
              </button>
              <button
                type="button"
                onClick={() => handleFilterSelect("mercury")}
                className={`w-full px-4 py-2.5 text-left text-sm transition flex items-center gap-2 ${
                  selectedFilter === "mercury"
                    ? "bg-gray-400/20 text-gray-300"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Circle size={16} />
                Mercury
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
