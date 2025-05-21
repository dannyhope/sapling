/**
 * Text Version Control System
 * 
 * Features:
 * - Records every single keypress in a textarea
 * - Visualizes timeline as an interactive tree with tiny markers for each edit
 * - Supports branching when editing from a previous point
 * - Allows navigation through version history
 */

class VersionControl {
  constructor(editorId, timelineId) {
    // DOM elements
    this.editor = document.getElementById(editorId);
    this.timelineEl = document.getElementById(timelineId);
    
    // Version control data structures
    this.currentBranchId = 'main';
    this.branches = {
      main: {
        versions: [{ id: 0, content: '', timestamp: Date.now(), message: 'Initial version', type: 'initial' }],
        parentVersion: null
      }
    };
    this.currentVersionIndex = 0;
    this.isEditing = false;
    this.isDragging = false;
    this.dragTarget = null;
    
    // Track previous content for keypress detection
    this.previousContent = '';
    
    // Initialize
    this.initEventListeners();
    this.renderTimeline();
    
    // Store user's last active branch
    this.loadUserPreferences();
  }
  
  initEventListeners() {
    // Record every keypress
    this.editor.addEventListener('input', (e) => {
      this.recordKeypress(e);
    });
    
    // Special handling for deletions
    this.editor.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.recordDeletion(e.key);
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleShortcuts(e);
    });
    
    // Set up drag events on document
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Prevent any hover effects on the timeline container
    this.timelineEl.addEventListener('mouseover', (e) => {
      if (!this.isDragging) {
        e.stopPropagation();
      }
    });
  }
  
  recordKeypress(event) {
    const currentContent = this.editor.value;
    
    // Don't record if we're programmatically changing the content
    if (this.isEditing) {
      return;
    }
    
    // Determine if it's an addition
    if (currentContent.length > this.previousContent.length) {
      // It's an addition
      this.addVersion('keypress', currentContent);
    }
    
    this.previousContent = currentContent;
  }
  
  recordDeletion(key) {
    const currentContent = this.editor.value;
    
    // Don't record if we're programmatically changing the content
    if (this.isEditing) {
      return;
    }
    
    // Only record if content actually changed (deletion happened)
    setTimeout(() => {
      if (this.editor.value.length < this.previousContent.length) {
        this.addVersion('deletion', this.editor.value);
        this.previousContent = this.editor.value;
      }
    }, 0);
  }
  
  addVersion(type, content) {
    const currentBranch = this.branches[this.currentBranchId];
    
    // If we're not at the tip of the branch, create a new branch
    if (this.currentVersionIndex < currentBranch.versions.length - 1) {
      const newBranchId = `branch-${Date.now()}`;
      this.createBranch(newBranchId, this.currentBranchId, this.currentVersionIndex);
      this.currentBranchId = newBranchId;
      this.currentVersionIndex = 0;
    }
    
    // Add the new version
    currentBranch.versions.push({
      id: currentBranch.versions.length,
      content: content,
      timestamp: Date.now(),
      message: type === 'keypress' ? 'Added character' : 'Deleted character',
      type: type
    });
    
    this.currentVersionIndex = currentBranch.versions.length - 1;
    this.renderTimeline();
    this.saveUserPreferences();
  }
  
  createBranch(branchId, parentBranchId, parentVersionIndex) {
    const parentBranch = this.branches[parentBranchId];
    const parentVersion = parentBranch.versions[parentVersionIndex];
    
    this.branches[branchId] = {
      versions: [{
        id: 0,
        content: this.editor.value,
        timestamp: Date.now(),
        message: `Branched from ${parentBranchId} at version ${parentVersionIndex}`,
        type: 'branch'
      }],
      parentVersion: {
        branchId: parentBranchId,
        versionIndex: parentVersionIndex
      }
    };
  }
  
  createNamedBranch(branchName) {
    // Sanitize branch name
    const sanitizedName = branchName.replace(/[^a-zA-Z0-9-_]/g, '-');
    this.createBranch(sanitizedName, this.currentBranchId, this.currentVersionIndex);
    this.currentBranchId = sanitizedName;
    this.currentVersionIndex = 0;
    this.renderTimeline();
    this.saveUserPreferences();
  }
  
  navigateToVersion(branchId, versionIndex) {
    const branch = this.branches[branchId];
    const version = branch.versions[versionIndex];
    
    this.isEditing = true;
    this.currentBranchId = branchId;
    this.currentVersionIndex = versionIndex;
    this.editor.value = version.content;
    this.previousContent = version.content;
    this.isEditing = false;
    
    this.renderTimeline();
    this.saveUserPreferences();
  }
  
  navigateToPreviousVersion() {
    const currentBranch = this.branches[this.currentBranchId];
    
    if (this.currentVersionIndex > 0) {
      this.navigateToVersion(this.currentBranchId, this.currentVersionIndex - 1);
    } else if (currentBranch.parentVersion) {
      // Go to parent branch's version if we're at the start of a branch
      this.navigateToVersion(
        currentBranch.parentVersion.branchId,
        currentBranch.parentVersion.versionIndex
      );
    }
  }
  
  navigateToNextVersion() {
    const currentBranch = this.branches[this.currentBranchId];
    
    if (this.currentVersionIndex < currentBranch.versions.length - 1) {
      this.navigateToVersion(this.currentBranchId, this.currentVersionIndex + 1);
    }
  }
  
  renderTimeline() {
    this.timelineEl.innerHTML = '';
    
    // Create a fixed-size container div
    const timelineContainer = document.createElement('div');
    timelineContainer.style.position = 'relative';
    timelineContainer.style.height = '100px';
    timelineContainer.style.width = '100%';
    timelineContainer.style.overflow = 'hidden';
    
    // Create SVG element for the timeline with fixed dimensions
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100");
    svg.setAttribute("viewBox", "0 0 1000 100");
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.style.pointerEvents = 'none';
    
    // Create a group for all timeline elements
    const timelineGroup = document.createElementNS(svgNS, "g");
    timelineGroup.setAttribute("transform", "translate(10, 50)");
    svg.appendChild(timelineGroup);
    
    // Calculate positions and render the timeline
    this.renderSVGTimeline(timelineGroup);
    
    timelineContainer.appendChild(svg);
    this.timelineEl.appendChild(timelineContainer);
    
    // Add keyboard shortcuts info
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
  
  renderSVGTimeline(parentGroup) {
    const svgNS = "http://www.w3.org/2000/svg";
    const nodeSize = 2; // Size of keypress nodes
    const nodeSpacing = 3; // Horizontal spacing between nodes
    const branchSpacing = 15; // Vertical spacing between branches
    
    // Create a map to store positions of each node for connections
    this.nodePositions = {};
    
    // Process branches to calculate total nodes and structure
    let branchStructure = this.calculateBranchStructure();
    
    // Count the actual branches that will be rendered (not just the data structure)
    let visibleBranchCount = 0;
    const countVisibleBranches = (branchId, structure) => {
      visibleBranchCount++;
      const childBranches = structure.childBranches[branchId] || [];
      childBranches.forEach(childId => {
        countVisibleBranches(childId, structure);
      });
    };
    countVisibleBranches('main', branchStructure);
    
    // Calculate the total height needed based on visible branches
    const totalHeight = Math.max(100, visibleBranchCount * branchSpacing + 50);
    
    // Update the SVG and container height
    const svg = parentGroup.ownerSVGElement;
    svg.setAttribute("height", totalHeight);
    svg.setAttribute("viewBox", `0 0 1000 ${totalHeight}`);
    
    // Update container heights
    if (svg.parentElement) {
      svg.parentElement.style.height = `${totalHeight}px`;
    }
    
    // Update the timeline tree container height - always grow to fit content
    const timelineTree = document.getElementById('timeline-tree');
    if (timelineTree) {
      timelineTree.style.height = `${totalHeight}px`;
      // No max height - let it grow as needed
      timelineTree.style.overflowY = 'visible';
      timelineTree.style.overflowX = 'hidden';
    }
    
    // Center the initial transform based on height
    parentGroup.setAttribute("transform", `translate(10, ${Math.min(50, totalHeight/4)})`);
    
    // Render each branch
    let yOffset = 0;
    this.renderSVGBranch(parentGroup, 'main', 0, yOffset, nodeSize, nodeSpacing, branchSpacing, branchStructure);
    
    // Render connections between branches after all nodes are positioned
    this.renderBranchConnections(parentGroup);
  }
  
  calculateBranchStructure() {
    // Map to store branch structure information
    let branchStructure = {
      branchDepths: {}, // Depth of each branch (how nested it is)
      childBranches: {}, // Child branches for each branch
      branchParents: {}, // Parent branch and version for each branch
      branchLengths: {}, // Number of visible nodes in each branch
      branchPoints: {} // Points where branches split off
    };
    
    // Calculate branch depths (how nested each branch is)
    const calculateBranchDepth = (branchId, depth = 0) => {
      branchStructure.branchDepths[branchId] = depth;
      
      // Find all child branches
      const childBranches = [];
      Object.entries(this.branches).forEach(([childId, childBranch]) => {
        if (childBranch.parentVersion && childBranch.parentVersion.branchId === branchId) {
          childBranches.push(childId);
          branchStructure.branchParents[childId] = {
            parentBranchId: branchId,
            parentVersionIndex: childBranch.parentVersion.versionIndex
          };
          calculateBranchDepth(childId, depth + 1);
        }
      });
      
      branchStructure.childBranches[branchId] = childBranches;
    };
    
    // Start with main branch
    calculateBranchDepth('main');
    
    // Calculate branch lengths (number of visible nodes)
    Object.keys(this.branches).forEach(branchId => {
      const branch = this.branches[branchId];
      let visibleNodes = 0;
      
      branch.versions.forEach(version => {
        if (version.type === 'keypress' || version.type === 'deletion') {
          visibleNodes++;
        }
      });
      
      branchStructure.branchLengths[branchId] = visibleNodes;
    });
    
    // Calculate branch points
    Object.keys(branchStructure.branchParents).forEach(branchId => {
      const parentInfo = branchStructure.branchParents[branchId];
      const parentBranch = this.branches[parentInfo.parentBranchId];
      
      // Count visible nodes up to the parent version
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
  
  renderSVGBranch(parentGroup, branchId, xOffset, yOffset, nodeSize, nodeSpacing, branchSpacing, branchStructure) {
    const svgNS = "http://www.w3.org/2000/svg";
    const branch = this.branches[branchId];
    
    // Create a group for this branch
    const branchGroup = document.createElementNS(svgNS, "g");
    branchGroup.setAttribute("transform", `translate(${xOffset}, ${yOffset})`);
    branchGroup.setAttribute("data-branch-id", branchId);
    parentGroup.appendChild(branchGroup);
    
    // Render nodes for this branch
    let currentX = 0;
    let visibleNodeIndex = 0;
    
    branch.versions.forEach((version, index) => {
      // Skip nodes that aren't keypresses or deletions
      if (version.type !== 'keypress' && version.type !== 'deletion') {
        return;
      }
      
      // Create node element based on type
      let node;
      if (version.type === 'keypress') {
        // Square for keypress
        node = document.createElementNS(svgNS, "rect");
        node.setAttribute("x", currentX);
        node.setAttribute("y", -nodeSize/2);
        node.setAttribute("width", nodeSize);
        node.setAttribute("height", nodeSize);
        node.setAttribute("fill", "rgba(0,0,0,0.75)"); // Semi-transparent black dots
      } else {
        // X mark for deletion
        node = document.createElementNS(svgNS, "g");
        node.setAttribute("transform", `translate(${currentX}, 0)`);
        
        // Create X using two lines
        const line1 = document.createElementNS(svgNS, "line");
        line1.setAttribute("x1", -nodeSize/2);
        line1.setAttribute("y1", -nodeSize/2);
        line1.setAttribute("x2", nodeSize/2);
        line1.setAttribute("y2", nodeSize/2);
        line1.setAttribute("stroke", "rgba(0,0,0,0.75)"); // Semi-transparent black lines
        line1.setAttribute("stroke-width", "0.5");
        
        const line2 = document.createElementNS(svgNS, "line");
        line2.setAttribute("x1", -nodeSize/2);
        line2.setAttribute("y1", nodeSize/2);
        line2.setAttribute("x2", nodeSize/2);
        line2.setAttribute("y2", -nodeSize/2);
        line2.setAttribute("stroke", "rgba(0,0,0,0.75)"); // Semi-transparent black lines
        line2.setAttribute("stroke-width", "0.5");
        
        node.appendChild(line1);
        node.appendChild(line2);
      }
      
      // Highlight current version
      if (branchId === this.currentBranchId && index === this.currentVersionIndex) {
        if (version.type === 'keypress') {
          // Make active keypress node larger and solid green
          node.setAttribute("width", nodeSize * 2.5);
          node.setAttribute("height", nodeSize * 2.5);
          node.setAttribute("x", currentX - nodeSize * 0.75);
          node.setAttribute("y", -nodeSize * 1.25);
          node.setAttribute("fill", "#00B400"); // Green for active keypress
        } else {
          // Make active deletion X larger and red
          node.querySelectorAll("line").forEach(line => {
            line.setAttribute("stroke", "#E4003D"); // Red for active deletion
            line.setAttribute("stroke-width", "1.5");
            
            // Scale the lines to make the X larger
            if (line.getAttribute("x1") === "-1") {
              line.setAttribute("x1", -nodeSize);
              line.setAttribute("y1", -nodeSize);
              line.setAttribute("x2", nodeSize);
              line.setAttribute("y2", nodeSize);
            } else {
              line.setAttribute("x1", -nodeSize);
              line.setAttribute("y1", nodeSize);
              line.setAttribute("x2", nodeSize);
              line.setAttribute("y2", -nodeSize);
            }
          });
        }
      }
      
      // Store node position for connections
      this.nodePositions[`${branchId}-${index}`] = {
        x: currentX + xOffset,
        y: yOffset,
        type: version.type
      };
      
      // Add click event
      node.addEventListener("click", () => {
        this.navigateToVersion(branchId, index);
      });
      
      // Create a transparent hit area for better click/drag handling
      const hitArea = document.createElementNS(svgNS, "rect");
      hitArea.setAttribute("x", currentX - 5);
      hitArea.setAttribute("y", -15);
      hitArea.setAttribute("width", 10);
      hitArea.setAttribute("height", 30);
      hitArea.setAttribute("fill", "transparent");
      hitArea.style.pointerEvents = 'all';
      hitArea.classList.add('node-hit-area');
      
      // Make the hit area draggable
      hitArea.addEventListener('mousedown', (e) => {
        // Prevent text selection during drag
        e.preventDefault();
        e.stopPropagation();
        
        this.isDragging = true;
        this.dragTarget = {
          branchId: branchId,
          startIndex: index,
          currentIndex: index,
          element: node,
          startX: e.clientX
        };
        
        // Add dragging class to cursor
        document.body.style.cursor = 'ew-resize';
      });
      
      // Add a title to show this is draggable
      hitArea.setAttribute('title', 'Drag to navigate through versions');
      
      // Add the hit area to the branch group before the node
      branchGroup.appendChild(hitArea);
      
      // Make sure the node doesn't receive pointer events
      node.style.pointerEvents = 'none';
      node.classList.add('node');
      
      // Add node to branch group
      branchGroup.appendChild(node);
      
      // Move to next position
      currentX += nodeSize + nodeSpacing;
      visibleNodeIndex++;
    });
    
    // Recursively render child branches
    const childBranches = branchStructure.childBranches[branchId] || [];
    let childYOffset = yOffset + branchSpacing;
    
    childBranches.forEach(childId => {
      // Calculate x offset based on branch point
      const branchPointIndex = branchStructure.branchPoints[childId];
      const childXOffset = branchPointIndex * (nodeSize + nodeSpacing);
      
      this.renderSVGBranch(
        parentGroup, 
        childId, 
        xOffset + childXOffset, 
        childYOffset, 
        nodeSize, 
        nodeSpacing, 
        branchSpacing, 
        branchStructure
      );
      
      childYOffset += branchSpacing;
    });
  }
  
  renderBranchConnections(parentGroup) {
    const svgNS = "http://www.w3.org/2000/svg";
    
    // Remove any existing connections first
    const existingConnections = parentGroup.querySelector('.branch-connections');
    if (existingConnections) {
      parentGroup.removeChild(existingConnections);
    }
    
    // Create a new group for all connections
    const connectionsGroup = document.createElementNS(svgNS, "g");
    connectionsGroup.setAttribute("class", "branch-connections");
    parentGroup.insertBefore(connectionsGroup, parentGroup.firstChild); // Add to back
    
    // Draw debug rectangle to make sure the connections group is visible
    const debugRect = document.createElementNS(svgNS, "rect");
    debugRect.setAttribute("x", 0);
    debugRect.setAttribute("y", 0);
    debugRect.setAttribute("width", 5);
    debugRect.setAttribute("height", 5);
    debugRect.setAttribute("fill", "red");
    connectionsGroup.appendChild(debugRect);
    
    // Process each branch except main
    Object.keys(this.branches).forEach(branchId => {
      if (branchId === 'main') return; // Skip main branch
      
      const branch = this.branches[branchId];
      if (!branch.parentVersion) return;
      
      const parentBranchId = branch.parentVersion.branchId;
      const parentVersionIndex = branch.parentVersion.versionIndex;
      
      // Find the first visible node in this branch
      let childNodeIndex = -1;
      for (let i = 0; i < branch.versions.length; i++) {
        if (branch.versions[i].type === 'keypress' || branch.versions[i].type === 'deletion') {
          childNodeIndex = i;
          break;
        }
      }
      
      if (childNodeIndex === -1) return; // No visible nodes in this branch
      
      // Get parent and child positions
      const parentKey = `${parentBranchId}-${parentVersionIndex}`;
      const childKey = `${branchId}-${childNodeIndex}`;
      
      // Validate positions exist
      if (!this.nodePositions[parentKey] || !this.nodePositions[childKey]) {
        console.warn(`Missing positions for branch connection: ${parentKey} -> ${childKey}`);
        return;
      }
      
      const parentPos = this.nodePositions[parentKey];
      const childPos = this.nodePositions[childKey];
      
      // Draw a path for the connection
      const path = document.createElementNS(svgNS, "path");
      
      // Calculate control points for a smooth curve
      const midY = (parentPos.y + childPos.y) / 2;
      const pathData = `M ${parentPos.x+1},${parentPos.y} ` + // Move to parent
                     `L ${parentPos.x+1},${midY} ` +         // Vertical line to midpoint
                     `L ${childPos.x},${childPos.y}`;        // Line to child
      
      path.setAttribute("d", pathData);
      path.setAttribute("stroke", "#0C679C"); // Use blue for branches
      path.setAttribute("stroke-width", "2"); // Make it thicker
      path.setAttribute("fill", "none");
      path.setAttribute("pointer-events", "none");
      
      // Add the path to the connections group
      connectionsGroup.appendChild(path);
      
      // Create small circles at the junction points
      const junctionPoint = document.createElementNS(svgNS, "circle");
      junctionPoint.setAttribute("cx", parentPos.x+1);
      junctionPoint.setAttribute("cy", midY);
      junctionPoint.setAttribute("r", 2);
      junctionPoint.setAttribute("fill", "#0C679C");
      connectionsGroup.appendChild(junctionPoint);
      
      // Create a label for the branch
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", childPos.x + 3);
      label.setAttribute("y", childPos.y - 5);
      label.setAttribute("font-size", "8px");
      label.setAttribute("fill", "#0C679C");
      label.textContent = branchId.replace('branch-', '');
      connectionsGroup.appendChild(label);
    });
  }
  
  // Handle keyboard shortcuts
  handleShortcuts(event) {
    // Undo: Ctrl/Cmd + Z
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.navigateToPreviousVersion();
    }
    
    // Redo: Ctrl/Cmd + Shift + Z
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
      event.preventDefault();
      this.navigateToNextVersion();
    }
    
    // Create branch: Ctrl/Cmd + B
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      const branchName = prompt('Enter a name for the new branch:');
      if (branchName) {
        this.createNamedBranch(branchName);
      }
    }
  }
  
  // Drag handling methods
  handleMouseMove(event) {
    if (!this.isDragging || !this.dragTarget) return;
    
    // Calculate how far we've dragged horizontally
    const deltaX = event.clientX - this.dragTarget.startX;
    
    // Determine how many versions to move (1 version per 5px)
    const versionDelta = Math.floor(deltaX / 5);
    
    // Get the branch
    const branch = this.branches[this.dragTarget.branchId];
    if (!branch) return;
    
    // Find all visible nodes (keypresses and deletions)
    const visibleNodes = [];
    branch.versions.forEach((version, index) => {
      if (version.type === 'keypress' || version.type === 'deletion') {
        visibleNodes.push(index);
      }
    });
    
    // Find the visible node index of the start index
    const startVisibleIndex = visibleNodes.indexOf(this.dragTarget.startIndex);
    if (startVisibleIndex === -1) return;
    
    // Calculate the new visible index
    const newVisibleIndex = Math.max(0, Math.min(visibleNodes.length - 1, startVisibleIndex + versionDelta));
    
    // Get the actual version index
    const newVersionIndex = visibleNodes[newVisibleIndex];
    
    // Only update if the index changed
    if (newVersionIndex !== this.dragTarget.currentIndex) {
      this.dragTarget.currentIndex = newVersionIndex;
      this.navigateToVersion(this.dragTarget.branchId, newVersionIndex);
    }
  }
  
  handleMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragTarget = null;
      document.body.style.cursor = 'auto';
      
      // Force a re-render to ensure everything is in the right place
      this.renderTimeline();
    }
  }
  
  saveUserPreferences() {
    localStorage.setItem('textVersionControl', JSON.stringify({
      currentBranchId: this.currentBranchId,
      currentVersionIndex: this.currentVersionIndex
    }));
  }
  
  loadUserPreferences() {
    try {
      const prefs = JSON.parse(localStorage.getItem('textVersionControl'));
      if (prefs && this.branches[prefs.currentBranchId]) {
        const branch = this.branches[prefs.currentBranchId];
        if (branch.versions[prefs.currentVersionIndex]) {
          this.navigateToVersion(prefs.currentBranchId, prefs.currentVersionIndex);
        }
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
  }
  
  // Export version history
  exportHistory() {
    const data = JSON.stringify(this.branches);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `text-version-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  // Import version history
  importHistory(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      this.branches = data;
      this.currentBranchId = 'main';
      this.currentVersionIndex = this.branches.main.versions.length - 1;
      this.navigateToVersion(this.currentBranchId, this.currentVersionIndex);
    } catch (e) {
      console.error('Failed to import history:', e);
      alert('Invalid history file');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const versionControl = new VersionControl('editor', 'timeline-tree');
  
  // Check if we should load test data (for development purposes)
  if (CONFIG && CONFIG.defaultTestDataFile) {
    // Only load test data if in development mode or explicitly requested
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
          versionControl.importHistory(data);
          console.log(`Loaded test data from ${CONFIG.defaultTestDataFile}`);
        })
        .catch(error => {
          console.warn(`Error loading test data: ${error.message}`);
        });
    }
  }
  
  // Add export/import buttons
  const container = document.querySelector('.container');
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'controls';
  controlsDiv.style.marginTop = '20px';
  
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export History';
  exportBtn.addEventListener('click', () => versionControl.exportHistory());
  
  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import History';
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          versionControl.importHistory(event.target.result);
        };
        reader.readAsText(file);
      }
    });
    input.click();
  });
  
  controlsDiv.appendChild(exportBtn);
  controlsDiv.appendChild(document.createTextNode(' '));
  controlsDiv.appendChild(importBtn);
  
  // Add build time
  const buildTimeDiv = document.createElement('div');
  buildTimeDiv.className = 'build-info';
  buildTimeDiv.style.fontSize = '12px';
  buildTimeDiv.style.color = '#616E73';
  buildTimeDiv.style.marginTop = '30px';
  buildTimeDiv.textContent = `Last built on Friday the 4th of April, 2025 at 4:41PM`;
  
  // Add feedback link
  const feedbackLink = document.createElement('a');
  feedbackLink.href = 'https://github.com/dannyhope/sapling/issues/new/choose';
  feedbackLink.textContent = 'Submit feedback';
  feedbackLink.style.fontSize = '12px';
  feedbackLink.style.marginLeft = '15px';
  feedbackLink.style.color = '#0C679C';
  buildTimeDiv.appendChild(feedbackLink);
  
  container.appendChild(controlsDiv);
  container.appendChild(buildTimeDiv);
});
