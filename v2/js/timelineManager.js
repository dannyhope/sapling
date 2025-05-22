import { TIMELINE_CONSTANTS } from './timeline/timelineConstants.js';
import { TimelineSvgManager } from './timeline/timelineSvgManager.js';
import { TimelineBranchRenderer } from './timeline/timelineBranchRenderer.js';
import { TimelineNodeRenderer } from './timeline/timelineNodeRenderer.js';
import { TimelineConnectionRenderer } from './timeline/timelineConnectionRenderer.js';
import { TimelineDragHandler } from './timeline/timelineDragHandler.js';
import { TimelineUtils } from './timeline/timelineUtils.js';
import { TimelineEventHandler } from './timeline/timelineEventHandler.js';

/**
 * @class TimelineManager
 * @description Manages the visualization and interaction with version history timeline
 */
export class TimelineManager {
  // static SVG_NS = "http://www.w3.org/2000/svg"; // Moved to TIMELINE_CONSTANTS or not needed if SvgManager handles it

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
    this.versionControl = versionControl; // Will be null initially, set later from app.js
    this.svgManager = new TimelineSvgManager(this.timelineContainerEl);

    this._nodePositions = {}; 
    this.isDragging = false; // Managed by TimelineDragHandler, but TimelineManager might need to know state
    this.dragTarget = null;  // Managed by TimelineDragHandler

    this._branchConnectionsGroup = null; 
    this._branchNodesGroup = null; 
    this._branchLabelsGroup = null;
    // this._maxRenderedXForViewBox = 0; // Now managed by branch/node renderers and passed to SvgManager
    // this._maxRenderedYForViewBox = 0; // Ditto

    // Initialize sub-components to null, they will be created in initializeDependentComponents
    this.dragHandler = null;
    this.nodeRenderer = null;
    this.branchRenderer = null;
    this.connectionRenderer = null;
    this.eventHandler = null; // Added TimelineEventHandler property

    this._resizeObserver = new ResizeObserver(() => {
      // Guard to ensure components are initialized and timeline is visible
      if (this.versionControl && this.branchRenderer && this.nodeRenderer && this.connectionRenderer && this.timelineContainerEl.offsetParent !== null) {
        this.render();
      }
    });
    this._resizeObserver.observe(this.timelineContainerEl);
  }

  /**
   * Initializes sub-components that depend on VersionControl.
   * This method should be called after `this.versionControl` has been set.
   */
  initializeDependentComponents() {
    if (!this.versionControl) {
      console.error("TimelineManager: Cannot initialize dependent components because VersionControl is not set.");
      return;
    }

    this.dragHandler = new TimelineDragHandler(this.versionControl, this);
    this.nodeRenderer = new TimelineNodeRenderer(
      this.versionControl,
      this._nodePositions,
      TimelineUtils.parseTransform,
      null // Placeholder for onNodeMouseDownCallback, as TimelineEventHandler will manage this.
    );
    this.branchRenderer = new TimelineBranchRenderer(
      this.versionControl,
      this._nodePositions,
      null, // branchLabelsGroup (set in render)
      null, // branchNodesGroup (set in render)
      TimelineUtils.parseTransform,
      this.nodeRenderer
    );
    this.branchRenderer.nodeRenderer = this.nodeRenderer; // Explicitly set after construction

    this.connectionRenderer = new TimelineConnectionRenderer(
      this.versionControl,
      this._nodePositions,
      null // branchConnectionsGroup (set in render)
    );

    // Initialize TimelineEventHandler after DragHandler is available
    this.eventHandler = new TimelineEventHandler(this.timelineContainerEl, this, this.dragHandler);
    this.eventHandler.initializeEventListeners(); // TimelineEventHandler sets up its own listeners (incl. resize)
  }

  /**
   * Renders the version history timeline.
   */
  render() {
    if (!this.versionControl || !this.svgManager || !this.branchRenderer || !this.nodeRenderer || !this.connectionRenderer || !this.eventHandler) {
      // console.warn("TimelineManager.render() called before critical components are initialized or VersionControl is set.");
      return;
    }
    
    this.svgManager.clearTimeline();
    this._nodePositions = {}; 
    
    const svg = this.svgManager.createSvgCanvas();
    const mainTimelineGroup = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "g");
    mainTimelineGroup.setAttribute("id", TIMELINE_CONSTANTS.MAIN_TIMELINE_GROUP_ID);
    svg.appendChild(mainTimelineGroup);

    this._branchConnectionsGroup = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "g");
    this._branchConnectionsGroup.setAttribute("id", TIMELINE_CONSTANTS.BRANCH_CONNECTIONS_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchConnectionsGroup);
    // Update connectionRenderer with the group
    this.connectionRenderer._branchConnectionsGroup = this._branchConnectionsGroup;

    this._branchNodesGroup = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "g");
    this._branchNodesGroup.setAttribute("id", TIMELINE_CONSTANTS.BRANCH_NODES_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchNodesGroup);

    this._branchLabelsGroup = document.createElementNS(TIMELINE_CONSTANTS.SVG_NS, "g");
    this._branchLabelsGroup.setAttribute("id", TIMELINE_CONSTANTS.BRANCH_LABELS_GROUP_ID);
    mainTimelineGroup.appendChild(this._branchLabelsGroup);
    
    this.branchRenderer._branchLabelsGroup = this._branchLabelsGroup;
    this.branchRenderer._branchNodesGroup = this._branchNodesGroup;

    const branchRenderData = this.branchRenderer.renderBranches(mainTimelineGroup);
    this.connectionRenderer.renderBranchConnections();
    
    this.svgManager.adjustSvgViewbox(mainTimelineGroup, branchRenderData.maxXForViewBox, branchRenderData.maxYForViewBox);
  }
  
  /**
   * Provides information about a node based on a mousedown event target.
   * Used by TimelineEventHandler to get details for drag initiation.
   * @param {MouseEvent} event - The mousedown event.
   * @returns {{branchId: string, transactionIndex: number, nodeElement: SVGElement} | null} Node info or null.
   */
  getNodeInfoFromEvent(event) {
    const hitArea = event.target.closest('.timeline-node-hit-area');
    if (!hitArea) return null;

    // Attempt to find the visual node. This depends on DOM structure set by TimelineNodeRenderer.
    // Assumption: hitArea is a sibling to the visual node, or visual node is a specific child/sibling.
    // Let's assume the hitArea's parent group also contains the .timeline-node circle.
    const visualNode = hitArea.parentElement?.querySelector('.timeline-node'); 

    if (visualNode && visualNode.dataset.compositeKey) {
        const [branchId, indexStr] = visualNode.dataset.compositeKey.split('_');
        const transactionIndex = parseInt(indexStr, 10);
        if (branchId && !isNaN(transactionIndex)) {
            return { branchId, transactionIndex, nodeElement: visualNode };
        }
    }
    console.warn("Could not extract node info from event", event.target);
    return null;
  }

  // Methods like isDragging() for TimelineDragHandler are now accessed directly 
  // by TimelineEventHandler if needed, or managed internally by TimelineDragHandler.
  // TimelineManager's role is less about direct event state and more about orchestration.

  /**
   * Gets the current dragging state from the DragHandler.
   * Useful for other components if they need to know if a drag is active.
   * @returns {boolean} True if a timeline drag is in progress.
   */
  isTimelineDragging() {
    return this.dragHandler ? this.dragHandler.isDragging() : false;
  }
} 