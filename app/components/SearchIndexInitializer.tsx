'use client';

import { useEffect } from 'react';
import { initializeAppSearchIndex } from '../utils/initializeSearch';

/**
 * Component that initializes the search index on app startup
 * Should be included once in the main app layout
 */
export default function SearchIndexInitializer() {
  useEffect(() => {
    // Initialize search index on mount
    initializeAppSearchIndex().catch(console.error);
  }, []);

  return null; // This component doesn't render anything
}