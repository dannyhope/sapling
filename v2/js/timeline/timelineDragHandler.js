import { TIMELINE_CONSTANTS } from './timelineConstants.js';

/**
 * @class TimelineDragHandler
 * @description Handles drag-and-drop interactions on the timeline for navigating versions.
 */
export class TimelineDragHandler {
  /**
   * Creates a TimelineDragHandler instance.
   * @param {import('../versionControl.js').VersionControl} versionControl - The main version control instance.
   * @param {TimelineManager} timelineManager - The main TimelineManager instance (to access isDragging, dragTarget).
   */
  constructor(versionControl, timelineManager) {
    this.versionControl = versionControl;
    this.timelineManager = timelineManager; // To access isDragging, dragTarget, etc.
  }

  /**
   * Handles the 'mousedown' event on a timeline node's hit area.
   * Initiates the dragging process by setting up the drag target and state.
   * This method is typically called by a renderer (e.g., TimelineNodeRenderer) when a node is clicked.
   * @param {MouseEvent} event - The mousedown event.
   * @param {string} branchId - The ID of the branch containing the clicked node.
   * @param {number} transactionIndex - The transaction index of the state associated with the clicked node (-1 for initial).
   * @param {SVGElement} nodeElement - The visual SVG node element (circle) that was clicked (via its hit area).
   */
  handleNodeMouseDown(event, branchId, transactionIndex, nodeElement) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.versionControl) return;

    this.timelineManager.isDragging = true;
    const branchData = this.versionControl.getBranchData(branchId);
    if (!branchData) {
      this.timelineManager.isDragging = false;
      return;
    }

    const draggableIndices = [-1, ...branchData.transactions.map((_, i) => i)];
    const currentDragStartIndexOnList = draggableIndices.indexOf(transactionIndex);

    this.timelineManager.dragTarget = {
      branchId: branchId,
      currentBranchDraggableIndices: draggableIndices,
      currentDragStartIndexOnList: currentDragStartIndexOnList,
      currentDragListIndex: currentDragStartIndexOnList,
      element: nodeElement,
      startX: event.clientX,
    };
    document.body.style.cursor = TIMELINE_CONSTANTS.CURSOR_EW_RESIZE;
  }

  /**
   * Handles global 'mousemove' events during a drag operation on the timeline.
   * Calculates the new target version based on mouse movement and instructs
   * VersionControl to switch to it if it has changed.
   * @param {MouseEvent} event - The mousemove event.
   */
  handleDragMove(event) {
    if (!this.timelineManager.isDragging || !this.timelineManager.dragTarget || !this.versionControl) return;

    const deltaX = event.clientX - this.timelineManager.dragTarget.startX;
    const versionDelta = Math.floor(deltaX / TIMELINE_CONSTANTS.NODE_SPACING);

    const draggableIndices = this.timelineManager.dragTarget.currentBranchDraggableIndices;
    if (!draggableIndices || draggableIndices.length === 0) return;

    let newDragListIndex = this.timelineManager.dragTarget.currentDragStartIndexOnList + versionDelta;
    newDragListIndex = Math.max(0, Math.min(draggableIndices.length - 1, newDragListIndex));

    if (newDragListIndex !== this.timelineManager.dragTarget.currentDragListIndex) {
      this.timelineManager.dragTarget.currentDragListIndex = newDragListIndex;
      const targetTransactionIndex = draggableIndices[newDragListIndex];
      
      if (targetTransactionIndex !== undefined) {
        this.versionControl.switchToVersion(this.timelineManager.dragTarget.branchId, targetTransactionIndex);
      }
    }
  }

  /**
   * Handles global 'mouseup' events to conclude a drag operation on the timeline.
   * Finalizes the version switch if a drag occurred and resets dragging state.
   * @param {MouseEvent} event - The mouseup event.
   */
  handleDragEnd(event) {
    if (this.timelineManager.isDragging) {
      this.timelineManager.isDragging = false;
      if (this.timelineManager.dragTarget && this.versionControl) {
        const finalBranchId = this.timelineManager.dragTarget.branchId;
        const finalTransactionIndex = this.timelineManager.dragTarget.currentBranchDraggableIndices[this.timelineManager.dragTarget.currentDragListIndex];
        if (finalTransactionIndex !== undefined) {
            this.versionControl.switchToVersion(finalBranchId, finalTransactionIndex);
        }
      }
      this.timelineManager.dragTarget = null;
      document.body.style.cursor = TIMELINE_CONSTANTS.CURSOR_AUTO;
    }
  }
} 