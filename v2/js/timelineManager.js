/**
 * @class TimelineManagerV2
 * @description Manages the visualization and interaction with version history timeline
 */
export class TimelineManagerV2 {
  /**
   * Creates a TimelineManagerV2 instance
   * @param {string} timelineContainerId - ID of the container element
   * @param {VersionControlV2} versionControl - Main version control instance
   * @throws {Error} If the timeline container element is not found
   */
  constructor(timelineContainerId, versionControl) {
    this.timelineContainerEl = document.getElementById(timelineContainerId);
    if (!this.timelineContainerEl) {
      throw new Error(`Timeline container with ID '${timelineContainerId}' not found`);
    }
    this.versionControl = versionControl; // Will be set later if null
    this._svgNS = "http://www.w3.org/2000/svg";
    this._nodePositions = {}; // For tracking node positions globally (svg coordinates)
    this.isDragging = false;
    this.dragTarget = null;
    this._scrubberLine = null; // To hold the scrubber line element
    this._branchConnectionsGroup = null; // Group for connection lines
    this._maxRenderedXForViewBox = 0; // Max X coordinate reached by any node
    this._maxRenderedYForViewBox = 0; // Max Y coordinate for vertical stacking
    this._branchLabelOffset = 20; // Space for branch labels
    this._branchNodesGroup = null; // Group for all branch nodes
    this._branchLabelsGroup = null; // Group for all branch labels
  }

  /**
   * Renders the version history timeline
   */
  render() {
    if (!this.versionControl) {
      console.warn("Timeline: VersionControl not set, skipping render");
      return;
    }
    
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
    this._updateScrubberLinePosition(); // Ensure scrubber is updated after render
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
    this._scrubberLine = document.createElementNS(this._svgNS, "line");
    this._scrubberLine.setAttribute("stroke", "var(--red)");
    this._scrubberLine.setAttribute("stroke-width", "1.5");
    this._scrubberLine.setAttribute("y1", "0"); // Top of SVG
    this._scrubberLine.setAttribute("y2", "100"); // Bottom of SVG (assuming height 100)
    this._scrubberLine.style.visibility = 'hidden'; // Initially hidden
    this._scrubberLine.style.pointerEvents = 'none'; // Ensure it doesn't interfere with mouse events
    svg.appendChild(this._scrubberLine);

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
    const currentVersionId = this.versionControl._currentVersionId;

    const branchRenderOrder = this._determineBranchRenderOrder(allBranchesData);
    
    let yBranchOffset = 0;
    const branchVerticalSpacing = 40; // Vertical space between branches

    for (const branchId of branchRenderOrder) {
      const branchData = allBranchesData[branchId];
      if (branchData && branchData.versions) {
        // Create a group for each branch's versions
        const branchVersionsGroup = document.createElementNS(this._svgNS, "g");
        branchVersionsGroup.setAttribute("id", `branch-group-${branchId}`);
        branchVersionsGroup.setAttribute("transform", `translate(0, ${yBranchOffset})`);
        // Append to the dedicated nodes group instead of mainTimelineGroup directly
        this._branchNodesGroup.appendChild(branchVersionsGroup);

        const branchLabel = document.createElementNS(this._svgNS, "text");
        branchLabel.setAttribute("x", "-15"); 
        branchLabel.setAttribute("y", (yBranchOffset + 5).toString()); 
        branchLabel.setAttribute("font-size", "10px");
        branchLabel.setAttribute("fill", "var(--gray)");
        branchLabel.textContent = branchId;
        if (branchId === currentBranchIdFromVC) {
            branchLabel.style.fontWeight = "bold";
            branchLabel.setAttribute("fill", "var(--blue)");
        }
        // Add label to the dedicated labels group
        this._branchLabelsGroup.appendChild(branchLabel);

        this._renderBranchVersions(
          branchVersionsGroup, // Pass the specific group for this branch's versions
          branchId, // Pass branchId for hit areas and node storage
          branchData.versions, 
          currentVersionId,
          0 // Initial xOffset within this branch group will be 0
        );
        yBranchOffset += branchVerticalSpacing;
      }
    }
    this._maxRenderedYForViewBox = Math.max(100, yBranchOffset + 20); // Add some padding
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
    // Simple sort: 'main' first, then alphabetically.
    return branchIds.sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      // Fallback for non-main branches (e.g. alphabetical or by creation time if available)
      // For now, just alphabetical for non-main
      const aTimestamp = allBranchesData[a].versions[0]?.timestamp || 0;
      const bTimestamp = allBranchesData[b].versions[0]?.timestamp || 0;
      if (aTimestamp !== bTimestamp) {
        return aTimestamp - bTimestamp;
      }
      return a.localeCompare(b);
    });
  }
  
  /**
   * Renders the versions of a branch
   * @private
   * @param {SVGElement} branchVersionsGroup - The SVG group specific to this branch's versions.
   * @param {string} branchId - The ID of the current branch being rendered.
   * @param {Array} versions - The versions to render for this branch.
   * @param {string} currentVersionId - The overall current version ID (from VersionControl).
   * @param {number} initialXOffset - The starting X offset for the first node in this branch group.
   */
  _renderBranchVersions(branchVersionsGroup, branchId, versions, currentVersionId, initialXOffset) {
    let xOffset = initialXOffset;
    const nodeRadius = 4;
    const nodeSpacing = 12;
    const hitAreaHeight = 30; // Height of the hit area
    const hitAreaWidth = nodeSpacing; // Width of the hit area, ensure it's wide enough

    versions.forEach((version, index) => {
      const isCurrent = version.id === currentVersionId && branchId === this.versionControl.findBranchOfVersion(version.id);
      const visualNode = this._createVersionNode(
        xOffset, // x is relative to the branchVersionsGroup
        0,       // y is 0 within the branchVersionsGroup
        nodeRadius,
        version,
        isCurrent 
      );
      visualNode.style.pointerEvents = 'auto'; // Ensure visual node can be clicked if needed
      visualNode.classList.add('timeline-node'); // For potential styling

      // Create hit area
      const hitArea = document.createElementNS(this._svgNS, "rect");
      hitArea.setAttribute("x", (xOffset - hitAreaWidth / 2 + nodeRadius / 2).toString()); // Centered on node
      hitArea.setAttribute("y", (-hitAreaHeight / 2).toString());
      hitArea.setAttribute("width", hitAreaWidth.toString());
      hitArea.setAttribute("height", hitAreaHeight.toString());
      hitArea.setAttribute("fill", "transparent"); // Make it invisible
      hitArea.style.pointerEvents = 'all'; // Capture all mouse events
      hitArea.style.cursor = 'ew-resize'; // Indicate draggable
      hitArea.classList.add('timeline-node-hit-area');

      // Add mousedown listener for dragging to the hit area
      hitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, index, visualNode, versions));
      
      // Add click listener to the visual node itself for simple navigation
      visualNode.addEventListener('click', () => {
        if (!this.isDragging && this.versionControl) { 
            this.versionControl.switchToVersion(branchId, version.id);
        }
      });
      
      // Append hit area first, then visual node (so visual node's tooltip works)
      branchVersionsGroup.appendChild(hitArea);
      branchVersionsGroup.appendChild(visualNode);

      // Store GLOBAL position for connections and scrubber.
      // Must account for the mainTimelineGroup's transform and this branchVersionsGroup's transform.
      const mainTimelineGroupTransform = this._parseTransform(document.getElementById("main-timeline-group")?.getAttribute("transform"));
      const branchGroupTransform = this._parseTransform(branchVersionsGroup.getAttribute("transform"));
      
      const globalX = xOffset + mainTimelineGroupTransform.translateX + branchGroupTransform.translateX;
      const globalY = 0 + mainTimelineGroupTransform.translateY + branchGroupTransform.translateY; // y is 0 within branch group

      this._nodePositions[version.id] = { x: globalX, y: globalY, branchId: branchId };
      this._maxRenderedXForViewBox = Math.max(this._maxRenderedXForViewBox, globalX + nodeRadius + this._branchLabelOffset);

      xOffset += nodeSpacing;
    });

    // this._finalXOffset is no longer suitable for global viewbox calculation with multiple branches.
    // We use _maxRenderedXForViewBox instead.
  }
  
  /**
   * Creates a version node (circle)
   * @private
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} radius - Circle radius
   * @param {object} version - Version data
   * @param {boolean} isCurrent - Whether this is the current version
   * @returns {SVGElement} The created circle element
   */
  _createVersionNode(x, y, radius, version, isCurrent) {
    const circle = document.createElementNS(this._svgNS, "circle");
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", y.toString());
    circle.setAttribute("r", radius.toString());
    
    // Set visual appearance based on version type
    let fillColor = 'var(--light-gray)';
    let strokeColor = 'var(--dark-gray)';
    let strokeWidth = '1';
    
    switch (version.type) {
      case 'charTyped':
        fillColor = 'var(--green)';
        break;
      case 'charDeleted':
        fillColor = 'var(--red)';
        break;
    }
    
    if (isCurrent) {
      strokeColor = 'var(--blue)';
      strokeWidth = '2.5';
    }
    
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", strokeWidth);
    circle.style.pointerEvents = 'auto'; // Explicitly allow pointer events on the circle itself
    
    // Add tooltip
    const title = document.createElementNS(this._svgNS, "title");
    title.textContent = `Version: ${version.id.substring(0,8)}... (${version.type})
${version.message || ''}`;
    circle.appendChild(title);
    
    return circle;
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
   * @param {number} versionIndex - The index of the version (node) in the versions array.
   * @param {SVGElement} nodeElement - The SVG element of the node.
   * @param {Array} versions - The array of versions for the current branch.
   */
  _handleNodeMouseDown(event, branchId, versionIndex, nodeElement, versions) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.versionControl) return;

    this.isDragging = true;
    this.dragTarget = {
      branchId: branchId,
      startIndex: versionIndex, // Store the index in the versions array
      currentIndex: versionIndex,
      element: nodeElement,
      startX: event.clientX,
      versions: versions // Store the versions array for easy access
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
    const nodeSpacing = 12; // Same as in _renderBranchVersions
    // Calculate version delta based on drag distance.
    // A larger divisor means user has to drag farther to change versions.
    // Changed from (nodeSpacing * 0.5) to nodeSpacing for less sensitivity.
    const versionDelta = Math.floor(deltaX / nodeSpacing);


    const versions = this.dragTarget.versions;
    if (!versions || versions.length === 0) return;

    let newVersionIndex = this.dragTarget.startIndex + versionDelta;
    newVersionIndex = Math.max(0, Math.min(versions.length - 1, newVersionIndex));

    if (newVersionIndex !== this.dragTarget.currentIndex) {
      this.dragTarget.currentIndex = newVersionIndex;
      const targetVersion = versions[newVersionIndex];
      if (targetVersion) {
        this.versionControl.switchToVersion(this.dragTarget.branchId, targetVersion.id);
        // switchToVersion will call _updateUI, which calls timelineManager.render(), 
        // which in turn calls _updateScrubberLinePosition().
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
      this.dragTarget = null;
      document.body.style.cursor = 'auto';
      // Optional: Force a re-render if needed, though switchToVersion should handle it.
      // if (this.versionControl) this.render();
    }
  }

  /**
   * Updates the position and visibility of the scrubber line.
   * @private
   */
  _updateScrubberLinePosition() {
    if (!this.versionControl || !this._scrubberLine) return;

    const currentVersionId = this.versionControl._currentVersionId;
    if (currentVersionId && this._nodePositions[currentVersionId]) {
      const nodePos = this._nodePositions[currentVersionId];
      
      // The nodePos.x and nodePos.y are already global SVG coordinates.
      // The scrubber line is a direct child of the SVG, so no further complex transform needed.
      this._scrubberLine.setAttribute("x1", nodePos.x.toString());
      this._scrubberLine.setAttribute("x2", nodePos.x.toString());
      // Set y1 and y2 to span the height of the SVG's viewBox
      const viewBox = this._scrubberLine.ownerSVGElement.getAttribute('viewBox');
      if (viewBox) {
          const [,, vbWidth, vbHeight] = viewBox.split(' ').map(parseFloat);
          this._scrubberLine.setAttribute("y1", "0");
          this._scrubberLine.setAttribute("y2", vbHeight.toString());
      } else { // fallback
          this._scrubberLine.setAttribute("y1", "0");
          this._scrubberLine.setAttribute("y2", "100%"); // Fallback, might not be ideal
      }
      this._scrubberLine.style.visibility = 'visible';
    } else {
      this._scrubberLine.style.visibility = 'hidden';
      if (currentVersionId) {
          console.warn(`Scrubber: Node position for current version ${currentVersionId} not found.`);
      }
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
      if (branchData.parent && branchData.parent.versionId && branchData.versions.length > 0) {
        const parentVersionPos = this._nodePositions[branchData.parent.versionId];
        // The child connection point is the first version of the current branch.
        const childVersionPos = this._nodePositions[branchData.versions[0].id];

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
          console.warn(`Timeline: Could not find positions for connection between parent ${branchData.parent.versionId} and child branch ${branchId} (first version ${branchData.versions[0]?.id})`);
        }
      }
    }
  }
} 