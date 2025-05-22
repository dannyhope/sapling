/**
 * @file eventHandler.js
 * @description Manages event handling for timeline components, centralizing DOM event
 *              listeners and interactions for the timeline.
 */

import { TIMELINE_CONSTANTS } from './timelineConstants.js'; // May need TIMELINE_CONSTANTS

/**
 * @class EventHandler
 * @description Handles timeline-specific DOM event listening and dispatching.
 */
export class EventHandler {
  /**
   * Creates an EventHandler instance.
   * @param {HTMLElement} timelineContainerEl - The main container element for the timeline SVG.
   * @param {import('../timelineManager.js').TimelineManager} timelineManager - The TimelineManager instance.
   * @param {import('./timelineDragHandler.js').TimelineDragHandler} dragHandler - The TimelineDragHandler instance.
   */
  constructor(timelineContainerEl, timelineManager, dragHandler) {
    this.timelineContainerEl = timelineContainerEl;
    this.timelineManager = timelineManager; // To call render, access other components if needed
    this.dragHandler = dragHandler;       // To delegate drag-related events

    this._isTimelineDragging = false; // Internal state to manage global listeners

    // Bound versions of global event handlers
    this._boundHandleGlobalMouseMove = this._handleGlobalMouseMove.bind(this);
    this._boundHandleGlobalMouseUp = this._handleGlobalMouseUp.bind(this);
    this._boundHandleResize = this._handleResize.bind(this);

    this._resizeObserver = null;

    // console.log('EventHandler initialized'); // For debugging
  }

  /**
   * Initializes all event listeners managed by this handler.
   * This includes listeners for node interactions and the resize observer.
   */
  initializeEventListeners() {
    this._initNodeEventListeners();
    this._initResizeObserver();
    // console.log('EventHandler listeners initialized');
  }

  /**
   * Initializes event listeners for timeline nodes (e.g., mousedown for drag).
   * This method will need to be called when the timeline is rendered or re-rendered,
   * or use event delegation on the timelineContainerEl.
   * @private
   */
  _initNodeEventListeners() {
    // Option 1: Direct listeners (requires re-attaching after each render if nodes are recreated)
    // This would typically be called by TimelineManager after nodes are rendered,
    // passing the relevant node elements or relying on querying them.
    // For now, we'll assume TimelineManager might call a method like `attachListenersToNodes(nodeElements)`

    // Option 2: Event delegation (more robust to re-renders)
    if (this.timelineContainerEl) {
      this.timelineContainerEl.addEventListener('mousedown', this._handleNodeMouseDown.bind(this));
      // console.log('Mousedown listener attached to timelineContainerEl for delegation');
    }
  }

  /**
   * Handles mousedown events on timeline elements (likely delegated from timelineContainerEl).
   * Identifies if the mousedown was on a node hit area and initiates drag.
   * @param {MouseEvent} event - The mousedown event.
   * @private
   */
  _handleNodeMouseDown(event) {
    // Check if the target is a node hit area or a child of it
    const hitArea = event.target.closest('.timeline-node-hit-area'); // Assuming hit areas have this class

    if (hitArea && this.dragHandler) {
      // Need to extract branchId and transactionIndex.
      // This info might be on dataset attributes of hitArea or its parent visual node.
      // The TimelineNodeRenderer currently sets dataset.compositeKey on the visual node.
      // We need to ensure hitArea or visual node can be accessed.

      // Let's assume the visual node is accessible, perhaps hitArea is a child of the group containing the visual node
      // or we query for it based on the hitArea's context.
      // This part needs careful implementation based on final DOM structure from NodeRenderer.
      
      // Placeholder: Assume we can get branchId and index
      // const branchId = hitArea.dataset.branchId; // Example
      // const transactionIndex = parseInt(hitArea.dataset.transactionIndex, 10); // Example
      // const visualNodeElement = hitArea.parentElement.querySelector('.timeline-node'); // Example

      // For now, this logic will be refined in a subsequent task.
      // The key is that TimelineDragHandler.handleNodeMouseDown needs the event, branchId, transactionIndex, and the visual node element.
      
      // console.log('Node mousedown detected by EventHandler', event.target);

      // If successfully initiated drag in dragHandler, it should set its internal state.
      // We then set our internal state and attach global listeners.
      // This is a simplified call; dragHandler.handleNodeMouseDown might need more params or return a status.
      // The actual call to dragHandler.handleNodeMouseDown might be better placed in TimelineManager
      // if EventHandler's role is purely to capture and delegate the raw event.
      // However, the task implies EventHandler manages more.

      // Let's assume for now TimelineManager will provide a way to get necessary info from event target
      const nodeInfo = this.timelineManager.getNodeInfoFromEvent(event);

      if (nodeInfo) {
        // console.log('Node info from event:', nodeInfo);
        this.dragHandler.handleNodeMouseDown(event, nodeInfo.branchId, nodeInfo.transactionIndex, nodeInfo.nodeElement);
        
        if (this.dragHandler.isDragging()) { // Add an isDragging method to TimelineDragHandler
            this._isTimelineDragging = true;
            document.addEventListener('mousemove', this._boundHandleGlobalMouseMove);
            document.addEventListener('mouseup', this._boundHandleGlobalMouseUp);
            // console.log('Global mousemove and mouseup listeners ADDED by EventHandler');
        }
      }
    }
  }


  /**
   * Handles global mousemove events during a timeline drag operation.
   * Delegates to TimelineDragHandler.
   * @param {MouseEvent} event - The mousemove event.
   * @private
   */
  _handleGlobalMouseMove(event) {
    if (this._isTimelineDragging && this.dragHandler) {
      this.dragHandler.handleDragMove(event);
    }
  }

  /**
   * Handles global mouseup events to end a timeline drag operation.
   * Delegates to TimelineDragHandler and cleans up global listeners.
   * @param {MouseEvent} event - The mouseup event.
   * @private
   */
  _handleGlobalMouseUp(event) {
    if (this._isTimelineDragging && this.dragHandler) {
      this.dragHandler.handleDragEnd(event); // This should reset dragHandler's internal dragging state
      this._isTimelineDragging = false;
      document.removeEventListener('mousemove', this._boundHandleGlobalMouseMove);
      document.removeEventListener('mouseup', this._boundHandleGlobalMouseUp);
      // console.log('Global mousemove and mouseup listeners REMOVED by EventHandler');
    }
  }

  /**
   * Initializes the ResizeObserver to monitor the timeline container.
   * @private
   */
  _initResizeObserver() {
    if (this.timelineContainerEl) {
      this._resizeObserver = new ResizeObserver(this._boundHandleResize);
      this._resizeObserver.observe(this.timelineContainerEl);
      // console.log('ResizeObserver initialized and observing timelineContainerEl');
    }
  }

  /**
   * Handles the resize event from ResizeObserver.
   * @param {ResizeObserverEntry[]} entries - An array of ResizeObserverEntry objects.
   * @private
   */
  _handleResize(entries) {
    // We typically only observe one element here, but ResizeObserver API provides entries array.
    // For now, any resize will trigger a render if timelineManager is available.
    if (this.timelineManager && this.timelineManager.render && this.timelineContainerEl.offsetParent !== null) {
        // console.log('Resize detected, calling timelineManager.render()');
        this.timelineManager.render();
    }
  }

  /**
   * Cleans up all event listeners and observers when the instance is no longer needed.
   */
  destroy() {
    if (this.timelineContainerEl) {
      this.timelineContainerEl.removeEventListener('mousedown', this._handleNodeMouseDown.bind(this)); // Ensure correct bound function if used
    }
    
    // Remove global listeners if they happen to be active (shouldn't be if drag ended properly)
    document.removeEventListener('mousemove', this._boundHandleGlobalMouseMove);
    document.removeEventListener('mouseup', this._boundHandleGlobalMouseUp);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    // console.log('EventHandler listeners destroyed');
  }
}

// Helper/utility to be added to TimelineDragHandler:
// TimelineDragHandler.prototype.isDragging = function() { return this.isDraggingState; /* or whatever internal flag it uses */ }

// Helper to be added to TimelineManager:
// TimelineManager.prototype.getNodeInfoFromEvent = function(event) {
//   const hitArea = event.target.closest('.timeline-node-hit-area');
//   if (!hitArea) return null;
//   // This logic depends on how TimelineNodeRenderer structures the DOM.
//   // It needs to find the associated visual node and extract its branchId and transactionIndex,
//   // which are likely stored as data attributes on the visual node.
//   // For example, if hitArea is a direct child of a group that also contains the visual node:
//   const visualNode = hitArea.parentNode.querySelector('.timeline-node');
//   if (visualNode && visualNode.dataset.compositeKey) {
//       const [branchId, indexStr] = visualNode.dataset.compositeKey.split('_');
//       const transactionIndex = parseInt(indexStr, 10);
//       if (branchId && !isNaN(transactionIndex)) {
//           return { branchId, transactionIndex, nodeElement: visualNode };
//       }
//   }
//   return null;
// } 