import { TIMELINE_CONSTANTS } from './timelineConstants.js';
// import { TimelineNodeRenderer } from './timelineNodeRenderer.js'; // Will be needed

/**
 * @class TimelineBranchRenderer
 * @description Handles the rendering of branches, including their labels and overall structure,
 *              and determines the order in which branches appear.
 */
export class TimelineBranchRenderer {
  /**
   * Creates a TimelineBranchRenderer instance.
   * @param {import('../versionControl.js').VersionControl} versionControl - The main version control instance.
   * @param {object} nodePositions - A reference to the nodePositions map managed by TimelineManager or a dedicated data module.
   * @param {SVGElement} branchLabelsGroup - The SVG group element for branch labels.
   * @param {SVGElement} branchNodesGroup - The SVG group element for branch nodes.
   * @param {function} parseTransform - Utility function to parse SVG transforms.
   * @param {TimelineNodeRenderer} nodeRenderer - Instance of TimelineNodeRenderer.
   */
  constructor(versionControl, nodePositions, branchLabelsGroup, branchNodesGroup, parseTransform, nodeRenderer) {
    this.versionControl = versionControl;
    this._nodePositions = nodePositions; // Shared or passed-around object
    this._branchLabelsGroup = branchLabelsGroup;
    this._branchNodesGroup = branchNodesGroup;
    this._parseTransform = parseTransform;
    // this.nodeRenderer = nodeRenderer; // To call _renderBranchStates
    // This will be set after nodeRenderer is created to avoid circular dependency issues if constructed simultaneously
    this.nodeRenderer = null;
  }

  /**
   * Renders all branches onto the timeline.
   * It determines the render order of branches, then for each branch,
   * it creates a dedicated SVG group, positions it, renders a label,
   * and calls the nodeRenderer to draw the individual version nodes.
   * It also calculates the vertical extent of the rendered content.
   * @param {SVGElement} mainTimelineGroup - The main SVG group that will contain all branch groups.
   * @returns {{minContentYInMainGroup: number, maxContentYInMainGroup: number, maxYForViewBox: number, maxXForViewBox: number}}
   */
  renderBranches(mainTimelineGroup) {
    const allBranchesData = this.versionControl.getAllBranchesData();
    const currentBranchIdFromVC = this.versionControl._currentBranchId;
    const currentTransactionIndexFromVC = this.versionControl._currentTransactionIndex;

    const branchRenderOrder = this._determineBranchRenderOrder(allBranchesData);
    
    let yBranchOffset = 0;
    let minContentYInMainGroup = Infinity;
    let maxContentYInMainGroup = -Infinity;
    let maxXForViewBox = 0;

    const mainTimelineGroupTransform = this._parseTransform(mainTimelineGroup?.getAttribute("transform"));
    const mainTimelineGroupGlobalXTranslate = mainTimelineGroupTransform.translateX;

    for (const branchId of branchRenderOrder) {
      const branchData = allBranchesData[branchId];
      if (branchData && branchData.transactions !== undefined && branchData.initialContent !== undefined) {
        const branchVersionsGroup = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "g");
        branchVersionsGroup.setAttribute("id", `branch-group-${branchId}`);
        branchVersionsGroup.setAttribute("transform", `translate(0, ${yBranchOffset})`);
        this._branchNodesGroup.appendChild(branchVersionsGroup);

        const branchLabelYPosition = yBranchOffset;

        let xOffsetForThisBranchNodes = 0; 
        if (branchData.parentBranchId && typeof branchData.parentTransactionIndex === 'number') {
          const parentNodeKey = `${branchData.parentBranchId}_${branchData.parentTransactionIndex}`;
          const parentNodePosition = this._nodePositions[parentNodeKey];

          if (parentNodePosition) {
            xOffsetForThisBranchNodes = parentNodePosition.x - mainTimelineGroupGlobalXTranslate;
          }
        }

        const branchLabel = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "text");
        branchLabel.setAttribute("x", xOffsetForThisBranchNodes.toString());
        branchLabel.setAttribute("text-anchor", TIMELINE_CONSTANTS.TEXT_ANCHOR_END);
        branchLabel.setAttribute("dx", TIMELINE_CONSTANTS.BRANCH_LABEL_DX_OFFSET);
        branchLabel.setAttribute("y", branchLabelYPosition.toString()); 
        branchLabel.setAttribute("dominant-baseline", "middle");
        branchLabel.setAttribute("dy", TIMELINE_CONSTANTS.BRANCH_LABEL_DY_OFFSET);
        branchLabel.setAttribute("font-size", TIMELINE_CONSTANTS.BRANCH_LABEL_FONT_SIZE);
        branchLabel.setAttribute("fill", TIMELINE_CONSTANTS.COLOR_GRAY);
        branchLabel.textContent = branchId;
        if (branchId === currentBranchIdFromVC) {
            branchLabel.style.fontWeight = "bold";
            branchLabel.setAttribute("fill", TIMELINE_CONSTANTS.COLOR_BLUE);
        }
        this._branchLabelsGroup.appendChild(branchLabel);

        if (!this.nodeRenderer) {
          console.error("TimelineNodeRenderer not set on TimelineBranchRenderer");
          continue;
        }
        
        const branchStatesRenderData = this.nodeRenderer.renderBranchStates(
          branchVersionsGroup, 
          branchId, 
          branchData,
          currentBranchIdFromVC,
          currentTransactionIndexFromVC,
          xOffsetForThisBranchNodes,
          mainTimelineGroupGlobalXTranslate // Pass this for global X calculation within nodeRenderer
        );
        maxXForViewBox = Math.max(maxXForViewBox, branchStatesRenderData.maxXForBranch);

        yBranchOffset += TIMELINE_CONSTANTS.BRANCH_VERTICAL_SPACING;
        minContentYInMainGroup = Math.min(minContentYInMainGroup, branchLabelYPosition);
        maxContentYInMainGroup = Math.max(maxContentYInMainGroup, branchLabelYPosition);
      }
    }
    
    let maxYForViewBox;
    if (Object.keys(allBranchesData).length > 0) {
        maxYForViewBox = Math.max(TIMELINE_CONSTANTS.DEFAULT_SVG_HEIGHT, maxContentYInMainGroup + TIMELINE_CONSTANTS.BRANCH_VERTICAL_SPACING);
    } else {
        maxYForViewBox = TIMELINE_CONSTANTS.DEFAULT_SVG_HEIGHT;
    }
    return { minContentYInMainGroup, maxContentYInMainGroup, maxYForViewBox, maxXForViewBox };
  }

  /**
   * Determines the order in which branches should be rendered in the timeline.
   * The 'main' branch is always rendered first.
   * @private
   * @param {object} allBranchesData - An object containing data for all branches.
   * @returns {string[]} An array of branch IDs sorted in the desired render order.
   */
  _determineBranchRenderOrder(allBranchesData) {
    const branchIds = Object.keys(allBranchesData);
    return branchIds.sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      
      const branchAData = allBranchesData[a];
      const branchBData = allBranchesData[b];

      if (branchAData.parentBranchId === branchBData.parentBranchId && 
          branchAData.parentBranchId !== null) {
            if (branchAData.parentTransactionIndex !== branchBData.parentTransactionIndex) {
                return branchAData.parentTransactionIndex - branchBData.parentTransactionIndex;
            }
      }
      return a.localeCompare(b); 
    });
  }
} 