/**
 * @class TimelineManager
 * @description Manages the visualization and interaction with version history timeline
 */
export class TimelineManager {
  static SVG_NS = "http://www.w3.org/2000/svg";
  static CONSTANTS = {
    NODE_RADIUS: 8,
    ACTIVE_NODE_RADIUS: 10,
    NODE_SPACING: 20,
    HIT_AREA_HEIGHT: 50,
    BRANCH_LABEL_OFFSET: 60,
    BRANCH_VERTICAL_SPACING: 40,
    DEFAULT_SVG_WIDTH: 800,
    DEFAULT_SVG_HEIGHT: 100,
    SVG_MIN_HEIGHT: "100px",
    SVG_BORDER_STYLE: "1px solid #ccc",
    MAIN_GROUP_INITIAL_TRANSLATE_X: 20, // Initial X translation for the main group
    MAIN_GROUP_INITIAL_TRANSLATE_Y: 40, // Initial Y translation for the main group
    VIEWBOX_PADDING: 20,
    BRANCH_LABEL_FONT_SIZE: "18px",
    BRANCH_LABEL_DX_OFFSET: "-15px",
    BRANCH_CONNECTIONS_GROUP_ID: "branch-connections-group",
    BRANCH_NODES_GROUP_ID: "branch-nodes-group",
    BRANCH_LABELS_GROUP_ID: "branch-labels-group",
    MAIN_TIMELINE_GROUP_ID: "main-timeline-group",
    NODE_STROKE_WIDTH: "1",
    ACTIVE_NODE_STROKE_WIDTH: "2",
    CONNECTION_LINE_STROKE_WIDTH: "1.5",
    // Colors (using CSS variables where possible, but good to have them defined)
    COLOR_GRAY: "var(--gray)",
    COLOR_BLUE: "var(--blue)",
    COLOR_LIGHT_GRAY: "var(--light-gray)",
    COLOR_DARK_GRAY: "var(--dark-gray)",
    COLOR_YELLOW: "var(--yellow)",
    COLOR_GREEN: "var(--green)",
    COLOR_RED: "var(--red)",
    COLOR_BLUE_GRAY: "var(--blue-gray)",
    COLOR_PURPLE: "var(--purple)",
    CURSOR_EW_RESIZE: "ew-resize",
    CURSOR_AUTO: "auto",
    POINTER_EVENTS_NONE: "none",
    POINTER_EVENTS_ALL: "all",
    TEXT_ANCHOR_END: "end"
  };

  /**
   * Creates a TimelineManager instance
   * @param {string} timelineContainerId - ID of the container element
   * @param {VersionControl} versionControl - Main version control instance
   * @throws {Error} If the timeline container element is not found
   */
  constructor(timelineContainerId, versionControl) {
    this.timelineContainerEl = document.getElementById(timelineContainerId);
    if (!this.timelineContainerEl) {
      throw new Error(`Timeline container with ID '${timelineContainerId}' not found`);
    }
    this.versionControl = versionControl; // Will be set later if null
    this._nodePositions = {}; // Key: "{branchId}_{transactionIndex}", Value: { x, y, branchId, index }
    this.isDragging = false;
    this.dragTarget = null;
    this._branchConnectionsGroup = null; // Group for connection lines
    this._maxRenderedXForViewBox = 0; // Max X coordinate reached by any node
    this._maxRenderedYForViewBox = 0; // Max Y coordinate for vertical stacking
    this._branchNodesGroup = null; // Group for all branch nodes
    this._branchLabelsGroup = null; // Group for all branch labels

    // Node styling and layout properties are now in CONSTANTS

    // Add ResizeObserver for responsiveness
    this._resizeObserver = new ResizeObserver(() => {
      if (this.versionControl && this.timelineContainerEl.offsetParent !== null) { // Check if element is visible
        this.render();
      }
    });
    this._resizeObserver.observe(this.timelineContainerEl);
  }

  /**
   * Renders the version history timeline.
   * Clears any existing timeline content and rebuilds it based on the current
   * state of the VersionControl data. This involves creating the SVG canvas,
   * rendering all branches and their states (nodes), drawing connections
   * between branches, and finally adjusting the SVG viewbox to fit the content.
   */
  render() {
    if (!this.versionControl) {
      return;
    }
    
    this._clearTimeline();
    this._nodePositions = {}; // Reset node positions on each render
    this._maxRenderedXForViewBox = 0; // Reset max X for viewbox calculation
    this._maxRenderedYForViewBox = 0; // Reset max Y for viewbox calculation
    
    const svg = this._createSvgCanvas();
    const mainTimelineGroup = document.createElementNS(TimelineManager.SVG_NS, "g");
    mainTimelineGroup.setAttribute("id", TimelineManager.CONSTANTS.MAIN_TIMELINE_GROUP_ID);
    mainTimelineGroup.setAttribute("transform", `translate(${TimelineManager.CONSTANTS.MAIN_GROUP_INITIAL_TRANSLATE_X}, ${TimelineManager.CONSTANTS.MAIN_GROUP_INITIAL_TRANSLATE_Y})`); 
    svg.appendChild(mainTimelineGroup);

    // Order of groups determines rendering layers (last is on top)
    this._branchConnectionsGroup = document.createElementNS(TimelineManager.SVG_NS, "g");
    this._branchConnectionsGroup.setAttribute("id", TimelineManager.CONSTANTS.BRANCH_CONNECTIONS_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchConnectionsGroup);

    this._branchNodesGroup = document.createElementNS(TimelineManager.SVG_NS, "g");
    this._branchNodesGroup.setAttribute("id", TimelineManager.CONSTANTS.BRANCH_NODES_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchNodesGroup);

    this._branchLabelsGroup = document.createElementNS(TimelineManager.SVG_NS, "g");
    this._branchLabelsGroup.setAttribute("id", TimelineManager.CONSTANTS.BRANCH_LABELS_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchLabelsGroup);
    
    this._renderBranches(mainTimelineGroup); 
    this._renderBranchConnections(); // Pass connections group directly -> No longer passing, it uses this._branchConnectionsGroup
    
    this._adjustSvgViewbox(svg);
    this.timelineContainerEl.appendChild(svg);
  }
  
  /**
   * Clears all child elements from the timeline container.
   * @private
   */
  _clearTimeline() {
    this.timelineContainerEl.innerHTML = '';
  }
  
  /**
   * Creates the main SVG canvas element for the timeline.
   * Sets initial width, height, viewBox, and basic styling.
   * These attributes will be adjusted later by _adjustSvgViewbox.
   * @private
   * @returns {SVGElement} The created SVG canvas element.
   */
  _createSvgCanvas() {
    const svg = document.createElementNS(TimelineManager.SVG_NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", TimelineManager.CONSTANTS.DEFAULT_SVG_HEIGHT.toString()); // Initial, will be adjusted
    svg.setAttribute("viewBox", `0 0 ${TimelineManager.CONSTANTS.DEFAULT_SVG_WIDTH} ${TimelineManager.CONSTANTS.DEFAULT_SVG_HEIGHT}`); // Initial, will be adjusted
    svg.style.border = TimelineManager.CONSTANTS.SVG_BORDER_STYLE;
    svg.style.minHeight = TimelineManager.CONSTANTS.SVG_MIN_HEIGHT; // Ensure a minimum height

    return svg;
  }
  
  /**
   * Renders all branches onto the timeline.
   * It determines the render order of branches, then for each branch,
   * it creates a dedicated SVG group, positions it, renders a label,
   * and calls _renderBranchStates to draw the individual version nodes.
   * It also calculates the vertical extent of the rendered content.
   * @private
   * @param {SVGElement} mainTimelineGroup - The main SVG group that will contain all branch groups.
   */
  _renderBranches(mainTimelineGroup) {
    const allBranchesData = this.versionControl.getAllBranchesData();
    const currentBranchIdFromVC = this.versionControl._currentBranchId;
    const currentTransactionIndexFromVC = this.versionControl._currentTransactionIndex;

    const branchRenderOrder = this._determineBranchRenderOrder(allBranchesData);
    
    let yBranchOffset = 0;

    // Store min/max Y for scrubber alignment relative to mainTimelineGroup content
    this._minContentYInMainGroup = Infinity;
    this._maxContentYInMainGroup = -Infinity;

    const mainTimelineGroupTransform = this._parseTransform(mainTimelineGroup?.getAttribute("transform"));
    const mainTimelineGroupGlobalXTranslate = mainTimelineGroupTransform.translateX;

    for (const branchId of branchRenderOrder) {
      const branchData = allBranchesData[branchId];
      if (branchData && branchData.transactions !== undefined && branchData.initialContent !== undefined) {
        // Create a group for each branch's versions
        const branchVersionsGroup = document.createElementNS(TimelineManager.SVG_NS, "g");
        branchVersionsGroup.setAttribute("id", `branch-group-${branchId}`);
        branchVersionsGroup.setAttribute("transform", `translate(0, ${yBranchOffset})`);
        // Append to the dedicated nodes group instead of mainTimelineGroup directly
        this._branchNodesGroup.appendChild(branchVersionsGroup);

        const branchLabelYPosition = yBranchOffset; // Align label baseline with node centers

        // Calculate the initial X offset for the nodes within this branch's group
        let xOffsetForThisBranchNodes = 0; // Default for 'main' or if parent node not found/not on main

        // HORIZONTAL ALIGNMENT LOGIC:
        // If this branch has a parent, and that parent's node position is known,
        // calculate the required x-offset for this branch's nodes so its first node aligns.
        if (branchData.parentBranchId && typeof branchData.parentTransactionIndex === 'number') {
          const parentNodeKey = `${branchData.parentBranchId}_${branchData.parentTransactionIndex}`;
          const parentNodePosition = this._nodePositions[parentNodeKey];

          if (parentNodePosition) {
            // parentNodePosition.x is the global X of the parent node.
            // Nodes drawn by _renderBranchStates are relative to branchVersionsGroup.
            // branchVersionsGroup has no horizontal translation within mainTimelineGroup.
            // Global X of child's first node = mainTimelineGroupGlobalXTranslate + xOffsetForThisBranchNodes (being node's cx)
            // We want this to be parentNodePosition.x.
            // So, xOffsetForThisBranchNodes = parentNodePosition.x - mainTimelineGroupGlobalXTranslate;
            xOffsetForThisBranchNodes = parentNodePosition.x - mainTimelineGroupGlobalXTranslate;
          } else {
            // This can happen if parent branch is rendered after child, or parent node doesn't exist.
            // Render order should handle main first.
          }
        }
        // END HORIZONTAL ALIGNMENT LOGIC

        const branchLabel = document.createElementNS(TimelineManager.SVG_NS, "text");
        branchLabel.setAttribute("x", xOffsetForThisBranchNodes.toString()); // Position label relative to new node start X
        branchLabel.setAttribute("text-anchor", TimelineManager.CONSTANTS.TEXT_ANCHOR_END);
        branchLabel.setAttribute("dx", TimelineManager.CONSTANTS.BRANCH_LABEL_DX_OFFSET); // Shift text 15px left of node line start
        branchLabel.setAttribute("y", branchLabelYPosition.toString()); 
        branchLabel.setAttribute("font-size", TimelineManager.CONSTANTS.BRANCH_LABEL_FONT_SIZE); // Increased font size
        branchLabel.setAttribute("fill", TimelineManager.CONSTANTS.COLOR_GRAY);
        branchLabel.textContent = branchId;
        if (branchId === currentBranchIdFromVC) {
            branchLabel.style.fontWeight = "bold";
            branchLabel.setAttribute("fill", TimelineManager.CONSTANTS.COLOR_BLUE);
        }
        // Add label to the dedicated labels group
        this._branchLabelsGroup.appendChild(branchLabel);

        this._renderBranchStates(
          branchVersionsGroup, 
          branchId, 
          branchData, // Pass full branchData including initialContent and transactions
          currentBranchIdFromVC,
          currentTransactionIndexFromVC,
          xOffsetForThisBranchNodes // Use calculated initial xOffset
        );
        yBranchOffset += TimelineManager.CONSTANTS.BRANCH_VERTICAL_SPACING;
        // Update min/max content Y based on this branch's label Y (which is where nodes are centered)
        this._minContentYInMainGroup = Math.min(this._minContentYInMainGroup, branchLabelYPosition);
        this._maxContentYInMainGroup = Math.max(this._maxContentYInMainGroup, branchLabelYPosition);
      }
    }
    // this._maxRenderedYForViewBox = Math.max(100, yBranchOffset + 20); // Add some padding
    // Use the actual content height for viewBox calculation
    if (Object.keys(allBranchesData).length > 0) {
        this._maxRenderedYForViewBox = Math.max(TimelineManager.CONSTANTS.DEFAULT_SVG_HEIGHT, this._maxContentYInMainGroup + TimelineManager.CONSTANTS.BRANCH_VERTICAL_SPACING); // Add padding below last branch
    } else {
        this._maxRenderedYForViewBox = TimelineManager.CONSTANTS.DEFAULT_SVG_HEIGHT; // Default if no branches
    }
  }

  /**
   * Determines the order in which branches should be rendered in the timeline.
   * The 'main' branch is always rendered first. Subsequent branches are sorted
   * based on their parent's transaction index if they share the same parent.
   * As a fallback, branches are sorted by their ID.
   * Note: This provides a heuristic for chronological ordering but may not be
   * perfectly accurate for complex, multi-level branching scenarios.
   * @private
   * @param {object} allBranchesData - An object containing data for all branches,
   *                                   keyed by branch ID, from VersionControl.
   * @returns {string[]} An array of branch IDs sorted in the desired render order.
   */
  _determineBranchRenderOrder(allBranchesData) {
    const branchIds = Object.keys(allBranchesData);
    // Simple sort: 'main' first, then others.
    return branchIds.sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      
      // For non-main branches, sort by their creation point (parent's transaction index or an equivalent time metric if available)
      // This is a simplified sort. A true chronological sort across branches is complex.
      // We might need to store a creation timestamp on the branch object itself for better sorting.
      const branchAData = allBranchesData[a];
      const branchBData = allBranchesData[b];

      // Fallback: if parentTransactionIndex is available and on the same parent branch, use that.
      // This is a heuristic and might not be perfect for complex multi-level branching.
      if (branchAData.parentBranchId === branchBData.parentBranchId && 
          branchAData.parentBranchId !== null) {
            if (branchAData.parentTransactionIndex !== branchBData.parentTransactionIndex) {
                return branchAData.parentTransactionIndex - branchBData.parentTransactionIndex;
            }
      }
      // Fallback to comparing initial transaction timestamps if available (ephemeral though)
      // Or branch ID as last resort for stability
      return a.localeCompare(b); 
    });
  }
  
  /**
   * Renders the individual states (initial content and subsequent transactions) of a single branch.
   * For each state, it creates a visual node (circle) and an interactive hit area.
   * It calculates the global position of each node and stores it for drawing connections.
   * It also updates the maximum horizontal extent of the rendered content.
   * @private
   * @param {SVGElement} branchStateGroup - The SVG group element dedicated to this branch's nodes.
   * @param {string} branchId - The ID of the branch being rendered.
   * @param {object} branchData - The data object for the branch, including transactions.
   * @param {string} currentGlobalBranchId - The ID of the currently active branch in the VersionControl.
   * @param {number} currentGlobalTransactionIndex - The index of the currently active transaction in the VersionControl.
   * @param {number} initialXOffset - The calculated starting X coordinate for the first node in this branch,
   *                                  relative to the main timeline group's translation.
   */
  _renderBranchStates(branchStateGroup, branchId, branchData, currentGlobalBranchId, currentGlobalTransactionIndex, initialXOffset) {
    let xOffset = initialXOffset;
    const hitAreaWidth = TimelineManager.CONSTANTS.NODE_SPACING; 

    // 1. Render node for initialContent state (index -1)
    const initialStateInfo = this.versionControl.getStateInfoAt(branchId, -1);
    if (initialStateInfo) {
      const isCurrentInitial = branchId === currentGlobalBranchId && currentGlobalTransactionIndex === -1;
      const initialNodeCompositeKey = `${branchId}_-1`;
      const initialVisualNode = this._createVisualNode(
        xOffset, 
        0, // Y is relative to branchStateGroup, which is already at yPos
        isCurrentInitial ? TimelineManager.CONSTANTS.ACTIVE_NODE_RADIUS : TimelineManager.CONSTANTS.NODE_RADIUS, // Use active radius if current
        initialStateInfo, // Contains type, message etc.
        isCurrentInitial
      );
      initialVisualNode.dataset.compositeKey = initialNodeCompositeKey;

      const initialHitArea = this._createHitArea(xOffset, TimelineManager.CONSTANTS.NODE_RADIUS, hitAreaWidth, TimelineManager.CONSTANTS.HIT_AREA_HEIGHT);
      initialHitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, -1, initialVisualNode));
      
      branchStateGroup.appendChild(initialHitArea);
      branchStateGroup.appendChild(initialVisualNode);

      const mainTimelineGroupTransform = this._parseTransform(document.getElementById(TimelineManager.CONSTANTS.MAIN_TIMELINE_GROUP_ID)?.getAttribute("transform"));
      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform"));
      const globalXInitial = xOffset + mainTimelineGroupTransform.translateX + branchGroupTransform.translateX;
      const globalYInitial = 0 + mainTimelineGroupTransform.translateY + branchGroupTransform.translateY;
      
      this._nodePositions[initialNodeCompositeKey] = { x: globalXInitial, y: globalYInitial, branchId: branchId, index: -1 };
      this._maxRenderedXForViewBox = Math.max(this._maxRenderedXForViewBox, globalXInitial + TimelineManager.CONSTANTS.NODE_RADIUS);
      xOffset += TimelineManager.CONSTANTS.NODE_SPACING;
    }

    // 2. Render nodes for each transaction
    branchData.transactions.forEach((opArray, txIndex) => {
      const stateInfo = this.versionControl.getStateInfoAt(branchId, txIndex);
      if (!stateInfo) {
        return;
      }

      const isCurrentTransaction = branchId === currentGlobalBranchId && txIndex === currentGlobalTransactionIndex;
      const nodeCompositeKey = `${branchId}_${txIndex}`;

      const visualNode = this._createVisualNode(
        xOffset, 
        0, // Y is relative to branchStateGroup
        isCurrentTransaction ? TimelineManager.CONSTANTS.ACTIVE_NODE_RADIUS : TimelineManager.CONSTANTS.NODE_RADIUS, // Use active radius if current
        stateInfo, // Contains type, message etc.
        isCurrentTransaction 
      );
      visualNode.dataset.compositeKey = nodeCompositeKey;

      const hitArea = this._createHitArea(xOffset, TimelineManager.CONSTANTS.NODE_RADIUS, hitAreaWidth, TimelineManager.CONSTANTS.HIT_AREA_HEIGHT);
      hitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, txIndex, visualNode));
      
      branchStateGroup.appendChild(hitArea);
      branchStateGroup.appendChild(visualNode);

      const mainTimelineGroupTransform = this._parseTransform(document.getElementById(TimelineManager.CONSTANTS.MAIN_TIMELINE_GROUP_ID)?.getAttribute("transform"));
      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform"));
      const globalX = xOffset + mainTimelineGroupTransform.translateX + branchGroupTransform.translateX;
      const globalY = 0 + mainTimelineGroupTransform.translateY + branchGroupTransform.translateY;

      this._nodePositions[nodeCompositeKey] = { x: globalX, y: globalY, branchId: branchId, index: txIndex };
      this._maxRenderedXForViewBox = Math.max(this._maxRenderedXForViewBox, globalX + TimelineManager.CONSTANTS.NODE_RADIUS);

      xOffset += TimelineManager.CONSTANTS.NODE_SPACING;
    });
  }
  
  /**
   * Creates a visual SVG circle element representing a single version state on the timeline.
   * Applies appropriate styling based on whether it's the current state and the type of operation.
   * Also adds an SVG 'title' element for tooltip display.
   * @private
   * @param {number} x - The X coordinate of the circle's center, relative to its parent group.
   * @param {number} y - The Y coordinate of the circle's center, relative to its parent group.
   * @param {number} radius - The radius of the circle.
   * @param {object} stateInfo - Information about the state (type, message, op) from VersionControl.
   * @param {boolean} isCurrent - True if this node represents the currently active version state.
   * @returns {SVGCircleElement} The created SVG circle element.
   */
  _createVisualNode(x, y, radius, stateInfo, isCurrent) {
    const circle = document.createElementNS(TimelineManager.SVG_NS, "circle");
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", y.toString());
    circle.setAttribute("r", radius.toString());
    
    let fillColor = TimelineManager.CONSTANTS.COLOR_LIGHT_GRAY;
    let strokeColor = TimelineManager.CONSTANTS.COLOR_DARK_GRAY;
    let strokeWidth = TimelineManager.CONSTANTS.NODE_STROKE_WIDTH;
    
    if (isCurrent) {
      fillColor = TimelineManager.CONSTANTS.COLOR_YELLOW; // Bright yellow for active node
      strokeWidth = TimelineManager.CONSTANTS.ACTIVE_NODE_STROKE_WIDTH; // Thicker border for active node
      // Set strokeColor based on stateInfo.type for active nodes
      switch (stateInfo.type) {
        case 'charTyped':
          strokeColor = TimelineManager.CONSTANTS.COLOR_GREEN;
          break;
        case 'charDeleted': // Covers single and multiple deletions
          strokeColor = TimelineManager.CONSTANTS.COLOR_RED;
          break;
        default:
          strokeColor = TimelineManager.CONSTANTS.COLOR_DARK_GRAY; // Default for other active types (initial, branch, etc.)
          break;
      }
    } else {
      // stateInfo.type is inferred by VersionControl (e.g., 'charTyped', 'charDeleted', 'initial', 'branch_created')
      switch (stateInfo.type) {
        case 'charTyped':
          fillColor = TimelineManager.CONSTANTS.COLOR_GREEN;
          break;
        case 'charDeleted':
          fillColor = TimelineManager.CONSTANTS.COLOR_RED;
          break;
        case 'initial':
          fillColor = TimelineManager.CONSTANTS.COLOR_BLUE_GRAY; // A distinct color for true initial states
          break;
        case 'branch_created':
          fillColor = TimelineManager.CONSTANTS.COLOR_PURPLE; // A distinct color for branch points (initial content of a new branch)
          break;
      }
    }
    
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.style.pointerEvents = TimelineManager.CONSTANTS.POINTER_EVENTS_NONE; // Visual nodes should not capture pointer events
    circle.classList.add('timeline-node');
    
    const title = document.createElementNS(TimelineManager.SVG_NS, "title");
    // stateInfo.id is {branchId, index}, stateInfo.message is generated by VersionControl
    const opDisplay = stateInfo.op ? `Op: [${stateInfo.op.join(',')}]` : "Initial State";
    title.textContent = `State: ${stateInfo.id.branchId} @ index ${stateInfo.id.index}\n${stateInfo.message || ''}\n${opDisplay}`;
    circle.appendChild(title);
    
    return circle;
  }

  /**
   * Creates an invisible SVG rectangle used as a larger, easier-to-click hit area for a timeline node.
   * This makes interacting with nodes (e.g., for dragging) more user-friendly.
   * @private
   * @param {number} nodeX - The X coordinate of the associated visual node's center.
   * @param {number} nodeRadius - The radius of the associated visual node (not directly used for hit area size here).
   * @param {number} hitAreaWidth - The desired width of the hit area.
   * @param {number} hitAreaHeight - The desired height of the hit area.
   * @returns {SVGRectElement} The created SVG rect element for the hit area.
   */
  _createHitArea(nodeX, nodeRadius, hitAreaWidth, hitAreaHeight) {
      const hitArea = document.createElementNS(TimelineManager.SVG_NS, "rect");
      hitArea.setAttribute("x", (nodeX - hitAreaWidth / 2).toString()); // Centered hit area
      hitArea.setAttribute("y", (-hitAreaHeight / 2).toString());
      hitArea.setAttribute("width", hitAreaWidth.toString());
      hitArea.setAttribute("height", hitAreaHeight.toString());
      hitArea.setAttribute("fill", "transparent");
      hitArea.style.pointerEvents = TimelineManager.CONSTANTS.POINTER_EVENTS_ALL;
      hitArea.style.cursor = TimelineManager.CONSTANTS.CURSOR_EW_RESIZE;
      hitArea.classList.add('timeline-node-hit-area');
      return hitArea;
  }
  
  /**
   * Adjusts the SVG canvas's 'viewBox' attribute and its explicit 'height' and 'width'
   * attributes to encompass all rendered timeline content with appropriate padding.
   * It also adjusts the height of the timeline container div to match the SVG.
   * The main timeline group's transform is updated to ensure content is well-padded.
   * @private
   * @param {SVGElement} svg - The main SVG element of the timeline.
   */
  _adjustSvgViewbox(svg) {
    // Use _maxRenderedXForViewBox and _maxRenderedYForViewBox calculated during rendering.
    const padding = TimelineManager.CONSTANTS.VIEWBOX_PADDING; // General padding for viewbox
    // The mainTimelineGroup's own translateX (BRANCH_LABEL_OFFSET + padding) will handle left-side space for labels.
    // _maxRenderedXForViewBox now represents the max extent of nodes themselves.
    const svgWidth = Math.max(TimelineManager.CONSTANTS.DEFAULT_SVG_WIDTH, this._maxRenderedXForViewBox + padding);
    const svgHeight = Math.max(TimelineManager.CONSTANTS.DEFAULT_SVG_HEIGHT, this._maxRenderedYForViewBox + padding);

    svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute("height", svgHeight.toString()); // Also set the explicit height of SVG
    
    // Adjust the container div's height as well
    if (this.timelineContainerEl && this.timelineContainerEl.firstChild === svg) {
        this.timelineContainerEl.style.height = `${svgHeight}px`;
    }

    // Adjust main timeline group transform to ensure consistent padding for labels and content.
    const mainTimelineGroup = document.getElementById(TimelineManager.CONSTANTS.MAIN_TIMELINE_GROUP_ID);
    if (mainTimelineGroup) {
        const translateX = TimelineManager.CONSTANTS.BRANCH_LABEL_OFFSET + padding;
        const translateY = padding * 1.5; // Provides top padding for the first branch's content
        mainTimelineGroup.setAttribute("transform", `translate(${translateX}, ${translateY})`);
    }
  }

  /**
   * Handles the 'mousedown' event on a timeline node's hit area.
   * Initiates the dragging process by setting up the drag target and state.
   * @private
   * @param {MouseEvent} event - The mousedown event.
   * @param {string} branchId - The ID of the branch containing the clicked node.
   * @param {number} transactionIndex - The transaction index of the state associated with the clicked node (-1 for initial).
   * @param {SVGElement} nodeElement - The visual SVG node element (circle) that was clicked (via its hit area).
   */
  _handleNodeMouseDown(event, branchId, transactionIndex, nodeElement) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.versionControl) return;

    this.isDragging = true;
    // To determine the list of draggable states for this branch, we need to know its transactions.
    const branchData = this.versionControl.getBranchData(branchId);
    if (!branchData) {
        this.isDragging = false;
        return;
    }

    // Create a list of draggable indices: -1 for initial, then 0 to N-1 for transactions
    const draggableIndices = [-1, ...branchData.transactions.map((_, i) => i)];
    const currentDragStartIndexOnList = draggableIndices.indexOf(transactionIndex);

    this.dragTarget = {
      branchId: branchId,
      currentBranchDraggableIndices: draggableIndices, // List of valid indices for this branch
      currentDragStartIndexOnList: currentDragStartIndexOnList, // Index IN `draggableIndices` list
      currentDragListIndex: currentDragStartIndexOnList, // Current position IN `draggableIndices` list during drag
      element: nodeElement,
      startX: event.clientX,
    };
    document.body.style.cursor = TimelineManager.CONSTANTS.CURSOR_EW_RESIZE;
  }

  /**
   * Handles global 'mousemove' events during a drag operation on the timeline.
   * Calculates the new target version based on mouse movement and instructs
   * VersionControl to switch to it if it has changed.
   * This method should be called by a global mousemove listener (e.g., in UIManager).
   * @param {MouseEvent} event - The mousemove event.
   */
  handleDragMove(event) {
    if (!this.isDragging || !this.dragTarget || !this.versionControl) return;

    const deltaX = event.clientX - this.dragTarget.startX;
    const versionDelta = Math.floor(deltaX / TimelineManager.CONSTANTS.NODE_SPACING);

    const draggableIndices = this.dragTarget.currentBranchDraggableIndices;
    if (!draggableIndices || draggableIndices.length === 0) return;

    let newDragListIndex = this.dragTarget.currentDragStartIndexOnList + versionDelta;
    newDragListIndex = Math.max(0, Math.min(draggableIndices.length - 1, newDragListIndex));

    if (newDragListIndex !== this.dragTarget.currentDragListIndex) {
      this.dragTarget.currentDragListIndex = newDragListIndex;
      const targetTransactionIndex = draggableIndices[newDragListIndex]; // Get actual transactionIndex (-1, 0, 1...)
      
      if (targetTransactionIndex !== undefined) {
        this.versionControl.switchToVersion(this.dragTarget.branchId, targetTransactionIndex);
      }
    }
  }

  /**
   * Handles global 'mouseup' events to conclude a drag operation on the timeline.
   * Finalizes the version switch if a drag occurred and resets dragging state.
   * This method should be called by a global mouseup listener.
   * @param {MouseEvent} event - The mouseup event.
   */
  handleDragEnd(event) {
    if (this.isDragging) {
      this.isDragging = false;
      // If there was a drag target, switch to its final determined version.
      // This handles both true drags and simple clicks (mousedown -> mouseup).
      if (this.dragTarget && this.versionControl) {
        const finalBranchId = this.dragTarget.branchId;
        const finalTransactionIndex = this.dragTarget.currentBranchDraggableIndices[this.dragTarget.currentDragListIndex];
        if (finalTransactionIndex !== undefined) {
            this.versionControl.switchToVersion(finalBranchId, finalTransactionIndex);
        }
      }
      this.dragTarget = null;
      document.body.style.cursor = TimelineManager.CONSTANTS.CURSOR_AUTO;
      // No need to update scrubber line anymore
    }
  }

  /**
   * A utility function to parse an SVG 'transform' attribute string (e.g., "translate(x,y)")
   * and extract the translateX and translateY values.
   * Handles cases where the transform attribute might be missing or malformed.
   * @private
   * @param {string | null} transformString - The SVG transform attribute string.
   * @returns {{translateX: number, translateY: number}} An object with translateX and translateY values.
   *                                                   Defaults to {translateX: 0, translateY: 0} if parsing fails.
   */
  _parseTransform(transformString) {
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
   * Renders the visual connections (lines) between parent branches and their child branches.
   * Connections are drawn as cubic Bezier curves from the parent node to the
   * initial node of the child branch. This method directly uses `this._branchConnectionsGroup`.
   * @private
   */
  _renderBranchConnections() {
    if (!this._branchConnectionsGroup) return;
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
          const line = document.createElementNS(TimelineManager.SVG_NS, "path");
          // Draw a simple elbow connector.
          // M = move to parent node's center-right
          // C = cubic bezier curve towards child node.
          // Adjust control points for a smoother curve.
          const nodeRadiusAdjust = TimelineManager.CONSTANTS.NODE_RADIUS / 2; // Or a fixed small offset
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
          line.setAttribute("stroke", TimelineManager.CONSTANTS.COLOR_GRAY);
          line.setAttribute("stroke-width", TimelineManager.CONSTANTS.CONNECTION_LINE_STROKE_WIDTH);
          line.setAttribute("fill", "none");
          this._branchConnectionsGroup.appendChild(line);
        }
      }
    }
  }
} 