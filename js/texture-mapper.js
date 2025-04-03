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
        "name": "T-Shirt",
        "glbPath": "./models/tshirt.glb",
        "defaultColor": "#FFFFFF",
        "defaultScale": 1.0,
        "views": {
            "front": {
                "name": "Front",
                "bounds": { "x": 0.15, "y": 0.45, "width": 0.7, "height": 0.8 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.08, "v1": 0.08, "u2": 0.45, "v2": 0.65 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "back": {
                "name": "Back",
                "bounds": { "x": 0.25, "y": 0.52, "width": 0.45, "height": 0.45 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.55, "v1": 0.08, "u2": 0.92, "v2": 0.65 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "left_arm": {
                "name": "Left Sleeve",
                "bounds": { "x": 0.16, "y": 0.35, "width": 0.14, "height": 0.22 },
                "defaultScale": 0.25,
                "uvRect": { "u1": 0.08, "v1": 0.78, "u2": 0.42, "v2": 0.92 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "right_arm": {
                "name": "Right Sleeve",
                "bounds": { "x": 0.76, "y": 0.35, "width": 0.14, "height": 0.22 },
                "defaultScale": 0.25,
                "uvRect": { "u1": 0.58, "v1": 0.78, "u2": 0.92, "v2": 0.92 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            }
        },
        "textureSettings": {
            "canvasWidth": 1024,
            "canvasHeight": 1024,
            "baseColor": "#FFFFFF",
            "acceptsFullTexture": true,
            "acceptsDecals": true
        }
    },
    "hoodie": {
       "name": "Hoodie",
       "glbPath": "./models/hoodie.glb",
       "defaultColor": "#FFFFFF",
       "defaultScale": 1.0,
       "views": {
            "front": {
                "name": "Front",
                "bounds": { "x": 0.15, "y": 0.45, "width": 0.7, "height": 0.8 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.08, "v1": 0.08, "u2": 0.45, "v2": 0.65 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "back": {
                "name": "Back",
                "bounds": { "x": 0.25, "y": 0.52, "width": 0.45, "height": 0.45 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.55, "v1": 0.08, "u2": 0.92, "v2": 0.65 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "left_arm": {
                "name": "Left Sleeve",
                "bounds": { "x": 0.16, "y": 0.35, "width": 0.14, "height": 0.22 },
                "defaultScale": 0.25,
                "uvRect": { "u1": 0.08, "v1": 0.78, "u2": 0.42, "v2": 0.92 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "right_arm": {
                "name": "Right Sleeve",
                "bounds": { "x": 0.76, "y": 0.35, "width": 0.14, "height": 0.22 },
                "defaultScale": 0.25,
                "uvRect": { "u1": 0.58, "v1": 0.78, "u2": 0.92, "v2": 0.92 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            },
            "hood": {
                "name": "Hood",
                "bounds": { "x": 0.35, "y": 0.15, "width": 0.3, "height": 0.2 },
                "defaultScale": 0.25,
                "uvRect": { "u1": 0.35, "v1": 0.05, "u2": 0.65, "v2": 0.2 },
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1 },
                    "rotation": 0,
                    "offset": { "x": 0, "y": 0 }
                }
            }
        },
        "textureSettings": {
            "canvasWidth": 1024,
            "canvasHeight": 1024,
            "baseColor": "#FFFFFF",
            "acceptsFullTexture": true,
            "acceptsDecals": true
        }
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
 * @param {string} baseTexturePath - Path to base texture (optional)
 * @param {string} bumpMapPath - Path to bump/normal map (optional)
 * @param {string} modelType - Type of model ('tshirt', 'hoodie', etc)
 * @returns {Promise} - A promise that resolves with the loaded textures
 */
export function initTextureMapper(baseTexturePath = null, bumpMapPath = null, modelType = null) {
    // Use the provided model type or get it from state, or fallback to tshirt
    const currentModelType = modelType || state.currentModel || 'tshirt';
    
    // Validate that the model type exists
    if (!modelConfig[currentModelType]) {
        console.warn(`Unknown model type: ${currentModelType}, falling back to tshirt`);
        textureState.currentModel = 'tshirt';
    } else {
        textureState.currentModel = currentModelType;
    }
    
    console.log(`Texture mapper initialized for model type: ${textureState.currentModel}`);

    // Enable advanced features by default
    toggleSmartPlacement(true);
    toggleAutoAdjustment(true);

    Logger.log(`Texture Mapper initialized for ${textureState.currentModel} with advanced features`);
    
    // Expose important functions to window object for cross-module access
    window.detectViewFromPosition = detectViewFromPosition;
    window.modelConfig = modelConfig;
    window.setModelType = setModelType;
    window.registerModelType = registerModelType;
    window.getAvailableModels = getAvailableModels;
    window.getModelConfig = getModelConfig;
    window.getCurrentModelType = () => textureState.currentModel;

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
        // Get the current model type from options or state
        const currentModelType = options.modelType || state.currentModel || 'tshirt';
        
        // Check if view is valid for the current model
        if (!modelConfig[currentModelType] || !modelConfig[currentModelType].views[view]) {
            const fallbackView = 'front';
            showToast(`Invalid view "${view}" for ${currentModelType}. Using "${fallbackView}" instead.`);
            view = fallbackView;
        }
        
        console.log(`Loading custom image for ${currentModelType} - ${view} view`);

        // Use the 3D editor's addImage function with smart placement
        addImage(imageUrl, {
            view: view,
            center: true,
            smartPlacement: true,
            autoAdjust: true,
            isAIGenerated: options.isAIGenerated || false,
            ...options
        }).then(imageObj => {
            Logger.log(`Custom image loaded for ${currentModelType} ${view}`);
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
        
        // Update state to ensure consistency
        updateState({ currentModel: modelType });
    } else {
        console.warn(`Unknown model type: ${modelType}, using defaults`);
    }
}

/**
 * Clear custom images from views
 * @param {string} view - The view to clear or 'all' to clear all views
 * @param {string} modelType - The model type to clear images from
 */
export function clearCustomImage(view = 'all', modelType = null) {
    const currentModelType = modelType || state.currentModel || 'tshirt';
    
    // Call the 3D editor's clearObjectsByView function
    clearObjectsByView(view);
    
    Logger.log(`Cleared custom images from ${view === 'all' ? 'all views' : view} on ${currentModelType}`);
    showToast(`Cleared ${view === 'all' ? 'all' : view} view${view === 'all' ? 's' : ''} on ${currentModelType}`);
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

/**
 * Register a new model type in the system
 * @param {string} modelType - ID for the model (e.g., 'oversized_tshirt')
 * @param {object} config - Configuration object for the model
 * @returns {boolean} - Success status
 */
export function registerModelType(modelType, config) {
    if (!modelType || typeof modelType !== 'string') {
        console.error('Invalid model type: must be a non-empty string');
        return false;
    }

    if (!config || typeof config !== 'object') {
        console.error('Invalid model configuration: must be an object');
        return false;
    }

    // Validate required configuration properties
    if (!config.name || !config.glbPath || !config.views) {
        console.error('Invalid model configuration: missing required properties (name, glbPath, views)');
        return false;
    }

    // Ensure each view has required properties
    const views = config.views;
    if (!views || typeof views !== 'object' || Object.keys(views).length === 0) {
        console.error('Invalid model configuration: views must be a non-empty object');
        return false;
    }

    for (const [viewName, viewConfig] of Object.entries(views)) {
        if (!viewConfig.bounds || !viewConfig.uvRect) {
            console.error(`Invalid view configuration for "${viewName}": missing required properties (bounds, uvRect)`);
            return false;
        }
    }

    // Check if model already exists
    if (modelConfig[modelType]) {
        console.warn(`Model "${modelType}" already exists and will be overwritten`);
    }

    // Add default values if missing
    const finalConfig = {
        ...config,
        defaultColor: config.defaultColor || "#FFFFFF",
        defaultScale: config.defaultScale || 1.0,
        textureSettings: {
            canvasWidth: config.textureSettings?.canvasWidth || 1024,
            canvasHeight: config.textureSettings?.canvasHeight || 1024,
            baseColor: config.textureSettings?.baseColor || "#FFFFFF",
            acceptsFullTexture: config.textureSettings?.acceptsFullTexture !== false,
            acceptsDecals: config.textureSettings?.acceptsDecals !== false
        }
    };

    // Register the model
    modelConfig[modelType] = finalConfig;
    console.log(`Registered model type: ${modelType}`);

    // Register view detection matrix if provided
    if (config.viewDetection && Array.isArray(config.viewDetection.zones)) {
        viewDetectionMatrix[modelType] = {
            zones: config.viewDetection.zones
        };
        console.log(`Registered view detection zones for ${modelType}`);
    }

    return true;
}

/**
 * Get available models in the system
 * @returns {Array} - Array of model type objects with id and name
 */
export function getAvailableModels() {
    return Object.entries(modelConfig).map(([id, config]) => ({
        id,
        name: config.name || id,
        path: config.glbPath
    }));
}

/**
 * Get model configuration for a specific model type
 * @param {string} modelType - The model type to get configuration for
 * @returns {object|null} - Model configuration or null if not found
 */
export function getModelConfig(modelType) {
    return modelConfig[modelType] || null;
} 