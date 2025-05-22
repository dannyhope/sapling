import { TIMELINE_CONSTANTS } from './timelineConstants.js';

/**
 * @class TimelineConnectionRenderer
 * @description Handles the rendering of visual connections (lines) between parent and child branch nodes.
 */
export class TimelineConnectionRenderer {
  /**
   * Creates a TimelineConnectionRenderer instance.
   * @param {import('../versionControl.js').VersionControl} versionControl - The main version control instance.
   * @param {object} nodePositions - A reference to the shared nodePositions map.
   * @param {SVGElement} branchConnectionsGroup - The SVG group element dedicated to branch connection lines.
   */
  constructor(versionControl, nodePositions, branchConnectionsGroup) {
    this.versionControl = versionControl;
    this._nodePositions = nodePositions; // Shared object, accessed here
    this._branchConnectionsGroup = branchConnectionsGroup;
  }

  /**
   * Renders the visual connections (lines) between parent branches and their child branches.
   * Connections are drawn as cubic Bezier curves from the parent node to the
   * initial node of the child branch.
   */
  renderBranchConnections() {
    if (!this._branchConnectionsGroup) {
      console.error("Branch connections group not set for TimelineConnectionRenderer");
      return;
    }
    this._branchConnectionsGroup.innerHTML = ''; // Clear previous connections

    const allBranchesData = this.versionControl.getAllBranchesData();

    for (const branchId in allBranchesData) {
      const branchData = allBranchesData[branchId];
      // Connect if it has a parentBranchId and a defined parentTransactionIndex
      if (branchData.parentBranchId && typeof branchData.parentTransactionIndex === 'number') {
        const parentNodeKey = `${branchData.parentBranchId}_${branchData.parentTransactionIndex}`;
        const parentVersionPos = this._nodePositions[parentNodeKey];
        
        // The child connection point is ALWAYS the initialContent state (-1) of the current branch.
        const childNodeKey = `${branchId}_-1`; 
        const childVersionPos = this._nodePositions[childNodeKey];

        if (parentVersionPos && childVersionPos) {
          const line = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "path");
          const nodeRadiusAdjust = TIMELINE_CONSTANTS.NODE_RADIUS / 2;
          const startX = parentVersionPos.x + nodeRadiusAdjust; 
          const startY = parentVersionPos.y;
          const endX = childVersionPos.x - nodeRadiusAdjust; 
          const endY = childVersionPos.y;

          // Control points for bezier curve
          const cp1X = startX + (endX - startX) / 2;
          const cp1Y = startY;
          const cp2X = startX + (endX - startX) / 2;
          const cp2Y = endY;
          
          line.setAttribute("d", `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
          line.setAttribute("stroke", TIMELINE_CONSTANTS.COLOR_GRAY);
          line.setAttribute("stroke-width", TIMELINE_CONSTANTS.CONNECTION_LINE_STROKE_WIDTH);
          line.setAttribute("fill", "none");
          this._branchConnectionsGroup.appendChild(line);
        }
      }
    }
  }
} 