/**
 * Texture Mapper Module
 * Handles texture configurations for 3D clothing models
 * Improved with advanced mapping capabilities and better user experience
 */
import { state, updateState } from './state.js';
import { Logger, Performance, debounce } from './utils.js';
import { showToast } from './ui.js';
import {
    addImage,
    clearObjectsByView,
    toggleDragAndDrop,
    toggleSmartPlacement,
    toggleAutoAdjustment
} from './3d-editor.js';

// Define textureState object
const textureState = {
    currentModel: 'tshirt',
    baseTexture: null,
    normalMap: null,
    roughnessMap: null
};

// Configuration for different model types
export const modelConfig = {
    "tshirt": {
        "views": {
            "front": {
                "bounds": { "x": 0.1, "y": 0.4, "width": 0.2, "height": 0.9 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.1, "v1": 0.5, "u2": 0.62, "v2": 0.85 },
                "name": "Front",
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "back": {
                "bounds": { "x": 0.20, "y": 0.48, "width": 0.52, "height": 0.52 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.18, "v1": 0.30, "u2": 0.68, "v2": 0.80 },
                "name": "Back",
                "transformMatrix": {
                    "scale": { "x": 1.0, "y": 1.0 },
                    "rotation": 0,
                    "offset": { "x": -0.04, "y": -0.04 }
                }
            },
            "left_arm": {
                "bounds": { "x": 0.14, "y": 0.33, "width": 0.17, "height": 0.26 },
                "defaultScale": 0.27,
                "uvRect": { "u1": 0.03, "v1": 0.21, "u2": 0.18, "v2": 0.46 },
                "name": "Left Sleeve",
                "transformMatrix": {
                    "scale": { "x": 1.05, "y": 0.97 },
                    "rotation": -6,
                    "offset": { "x": 0.02, "y": -0.01 }
                }
            },
            "right_arm": {
                "bounds": { "x": 0.74, "y": 0.33, "width": 0.17, "height": 0.26 },
                "defaultScale": 0.27,
                "uvRect": { "u1": 0.78, "v1": 0.21, "u2": 0.93, "v2": 0.46 },
                "name": "Right Sleeve",
                "transformMatrix": {
                    "scale": { "x": 1.05, "y": 0.97 },
                    "rotation": 6,
                    "offset": { "x": -0.02, "y": -0.01 }
                }
            }
        },
    },
    "hoodie": {
       "views": {
            "front": {
                "bounds": { "x": 0.1, "y": 0.4, "width": 0.2, "height": 0.9 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.1, "v1": 0.5, "u2": 0.62, "v2": 0.85 },
                "name": "Front",
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "back": {
                "bounds": { "x": 0.20, "y": 0.48, "width": 0.52, "height": 0.52 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.18, "v1": 0.30, "u2": 0.68, "v2": 0.80 },
                "name": "Back",
                "transformMatrix": {
                    "scale": { "x": 1.0, "y": 1.0 },
                    "rotation": 0,
                    "offset": { "x": -0.04, "y": -0.04 }
                }
            },
            "left_arm": {
                "bounds": { "x": 0.14, "y": 0.33, "width": 0.17, "height": 0.26 },
                "defaultScale": 0.27,
                "uvRect": { "u1": 0.03, "v1": 0.21, "u2": 0.18, "v2": 0.46 },
                "name": "Left Sleeve",
                "transformMatrix": {
                    "scale": { "x": 1.05, "y": 0.97 },
                    "rotation": -6,
                    "offset": { "x": 0.02, "y": -0.01 }
                }
            },
            "right_arm": {
                "bounds": { "x": 0.74, "y": 0.33, "width": 0.17, "height": 0.26 },
                "defaultScale": 0.27,
                "uvRect": { "u1": 0.78, "v1": 0.21, "u2": 0.93, "v2": 0.46 },
                "name": "Right Sleeve",
                "transformMatrix": {
                    "scale": { "x": 1.05, "y": 0.97 },
                    "rotation": 6,
                    "offset": { "x": -0.02, "y": -0.01 }
                }
            }
        },
    }
};

// Add view detection matrix for more accurate view detection when placing textures
const viewDetectionMatrix = {
    "tshirt": {
        // Each zone is mapped to a view
        // x and y are normalized coordinates (0-1)
        // These zones help determine which view is being targeted when a user clicks or drags
        "zones": [
            { x: [0.4, 0.6], y: [0.25, 0.75], view: "front" },
            { x: [0.1, 0.3], y: [0.3, 0.5], view: "left_arm" },
            { x: [0.7, 0.9], y: [0.3, 0.5], view: "right_arm" },
            // Back is determined by camera angle, not by position
        ]
    },
    "hoodie": {
        "zones": [
            { x: [0.35, 0.65], y: [0.2, 0.8], view: "front" },
            { x: [0.05, 0.3], y: [0.3, 0.6], view: "left_arm" },
            { x: [0.7, 0.95], y: [0.3, 0.6], view: "right_arm" },
            // Hood and other areas
            { x: [0.35, 0.65], y: [0.05, 0.2], view: "hood" }
        ]
    }
};



/**
 * Initialize texture mapper with base textures
 * @param {string} modelType - Type of model ('tshirt', 'hoodie', etc)
 */
export function initTextureMapper(modelType = 'tshirt') {
    textureState.currentModel = modelType;
    console.log('Texture mapper initialized - 3D Editor Mode');

    // Enable advanced features by default
    toggleDragAndDrop(true);
    toggleSmartPlacement(true);
    toggleAutoAdjustment(true);

    Logger.log('Texture Mapper initialized with advanced features');

    return Promise.resolve({
        baseTexture: null,
        bumpMap: null
    });
}

/**
 * Load a custom image and place it on the model
 * @param {string} imageUrl - The URL of the image to load
 * @param {string} view - The view to place the image on
 * @param {Object} options - Additional options for image placement
 * @returns {Promise} - A promise that resolves when the image is loaded
 */
export function loadCustomImage(imageUrl, view = 'front', options = {}) {
    return new Promise((resolve, reject) => {
        // Check if view is valid
        if (!modelConfig[state.currentModel].views[view]) {
            showToast(`Invalid view "${view}". Using "front" instead.`);
            view = 'front';
        }

        // Use the 3D editor's addImage function with smart placement
        addImage(imageUrl, {
            view: view,
            center: true,
            smartPlacement: true,
            autoAdjust: true,
            ...options
        }).then(imageObj => {
            Logger.log(`Custom image loaded for ${view}`);
            showToast(`Image added to ${view} view`);
            resolve(imageObj);
        }).catch(error => {
            Logger.error(`Failed to load custom image: ${error.message}`);
            showToast(`Failed to load image: ${error.message}`);
            reject(error);
        });
    });
}

/**
 * Change the model type
 * @param {string} modelType - The new model type ('tshirt', 'hoodie', etc)
 */
export function setModelType(modelType) {
    if (modelConfig[modelType]) {
        textureState.currentModel = modelType;
        console.log(`Model type set to: ${modelType}`);
    }
}

/**
 * Clear custom images from views
 * @param {string} view - The view to clear or 'all' to clear all views
 */
export function clearCustomImage(view = 'all') {
    clearObjectsByView(view);
    Logger.log(`Cleared custom images from ${view === 'all' ? 'all views' : view}`);
    showToast(`Cleared ${view === 'all' ? 'all' : view} view${view === 'all' ? 's' : ''}`);
}

/**
 * Show bounding boxes for the current camera view to help with texture placement
 * @param {string} cameraView - The camera view to show bounding boxes for
 */
export function showBoundingBoxesForCameraView(cameraView) {
    // No-op function maintained for compatibility
    console.log(`Bounding box display now handled by 3D editor: ${cameraView}`);
}

/**
 * Set the position of the texture
 * @param {Object} position - The position to set
 * @param {string} view - The view to set the position for
 */
export function setTexturePosition(position, view = null) {
    // No-op function maintained for compatibility
    console.log(`Texture positioning now handled by 3D editor: ${position} on ${view || 'current view'}`);
    return true;
}

/**
 * Get the current view
 * @returns {string} - The current view
 */
export function getCurrentView() {
    return state.cameraView || 'front';
}

/**
 * Get all available views for the current model
 * @returns {Array} - Array of view names
 */
export function getAllViews() {
    return Object.keys(modelConfig[state.currentModel].views);
}

/**
 * Get view configuration
 * @param {string} viewName - The name of the view
 * @returns {Object} - The view configuration
 */
export function getViewConfig(viewName) {
    return modelConfig[state.currentModel].views[viewName];
}

/**
 * Quickly switch to a specific view and center the camera
 * @param {string} viewName - The name of the view to jump to
 */
export function quickJumpToView(viewName) {
    if (!modelConfig[state.currentModel].views[viewName]) {
        showToast(`Invalid view "${viewName}"`);
        return;
    }

    // Update the camera view in state
    updateState({ cameraView: viewName });

    // Use camera view mapping function to get the actual camera view
    const actualCameraView = mapViewNameToCameraView(viewName);

    // This function should be implemented in main.js or scene.js
    if (typeof changeCameraView === 'function') {
        changeCameraView(actualCameraView);
    }

    Logger.log(`Jumped to view: ${viewName}`);
}

/**
 * Map view name to camera view
 * @param {string} viewName - The name of the view
 * @returns {string} - The camera view
 */
function mapViewNameToCameraView(viewName) {
    // Map view names to camera views
    const viewToCameraMap = {
        'front': 'front',
        'back': 'back',
        'left_arm': 'left',
        'right_arm': 'right',
        'hood': 'top',
        // Add more mappings as needed
    };

    return viewToCameraMap[viewName] || viewName;
}

/**
 * Enhanced view detection
 * @param {number} x - Normalized x coordinate (0-1)
 * @param {number} y - Normalized y coordinate (0-1)
 * @param {string} model - The model type
 * @returns {string} - The detected view
 */
export function detectViewFromPosition(x, y, model = state.currentModel) {
    // Normalize coordinates (0-1)
    const normalizedX = x;
    const normalizedY = y;

    // Get zones for current model
    const modelZones = viewDetectionMatrix[model]?.zones || [];

    // Find matching zone
    for (const zone of modelZones) {
        if (normalizedX >= zone.x[0] && normalizedX <= zone.x[1] &&
            normalizedY >= zone.y[0] && normalizedY <= zone.y[1]) {
            return zone.view;
        }
    }

    // Default to the current camera view if no matching zone
    return state.cameraView || 'front';
} 