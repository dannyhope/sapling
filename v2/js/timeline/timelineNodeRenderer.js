import { TIMELINE_CONSTANTS } from './timelineConstants.js';

/**
 * @class TimelineNodeRenderer
 * @description Handles the rendering of individual version nodes (states) on the timeline,
 *              including their visual representation and interactive hit areas.
 */
export class TimelineNodeRenderer {
  /**
   * Creates a TimelineNodeRenderer instance.
   * @param {import('../versionControl.js').VersionControl} versionControl - The main version control instance.
   * @param {object} nodePositions - A reference to the shared nodePositions map.
   * @param {function} parseTransform - Utility function to parse SVG transforms.
   * @param {function} onNodeMouseDownCallback - Callback function to handle mousedown events on nodes.
   */
  constructor(versionControl, nodePositions, parseTransform, onNodeMouseDownCallback) {
    this.versionControl = versionControl;
    this._nodePositions = nodePositions; // Shared object, mutated here
    this._parseTransform = parseTransform;
    this.onNodeMouseDownCallback = onNodeMouseDownCallback;
  }

  /**
   * Renders the individual states (initial content and subsequent transactions) of a single branch.
   * For each state, it creates a visual node (circle) and an interactive hit area.
   * It calculates the global position of each node and stores it in `this._nodePositions`.
   * It also updates and returns the maximum horizontal extent reached by nodes in this branch.
   * @param {SVGElement} branchStateGroup - The SVG group element dedicated to this branch's nodes.
   * @param {string} branchId - The ID of the branch being rendered.
   * @param {object} branchData - The data object for the branch, including transactions.
   * @param {string} currentGlobalBranchId - The ID of the currently active branch in the VersionControl.
   * @param {number} currentGlobalTransactionIndex - The index of the currently active transaction in the VersionControl.
   * @param {number} initialXOffset - The calculated starting X coordinate for the first node in this branch.
   * @param {number} mainTimelineGroupGlobalXTranslate - The global X translation of the main timeline group.
   * @returns {{maxXForBranch: number}} An object containing the maximum X coordinate reached by nodes in this branch.
   */
  renderBranchStates(branchStateGroup, branchId, branchData, currentGlobalBranchId, currentGlobalTransactionIndex, initialXOffset, mainTimelineGroupGlobalXTranslate) {
    let xOffset = initialXOffset;
    const hitAreaWidth = TIMELINE_CONSTANTS.NODE_SPACING;
    let maxXForBranch = 0;

    // 1. Render node for initialContent state (index -1)
    const initialStateInfo = this.versionControl.getStateInfoAt(branchId, -1);
    if (initialStateInfo) {
      const isCurrentInitial = branchId === currentGlobalBranchId && currentGlobalTransactionIndex === -1;
      const initialNodeCompositeKey = `${branchId}_-1`;
      const initialVisualNode = this._createVisualNode(
        xOffset,
        0, // Y is relative to branchStateGroup, which is already at yPos
        isCurrentInitial ? TIMELINE_CONSTANTS.ACTIVE_NODE_RADIUS : TIMELINE_CONSTANTS.NODE_RADIUS,
        initialStateInfo,
        isCurrentInitial
      );
      initialVisualNode.dataset.compositeKey = initialNodeCompositeKey;

      const initialHitArea = this._createHitArea(xOffset, hitAreaWidth, TIMELINE_CONSTANTS.HIT_AREA_HEIGHT);
      if (this.onNodeMouseDownCallback) {
        initialHitArea.addEventListener('mousedown', (e) => this.onNodeMouseDownCallback(e, branchId, -1, initialVisualNode));
      }
      
      branchStateGroup.appendChild(initialHitArea);
      branchStateGroup.appendChild(initialVisualNode);

      // Calculate global position for _nodePositions
      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform")); // Should be (0, yBranchOffset)
      const globalXInitial = mainTimelineGroupGlobalXTranslate + branchGroupTransform.translateX + xOffset;
      const globalYInitial = this._parseTransform(document.getElementById(TIMELINE_CONSTANTS.MAIN_TIMELINE_GROUP_ID)?.getAttribute("transform")).translateY + branchGroupTransform.translateY + 0; // y is 0 within branchStateGroup

      this._nodePositions[initialNodeCompositeKey] = { x: globalXInitial, y: globalYInitial, branchId: branchId, index: -1 };
      maxXForBranch = Math.max(maxXForBranch, globalXInitial + TIMELINE_CONSTANTS.NODE_RADIUS);
      xOffset += TIMELINE_CONSTANTS.NODE_SPACING;
    }

    // 2. Render nodes for each transaction
    branchData.transactions.forEach((opArray, txIndex) => {
      const stateInfo = this.versionControl.getStateInfoAt(branchId, txIndex);
      if (!stateInfo) {
        console.warn(`State info not found for ${branchId}_${txIndex}`);
        return;
      }

      const isCurrentTransaction = branchId === currentGlobalBranchId && txIndex === currentGlobalTransactionIndex;
      const nodeCompositeKey = `${branchId}_${txIndex}`;

      const visualNode = this._createVisualNode(
        xOffset,
        0, // Y is relative to branchStateGroup
        isCurrentTransaction ? TIMELINE_CONSTANTS.ACTIVE_NODE_RADIUS : TIMELINE_CONSTANTS.NODE_RADIUS,
        stateInfo,
        isCurrentTransaction
      );
      visualNode.dataset.compositeKey = nodeCompositeKey;

      const hitArea = this._createHitArea(xOffset, hitAreaWidth, TIMELINE_CONSTANTS.HIT_AREA_HEIGHT);
       if (this.onNodeMouseDownCallback) {
        hitArea.addEventListener('mousedown', (e) => this.onNodeMouseDownCallback(e, branchId, txIndex, visualNode));
      }
      
      branchStateGroup.appendChild(hitArea);
      branchStateGroup.appendChild(visualNode);

      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform"));
      const globalX = mainTimelineGroupGlobalXTranslate + branchGroupTransform.translateX + xOffset;
      const globalY = this._parseTransform(document.getElementById(TIMELINE_CONSTANTS.MAIN_TIMELINE_GROUP_ID)?.getAttribute("transform")).translateY + branchGroupTransform.translateY + 0;

      this._nodePositions[nodeCompositeKey] = { x: globalX, y: globalY, branchId: branchId, index: txIndex };
      maxXForBranch = Math.max(maxXForBranch, globalX + TIMELINE_CONSTANTS.NODE_RADIUS);

      xOffset += TIMELINE_CONSTANTS.NODE_SPACING;
    });
    return { maxXForBranch };
  }
  
  /**
   * Creates a visual SVG circle element representing a single version state on the timeline.
   * @private
   */
  _createVisualNode(x, y, radius, stateInfo, isCurrent) {
    const circle = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "circle");
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", y.toString());
    circle.setAttribute("r", radius.toString());
    
    let fillColor = TIMELINE_CONSTANTS.COLOR_LIGHT_GRAY;
    let strokeColor = TIMELINE_CONSTANTS.COLOR_DARK_GRAY;
    let strokeWidth = TIMELINE_CONSTANTS.NODE_STROKE_WIDTH;
    
    if (isCurrent) {
      fillColor = TIMELINE_CONSTANTS.COLOR_YELLOW;
      strokeWidth = TIMELINE_CONSTANTS.ACTIVE_NODE_STROKE_WIDTH;
      switch (stateInfo.type) {
        case 'charTyped': strokeColor = TIMELINE_CONSTANTS.COLOR_GREEN; break;
        case 'charDeleted': strokeColor = TIMELINE_CONSTANTS.COLOR_RED; break;
        default: strokeColor = TIMELINE_CONSTANTS.COLOR_DARK_GRAY; break;
      }
    } else {
      switch (stateInfo.type) {
        case 'charTyped': fillColor = TIMELINE_CONSTANTS.COLOR_GREEN; break;
        case 'charDeleted': fillColor = TIMELINE_CONSTANTS.COLOR_RED; break;
        case 'initial': fillColor = TIMELINE_CONSTANTS.COLOR_BLUE_GRAY; break;
        case 'branch_created': fillColor = TIMELINE_CONSTANTS.COLOR_PURPLE; break;
      }
    }
    
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.style.pointerEvents = TIMELINE_CONSTANTS.POINTER_EVENTS_NONE;
    circle.classList.add('timeline-node');
    
    const title = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "title");
    const opDisplay = stateInfo.op ? `Op: [${stateInfo.op.join(',')}]` : "Initial State";
    title.textContent = `State: ${stateInfo.id.branchId} @ index ${stateInfo.id.index}\n${stateInfo.message || ''}\n${opDisplay}`;
    circle.appendChild(title);
    
    return circle;
  }

  /**
   * Creates an invisible SVG rectangle used as a larger hit area for a timeline node.
   * @private
   */
  _createHitArea(nodeX, hitAreaWidth, hitAreaHeight) {
      const hitArea = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "rect");
      hitArea.setAttribute("x", (nodeX - hitAreaWidth / 2).toString());
      hitArea.setAttribute("y", (-hitAreaHeight / 2).toString());
      hitArea.setAttribute("width", hitAreaWidth.toString());
      hitArea.setAttribute("height", hitAreaHeight.toString());
      hitArea.setAttribute("fill", "transparent");
      hitArea.style.pointerEvents = TIMELINE_CONSTANTS.POINTER_EVENTS_ALL;
      hitArea.style.cursor = TIMELINE_CONSTANTS.CURSOR_EW_RESIZE;
      hitArea.classList.add('timeline-node-hit-area');
      return hitArea;
  }
} 