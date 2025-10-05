/**
 * Intelligent Search Hook with Natural Language Processing
 * Integrates with DeepSeek API for smart query understanding
 */

import { useState, useEffect } from 'react';

export interface IntelligentSearchResult {
  id: string;
  name: string;
  body: string;
  category: string;
  keywords: string[];
  coordinates?: {
    lat: number;
    lon: number;
  };
}

export interface SearchUnderstanding {
  intent: string;
  target_body?: string;
  feature_type?: string;
  size_filter?: string;
  keywords: string[];
  temporal_filter?: string;
  spatial_filter?: any;
  comparison?: any;
}

interface IntelligentSearchResponse {
  status: string;
  query_type: 'simple' | 'complex';
  understanding?: SearchUnderstanding;
  results: IntelligentSearchResult[];
  total_results: number;
}

// Session management
let sessionId: string | null = null;

const getOrCreateSessionId = async (): Promise<string> => {
  if (sessionId) return sessionId;
  
  // Try to load from localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('search_session_id');
    if (stored) {
      sessionId = stored;
      return sessionId;
    }
  }
  
  // Generate new session ID
  try {
    const response = await fetch('http://localhost:8000/api/generate-session', {
      method: 'POST'
    });
    const data = await response.json();
    sessionId = data.session_id;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('search_session_id', sessionId);
    }
    
    return sessionId;
  } catch (error) {
    console.error('Failed to generate session ID:', error);
    sessionId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return sessionId;
  }
};

/**
 * Hook for intelligent search with natural language understanding
 */
export const useIntelligentSearch = (query: string, limit: number = 50) => {
  const [results, setResults] = useState<IntelligentSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queryType, setQueryType] = useState<'simple' | 'complex' | null>(null);
  const [understanding, setUnderstanding] = useState<SearchUnderstanding | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setQueryType(null);
      setUnderstanding(null);
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const session = await getOrCreateSessionId();

        const response = await fetch('http://localhost:8000/api/intelligent-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query.trim(),
            session_id: session,
            limit
          })
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data: IntelligentSearchResponse = await response.json();
        
        setResults(data.results || []);
        setQueryType(data.query_type);
        setUnderstanding(data.understanding || null);
        
      } catch (err) {
        console.error('Search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [query, limit]);

  return {
    results,
    isLoading,
    queryType,
    understanding,
    error
  };
};

/**
 * Hook for personalized search suggestions
 */
export const useSearchSuggestions = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadSuggestions = async () => {
      setIsLoading(true);
      
      try {
        const session = await getOrCreateSessionId();
        
        const response = await fetch('http://localhost:8000/api/search-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: session
          })
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSuggestions();
  }, []);

  return { suggestions, isLoading };
};

/**
 * Hook for search history
 */
export const useSearchHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      
      try {
        const session = await getOrCreateSessionId();
        
        const response = await fetch(`http://localhost:8000/api/search-history/${session}`);

        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  return { history, isLoading };
};

/**
 * Hook for trending searches
 */
export const useTrendingSearches = () => {
  const [trending, setTrending] = useState<Array<{ query: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTrending = async () => {
      setIsLoading(true);
      
      try {
        const response = await fetch('http://localhost:8000/api/trending-searches');

        if (response.ok) {
          const data = await response.json();
          setTrending(data.trending || []);
        }
      } catch (err) {
        console.error('Failed to load trending:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrending();
  }, []);

  return { trending, isLoading };
};
