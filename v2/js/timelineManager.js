/**
 * @class TimelineManager
 * @description Manages the visualization and interaction with version history timeline
 */
export class TimelineManager {
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
    this._svgNS = "http://www.w3.org/2000/svg";
    this._nodePositions = {}; // Key: "{branchId}_{transactionIndex}", Value: { x, y, branchId, index }
    this.isDragging = false;
    this.dragTarget = null;
    this._branchConnectionsGroup = null; // Group for connection lines
    this._maxRenderedXForViewBox = 0; // Max X coordinate reached by any node
    this._maxRenderedYForViewBox = 0; // Max Y coordinate for vertical stacking
    this._branchLabelOffset = 60; // Increased space for branch labels
    this._branchNodesGroup = null; // Group for all branch nodes
    this._branchLabelsGroup = null; // Group for all branch labels

    // Node styling and layout properties
    this._nodeRadius = 7;
    this._activeNodeRadius = 9;
    this._nodeSpacing = 18;
    this._hitAreaHeight = 75; // User-defined hit area height
    // _hitAreaWidth will be based on _nodeSpacing

    // Add ResizeObserver for responsiveness
    this._resizeObserver = new ResizeObserver(() => {
      if (this.versionControl && this.timelineContainerEl.offsetParent !== null) { // Check if element is visible
        // console.log("TimelineManager: Resizing detected, re-rendering.");
        this.render();
      }
    });
    this._resizeObserver.observe(this.timelineContainerEl);
  }

  /**
   * Renders the version history timeline
   */
  render() {
    if (!this.versionControl) {
      console.warn("Timeline: VersionControl not set, skipping render");
      return;
    }
    console.log("Timeline.render: Start. VC present.", this.versionControl);
    
    this._clearTimeline();
    this._nodePositions = {}; // Reset node positions on each render
    this._maxRenderedXForViewBox = 0; // Reset max X for viewbox calculation
    this._maxRenderedYForViewBox = 0; // Reset max Y for viewbox calculation
    
    const svg = this._createSvgCanvas();
    const mainTimelineGroup = document.createElementNS(this._svgNS, "g");
    mainTimelineGroup.setAttribute("id", "main-timeline-group");
    mainTimelineGroup.setAttribute("transform", "translate(20, 40)"); 
    svg.appendChild(mainTimelineGroup);

    // Order of groups determines rendering layers (last is on top)
    this._branchConnectionsGroup = document.createElementNS(this._svgNS, "g");
    this._branchConnectionsGroup.setAttribute("id", "branch-connections-group");
    mainTimelineGroup.appendChild(this._branchConnectionsGroup);

    this._branchNodesGroup = document.createElementNS(this._svgNS, "g");
    this._branchNodesGroup.setAttribute("id", "branch-nodes-group");
    mainTimelineGroup.appendChild(this._branchNodesGroup);

    this._branchLabelsGroup = document.createElementNS(this._svgNS, "g");
    this._branchLabelsGroup.setAttribute("id", "branch-labels-group");
    mainTimelineGroup.appendChild(this._branchLabelsGroup);
    
    this._renderBranches(mainTimelineGroup); 
    this._renderBranchConnections(this._branchConnectionsGroup); // Pass connections group directly
    
    this._adjustSvgViewbox(svg);
    this.timelineContainerEl.appendChild(svg);
  }
  
  /**
   * Clears the timeline container
   * @private
   */
  _clearTimeline() {
    this.timelineContainerEl.innerHTML = '';
  }
  
  /**
   * Creates the SVG canvas element
   * @private
   * @returns {SVGElement} The created SVG element
   */
  _createSvgCanvas() {
    const svg = document.createElementNS(this._svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100"); // Initial, will be adjusted
    svg.setAttribute("viewBox", "0 0 800 100"); // Initial, will be adjusted
    svg.style.border = "1px solid #ccc";
    svg.style.minHeight = "100px"; // Ensure a minimum height

    // Create the scrubber line here and add it to the SVG
    // this._scrubberLine = document.createElementNS(this._svgNS, "line");
    // this._scrubberLine.setAttribute("stroke", "var(--red)");
    // this._scrubberLine.setAttribute("stroke-width", "1.5");
    // this._scrubberLine.setAttribute("y1", "0"); // Top of SVG
    // this._scrubberLine.setAttribute("y2", "100"); // Bottom of SVG (assuming height 100)
    // this._scrubberLine.style.visibility = 'hidden'; // Initially hidden
    // this._scrubberLine.style.pointerEvents = 'none'; // Ensure it doesn't interfere with mouse events
    // svg.appendChild(this._scrubberLine);

    return svg;
  }
  
  /**
   * Renders all branches and their versions
   * @private
   * @param {SVGElement} mainTimelineGroup - The main SVG group for all timeline elements.
   */
  _renderBranches(mainTimelineGroup) {
    const allBranchesData = this.versionControl.getAllBranchesData();
    const currentBranchIdFromVC = this.versionControl._currentBranchId;
    const currentTransactionIndexFromVC = this.versionControl._currentTransactionIndex;

    const branchRenderOrder = this._determineBranchRenderOrder(allBranchesData);
    console.log("Timeline._renderBranches: Data: ", { allBranchesData, currentBranchIdFromVC, currentTransactionIndexFromVC, branchRenderOrder });
    
    let yBranchOffset = 0;
    const branchVerticalSpacing = 40; // Vertical space between branches

    // Store min/max Y for scrubber alignment relative to mainTimelineGroup content
    this._minContentYInMainGroup = Infinity;
    this._maxContentYInMainGroup = -Infinity;

    for (const branchId of branchRenderOrder) {
      const branchData = allBranchesData[branchId];
      console.log(`Timeline._renderBranches: Processing branchId: ${branchId}`, branchData);
      if (branchData && branchData.transactions !== undefined && branchData.initialContent !== undefined) {
        // Create a group for each branch's versions
        const branchVersionsGroup = document.createElementNS(this._svgNS, "g");
        branchVersionsGroup.setAttribute("id", `branch-group-${branchId}`);
        branchVersionsGroup.setAttribute("transform", `translate(0, ${yBranchOffset})`);
        // Append to the dedicated nodes group instead of mainTimelineGroup directly
        this._branchNodesGroup.appendChild(branchVersionsGroup);

        const branchLabelY = yBranchOffset + 5; // Consistent Y for label and nodes in this row

        const branchLabel = document.createElementNS(this._svgNS, "text");
        branchLabel.setAttribute("x", "0");
        branchLabel.setAttribute("text-anchor", "end");
        branchLabel.setAttribute("dx", "-15px"); // Shift text 15px left of node line start
        branchLabel.setAttribute("y", branchLabelY.toString()); 
        branchLabel.setAttribute("font-size", "14px"); // Increased font size
        branchLabel.setAttribute("fill", "var(--gray)");
        branchLabel.textContent = branchId;
        if (branchId === currentBranchIdFromVC) {
            branchLabel.style.fontWeight = "bold";
            branchLabel.setAttribute("fill", "var(--blue)");
        }
        // Add label to the dedicated labels group
        this._branchLabelsGroup.appendChild(branchLabel);

        this._renderBranchStates(
          branchVersionsGroup, 
          branchId, 
          branchData, // Pass full branchData including initialContent and transactions
          currentBranchIdFromVC,
          currentTransactionIndexFromVC,
          0, // Initial xOffset within this branch group will be 0
          branchLabelY // Pass the Y offset for nodes in this branch row
        );
        yBranchOffset += branchVerticalSpacing;
        // Update min/max content Y based on this branch's label Y (which is where nodes are centered)
        this._minContentYInMainGroup = Math.min(this._minContentYInMainGroup, branchLabelY);
        this._maxContentYInMainGroup = Math.max(this._maxContentYInMainGroup, branchLabelY);
      }
    }
    // this._maxRenderedYForViewBox = Math.max(100, yBranchOffset + 20); // Add some padding
    // Use the actual content height for viewBox calculation
    if (Object.keys(allBranchesData).length > 0) {
        this._maxRenderedYForViewBox = Math.max(100, this._maxContentYInMainGroup + branchVerticalSpacing); // Add padding below last branch
    } else {
        this._maxRenderedYForViewBox = 100; // Default if no branches
    }
  }

  /**
   * Determines the order in which branches should be rendered.
   * Main branch first, then others. Could be extended for complex sorting.
   * @private
   * @param {object} allBranchesData - All branches data from VersionControl.
   * @returns {string[]} Ordered list of branch IDs.
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
   * Renders the states (initialContent + transactions) of a branch.
   * @private
   * @param {SVGElement} branchStateGroup - The SVG group specific to this branch's states.
   * @param {string} branchId - The ID of the current branch being rendered.
   * @param {object} branchData - The full data object for this branch.
   * @param {string} currentGlobalBranchId - The overall current branch ID (from VersionControl).
   * @param {number} currentGlobalTransactionIndex - The overall current transaction index (from VC).
   * @param {number} initialXOffset - The starting X offset for the first node in this branch group.
   * @param {number} yPos - The Y position for nodes in this branch row.
   */
  _renderBranchStates(branchStateGroup, branchId, branchData, currentGlobalBranchId, currentGlobalTransactionIndex, initialXOffset, yPos) {
    console.log(`Timeline._renderBranchStates: branchId=${branchId}, initialXOffset=${initialXOffset}, yPos=${yPos}`, { branchData, currentGlobalBranchId, currentGlobalTransactionIndex });
    let xOffset = initialXOffset;
    const hitAreaWidth = this._nodeSpacing; 

    // 1. Render node for initialContent state (index -1)
    const initialStateInfo = this.versionControl.getStateInfoAt(branchId, -1);
    console.log(`Timeline._renderBranchStates: Initial state info for ${branchId}_-1:`, initialStateInfo);
    if (initialStateInfo) {
      const isCurrentInitial = branchId === currentGlobalBranchId && currentGlobalTransactionIndex === -1;
      const initialNodeCompositeKey = `${branchId}_-1`;
      const initialVisualNode = this._createVisualNode(
        xOffset, 
        0, // Y is relative to branchStateGroup, which is already at yPos
        isCurrentInitial ? this._activeNodeRadius : this._nodeRadius, // Use active radius if current
        initialStateInfo, // Contains type, message etc.
        isCurrentInitial
      );
      initialVisualNode.dataset.compositeKey = initialNodeCompositeKey;

      const initialHitArea = this._createHitArea(xOffset, this._nodeRadius, hitAreaWidth, this._hitAreaHeight);
      console.log(`Timeline._renderBranchStates: Created initial node for ${initialNodeCompositeKey}:`, {initialVisualNode, initialHitArea});
      initialHitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, -1, initialVisualNode));
      
      branchStateGroup.appendChild(initialHitArea);
      branchStateGroup.appendChild(initialVisualNode);

      const mainTimelineGroupTransform = this._parseTransform(document.getElementById("main-timeline-group")?.getAttribute("transform"));
      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform"));
      const globalXInitial = xOffset + mainTimelineGroupTransform.translateX + branchGroupTransform.translateX;
      const globalYInitial = 0 + mainTimelineGroupTransform.translateY + branchGroupTransform.translateY;
      
      this._nodePositions[initialNodeCompositeKey] = { x: globalXInitial, y: globalYInitial, branchId: branchId, index: -1 };
      this._maxRenderedXForViewBox = Math.max(this._maxRenderedXForViewBox, globalXInitial + this._nodeRadius + this._branchLabelOffset);
      xOffset += this._nodeSpacing;
    }

    // 2. Render nodes for each transaction
    branchData.transactions.forEach((opArray, txIndex) => {
      const stateInfo = this.versionControl.getStateInfoAt(branchId, txIndex);
      console.log(`Timeline._renderBranchStates: Transaction state info for ${branchId}_${txIndex}:`, stateInfo);
      if (!stateInfo) {
        console.warn(`Could not get state info for ${branchId} at index ${txIndex}`);
        return;
      }

      const isCurrentTransaction = branchId === currentGlobalBranchId && txIndex === currentGlobalTransactionIndex;
      const nodeCompositeKey = `${branchId}_${txIndex}`;

      const visualNode = this._createVisualNode(
        xOffset, 
        0, // Y is relative to branchStateGroup
        isCurrentTransaction ? this._activeNodeRadius : this._nodeRadius, // Use active radius if current
        stateInfo, // Contains type, message etc.
        isCurrentTransaction 
      );
      visualNode.dataset.compositeKey = nodeCompositeKey;

      const hitArea = this._createHitArea(xOffset, this._nodeRadius, hitAreaWidth, this._hitAreaHeight);
      console.log(`Timeline._renderBranchStates: Created transaction node for ${nodeCompositeKey}:`, {visualNode, hitArea});
      hitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, txIndex, visualNode));
      
      branchStateGroup.appendChild(hitArea);
      branchStateGroup.appendChild(visualNode);

      const mainTimelineGroupTransform = this._parseTransform(document.getElementById("main-timeline-group")?.getAttribute("transform"));
      const branchGroupTransform = this._parseTransform(branchStateGroup.getAttribute("transform"));
      const globalX = xOffset + mainTimelineGroupTransform.translateX + branchGroupTransform.translateX;
      const globalY = 0 + mainTimelineGroupTransform.translateY + branchGroupTransform.translateY;

      this._nodePositions[nodeCompositeKey] = { x: globalX, y: globalY, branchId: branchId, index: txIndex };
      this._maxRenderedXForViewBox = Math.max(this._maxRenderedXForViewBox, globalX + this._nodeRadius + this._branchLabelOffset);

      xOffset += this._nodeSpacing;
    });
  }
  
  /**
   * Creates a visual timeline node (circle) and its tooltip.
   * @private
   * @param {number} x - X coordinate relative to its parent group.
   * @param {number} y - Y coordinate relative to its parent group.
   * @param {number} radius - Circle radius.
   * @param {object} stateInfo - Object from versionControl.getStateInfoAt(), contains type, message.
   * @param {boolean} isCurrent - Whether this is the current state.
   * @returns {SVGElement} The created circle SVGElement.
   */
  _createVisualNode(x, y, radius, stateInfo, isCurrent) {
    const circle = document.createElementNS(this._svgNS, "circle");
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", y.toString());
    circle.setAttribute("r", radius.toString());
    
    let fillColor = 'var(--light-gray)';
    let strokeColor = 'var(--dark-gray)';
    let strokeWidth = '1';
    
    if (isCurrent) {
      fillColor = 'var(--yellow)'; // Bright yellow for active node
      strokeColor = 'var(--dark-gray)'; // Darker border for active node
      strokeWidth = '2'; // Thicker border for active node
    } else {
      // stateInfo.type is inferred by VersionControl (e.g., 'charTyped', 'charDeleted', 'initial', 'branch_created')
      switch (stateInfo.type) {
        case 'charTyped':
          fillColor = 'var(--green)';
          break;
        case 'charDeleted':
          fillColor = 'var(--red)';
          break;
        case 'initial':
          fillColor = 'var(--blue-gray)'; // A distinct color for true initial states
          break;
        case 'branch_created':
          fillColor = 'var(--purple)'; // A distinct color for branch points (initial content of a new branch)
          break;
      }
    }
    
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.style.pointerEvents = 'none'; // Visual nodes should not capture pointer events
    circle.classList.add('timeline-node');
    
    const title = document.createElementNS(this._svgNS, "title");
    // stateInfo.id is {branchId, index}, stateInfo.message is generated by VersionControl
    const opDisplay = stateInfo.op ? `Op: [${stateInfo.op.join(',')}]` : "Initial State";
    title.textContent = `State: ${stateInfo.id.branchId} @ index ${stateInfo.id.index}\n${stateInfo.message || ''}\n${opDisplay}`;
    circle.appendChild(title);
    
    return circle;
  }

  /**
   * Creates an invisible hit area rectangle for a node.
   * @private
   */
  _createHitArea(nodeX, nodeRadius, hitAreaWidth, hitAreaHeight) {
      const hitArea = document.createElementNS(this._svgNS, "rect");
      hitArea.setAttribute("x", (nodeX - hitAreaWidth / 2).toString()); // Centered hit area
      hitArea.setAttribute("y", (-hitAreaHeight / 2).toString());
      hitArea.setAttribute("width", hitAreaWidth.toString());
      hitArea.setAttribute("height", hitAreaHeight.toString());
      hitArea.setAttribute("fill", "transparent");
      hitArea.style.pointerEvents = 'all';
      hitArea.style.cursor = 'ew-resize';
      hitArea.classList.add('timeline-node-hit-area');
      return hitArea;
  }
  
  /**
   * Adjusts the SVG viewbox and container height based on content.
   * @private
   * @param {SVGElement} svg - The SVG element to adjust.
   */
  _adjustSvgViewbox(svg) {
    // Use _maxRenderedXForViewBox and _maxRenderedYForViewBox calculated during rendering.
    const padding = 20; // General padding for viewbox
    const svgWidth = Math.max(800, this._maxRenderedXForViewBox + padding + this._branchLabelOffset); // Add space for labels
    const svgHeight = Math.max(100, this._maxRenderedYForViewBox + padding);

    svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
    svg.setAttribute("height", svgHeight.toString()); // Also set the explicit height of SVG
    
    // Adjust the container div's height as well
    if (this.timelineContainerEl && this.timelineContainerEl.firstChild === svg) {
        this.timelineContainerEl.style.height = `${svgHeight}px`;
    }

    // Adjust main timeline group transform if necessary (e.g., to ensure labels are visible)
    const mainTimelineGroup = document.getElementById("main-timeline-group");
    if (mainTimelineGroup) {
        // Example: ensure left padding for labels
        mainTimelineGroup.setAttribute("transform", `translate(${this._branchLabelOffset + padding}, ${padding * 1.5})`);
    }
  }

  /**
   * Handles mousedown event on a timeline node to initiate dragging.
   * @private
   * @param {MouseEvent} event - The mouse event.
   * @param {string} branchId - The ID of the branch containing the node.
   * @param {number} transactionIndex - The transaction index of the state (-1 for initialContent).
   * @param {SVGElement} nodeElement - The SVG element of the node.
   */
  _handleNodeMouseDown(event, branchId, transactionIndex, nodeElement) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.versionControl) return;

    this.isDragging = true;
    // To determine the list of draggable states for this branch, we need to know its transactions.
    const branchData = this.versionControl.getBranchData(branchId);
    if (!branchData) {
        console.error("Could not get branch data for drag start.");
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
    document.body.style.cursor = 'ew-resize';
  }

  /**
   * Handles mouse move events for timeline dragging.
   * This should be called from a global mousemove listener (e.g., in UIManagerV2).
   * @param {MouseEvent} event - The mouse event.
   */
  handleDragMove(event) {
    if (!this.isDragging || !this.dragTarget || !this.versionControl) return;

    const deltaX = event.clientX - this.dragTarget.startX;
    const versionDelta = Math.floor(deltaX / this._nodeSpacing);

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
   * Handles mouse up events to end timeline dragging.
   * This should be called from a global mouseup listener.
   * @param {MouseEvent} event - The mouse event.
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
      document.body.style.cursor = 'auto';
      // No need to update scrubber line anymore
    }
  }

  /**
   * Helper to parse SVG transform attribute (simplified for translate(x,y)).
   * @private
   * @param {string | null} transformString - The transform attribute string.
   * @returns {{translateX: number, translateY: number}}
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
   * Renders connections between parent and child branches.
   * @private
   * @param {SVGElement} connectionsGroup - The SVG group where connections will be drawn.
   */
  _renderBranchConnections(connectionsGroup) {
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
          const line = document.createElementNS(this._svgNS, "path");
          // Draw a simple elbow connector.
          // M = move to parent node's center-right
          // C = cubic bezier curve towards child node.
          // Adjust control points for a smoother curve.
          const startX = parentVersionPos.x + 4; // Assuming nodeRadius = 4
          const startY = parentVersionPos.y;
          const endX = childVersionPos.x - 4; // Assuming nodeRadius = 4
          const endY = childVersionPos.y;

          // Control points for bezier curve
          const cp1X = startX + (endX - startX) / 2;
          const cp1Y = startY;
          const cp2X = startX + (endX - startX) / 2;
          const cp2Y = endY;
          
          line.setAttribute("d", `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
          line.setAttribute("stroke", "var(--gray)");
          line.setAttribute("stroke-width", "1.5");
          line.setAttribute("fill", "none");
          this._branchConnectionsGroup.appendChild(line);
        } else {
          console.warn(`Timeline: Could not find positions for connection. Parent: ${parentNodeKey}, Child: ${childNodeKey}`);
        }
      }
    }
  }
} 