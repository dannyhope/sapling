import { TIMELINE_CONSTANTS } from './timelineConstants.js';

/**
 * @class TimelineSvgManager
 * @description Manages the creation, clearing, and adjustment of the SVG canvas for the timeline.
 */
export class TimelineSvgManager {
  /**
   * Creates a TimelineSvgManager instance.
   * @param {HTMLElement} timelineContainerEl - The container element for the timeline SVG.
   */
  constructor(timelineContainerEl) {
    this.timelineContainerEl = timelineContainerEl;
    this.svgElement = null; // To store the created SVG element
    this._maxRenderedXForViewBox = 0;
    this._maxRenderedYForViewBox = 0;
  }

  /**
   * Clears all child elements from the timeline container.
   * @public
   */
  clearTimeline() {
    if (this.timelineContainerEl) {
      this.timelineContainerEl.innerHTML = '';
    }
    this._maxRenderedXForViewBox = 0;
    this._maxRenderedYForViewBox = 0;
    this.svgElement = null;
  }

  /**
   * Creates the main SVG canvas element for the timeline.
   * Sets initial width, height, viewBox, and basic styling.
   * These attributes will be adjusted later by adjustSvgViewbox.
   * @public
   * @returns {SVGElement} The created SVG canvas element.
   */
  createSvgCanvas() {
    const svg = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", TIMELINE_CONSTANTS.DEFAULT_SVG_HEIGHT.toString());
    svg.setAttribute("viewBox", `0 0 ${TIMELINE_CONSTANTS.DEFAULT_SVG_WIDTH} ${TIMELINE_CONSTANTS.DEFAULT_SVG_HEIGHT}`);
    svg.style.border = TIMELINE_CONSTANTS.SVG_BORDER_STYLE;
    svg.style.minHeight = TIMELINE_CONSTANTS.SVG_MIN_HEIGHT;
    
    this.svgElement = svg;
    this.timelineContainerEl.appendChild(svg);
    return svg;
  }

  /**
   * Adjusts the SVG canvas's 'viewBox' attribute and its explicit 'height' and 'width'
   * attributes to encompass all rendered timeline content with appropriate padding.
   * It also adjusts the height of the timeline container div to match the SVG.
   * The main timeline group's transform is updated to ensure content is well-padded.
   * @public
   * @param {SVGElement} mainTimelineGroup - The main group within the SVG that holds all timeline content.
   * @param {number} maxRenderedX - The maximum X coordinate reached by any rendered node.
   * @param {number} maxRenderedY - The maximum Y coordinate reached by rendered branches.
   */
  adjustSvgViewbox(mainTimelineGroup, maxRenderedX, maxRenderedY) {
    if (!this.svgElement) return;

    this._maxRenderedXForViewBox = maxRenderedX;
    this._maxRenderedYForViewBox = maxRenderedY;

    const padding = TIMELINE_CONSTANTS.VIEWBOX_PADDING;
    const svgWidth = Math.max(TIMELINE_CONSTANTS.DEFAULT_SVG_WIDTH, this._maxRenderedXForViewBox + padding);
    const svgHeight = Math.max(TIMELINE_CONSTANTS.DEFAULT_SVG_HEIGHT, this._maxRenderedYForViewBox + padding);

    this.svgElement.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    this.svgElement.setAttribute("height", svgHeight.toString());

    if (this.timelineContainerEl && this.timelineContainerEl.firstChild === this.svgElement) {
      this.timelineContainerEl.style.height = `${svgHeight}px`;
    }

    if (mainTimelineGroup) {
      const translateX = TIMELINE_CONSTANTS.BRANCH_LABEL_OFFSET + padding;
      const translateY = padding * 1.5;
      mainTimelineGroup.setAttribute("transform", `translate(${translateX}, ${translateY})`);
    }
  }
} 