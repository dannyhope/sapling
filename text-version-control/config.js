/**
 * Configuration settings for Text Version Control
 */

const CONFIG = {
  // Default test data file to load for development purposes
  defaultTestDataFile: 'text-version-history-2025-04-04.json',
  
  // Other configuration options can be added here
  debug: false,
  maxBranchDepth: 20,
  autoSaveInterval: 5000, // milliseconds
};

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
