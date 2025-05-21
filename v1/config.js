const CONFIG = {
  defaultTestDataFile: 'text-version-history-2025-04-04.json',
  debug: false,
  maxBranchDepth: 20,
  autoSaveInterval: 5000,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
