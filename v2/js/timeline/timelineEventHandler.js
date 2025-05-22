/**
 * @file timelineEventHandler.js
 * @description Manages event handling for timeline components, centralizing DOM event
 *              listeners and interactions for the timeline.
 */

import { TIMELINE_CONSTANTS } from './timelineConstants.js'; // May need TIMELINE_CONSTANTS
import { TimelineUtils } from './timelineUtils.js';

/**
 * @class TimelineEventHandler
 * @description Handles timeline-specific DOM event listening and dispatching.
 */
export class TimelineEventHandler {
  /**
   * Creates an TimelineEventHandler instance.
   * @param {HTMLElement} timelineContainerEl - The main container element for the timeline SVG.
   * @param {import('../timelineManager.js').TimelineManager} timelineManager - The TimelineManager instance.
   * @param {import('./timelineDragHandler.js').TimelineDragHandler} dragHandler - The TimelineDragHandler instance.
   */
  constructor(timelineContainerEl, timelineManager, dragHandler) {
    this.timelineContainerEl = timelineContainerEl;
    this.timelineManager = timelineManager; // To call render, access other components if needed
    this.dragHandler = dragHandler;       // To delegate drag-related events

    this._isTimelineDragging = false; // Internal state to manage global listeners
    this._eventListeners = {}; // For custom event registration

    // Bound versions of global event handlers
    this._boundHandleGlobalMouseMove = this._handleGlobalMouseMove.bind(this);
    this._boundHandleGlobalMouseUp = this._handleGlobalMouseUp.bind(this);
    // Debounce the resize handler
    this._debouncedRender = TimelineUtils.debounce(() => {
      if (this.timelineManager && this.timelineManager.render && this.timelineContainerEl.offsetParent !== null) {
        // console.log('Debounced resize detected, calling timelineManager.render()');
        this.timelineManager.render();
      }
    }, 250); // 250ms debounce delay
    this._boundHandleResize = this._handleResize.bind(this); // Keep original for observer, call debounced version from it

    this._resizeObserver = null;

    // console.log('TimelineEventHandler initialized'); // For debugging
  }

  /**
   * Initializes all event listeners managed by this handler.
   * This includes listeners for node interactions and the resize observer.
   */
  initializeEventListeners() {
    this._initNodeEventListeners();
    this._initResizeObserver();
    // console.log('TimelineEventHandler listeners initialized');
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

    try {
      if (hitArea && this.dragHandler) {
        const nodeInfo = this.timelineManager.getNodeInfoFromEvent(event);

        if (nodeInfo) {
          // console.log('Node info from event:', nodeInfo);
          this.dragHandler.handleNodeMouseDown(event, nodeInfo.branchId, nodeInfo.transactionIndex, nodeInfo.nodeElement);
          
          if (this.dragHandler.isDragging()) { // Add an isDragging method to TimelineDragHandler
              this._isTimelineDragging = true;
              document.addEventListener('mousemove', this._boundHandleGlobalMouseMove);
              document.addEventListener('mouseup', this._boundHandleGlobalMouseUp);
              // console.log('Global mousemove and mouseup listeners ADDED by TimelineEventHandler');
          }
        } else {
          console.warn('TimelineEventHandler: Could not get nodeInfo from mousedown event target:', event.target);
        }
      }
    } catch (error) {
      console.error('TimelineEventHandler: Error in _handleNodeMouseDown:', error);
    }
  }


  /**
   * Handles global mousemove events during a timeline drag operation.
   * Delegates to TimelineDragHandler.
   * @param {MouseEvent} event - The mousemove event.
   * @private
   */
  _handleGlobalMouseMove(event) {
    try {
      if (this._isTimelineDragging && this.dragHandler) {
        this.dragHandler.handleDragMove(event);
      }
    } catch (error) {
      console.error('TimelineEventHandler: Error in _handleGlobalMouseMove:', error);
    }
  }

  /**
   * Handles global mouseup events to end a timeline drag operation.
   * Delegates to TimelineDragHandler and cleans up global listeners.
   * @param {MouseEvent} event - The mouseup event.
   * @private
   */
  _handleGlobalMouseUp(event) {
    try {
      if (this._isTimelineDragging && this.dragHandler) {
        this.dragHandler.handleDragEnd(event); // This should reset dragHandler's internal dragging state
        this._isTimelineDragging = false;
        document.removeEventListener('mousemove', this._boundHandleGlobalMouseMove);
        document.removeEventListener('mouseup', this._boundHandleGlobalMouseUp);
        // console.log('Global mousemove and mouseup listeners REMOVED by TimelineEventHandler');
      }
    } catch (error) {
      console.error('TimelineEventHandler: Error in _handleGlobalMouseUp:', error);
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
    try {
      // We typically only observe one element here, but ResizeObserver API provides entries array.
      // For now, any resize will trigger a render if timelineManager is available.
      // Call the debounced render function
      this._debouncedRender();
    } catch (error) {
      console.error('TimelineEventHandler: Error in _handleResize:', error);
    }
  }

  /**
   * Registers a listener for a custom event type.
   * @param {string} eventType - The type of event to listen for.
   * @param {function} listener - The callback function to execute when the event is dispatched.
   */
  on(eventType, listener) {
    if (!this._eventListeners[eventType]) {
      this._eventListeners[eventType] = [];
    }
    if (!this._eventListeners[eventType].includes(listener)) {
      this._eventListeners[eventType].push(listener);
    }
  }

  /**
   * Unregisters a listener for a custom event type.
   * @param {string} eventType - The type of event.
   * @param {function} listener - The callback function to remove.
   */
  off(eventType, listener) {
    if (this._eventListeners[eventType]) {
      this._eventListeners[eventType] = this._eventListeners[eventType].filter(
        (registeredListener) => registeredListener !== listener
      );
      if (this._eventListeners[eventType].length === 0) {
        delete this._eventListeners[eventType];
      }
    }
  }

  /**
   * Dispatches a custom event to all registered listeners.
   * @param {string} eventType - The type of event to dispatch.
   * @param {object} [payload] - Optional data to pass to the listeners.
   */
  dispatchEvent(eventType, payload) {
    if (this._eventListeners[eventType]) {
      this._eventListeners[eventType].forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Cleans up all event listeners and observers when the instance is no longer needed.
   */
  destroy() {
    if (this.timelineContainerEl) {
      this.timelineContainerEl.removeEventListener('mousedown', this._handleNodeMouseDown.bind(this)); // Ensure correct bound function if used
    }
    
    this._eventListeners = {}; // Clear custom event listeners

    // Remove global listeners if they happen to be active (shouldn't be if drag ended properly)
    document.removeEventListener('mousemove', this._boundHandleGlobalMouseMove);
    document.removeEventListener('mouseup', this._boundHandleGlobalMouseUp);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    // console.log('TimelineEventHandler listeners destroyed');
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