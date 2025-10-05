'use client';

import { initializeSearchIndex } from './localSearch';

/**
 * Initialize the search index with feature data from all planetary bodies
 * This should be called once during app startup
 */
export async function initializeAppSearchIndex(): Promise<void> {
  try {
    console.log('[SEARCH] Initializing app search index...');
    const startTime = performance.now();

    // Call the existing initialization function
    await initializeSearchIndex();

    const endTime = performance.now();
    console.log(`[SUCCESS] App search index initialized in ${(endTime - startTime).toFixed(2)}ms`);

  } catch (error) {
    console.error('[ERROR] Failed to initialize app search index:', error);
  }
}