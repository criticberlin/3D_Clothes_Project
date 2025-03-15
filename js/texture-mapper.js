/**
 * Texture Mapper Module
 * Handles texture configurations for 3D clothing models
 * This is a simplified version that only maintains essential functionality
 * for compatibility with existing code after 3D editor implementation
 */

import * as THREE from 'three';
import { state, updateState } from './state.js';
import { Logger, Performance, debounce } from './utils.js';
import { showToast } from './ui.js';
import {
    init3DEditor,
    addImage,
    clearObjectsByView
} from './3d-editor.js';

// Configuration for different model types
export const modelConfig = {
    "tshirt": {
        "views": {
            "front": {
                "bounds": { "x": 0.15, "y": 0.4, "width": 0.50, "height": 0.50 },
                "defaultScale": 1,
                "uvRect": { "u1": 0.15, "v1": 0.5, "u2": 0.62, "v2": 0.95 },
                "name": "Front",
                "transformMatrix": {
                    "scale": { "x": 1, "y": 1.0 },
                    "rotation": 0,
                    "offset": { "x": -0.07, "y": -0.10 }
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
        "fabricTextureStrength": 0.8,
        "bumpMapStrength": 0.08,
        "materialSettings": {
            "roughness": 0.65,
            "metalness": 0.02,
            "clearcoat": 0.08,
            "clearcoatRoughness": 0.4,
            "transmission": 0.01,
            "thickness": 0.3,
            "envMapIntensity": 0.6,
            "anisotropy": 0.3,
            "normalScale": 0.7,
            "displacementScale": 0.02,
            "aoMapIntensity": 0.8
        }
    },
    hoodie: {
        views: {
            front: {
                bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                defaultScale: 0.35,
                uvRect: { u1: 0.25, v1: 0.25, u2: 0.75, v2: 0.75 },
                name: "Front"
            },
            back: {
                bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                defaultScale: 0.35,
                uvRect: { u1: 0.25, v1: 0.25, u2: 0.75, v2: 0.75 },
                name: "Back"
            },
            left_arm: {
                bounds: { x: 0.10, y: 0.30, width: 0.15, height: 0.25 },
                defaultScale: 0.2,
                uvRect: { u1: 0.10, v1: 0.30, u2: 0.25, v2: 0.55 },
                name: "Left Sleeve"
            },
            right_arm: {
                bounds: { x: 0.75, y: 0.30, width: 0.15, height: 0.25 },
                defaultScale: 0.2,
                uvRect: { u1: 0.75, v1: 0.30, u2: 0.90, v2: 0.55 },
                name: "Right Sleeve"
            }
        },
        fabricTextureStrength: 0.7,
        bumpMapStrength: 0.07,
        materialSettings: {
            roughness: 0.8,
            metalness: 0.03
        }
    }
};

// Minimal texture state management 
const textureState = {
    currentModel: 'tshirt',
    baseTexture: null,
    fabricTexture: null,
    bumpMap: null
};

// Create texture loader
const textureLoader = new THREE.TextureLoader();

/**
 * Initialize texture mapper with base textures
 * @param {string} fabricTextureUrl - URL to the fabric texture (optional)
 * @param {string} bumpMapUrl - URL to the bump map for fabric texture (optional)
 * @param {string} modelType - Type of model ('tshirt', 'hoodie', etc)
 */
export function initTextureMapper(fabricTextureUrl, bumpMapUrl, modelType = 'tshirt') {
    textureState.currentModel = modelType;
    console.log('Texture mapper initialized - 3D Editor Mode');

    return Promise.resolve({
        baseTexture: null,
        bumpMap: null
    });
}

/**
 * Map camera view to texture view (compatibility function)
 * @param {string} cameraView - The camera view (front, back, left, right)
 * @returns {string} The corresponding texture view
 */
function mapCameraViewToTextureView(cameraView) {
    switch (cameraView) {
        case 'left': return 'left_arm';
        case 'right': return 'right_arm';
        default: return cameraView; // 'front' and 'back' remain the same
    }
}

/**
 * Load a custom image (compatibility function - now handled by 3D editor)
 * @param {string} imageUrl - URL of the image to load
 * @param {string} view - The view to apply the image to
 * @returns {Promise} Promise resolving when the image is loaded
 */
export function loadCustomImage(imageUrl, view = 'front') {
    console.log(`Loading custom image for view: ${view}`);

    // Set the camera view first to ensure the image is placed in the correct view
    if (view !== state.cameraView) {
        // Import changeCameraView dynamically to avoid circular dependencies
        import('./scene.js').then(scene => {
            scene.changeCameraView(view);
        });
    }

    // Use the 3D editor's addImage function
    return addImage(imageUrl);
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
 * Remove the custom image (compatibility function)
 * @param {string} view - The view to clear (front, back, left_arm, right_arm, or 'all')
 */
export function clearCustomImage(view = 'all') {
    console.log(`Clearing custom image for view: ${view}`);
    // Use the new 3D editor function to clear objects by view
    clearObjectsByView(view);
}

/**
 * Show bounding boxes for a specific camera view (compatibility function)
 * @param {string} cameraView - The current camera view
 */
export function showBoundingBoxesForCameraView(cameraView) {
    // No-op function maintained for compatibility
    console.log(`Bounding box display now handled by 3D editor: ${cameraView}`);
}

/**
 * Set texture position (compatibility function)
 * @param {string} position - Position name
 * @param {string} view - The view
 */
export function setTexturePosition(position, view = null) {
    // No-op function maintained for compatibility
    console.log(`Texture positioning now handled by 3D editor: ${position} on ${view || 'current view'}`);
    return true;
}

/**
 * Get the current active view (compatibility function)
 * @returns {string} The current active view name
 */
export function getCurrentView() {
    return state.cameraView ? mapCameraViewToTextureView(state.cameraView) : 'front';
} 