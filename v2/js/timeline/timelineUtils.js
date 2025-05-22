/**
 * @class TimelineUtils
 * @description A collection of utility functions for the timeline.
 */
export class TimelineUtils {
  /**
   * A utility function to parse an SVG 'transform' attribute string (e.g., "translate(x,y)")
   * and extract the translateX and translateY values.
   * Handles cases where the transform attribute might be missing or malformed.
   * @param {string | null} transformString - The SVG transform attribute string.
   * @returns {{translateX: number, translateY: number}} An object with translateX and translateY values.
   *                                                   Defaults to {translateX: 0, translateY: 0} if parsing fails.
   */
  static parseTransform(transformString) {
    const result = { translateX: 0, translateY: 0 };
    if (transformString) {
      const translateMatch = /translate\(\s*([+-]?[\d.]+)\s*[,|\s]\s*([+-]?[\d.]+)\s*\)/.exec(transformString);
      if (translateMatch) {
        result.translateX = parseFloat(translateMatch[1]);
        result.translateY = parseFloat(translateMatch[2]);
      }
    }
    return result;
  }

  /**
   * Debounces a function, delaying its execution until after a specified wait time
   * has elapsed since the last time it was invoked.
   * @param {function} func - The function to debounce.
   * @param {number} wait - The number of milliseconds to delay.
   * @returns {function} The new debounced function.
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
} 