(function() {
/**
 * @file Text Version Control System
 *
 * This file implements a client-side text version control system.
 * It records keypresses, visualizes history as an interactive tree,
 * supports branching, and allows navigation through versions.
 */

/**
 * Manages the editor element, its content, and input-related events.
 * It detects changes (keypresses, deletions) and informs the VersionControl system.
 */
class EditorManager {
    /**
     * @param {string} editorId The ID of the textarea element.
     * @param {function(string, string):void} onKeypressCallback Callback for keypress.
     * @param {function(string):void} onDeletionCallback Callback for deletion.
     */
    constructor(editorId, onKeypressCallback, onDeletionCallback) {
        this.editorElement = document.getElementById(editorId);
        if (!this.editorElement) {
            throw new Error(`Editor element with ID '${editorId}' not found.`);
        }

        /** @private {string} Tracks the previous content of the editor to detect changes. */
        this._previousContent = '';
        /** @private {boolean} Flag to prevent recording programmatic changes to the editor. */
        this._isProgrammaticChange = false;

        /** @private {function(string, string):void} */
        this._onKeypressCallback = onKeypressCallback;
        /** @private {function(string):void} */
        this._onDeletionCallback = onDeletionCallback;

        this._initEventListeners();
    }

    /**
     * @private
     * Initializes event listeners for the editor.
     */
    _initEventListeners() {
        this.editorElement.addEventListener('input', (e) => {
            this._handleInput(e);
        });

        this.editorElement.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
                this._handleDeletionKey(e.key);
      }
    });
  }
  
    /**
     * @private
     * Handles the 'input' event on the editor.
     * Detects additions and triggers the keypress callback.
     * @param {InputEvent} event The input event.
     */
    _handleInput(event) {
        if (this._isProgrammaticChange) {
      return;
    }
        const currentContent = this.editorElement.value;
        if (currentContent.length > this._previousContent.length) {
            this._onKeypressCallback(currentContent, this._previousContent);
        }
        this._previousContent = currentContent;
    }

    /**
     * @private
     * Handles 'keydown' events for 'Backspace' and 'Delete' keys.
     * Triggers the deletion callback if content changes.
     * @param {string} key The key pressed ('Backspace' or 'Delete').
     */
    _handleDeletionKey(key) {
        if (this._isProgrammaticChange) {
      return;
    }
        // Use setTimeout to allow the editor value to update before checking
    setTimeout(() => {
            const currentContent = this.editorElement.value;
            if (currentContent.length < this._previousContent.length) {
                this._onDeletionCallback(currentContent);
                this._previousContent = currentContent;
      }
    }, 0);
  }
  
    /**
     * Gets the current value of the editor.
     * @returns {string} The current editor content.
     */
    getValue() {
        return this.editorElement.value;
    }

    /**
     * Sets the value of the editor.
     * @param {string} text The text to set in the editor.
     * @param {boolean} [isProgrammatic=true] Whether this change is programmatic (should not trigger recording).
     *                                         Defaults to true as this is typically for VCS navigation.
     */
    setValue(text, isProgrammatic = true) {
        const oldFlag = this._isProgrammaticChange;
        this._isProgrammaticChange = isProgrammatic;
        this.editorElement.value = text;
        this._previousContent = text; // Critical: Sync previousContent after programmatic change
        this._isProgrammaticChange = oldFlag;
    }
    
    /**
     * Updates the internal previous content tracker.
     * This is typically called by VersionControl after a version is successfully added.
     * @param {string} content The new content to set as previous.
     */
    updatePreviousContent(content) {
        this._previousContent = content;
    }
}

/**
 * Manages the rendering of the version history timeline as an SVG,
 * including branches, nodes, and connections. Handles timeline interactions.
 */
class TimelineRenderer {
    /**
     * @param {string} timelineId The ID of the timeline container element.
     * @param {VersionControl} versionControl The main version control instance.
     */
    constructor(timelineId, versionControl) {
        this.timelineEl = document.getElementById(timelineId);
        if (!this.timelineEl) {
            throw new Error(`Timeline element with ID '${timelineId}' not found.`);
        }
        /** @type {VersionControl} */
        this.versionControl = versionControl;
        /** @private {string} SVG namespace. */
        this._svgNS = "http://www.w3.org/2000/svg";
        /** @private {Object<string, {x: number, y: number, type: string}>} Stores positions of rendered nodes. */
        this._nodePositions = {};
        
        /** @public {boolean} Indicates if a timeline node is currently being dragged. */
        this.isDragging = false;
        /** @public {null|{branchId: string, startIndex: number, currentIndex: number, element: SVGElement, startX: number}} Target of drag operation. */
        this.dragTarget = null;
    }

    /**
     * Renders the entire timeline, including the SVG and shortcut information.
     */
    render() {
        this.timelineEl.innerHTML = ''; // Clear previous timeline

    const timelineContainer = document.createElement('div');
    timelineContainer.style.position = 'relative';
        timelineContainer.style.height = '100px'; // Initial height, will be adjusted
    timelineContainer.style.width = '100%';
    timelineContainer.style.overflow = 'hidden';
    
        const svg = document.createElementNS(this._svgNS, "svg");
    svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100"); // Initial height
        svg.setAttribute("viewBox", "0 0 1000 100"); // Fixed logical width, initial height
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.style.pointerEvents = 'auto';
    
        const timelineGroup = document.createElementNS(this._svgNS, "g");
        timelineGroup.setAttribute("transform", "translate(10, 50)"); // Initial transform
    svg.appendChild(timelineGroup);
    
        this._renderSVGTimeline(timelineGroup); // Main rendering call
    
    timelineContainer.appendChild(svg);
    this.timelineEl.appendChild(timelineContainer);
    
        this._renderShortcutsInfo();
    }

    /**
     * @private
     * Renders the keyboard shortcuts information below the timeline.
     */
    _renderShortcutsInfo() {
    const shortcutsDiv = document.createElement('div');
    shortcutsDiv.className = 'keyboard-shortcuts';
    shortcutsDiv.innerHTML = `
      <p>Keyboard shortcuts: 
        <span title="Undo">Ctrl/⌘+Z</span> | 
        <span title="Redo">Ctrl/⌘+Shift+Z</span> | 
        <span title="Create Branch">Ctrl/⌘+B</span>
      </p>
    `;
    this.timelineEl.appendChild(shortcutsDiv);
  }
  
    /**
     * @private
     * Calculates the structure of branches for rendering.
     * @returns {{branchDepths: Object<string, number>, childBranches: Object<string, string[]>, branchParents: Object<string, {parentBranchId: string, parentVersionIndex: number}>, branchLengths: Object<string, number>, branchPoints: Object<string, number>}}
     */
    _calculateBranchStructure() {
        const branches = this.versionControl.getAllBranches();
    let branchStructure = {
            branchDepths: {}, childBranches: {}, branchParents: {},
            branchLengths: {}, branchPoints: {}
        };

    const calculateBranchDepth = (branchId, depth = 0) => {
      branchStructure.branchDepths[branchId] = depth;
            const children = [];
            Object.entries(branches).forEach(([childId, childBranch]) => {
        if (childBranch.parentVersion && childBranch.parentVersion.branchId === branchId) {
                    children.push(childId);
          branchStructure.branchParents[childId] = {
            parentBranchId: branchId,
            parentVersionIndex: childBranch.parentVersion.versionIndex
          };
          calculateBranchDepth(childId, depth + 1);
        }
      });
            branchStructure.childBranches[branchId] = children;
    };
    
        if (branches.main) { // Ensure main branch exists
    calculateBranchDepth('main');
        }
    
        Object.keys(branches).forEach(branchId => {
            const branch = branches[branchId];
      let visibleNodes = 0;
      branch.versions.forEach(version => {
        if (version.type === 'keypress' || version.type === 'deletion') {
          visibleNodes++;
        }
      });
      branchStructure.branchLengths[branchId] = visibleNodes;
    });
    
    Object.keys(branchStructure.branchParents).forEach(branchId => {
      const parentInfo = branchStructure.branchParents[branchId];
            const parentBranch = branches[parentInfo.parentBranchId];
            if (!parentBranch) return;
      
      let visibleNodeIndex = -1;
      for (let i = 0; i <= parentInfo.parentVersionIndex; i++) {
        if (parentBranch.versions[i] && 
            (parentBranch.versions[i].type === 'keypress' || parentBranch.versions[i].type === 'deletion')) {
          visibleNodeIndex++;
        }
      }
      branchStructure.branchPoints[branchId] = visibleNodeIndex;
    });
    return branchStructure;
  }
  
    /**
     * @private
     * Renders the SVG representation of the timeline.
     * @param {SVGGElement} parentGroup The SVG group to render into.
     */
    _renderSVGTimeline(parentGroup) {
        this._nodePositions = {}; // Reset node positions
        const branchStructure = this._calculateBranchStructure();
        const nodeSize = 2, nodeSpacing = 3, branchSpacing = 15;

        let visibleBranchCount = 0;
        const countVisibleBranches = (branchId) => {
            if (!branchStructure.branchDepths.hasOwnProperty(branchId)) return;
            visibleBranchCount++;
            const childBranches = branchStructure.childBranches[branchId] || [];
            childBranches.forEach(childId => countVisibleBranches(childId));
        };
        if (this.versionControl.getBranch('main')) { // Check if main branch exists before counting
            countVisibleBranches('main');
        }


        const totalHeight = Math.max(100, visibleBranchCount * branchSpacing + 50);
        const svg = parentGroup.ownerSVGElement;
        svg.setAttribute("height", totalHeight.toString());
        svg.setAttribute("viewBox", `0 0 1000 ${totalHeight}`);
        if (svg.parentElement) {
            svg.parentElement.style.height = `${totalHeight}px`;
        }
        
        const timelineTreeEl = document.getElementById('timeline-tree'); // This ID is from HTML
        if (timelineTreeEl) { // If timelineEl is the container for the SVG itself
            timelineTreeEl.style.height = `${totalHeight}px`;
            timelineTreeEl.style.overflowY = 'visible';
            timelineTreeEl.style.overflowX = 'hidden';
        }


        parentGroup.setAttribute("transform", `translate(10, ${Math.min(50, totalHeight / 4)})`);
        
        if (this.versionControl.getBranch('main')) { // Check if main branch exists before rendering
            this._renderSVGBranch(parentGroup, 'main', 0, 0, nodeSize, nodeSpacing, branchSpacing, branchStructure);
        }
        this._renderBranchConnections(parentGroup);
    }

    /**
     * @private
     * Renders a single branch in the SVG timeline.
     * @param {SVGGElement} parentGroup The parent SVG group.
     * @param {string} branchId The ID of the branch to render.
     * @param {number} xOffset Horizontal offset for this branch.
     * @param {number} yOffset Vertical offset for this branch.
     * @param {number} nodeSize Size of the visual node.
     * @param {number} nodeSpacing Spacing between nodes.
     * @param {number} branchSpacing Vertical spacing between branches.
     * @param {ReturnType<this['_calculateBranchStructure']>} branchStructure Pre-calculated branch structure.
     */
    _renderSVGBranch(parentGroup, branchId, xOffset, yOffset, nodeSize, nodeSpacing, branchSpacing, branchStructure) {
        const branch = this.versionControl.getBranch(branchId);
        if (!branch) return;

        const branchGroup = document.createElementNS(this._svgNS, "g");
    branchGroup.setAttribute("transform", `translate(${xOffset}, ${yOffset})`);
    branchGroup.setAttribute("data-branch-id", branchId);
    parentGroup.appendChild(branchGroup);
    
    let currentX = 0;
    branch.versions.forEach((version, index) => {
            if (version.type !== 'keypress' && version.type !== 'deletion') return;
      
      let node;
      if (version.type === 'keypress') {
                node = document.createElementNS(this._svgNS, "rect");
                node.setAttribute("x", currentX.toString());
                node.setAttribute("y", (-nodeSize / 2).toString());
                node.setAttribute("width", nodeSize.toString());
                node.setAttribute("height", nodeSize.toString());
                node.setAttribute("fill", "rgba(0,0,0,0.75)");
            } else { // deletion
                node = document.createElementNS(this._svgNS, "g");
        node.setAttribute("transform", `translate(${currentX}, 0)`);
                const line1 = document.createElementNS(this._svgNS, "line");
                line1.setAttribute("x1", (-nodeSize/2).toString()); line1.setAttribute("y1", (-nodeSize/2).toString());
                line1.setAttribute("x2", (nodeSize/2).toString()); line1.setAttribute("y2", (nodeSize/2).toString());
                const line2 = document.createElementNS(this._svgNS, "line");
                line2.setAttribute("x1", (-nodeSize/2).toString()); line2.setAttribute("y1", (nodeSize/2).toString());
                line2.setAttribute("x2", (nodeSize/2).toString()); line2.setAttribute("y2", (-nodeSize/2).toString());
                [line1, line2].forEach(l => {
                    l.setAttribute("stroke", "rgba(0,0,0,0.75)");
                    l.setAttribute("stroke-width", "0.5");
                    node.appendChild(l);
                });
            }

            if (branchId === this.versionControl.currentBranchId && index === this.versionControl.currentVersionIndex) {
        if (version.type === 'keypress') {
                    node.setAttribute("width", (nodeSize * 2.5).toString());
                    node.setAttribute("height", (nodeSize * 2.5).toString());
                    node.setAttribute("x", (currentX - nodeSize * 0.75).toString());
                    node.setAttribute("y", (-nodeSize * 1.25).toString());
                    node.setAttribute("fill", "#00B400");
        } else {
          node.querySelectorAll("line").forEach(line => {
                        line.setAttribute("stroke", "#E4003D");
            line.setAttribute("stroke-width", "1.5");
                        if (line.getAttribute("x1") === (-nodeSize/2).toString()) { // Simplified check
                             line.setAttribute("x1", (-nodeSize).toString()); line.setAttribute("y1", (-nodeSize).toString());
                             line.setAttribute("x2", (nodeSize).toString()); line.setAttribute("y2", (nodeSize).toString());
            } else {
                             line.setAttribute("x1", (-nodeSize).toString()); line.setAttribute("y1", (nodeSize).toString());
                             line.setAttribute("x2", (nodeSize).toString()); line.setAttribute("y2", (-nodeSize).toString());
            }
          });
        }
      }
      
            this._nodePositions[`${branchId}-${index}`] = { x: currentX + xOffset, y: yOffset, type: version.type };

            node.addEventListener("click", () => this.versionControl.navigateToVersion(branchId, index));
            
            const hitArea = document.createElementNS(this._svgNS, "rect");
            hitArea.setAttribute("x", (currentX - 5).toString());
            hitArea.setAttribute("y", "-15");
            hitArea.setAttribute("width", "10");
            hitArea.setAttribute("height", "30");
      hitArea.setAttribute("fill", "transparent");
      hitArea.style.pointerEvents = 'all';
      hitArea.classList.add('node-hit-area');
      hitArea.setAttribute('title', 'Drag to navigate through versions');
            hitArea.addEventListener('mousedown', (e) => this._handleNodeMouseDown(e, branchId, index, node));
      
      branchGroup.appendChild(hitArea);
      node.style.pointerEvents = 'auto';
      node.classList.add('node');
      branchGroup.appendChild(node);
      
      currentX += nodeSize + nodeSpacing;
    });
    
    const childBranches = branchStructure.childBranches[branchId] || [];
    let childYOffset = yOffset + branchSpacing;
    childBranches.forEach(childId => {
      const branchPointIndex = branchStructure.branchPoints[childId];
            const childXOffset = (branchPointIndex !== undefined && branchPointIndex >=0) ? branchPointIndex * (nodeSize + nodeSpacing) : 0;
            this._renderSVGBranch(parentGroup, childId, xOffset + childXOffset, childYOffset, nodeSize, nodeSpacing, branchSpacing, branchStructure);
            childYOffset += branchSpacing * (1 + (branchStructure.childBranches[childId] || []).length * 0.5); // Dynamic spacing
        });
    }

    /**
     * @private
     * Renders connections (lines) between parent and child branches in the SVG.
     * @param {SVGGElement} parentGroup The SVG group to render connections into.
     */
    _renderBranchConnections(parentGroup) {
    const existingConnections = parentGroup.querySelector('.branch-connections');
        if (existingConnections) parentGroup.removeChild(existingConnections);
    
        const connectionsGroup = document.createElementNS(this._svgNS, "g");
    connectionsGroup.setAttribute("class", "branch-connections");
        parentGroup.insertBefore(connectionsGroup, parentGroup.firstChild);

        const branches = this.versionControl.getAllBranches();
        Object.keys(branches).forEach(branchId => {
            if (branchId === 'main') return;
            const branch = branches[branchId];
      if (!branch.parentVersion) return;
      
      const parentBranchId = branch.parentVersion.branchId;
      const parentVersionIndex = branch.parentVersion.versionIndex;
      
            let childNodeIndex = branch.versions.findIndex(v => v.type === 'keypress' || v.type === 'deletion');
            if (childNodeIndex === -1) return;

      const parentKey = `${parentBranchId}-${parentVersionIndex}`;
      const childKey = `${branchId}-${childNodeIndex}`;
      
            if (!this._nodePositions[parentKey] || !this._nodePositions[childKey]) {
        console.warn(`Missing positions for branch connection: ${parentKey} -> ${childKey}`);
        return;
      }
            const parentPos = this._nodePositions[parentKey];
            const childPos = this._nodePositions[childKey];

            const path = document.createElementNS(this._svgNS, "path");
      const midY = (parentPos.y + childPos.y) / 2;
            const pathData = `M ${parentPos.x + 1},${parentPos.y} L ${parentPos.x + 1},${midY} L ${childPos.x},${childPos.y}`;
      path.setAttribute("d", pathData);
            path.setAttribute("stroke", "#0C679C");
            path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("pointer-events", "none");
      connectionsGroup.appendChild(path);
      
            const junctionPoint = document.createElementNS(this._svgNS, "circle");
            junctionPoint.setAttribute("cx", (parentPos.x+1).toString());
            junctionPoint.setAttribute("cy", midY.toString());
            junctionPoint.setAttribute("r", "2");
      junctionPoint.setAttribute("fill", "#0C679C");
      connectionsGroup.appendChild(junctionPoint);
      
            const label = document.createElementNS(this._svgNS, "text");
            label.setAttribute("x", (childPos.x + 3).toString());
            label.setAttribute("y", (childPos.y - 5).toString());
      label.setAttribute("font-size", "8px");
      label.setAttribute("fill", "#0C679C");
      label.textContent = branchId.replace('branch-', '');
      connectionsGroup.appendChild(label);
    });
  }
  
    /**
     * @private
     * Handles mousedown event on a timeline node for initiating drag.
     * @param {MouseEvent} e The mouse event.
     * @param {string} branchId The ID of the branch containing the node.
     * @param {number} versionIndex The index of the version (node).
     * @param {SVGElement} nodeElement The SVG element of the node.
     */
    _handleNodeMouseDown(e, branchId, versionIndex, nodeElement) {
        e.preventDefault();
        e.stopPropagation();
        this.isDragging = true;
        this.dragTarget = {
            branchId: branchId,
            startIndex: versionIndex,
            currentIndex: versionIndex,
            element: nodeElement,
            startX: e.clientX
        };
        document.body.style.cursor = 'ew-resize';
    }

    /**
     * Handles mouse move events for timeline dragging.
     * This should be called from a global mousemove listener (e.g., in UIManager).
     * @param {MouseEvent} event The mouse event.
     */
    handleDragMove(event) {
    if (!this.isDragging || !this.dragTarget) return;
    
    const deltaX = event.clientX - this.dragTarget.startX;
        const versionDelta = Math.floor(deltaX / 5); // 1 version per 5px drag
        const branch = this.versionControl.getBranch(this.dragTarget.branchId);
    if (!branch) return;
    
        const visibleNodesIndices = [];
        branch.versions.forEach((v, i) => {
            if (v.type === 'keypress' || v.type === 'deletion') visibleNodesIndices.push(i);
        });
        if (visibleNodesIndices.length === 0) return;

        const startVisibleNodeIndex = visibleNodesIndices.indexOf(this.dragTarget.startIndex);
        if (startVisibleNodeIndex === -1) return; // Should not happen if startIndex is valid

        const newVisibleNodeIndex = Math.max(0, Math.min(visibleNodesIndices.length - 1, startVisibleNodeIndex + versionDelta));
        const newVersionIndex = visibleNodesIndices[newVisibleNodeIndex];

    if (newVersionIndex !== this.dragTarget.currentIndex) {
      this.dragTarget.currentIndex = newVersionIndex;
            this.versionControl.navigateToVersion(this.dragTarget.branchId, newVersionIndex);
            // Re-render is handled by navigateToVersion calling this.render()
        }
    }

    /**
     * Handles mouse up events to end timeline dragging.
     * This should be called from a global mouseup listener.
     * @param {MouseEvent} event The mouse event.
     */
    handleDragEnd(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTarget = null;
      document.body.style.cursor = 'auto';
            this.render(); // Force a re-render to ensure final state is correct
        }
    }
}

/**
 * Handles persistence of version history and user preferences using localStorage.
 */
class StorageManager {
    /** @private {string} Key used for storing data in localStorage. */
    _storageKey = 'textVersionControl';

    constructor() {}

    /**
     * Saves user preferences (e.g., current branch and version).
     * @param {{currentBranchId: string, currentVersionIndex: number}} prefs Preferences to save.
     */
    saveUserPreferences(prefs) {
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(prefs));
        } catch (e) {
            console.error('Failed to save preferences:', e);
        }
    }

    /**
     * Loads user preferences.
     * @returns {{currentBranchId: string, currentVersionIndex: number} | null} Loaded preferences or null.
     */
  loadUserPreferences() {
    try {
            const prefsString = localStorage.getItem(this._storageKey);
            if (prefsString) {
                return JSON.parse(prefsString);
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
        return null;
    }

    /**
     * Exports the version history to a JSON file.
     * @param {Object} branchesData The branches data (typically from `VersionControl.branches`).
     */
    exportHistory(branchesData) {
        try {
            const data = JSON.stringify(branchesData);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-version-history-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); // Required for Firefox
    a.click();
            document.body.removeChild(a);
    URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export history:', e);
            alert('Error exporting history.');
        }
    }

    /**
     * Imports version history from a JSON string.
     * @param {string} jsonData The JSON string of the history.
     * @returns {Object | null} The parsed branches data, or null if an error occurs.
     */
  importHistory(jsonData) {
    try {
            return JSON.parse(jsonData);
    } catch (e) {
      console.error('Failed to import history:', e);
            alert('Invalid history file or format.');
            return null;
        }
    }
}

/**
 * Manages global UI elements, interactions like keyboard shortcuts,
 * and orchestrates UI updates based on VersionControl state.
 */
class UIManager {
    /**
     * @param {VersionControl} versionControl
     * @param {TimelineRenderer} timelineRenderer
     * @param {StorageManager} storageManager
     */
    constructor(versionControl, timelineRenderer, storageManager) {
        /** @type {VersionControl} */
        this.versionControl = versionControl;
        /** @type {TimelineRenderer} */
        this.timelineRenderer = timelineRenderer;
        /** @type {StorageManager} */
        this.storageManager = storageManager;
    }

    /**
     * Initializes global keyboard shortcuts.
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => this._handleGlobalKeyDown(e));
    }

    /**
     * @private
     * Handles global keydown events for shortcuts.
     * @param {KeyboardEvent} event
     */
    _handleGlobalKeyDown(event) {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;

        if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey) { // Undo
            event.preventDefault();
            this.versionControl.navigateToPreviousVersion();
        } else if (isCtrlOrCmd && event.key === 'z' && event.shiftKey) { // Redo
            event.preventDefault();
            this.versionControl.navigateToNextVersion();
        } else if (isCtrlOrCmd && event.key === 'b') { // Create Branch
            event.preventDefault();
            const branchName = this.promptForBranchName();
            if (branchName) {
                this.versionControl.createNamedBranch(branchName);
            }
        }
    }
    
    /**
     * Initializes global mouse listeners for timeline dragging.
     */
    initDragListeners() {
        document.addEventListener('mousemove', this._handleGlobalMouseMove.bind(this));
        document.addEventListener('mouseup', this._handleGlobalMouseUp.bind(this));
        
        // Prevent hover effects on timeline container when not dragging (if needed)
        // this.timelineRenderer.timelineEl.addEventListener('mouseover', (e) => {
        //   if (!this.timelineRenderer.isDragging) {
        //     e.stopPropagation();
        //   }
        // });
    }

    /**
     * @private
     * Handles global mousemove for timeline drag, delegating to TimelineRenderer.
     * @param {MouseEvent} event
     */
    _handleGlobalMouseMove(event) {
        if (this.timelineRenderer.isDragging) {
            this.timelineRenderer.handleDragMove(event);
        }
    }

    /**
     * @private
     * Handles global mouseup for timeline drag, delegating to TimelineRenderer.
     * @param {MouseEvent} event
     */
    _handleGlobalMouseUp(event) {
        if (this.timelineRenderer.isDragging) {
            this.timelineRenderer.handleDragEnd(event);
        }
    }

    /**
     * Prompts the user for a branch name.
     * @returns {string | null} The branch name or null if cancelled.
     */
    promptForBranchName() {
        return prompt('Enter a name for the new branch:');
    }

    /**
     * Sets up UI controls like export/import buttons, build info, etc.
     * @param {string} controlsContainerSelector CSS selector for the container for controls.
     */
    setupUIControls(controlsContainerSelector) {
        const container = document.querySelector(controlsContainerSelector);
        if (!container) {
            console.error(`UI Controls container '${controlsContainerSelector}' not found.`);
            return;
        }
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'controls';
  controlsDiv.style.marginTop = '20px';
  
        const exportBtn = this._createButton('Export History', () => {
            this.storageManager.exportHistory(this.versionControl.getAllBranches());
        });
        
        const importBtn = this._createButton('Import History', () => {
            this._handleImportClick();
        });

        controlsDiv.appendChild(exportBtn);
        controlsDiv.appendChild(document.createTextNode(' ')); // Spacer
        controlsDiv.appendChild(importBtn);
        
        const buildTimeDiv = this._createBuildInfo();
        
        container.appendChild(controlsDiv);
        container.appendChild(buildTimeDiv);
    }
    
    /**
     * @private
     * Creates a button element.
     * @param {string} text The button text.
     * @param {function} onClickHandler The click handler.
     * @returns {HTMLButtonElement}
     */
    _createButton(text, onClickHandler) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.addEventListener('click', onClickHandler);
        return btn;
    }

    /**
     * @private
     * Handles the click event for the import button.
     */
    _handleImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
                    const importedData = this.storageManager.importHistory(event.target.result);
                    if (importedData) {
                        this.versionControl.replaceAllBranches(importedData);
                    }
        };
        reader.readAsText(file);
      }
    });
    input.click();
    }
    
    /**
     * @private
     * Creates the build information display element.
     * @returns {HTMLDivElement}
     */
    _createBuildInfo() {
  const buildTimeDiv = document.createElement('div');
  buildTimeDiv.className = 'build-info';
  buildTimeDiv.style.fontSize = '12px';
  buildTimeDiv.style.color = '#616E73';
  buildTimeDiv.style.marginTop = '30px';
        // This date was static in the original code. Keeping it static or making it dynamic is an option.
  buildTimeDiv.textContent = `Last built on Friday the 4th of April, 2025 at 4:41PM`;
  
  const feedbackLink = document.createElement('a');
  feedbackLink.href = 'https://github.com/dannyhope/sapling/issues/new/choose';
  feedbackLink.textContent = 'Submit feedback';
  feedbackLink.style.fontSize = '12px';
  feedbackLink.style.marginLeft = '15px';
  feedbackLink.style.color = '#0C679C';
  buildTimeDiv.appendChild(feedbackLink);
  
        return buildTimeDiv;
    }
}


/**
 * Core Version Control logic. Manages branches, versions, and navigation.
 * Delegates UI, editor, and storage tasks to respective manager classes.
 */
class VersionControl {
  /**
   * @param {EditorManager} editorManager Instance of EditorManager.
   * @param {TimelineRenderer} timelineRenderer Instance of TimelineRenderer.
   * @param {StorageManager} storageManager Instance of StorageManager.
   */
  constructor(editorManager, timelineRenderer, storageManager) {
    /** @type {EditorManager} */
    this.editorManager = editorManager;
    /** @type {TimelineRenderer} */
    this.timelineRenderer = timelineRenderer;
    /** @type {StorageManager} */
    this.storageManager = storageManager;

    /** @type {string} ID of the currently active branch. */
    this.currentBranchId = 'main';
    /** 
     * @type {Object<string, {versions: Array<{id: number, content: string, timestamp: number, message: string, type: string}>, parentVersion: {branchId: string, versionIndex: number}|null}>} 
     * Stores all branches and their versions.
     */
    this.branches = {
      main: {
        versions: [{ id: 0, content: '', timestamp: Date.now(), message: 'Initial version', type: 'initial' }],
        parentVersion: null
      }
    };
    /** @type {number} Index of the currently active version within the current branch. */
    this.currentVersionIndex = 0;
    
    // Load user preferences after core properties are initialized
    // this._loadUserPreferences(); // Removed this line to defer loading until timelineRenderer is set
  }

  /**
   * @private
   * Callback for when EditorManager detects a keypress (addition).
   * @param {string} currentContent The current editor content.
   * @param {string} previousContent The editor content before this input.
   */
  _handleEditorKeypress(currentContent, previousContent) {
    // previousContent is passed by EditorManager but VersionControl might re-verify or use its own state
    this.addVersion('keypress', currentContent);
    // Inform EditorManager to update its 'previousContent' state
    this.editorManager.updatePreviousContent(currentContent);
  }
  
  /**
   * @private
   * Callback for when EditorManager detects a deletion.
   * @param {string} currentContent The current editor content after deletion.
   */
  _handleEditorDeletion(currentContent) {
    this.addVersion('deletion', currentContent);
    // Inform EditorManager to update its 'previousContent' state
    this.editorManager.updatePreviousContent(currentContent);
  }

  /**
   * Adds a new version to the current branch or creates a new branch if editing an old version.
   * @param {'keypress' | 'deletion' | 'branch' | 'initial'} type The type of version.
   * @param {string} content The content of this version.
   * @param {string} [message] Optional message for the version.
   */
  addVersion(type, content, message) {
    let currentBranch = this.branches[this.currentBranchId];
    
    if (this.currentVersionIndex < currentBranch.versions.length - 1) {
      // Not at the tip of the branch, create a new branch
      const newBranchId = `branch-${Date.now()}`;
      this._createBranchLogic(newBranchId, this.currentBranchId, this.currentVersionIndex, content, `Branched from ${this.currentBranchId} (v${this.currentVersionIndex})`);
      this.currentBranchId = newBranchId;
      this.currentVersionIndex = 0; // New branch starts at its first version (index 0)
      currentBranch = this.branches[this.currentBranchId]; // Switch to the new branch context
    }
    
    const versionMessage = message || (type === 'keypress' ? 'Added character' : (type === 'deletion' ? 'Deleted character' : 'Created version'));
    currentBranch.versions.push({
      id: currentBranch.versions.length, // ID is based on new length
      content: content,
      timestamp: Date.now(),
      message: versionMessage,
      type: type
    });
    
    this.currentVersionIndex = currentBranch.versions.length - 1;
    this.timelineRenderer.render();
    this._saveUserPreferences();
  }

  /**
   * @private
   * Core logic for creating a new branch.
   * @param {string} newBranchId The ID for the new branch.
   * @param {string} parentBranchId The ID of the parent branch.
   * @param {number} parentVersionIndex The index of the version in the parent branch to branch from.
   * @param {string} initialContent The initial content for the new branch's first version.
   * @param {string} initialMessage The message for the new branch's first version.
   */
  _createBranchLogic(newBranchId, parentBranchId, parentVersionIndex, initialContent, initialMessage) {
    this.branches[newBranchId] = {
      versions: [{
        id: 0, // First version in a new branch
        content: initialContent,
        timestamp: Date.now(),
        message: initialMessage,
        type: 'branch'
      }],
      parentVersion: {
        branchId: parentBranchId,
        versionIndex: parentVersionIndex
      }
    };
  }

  /**
   * Creates a new branch with a user-provided name.
   * @param {string} branchName The desired name for the branch.
   */
  createNamedBranch(branchName) {
    const sanitizedName = branchName.replace(/[^a-zA-Z0-9-_]/g, '-');
    const editorContent = this.editorManager.getValue();
    this._createBranchLogic(sanitizedName, this.currentBranchId, this.currentVersionIndex, editorContent, `Branched from ${this.currentBranchId} at version ${this.currentVersionIndex}`);
    
    this.currentBranchId = sanitizedName;
    this.currentVersionIndex = 0; // New branch starts at its first version
    
    // Add a version representing the state at branching, if not already handled by addVersion logic
    // The current content is already in the first version of the new branch by _createBranchLogic
    
    this.timelineRenderer.render();
    this._saveUserPreferences();
  }

  /**
   * Navigates to a specific version in a specific branch.
   * Updates the editor content and the timeline.
   * @param {string} branchId The ID of the branch.
   * @param {number} versionIndex The index of the version.
   */
  navigateToVersion(branchId, versionIndex) {
    const branch = this.branches[branchId];
    if (!branch || !branch.versions[versionIndex]) {
      console.error(`Version not found: ${branchId}[${versionIndex}]`);
      return;
    }
    const version = branch.versions[versionIndex];
    
    this.currentBranchId = branchId;
    this.currentVersionIndex = versionIndex;
    
    this.editorManager.setValue(version.content, true); // true for programmatic change
    
    this.timelineRenderer.render();
    this._saveUserPreferences();
  }

  /**
   * Navigates to the previous version in the history (Undo functionality).
   * May jump to a parent branch if at the beginning of a child branch.
   */
  navigateToPreviousVersion() {
    const currentBranch = this.branches[this.currentBranchId];
    if (!currentBranch) return;

    if (this.currentVersionIndex > 0) {
      this.navigateToVersion(this.currentBranchId, this.currentVersionIndex - 1);
    } else if (currentBranch.parentVersion) {
      // At the beginning of a child branch, jump to parent
      this.navigateToVersion(
        currentBranch.parentVersion.branchId,
        currentBranch.parentVersion.versionIndex
      );
    }
  }

  /**
   * Navigates to the next version in the history (Redo functionality).
   * Only moves within the current branch.
   */
  navigateToNextVersion() {
    const currentBranch = this.branches[this.currentBranchId];
    if (!currentBranch) return;

    if (this.currentVersionIndex < currentBranch.versions.length - 1) {
      this.navigateToVersion(this.currentBranchId, this.currentVersionIndex + 1);
    }
  }
  
  /**
   * Gets a specific branch by its ID.
   * @param {string} branchId The ID of the branch.
   * @returns {({versions: Array<Object>, parentVersion: Object|null}) | undefined} The branch object or undefined.
   */
  getBranch(branchId) {
    return this.branches[branchId];
  }

  /**
   * Gets all branches.
   * @returns {Object<string, {versions: Array<Object>, parentVersion: Object|null}>} All branches.
   */
  getAllBranches() {
    return this.branches;
  }

  /**
   * Replaces all branches with new data, usually from an import.
   * Resets current position to the tip of 'main'.
   * @param {Object} newBranchesData The new branches data.
   */
  replaceAllBranches(newBranchesData) {
    if (typeof newBranchesData !== 'object' || newBranchesData === null) {
        console.error('Invalid data provided for replacing branches.');
        alert('Failed to import: Invalid data structure.');
        return;
    }
    this.branches = newBranchesData;
    // Reset to a sensible default, typically the latest version of 'main'
    this.currentBranchId = 'main';
    if (this.branches.main && this.branches.main.versions.length > 0) {
        this.currentVersionIndex = this.branches.main.versions.length - 1;
    } else {
        // If 'main' is missing or empty, create a basic 'main'
        this.branches.main = {
            versions: [{ id: 0, content: '', timestamp: Date.now(), message: 'Initial version (after import)', type: 'initial' }],
            parentVersion: null
        };
        this.currentVersionIndex = 0;
        this.currentBranchId = 'main'; // Ensure it's set
    }
    // Navigate to the new current version to update editor and UI
    this.navigateToVersion(this.currentBranchId, this.currentVersionIndex);
    // Timeline will be re-rendered by navigateToVersion
    this._saveUserPreferences(); // Save the new state
  }

  /**
   * @private
   * Saves the current branch ID and version index to storage.
   */
  _saveUserPreferences() {
    this.storageManager.saveUserPreferences({
      currentBranchId: this.currentBranchId,
      currentVersionIndex: this.currentVersionIndex
    });
  }

  /**
   * @private
   * Loads user preferences (last active branch/version) and navigates if valid.
   */
  _loadUserPreferences() {
    const prefs = this.storageManager.loadUserPreferences();
    if (prefs && this.branches[prefs.currentBranchId]) {
      const branch = this.branches[prefs.currentBranchId];
      if (branch.versions[prefs.currentVersionIndex]) {
        // Temporarily set current branch/version to avoid issues if navigateToVersion creates a branch
        this.currentBranchId = prefs.currentBranchId;
        this.currentVersionIndex = prefs.currentVersionIndex;
        this.navigateToVersion(prefs.currentBranchId, prefs.currentVersionIndex);
      } else {
        // If specific version is invalid, navigate to tip of stored branch
        this.navigateToVersion(prefs.currentBranchId, branch.versions.length - 1);
      }
    } else if (this.branches.main && this.branches.main.versions.length > 0) {
        // Default to the latest version of main if no valid prefs
        this.navigateToVersion('main', this.branches.main.versions.length - 1);
    }
    // Initial render if not already done by navigation
    this.timelineRenderer.render();
  }
}

// Global configuration (if needed, e.g., for test data)
const CONFIG = {
    // defaultTestDataFile: './text-version-history-sample.json' // Example
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const editorId = 'editor';
  const timelineId = 'timeline-tree'; // This is the ID of the div that will contain the SVG timeline.
  const controlsContainerSelector = '.container'; // Assuming controls go into the main .container

  // Instantiate managers
  const storageManager = new StorageManager();
  
  // The VersionControl instance will be created after EditorManager
  // because EditorManager needs callbacks that might involve the VC instance.
  // However, VC constructor also needs SM. So, slight re-arrangement.
  let versionControl; // Declare here

  const editorManager = new EditorManager(
    editorId,
    (currentContent, previousContent) => { // onKeypress
        if (versionControl) versionControl._handleEditorKeypress(currentContent, previousContent);
    },
    (currentContent) => { // onDeletion
        if (versionControl) versionControl._handleEditorDeletion(currentContent);
    }
  );
  
  // TimelineRenderer needs versionControl for data, but VC's _loadUserPreferences calls timelineRenderer.render()
  // This creates a cyclic dependency during construction.
  // We can pass VC later or make TimelineRenderer's constructor not immediately call render.
  // For now, let's initialize VC first, then TR, then connect them.
  
  // Create VersionControl, passing the already created managers it directly needs
  versionControl = new VersionControl(editorManager, null, storageManager); // Pass null for timelineRenderer initially

  // Now create TimelineRenderer and UIManager, passing the versionControl instance
  const timelineRenderer = new TimelineRenderer(timelineId, versionControl);
  
  // Assign the timelineRenderer to versionControl now that both are created
  versionControl.timelineRenderer = timelineRenderer;
  
  const uiManager = new UIManager(versionControl, timelineRenderer, storageManager);

  // Initialize UI components and managers
  uiManager.initKeyboardShortcuts();
  uiManager.initDragListeners(); // For timeline dragging
  uiManager.setupUIControls(controlsContainerSelector);
  
  // Manually trigger initial load/render sequence for VersionControl after all dependencies are set.
  // _loadUserPreferences is called in VC constructor, which calls navigateToVersion, which calls timelineRenderer.render.
  // If timelineRenderer was not set on VC yet, that call would fail.
  // By setting it after VC construction but before any user interaction, it should be fine.
  // A call to render here ensures the timeline is drawn based on initial state.
  versionControl._loadUserPreferences(); // This will also trigger a render if preferences are found and navigation occurs.
                                         // If no prefs, it defaults and calls render.

  // Load test data if configured (for development)
  if (CONFIG && CONFIG.defaultTestDataFile) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || 
        window.location.search.includes('loadTestData=true')) {
      fetch(CONFIG.defaultTestDataFile)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load test data: ${response.status} ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          const imported = storageManager.importHistory(JSON.stringify(data)); // Use stringify if data is already object
          if (imported) {
            versionControl.replaceAllBranches(imported);
          }
          console.log(`Loaded test data from ${CONFIG.defaultTestDataFile}`);
        })
        .catch(error => {
          console.warn(`Error loading test data: ${error.message}`);
        });
    }
  }
});
})();
