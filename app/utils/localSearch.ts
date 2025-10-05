/**
 * Fast Local Search Index for Instant Feature Discovery
 * Pre-computes search index for <50ms response times
 */

export interface SearchableFeature {
  id: string;
  name: string;
  body: string;
  category: string;
  keywords: string[];
  coordinates: { lat: number; lon: number };
  searchText: string; // Pre-computed searchable text
}

export interface SearchResult extends SearchableFeature {
  score: number;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'keyword';
}

class LocalSearchIndex {
  private features: SearchableFeature[] = [];
  private nameIndex: Map<string, SearchableFeature[]> = new Map();
  private keywordIndex: Map<string, SearchableFeature[]> = new Map();
  private bodyIndex: Map<string, SearchableFeature[]> = new Map();
  private categoryIndex: Map<string, SearchableFeature[]> = new Map();

  // Build search index from features
  buildIndex(features: SearchableFeature[]) {
    console.time('Building search index');
    
    this.features = features;
    this.nameIndex.clear();
    this.keywordIndex.clear();
    this.bodyIndex.clear();
    this.categoryIndex.clear();

    for (const feature of features) {
      // Index by name (exact and prefix)
      const nameLower = feature.name.toLowerCase();
      for (let i = 1; i <= nameLower.length; i++) {
        const prefix = nameLower.substring(0, i);
        if (!this.nameIndex.has(prefix)) {
          this.nameIndex.set(prefix, []);
        }
        this.nameIndex.get(prefix)!.push(feature);
      }

      // Index by keywords
      for (const keyword of feature.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (!this.keywordIndex.has(keywordLower)) {
          this.keywordIndex.set(keywordLower, []);
        }
        this.keywordIndex.get(keywordLower)!.push(feature);
      }

      // Index by body
      const bodyLower = feature.body.toLowerCase();
      if (!this.bodyIndex.has(bodyLower)) {
        this.bodyIndex.set(bodyLower, []);
      }
      this.bodyIndex.get(bodyLower)!.push(feature);

      // Index by category
      const categoryLower = feature.category.toLowerCase();
      if (!this.categoryIndex.has(categoryLower)) {
        this.categoryIndex.set(categoryLower, []);
      }
      this.categoryIndex.get(categoryLower)!.push(feature);
    }

    console.timeEnd('Building search index');
    console.log(`Indexed ${features.length} features with ${this.nameIndex.size} name entries`);
  }

  // Fast search with multiple strategies
  search(query: string, limit: number = 10): SearchResult[] {
    if (!query || query.length < 2) return [];

    const queryLower = query.toLowerCase().trim();
    const results = new Map<string, SearchResult>();

    // 1. Exact name matches (highest priority)
    const exactMatches = this.nameIndex.get(queryLower) || [];
    for (const feature of exactMatches) {
      if (feature.name.toLowerCase() === queryLower) {
        results.set(feature.id, {
          ...feature,
          score: 100,
          matchType: 'exact'
        });
      }
    }

    // 2. Name prefix matches
    const prefixMatches = this.nameIndex.get(queryLower) || [];
    for (const feature of prefixMatches) {
      if (!results.has(feature.id) && feature.name.toLowerCase().startsWith(queryLower)) {
        results.set(feature.id, {
          ...feature,
          score: 80 + (queryLower.length / feature.name.length) * 20,
          matchType: 'prefix'
        });
      }
    }

    // 3. Keyword matches
    const words = queryLower.split(/\s+/);
    for (const word of words) {
      const keywordMatches = this.keywordIndex.get(word) || [];
      for (const feature of keywordMatches) {
        if (!results.has(feature.id)) {
          results.set(feature.id, {
            ...feature,
            score: 60,
            matchType: 'keyword'
          });
        }
      }
    }

    // 4. Body and category matches
    const bodyMatches = this.bodyIndex.get(queryLower) || [];
    for (const feature of bodyMatches) {
      if (!results.has(feature.id)) {
        results.set(feature.id, {
          ...feature,
          score: 50,
          matchType: 'keyword'
        });
      }
    }

    const categoryMatches = this.categoryIndex.get(queryLower) || [];
    for (const feature of categoryMatches) {
      if (!results.has(feature.id)) {
        results.set(feature.id, {
          ...feature,
          score: 45,
          matchType: 'keyword'
        });
      }
    }

    // 5. Fuzzy text search (fallback)
    if (results.size < limit) {
      for (const feature of this.features) {
        if (!results.has(feature.id) && feature.searchText.includes(queryLower)) {
          results.set(feature.id, {
            ...feature,
            score: 30,
            matchType: 'fuzzy'
          });
        }
      }
    }

    // Sort by score and return top results
    return Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Get suggestions for autocomplete
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query || query.length < 2) return [];

    const queryLower = query.toLowerCase();
    const suggestions = new Set<string>();

    // Get name suggestions
    const nameMatches = this.nameIndex.get(queryLower) || [];
    for (const feature of nameMatches) {
      if (feature.name.toLowerCase().startsWith(queryLower)) {
        suggestions.add(feature.name);
        if (suggestions.size >= limit) break;
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  // Get features by body
  getFeaturesByBody(body: string): SearchableFeature[] {
    return this.bodyIndex.get(body.toLowerCase()) || [];
  }

  // Get feature statistics
  getStats() {
    const bodies = new Set(this.features.map(f => f.body));
    const categories = new Set(this.features.map(f => f.category));
    
    return {
      totalFeatures: this.features.length,
      bodies: bodies.size,
      categories: categories.size,
      indexSize: this.nameIndex.size
    };
  }
}

// Singleton instance
export const searchIndex = new LocalSearchIndex();

// Load features from local data
export async function initializeSearchIndex() {
  try {
    // Load feature data from local JSON files
    const [moonFeatures, marsFeatures, mercuryFeatures] = await Promise.all([
      fetch('/data/features/moon_features.json').then(r => r.ok ? r.json() : []),
      fetch('/data/features/mars_features.json').then(r => r.ok ? r.json() : []),
      fetch('/data/features/mercury_features.json').then(r => r.ok ? r.json() : [])
    ]);

    // Convert to searchable format
    const allFeatures: SearchableFeature[] = [];

    // Add Moon features
    for (const feature of moonFeatures) {
      allFeatures.push({
        id: `moon_${feature.id || feature.name}`,
        name: feature.name || feature.feature_name || 'Unnamed',
        body: 'moon',
        category: feature.category || 'feature',
        keywords: [feature.name, 'moon', feature.category].filter(Boolean),
        coordinates: {
          lat: feature.latitude || feature.lat || 0,
          lon: feature.longitude || feature.lon || 0
        },
        searchText: `${feature.name} moon ${feature.category} ${feature.description || ''}`.toLowerCase()
      });
    }

    // Add Mars features
    for (const feature of marsFeatures) {
      allFeatures.push({
        id: `mars_${feature.id || feature.name}`,
        name: feature.name || feature.feature_name || 'Unnamed',
        body: 'mars',
        category: feature.category || 'feature',
        keywords: [feature.name, 'mars', feature.category].filter(Boolean),
        coordinates: {
          lat: feature.latitude || feature.lat || 0,
          lon: feature.longitude || feature.lon || 0
        },
        searchText: `${feature.name} mars ${feature.category} ${feature.description || ''}`.toLowerCase()
      });
    }

    // Add Mercury features
    for (const feature of mercuryFeatures) {
      allFeatures.push({
        id: `mercury_${feature.id || feature.name}`,
        name: feature.name || feature.feature_name || 'Unnamed',
        body: 'mercury',
        category: feature.category || 'feature',
        keywords: [feature.name, 'mercury', feature.category].filter(Boolean),
        coordinates: {
          lat: feature.latitude || feature.lat || 0,
          lon: feature.longitude || feature.lon || 0
        },
        searchText: `${feature.name} mercury ${feature.category} ${feature.description || ''}`.toLowerCase()
      });
    }

    // Build the search index
    searchIndex.buildIndex(allFeatures);
    console.log('Search index initialized:', searchIndex.getStats());

  } catch (error) {
    console.error('Failed to initialize search index:', error);
    
    // Fallback: create basic index with default data
    const fallbackFeatures: SearchableFeature[] = [
      {
        id: 'moon_marco_polo',
        name: 'Marco Polo',
        body: 'moon',
        category: 'crater',
        keywords: ['marco polo', 'crater', 'moon'],
        coordinates: { lat: 15.4, lon: 2.0 },
        searchText: 'marco polo crater moon'
      },
      {
        id: 'mars_olympus_mons',
        name: 'Olympus Mons',
        body: 'mars',
        category: 'mons',
        keywords: ['olympus mons', 'mountain', 'mars'],
        coordinates: { lat: 18.65, lon: -133.8 },
        searchText: 'olympus mons mountain mars'
      }
    ];

    searchIndex.buildIndex(fallbackFeatures);
  }
}

// React hook for using the search index
export function useInstantSearch(query: string, limit: number = 10) {
  if (!query || query.length < 2) return [];
  
  const startTime = performance.now();
  const results = searchIndex.search(query, limit);
  const searchTime = performance.now() - startTime;
  
  if (searchTime > 50) {
    console.warn(`Search took ${searchTime.toFixed(1)}ms - target is <50ms`);
  }
  
  return results;
}

export function useSearchSuggestions(query: string, limit: number = 5) {
  if (!query || query.length < 2) return [];
  return searchIndex.getSuggestions(query, limit);
}