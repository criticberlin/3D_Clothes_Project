/**
 * Texture Mapper Module
 * Handles seamless texture mapping and interactive positioning for 3D clothing models
 */

import * as THREE from 'three';
import { state, updateState } from './state.js';

// Configuration for different model types
const modelConfig = {
    tshirt: {
        views: {
            front: {
                bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                defaultScale: 0.4,
                uvRect: { u1: 0.25, v1: 0.25, u2: 0.75, v2: 0.75 },
                name: "Front Chest"
            },
            back: {
                bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                defaultScale: 0.4,
                uvRect: { u1: 0.25, v1: 0.25, u2: 0.75, v2: 0.75 },
                name: "Back"
            },
            left_arm: {
                bounds: { x: 0.10, y: 0.30, width: 0.15, height: 0.25 },
                defaultScale: 0.25,
                uvRect: { u1: 0.10, v1: 0.30, u2: 0.25, v2: 0.55 },
                name: "Left Sleeve"
            },
            right_arm: {
                bounds: { x: 0.75, y: 0.30, width: 0.15, height: 0.25 },
                defaultScale: 0.25,
                uvRect: { u1: 0.75, v1: 0.30, u2: 0.90, v2: 0.55 },
                name: "Right Sleeve"
            }
        },
        fabricTextureStrength: 0.8,
        bumpMapStrength: 0.08,
        materialSettings: {
            roughness: 0.65,
            metalness: 0.02,
            clearcoat: 0.08,
            clearcoatRoughness: 0.4,
            transmission: 0.01,
            thickness: 0.3,
            envMapIntensity: 0.6,
            anisotropy: 0.3,
            normalScale: 0.7,
            displacementScale: 0.02,
            aoMapIntensity: 0.8
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

// Store current texture states
const textureState = {
    currentModel: 'tshirt',
    baseTexture: null,
    fabricTexture: null,
    bumpMap: null,
    customImages: {
        front: { texture: null, position: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0 },
        back: { texture: null, position: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0 },
        left_arm: { texture: null, position: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0 },
        right_arm: { texture: null, position: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0 }
    },
    activeBoundingBox: null,
    isDragging: false,
    isScaling: false,
    isRotating: false,
    lastMousePosition: { x: 0, y: 0 },
    activeView: 'front'
};

// Create texture loader
const textureLoader = new THREE.TextureLoader();

// Array of available views for iteration
const availableViews = ['front', 'back', 'left_arm', 'right_arm'];

/**
 * Predefined positions for texture placements
 * These represent common placement options for images on clothing
 */
const predefinedPositions = {
    center: { x: 0.5, y: 0.5, scale: 1.0, rotation: 0 },
    top: { x: 0.5, y: 0.25, scale: 0.9, rotation: 0 },
    bottom: { x: 0.5, y: 0.75, scale: 0.9, rotation: 0 },
    left: { x: 0.25, y: 0.5, scale: 0.8, rotation: 0 },
    right: { x: 0.75, y: 0.5, scale: 0.8, rotation: 0 },
    top_left: { x: 0.25, y: 0.25, scale: 0.7, rotation: 0 },
    top_right: { x: 0.75, y: 0.25, scale: 0.7, rotation: 0 },
    bottom_left: { x: 0.25, y: 0.75, scale: 0.7, rotation: 0 },
    bottom_right: { x: 0.75, y: 0.75, scale: 0.7, rotation: 0 },
    pocket: { x: 0.35, y: 0.3, scale: 0.4, rotation: 0 },
    sleeve: { x: 0.5, y: 0.5, scale: 0.6, rotation: 0 }
};

// Add new advanced texture utilities - optimized for performance
// Simplex noise implementation for realistic texture generation (optimized)
const SimplexNoise = {
    grad3: [
        [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
        [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
        [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ],
    p: [...Array(256)].map(() => Math.floor(Math.random() * 256)),

    // Populate the permutation table
    init() {
        this.perm = [...Array(512)].map((_, i) => this.p[i & 255]);

        // Pre-calculate some values for better performance
        this.cache = new Map();
        return this;
    },

    // 2D simplex noise with caching for better performance
    noise2D(x, y) {
        // Round to reduce unique combinations for better cache hits
        const rx = Math.round(x * 10) / 10;
        const ry = Math.round(y * 10) / 10;

        // Check cache first
        const key = `${rx},${ry}`;
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        // Find unit grid cell containing point
        let X = Math.floor(x);
        let Y = Math.floor(y);

        // Get relative xy coordinates of point within that cell
        x = x - X;
        y = y - Y;

        // Wrap to 0-255
        X = X & 255;
        Y = Y & 255;

        // Calculate noise contributions from each corner
        const n0 = this.dot(this.grad3[this.perm[(X + this.perm[Y]) & 255] % 12], x, y);
        const n1 = this.dot(this.grad3[this.perm[(X + 1 + this.perm[Y]) & 255] % 12], x - 1, y);
        const n2 = this.dot(this.grad3[this.perm[(X + this.perm[Y + 1]) & 255] % 12], x, y - 1);
        const n3 = this.dot(this.grad3[this.perm[(X + 1 + this.perm[Y + 1]) & 255] % 12], x - 1, y - 1);

        // Linear interpolation (optimized for performance)
        const u = x * x * (3 - 2 * x); // Faster curve than fade
        const v = y * y * (3 - 2 * y);

        // Interpolate the four results
        const nx0 = n0 + u * (n1 - n0);
        const nx1 = n2 + u * (n3 - n2);
        const nxy = nx0 + v * (nx1 - nx0);

        // Convert to range [0, 1] and cache the result
        const result = (nxy + 1) * 0.5;

        // Only store if cache isn't too large
        if (this.cache.size < 1000) {
            this.cache.set(key, result);
        }

        return result;
    },

    dot(g, x, y) {
        return g[0] * x + g[1] * y;
    }
}.init();

// Fractal Brownian Motion function for layered noise (optimized)
function fbm(x, y, octaves = 3, lacunarity = 2.0, gain = 0.5) {
    // Use fewer octaves for better performance
    octaves = Math.min(octaves, 3);

    let amplitude = 0.5;
    let frequency = 1.0;
    let sum = 0;
    let sumOfAmplitudes = 0;

    for (let i = 0; i < octaves; i++) {
        sum += amplitude * SimplexNoise.noise2D(x * frequency, y * frequency);
        sumOfAmplitudes += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }

    return sum / sumOfAmplitudes;
}

// Calculate ambient occlusion based on geometry factors (optimized)
function calculateAO(x, y, width, height, canvas, strength = 0.5) {
    // Use simpler calculations for better performance
    // Normalize coordinates to 0-1 range
    const nx = x / width;
    const ny = y / height;

    // Get distance from edges (in UV space)
    const distFromLeftEdge = nx;
    const distFromRightEdge = 1 - nx;
    const distFromTopEdge = ny;
    const distFromBottomEdge = 1 - ny;

    // Get minimum distance to edge
    const minDist = Math.min(
        distFromLeftEdge,
        distFromRightEdge,
        distFromTopEdge,
        distFromBottomEdge
    );

    // Simpler easing function for better performance
    const easedValue = Math.min(1, minDist * 10);

    // Scale by strength parameter
    return 1 - ((1 - easedValue) * strength);
}

// Calculate fabric displacement for 3D-like effects (simplified)
function calculateDisplacement(uvX, uvY) {
    // Simplified with fewer layers for better performance
    return fbm(uvX * 2, uvY * 2, 2, 2.0, 0.5) * 0.5;
}

/**
 * Initialize texture mapper with base textures
 * @param {string} fabricTextureUrl - URL to the fabric texture (optional)
 * @param {string} bumpMapUrl - URL to the bump map for fabric texture (optional)
 * @param {string} modelType - Type of model ('tshirt', 'hoodie', etc)
 */
export function initTextureMapper(fabricTextureUrl, bumpMapUrl, modelType = 'tshirt') {
    textureState.currentModel = modelType;

    return new Promise((resolve, reject) => {
        try {
            // Create procedural textures if URLs are not provided
            if (!fabricTextureUrl || !bumpMapUrl) {
                console.log('Creating procedural textures for texture mapper');

                // Create a procedural fabric texture
                const fabricCanvas = document.createElement('canvas');
                fabricCanvas.width = 1024;
                fabricCanvas.height = 1024;
                const fabricCtx = fabricCanvas.getContext('2d');

                // Fill with base color
                fabricCtx.fillStyle = state.color || '#FFFFFF';
                fabricCtx.fillRect(0, 0, fabricCanvas.width, fabricCanvas.height);

                // Add fabric pattern (subtle grid)
                fabricCtx.strokeStyle = 'rgba(0,0,0,0.1)';
                fabricCtx.lineWidth = 1;

                // Horizontal lines
                for (let i = 0; i < fabricCanvas.height; i += 8) {
                    fabricCtx.beginPath();
                    fabricCtx.moveTo(0, i);
                    fabricCtx.lineTo(fabricCanvas.width, i);
                    fabricCtx.stroke();
                }

                // Vertical lines
                for (let i = 0; i < fabricCanvas.width; i += 8) {
                    fabricCtx.beginPath();
                    fabricCtx.moveTo(i, 0);
                    fabricCtx.lineTo(i, fabricCanvas.height);
                    fabricCtx.stroke();
                }

                // Create the fabric texture
                const fabricTexture = new THREE.CanvasTexture(fabricCanvas);
                fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping;
                textureState.fabricTexture = fabricTexture;

                // Create a procedural normal map
                const normalCanvas = document.createElement('canvas');
                normalCanvas.width = 1024;
                normalCanvas.height = 1024;
                const normalCtx = normalCanvas.getContext('2d');

                // Fill with neutral normal (rgb: 128, 128, 255) - facing up in tangent space
                normalCtx.fillStyle = 'rgb(128, 128, 255)';
                normalCtx.fillRect(0, 0, normalCanvas.width, normalCanvas.height);

                // Add subtle normal variations
                for (let x = 0; x < normalCanvas.width; x += 4) {
                    for (let y = 0; y < normalCanvas.height; y += 4) {
                        // Random normal perturbation
                        const r = Math.floor(128 + (Math.random() * 20 - 10));
                        const g = Math.floor(128 + (Math.random() * 20 - 10));
                        normalCtx.fillStyle = `rgb(${r}, ${g}, 255)`;
                        normalCtx.fillRect(x, y, 4, 4);
                    }
                }

                // Create the normal map texture
                const normalTexture = new THREE.CanvasTexture(normalCanvas);
                normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
                textureState.bumpMap = normalTexture;

                // Create base texture
                textureState.baseTexture = createBaseTexture();

                // Setup UI
                setupBoundingBoxes();
                setupInteractions();

                resolve({
                    baseTexture: textureState.baseTexture,
                    bumpMap: textureState.bumpMap
                });
            } else {
                // Use provided textures
                // Code for loading external textures (as before)
                // ...
            }
        } catch (error) {
            console.error("Error initializing texture mapper:", error);
            reject(error);
        }
    });
}

/**
 * Creates a combined texture that includes the base fabric and all custom uploaded images
 * Now with advanced fabric simulation and effects - optimized for performance
 * @returns {THREE.Texture} The combined texture
 */
function createBaseTexture() {
    // Create a canvas to draw the combined texture (reduced resolution for performance)
    const canvas = document.createElement('canvas');
    canvas.width = 1024; // Back to original resolution for better performance
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Get material settings for current model
    const materialSettings = modelConfig[textureState.currentModel].materialSettings || {};

    // Create background with advanced fabric texture simulation (optimized)
    if (textureState.fabricTexture && textureState.fabricTexture.image) {
        // Draw base fabric texture with advanced blending
        ctx.globalAlpha = modelConfig[textureState.currentModel].fabricTextureStrength;
        ctx.drawImage(textureState.fabricTexture.image, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // Add fabric detail but with optimized approach
        // Use downsampled processing for better performance
        const downsampleFactor = 4; // Process fewer pixels
        const sampleWidth = canvas.width / downsampleFactor;
        const sampleHeight = canvas.height / downsampleFactor;

        // Create a smaller temporary canvas for the effects
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sampleWidth;
        tempCanvas.height = sampleHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the original image to the smaller canvas
        tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height,
            0, 0, sampleWidth, sampleHeight);

        // Get image data from the smaller canvas
        const pixelData = tempCtx.getImageData(0, 0, sampleWidth, sampleHeight);
        const data = pixelData.data;

        // Process the downsampled image data
        for (let y = 0; y < sampleHeight; y++) {
            for (let x = 0; x < sampleWidth; x++) {
                const i = (y * sampleWidth + x) * 4;

                // Normalized coordinates for noise function
                const nx = x / sampleWidth;
                const ny = y / sampleHeight;

                // Simplified fabric effects with fewer calculations
                const noise = fbm(nx * 10, ny * 10, 2, 2.0, 0.5) * 0.15;

                // Calculate ambient occlusion
                const ao = calculateAO(x, y, sampleWidth, sampleHeight, tempCanvas, 0.3);

                // Simplified total effect
                const totalEffect = 1.0 + noise;

                // Apply to pixel data with simpler math
                data[i] = Math.min(255, Math.max(0, data[i] * totalEffect * ao));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * totalEffect * ao));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * totalEffect * ao));
            }
        }

        // Put the processed image data back to the small canvas
        tempCtx.putImageData(pixelData, 0, 0);

        // Draw the small canvas back to the main canvas
        ctx.drawImage(tempCanvas, 0, 0, sampleWidth, sampleHeight,
            0, 0, canvas.width, canvas.height);
    } else {
        // Fill with simpler procedural texture for better performance
        ctx.fillStyle = state.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Only apply a basic fabric texture
        const patternSize = 12;
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;

        // Draw a simple grid pattern
        for (let i = 0; i < canvas.height; i += patternSize) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }

        for (let i = 0; i < canvas.width; i += patternSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
    }

    // Composite custom images for each view with optimized blending
    for (const view of availableViews) {
        const imageData = textureState.customImages[view];
        if (imageData.texture && imageData.texture.image) {
            // Get the UV rectangle for this view
            const uvRect = modelConfig[textureState.currentModel].views[view].uvRect;

            // Calculate pixel positions on canvas
            const x = Math.floor(uvRect.u1 * canvas.width);
            const y = Math.floor(uvRect.v1 * canvas.height);
            const width = Math.floor((uvRect.u2 - uvRect.u1) * canvas.width);
            const height = Math.floor((uvRect.v2 - uvRect.v1) * canvas.height);

            // Save context for transformations
            ctx.save();

            // Set up the transformation matrix for this image
            const centerX = x + width / 2;
            const centerY = y + height / 2;

            // Simplified UV analysis for better performance
            const uvAnalysis = {
                stretchFactorU: view.includes('arm') ? 1.1 : 1.0,
                stretchFactorV: 1.0,
                optimalCenterU: 0.5,
                optimalCenterV: 0.5
            };

            // Simplified optimization
            const position = imageData.position;
            const blendFactor = 0.15;
            const optimizedX = position.x * (1 - blendFactor) + 0.5 * blendFactor;
            const optimizedY = position.y * (1 - blendFactor) + 0.5 * blendFactor;

            // Position adjustment based on optimized image position
            const posX = centerX + (optimizedX - 0.5) * width;
            const posY = centerY + (optimizedY - 0.5) * height;

            // Apply transformations with simpler calculations
            ctx.translate(posX, posY);
            ctx.rotate(imageData.rotation * Math.PI / 180);

            // Calculate non-uniform scale with simpler math
            const scaleX = imageData.scale / uvAnalysis.stretchFactorU;
            const scaleY = imageData.scale / uvAnalysis.stretchFactorV;

            // Apply vertical flip and scale
            ctx.scale(scaleX, -scaleY);

            // Draw the image with simplified blending
            const imgWidth = imageData.texture.image.width;
            const imgHeight = imageData.texture.image.height;

            // Apply simple blending for fabric integration
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = 0.9;
            ctx.drawImage(
                imageData.texture.image,
                -imgWidth / 2,
                -imgHeight / 2,
                imgWidth,
                imgHeight
            );

            // Reset composite operation
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;

            // Restore context
            ctx.restore();
        }
    }

    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Add texture to debug view if element exists
    const debugTextureView = document.getElementById('texture-debug-view');
    if (debugTextureView) {
        debugTextureView.innerHTML = '';

        // Clone canvas to debug view for visualization
        const debugCanvas = canvas.cloneNode();
        debugCanvas.getContext('2d').drawImage(canvas, 0, 0);
        debugTextureView.appendChild(debugCanvas);
    }

    return texture;
}

// Simplified analysis function for better performance
function analyzeUVArea(uvRect, view, modelType) {
    // Calculate UV dimensions
    const uWidth = uvRect.u2 - uvRect.u1;
    const vHeight = uvRect.v2 - uvRect.v1;

    // Simplified stretch factors based on view
    let stretchFactorU = 1.0;
    let stretchFactorV = 1.0;

    // Quick approximation for performance
    if (view.includes('arm')) {
        stretchFactorU = 1.1;
        stretchFactorV = 0.95;
    }

    // Default optimal center
    const optimalCenterU = 0.5;
    const optimalCenterV = 0.5;

    return {
        uWidth,
        vHeight,
        stretchFactorU,
        stretchFactorV,
        optimalCenterU,
        optimalCenterV
    };
}

// Simplified functions for better performance
function calculateNonUniformScale(baseScale, stretchU, stretchV) {
    return {
        scaleX: baseScale / stretchU,
        scaleY: baseScale / stretchV
    };
}

function getOptimizedPosition(position, uvAnalysis) {
    const blendFactor = 0.15; // Less optimization for performance

    return {
        x: position.x * (1 - blendFactor) + uvAnalysis.optimalCenterU * blendFactor,
        y: position.y * (1 - blendFactor) + uvAnalysis.optimalCenterV * blendFactor
    };
}

/**
 * Load a custom image for a specific view
 * @param {string} imageUrl - URL of the image to load
 * @param {string} view - The view to apply the image to (front, back, left_arm, right_arm)
 * @returns {Promise} Promise resolving when the image is loaded and applied
 */
export function loadCustomImage(imageUrl, view = 'front') {
    // Map the camera view to our texture map views
    const mappedView = mapCameraViewToTextureView(view);

    return new Promise((resolve, reject) => {
        textureLoader.load(
            imageUrl,
            (texture) => {
                // Store the texture
                textureState.customImages[mappedView].texture = texture;

                // Reset position, rotation and set default scale
                textureState.customImages[mappedView].position = { x: 0.5, y: 0.5 };
                textureState.customImages[mappedView].rotation = 0;
                textureState.customImages[mappedView].scale =
                    modelConfig[textureState.currentModel].views[mappedView].defaultScale;

                // Update the combined texture
                updateCombinedTexture();

                // Show the appropriate bounding box
                showBoundingBox(mappedView);

                // Update active view
                textureState.activeView = mappedView;

                resolve(texture);
            },
            undefined,
            (error) => reject('Error loading image: ' + error)
        );
    });
}

/**
 * Map camera view to texture view
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
 * Update the combined texture and trigger material update
 */
function updateCombinedTexture() {
    textureState.baseTexture = createBaseTexture();

    // Dispatch a custom event that scene.js can listen for
    window.dispatchEvent(
        new CustomEvent('texture-updated', {
            detail: {
                baseTexture: textureState.baseTexture,
                bumpMap: textureState.bumpMap
            }
        })
    );
}

/**
 * Set up interactive bounding boxes for each view
 * Creates and positions visual boxes that represent each mappable area
 */
function setupBoundingBoxes() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Remove any existing bounding boxes
    const existingBoxes = container.querySelectorAll('.texture-bounding-box');
    existingBoxes.forEach(box => box.remove());

    // Create a bounding box UI element for each view
    for (const view of availableViews) {
        const boundingBox = document.createElement('div');
        boundingBox.className = `texture-bounding-box ${view}-view-box`;
        boundingBox.dataset.view = view;
        boundingBox.style.display = 'none';
        boundingBox.style.opacity = '0.1'; // Set opacity to 10%

        // Add title for the box with modern design
        const boxTitle = document.createElement('div');
        boxTitle.className = 'box-title';
        boxTitle.textContent = modelConfig[textureState.currentModel].views[view].name || view;
        boxTitle.style.fontSize = '11px'; // Smaller font size
        boxTitle.style.fontWeight = '600'; // Semibold
        boxTitle.style.padding = '3px 6px';
        boxTitle.style.borderRadius = '4px';
        boxTitle.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        boxTitle.style.color = 'white';
        boxTitle.style.pointerEvents = 'none'; // Don't interfere with interactions
        boundingBox.appendChild(boxTitle);

        // Minimalist drag indicator
        const dragArea = document.createElement('div');
        dragArea.className = 'drag-area';
        dragArea.innerHTML = '<i class="fas fa-arrows-alt"></i>';
        dragArea.style.fontSize = '10px';
        dragArea.style.opacity = '0.8';
        dragArea.style.position = 'absolute';
        dragArea.style.top = '50%';
        dragArea.style.left = '50%';
        dragArea.style.transform = 'translate(-50%, -50%)';
        dragArea.style.pointerEvents = 'none'; // Visual only
        boundingBox.appendChild(dragArea);

        // Create transform controls - smaller and minimalist
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'transform-controls-container';
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.bottom = '3px';
        controlsContainer.style.right = '3px';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.gap = '5px';

        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'transform-handle rotate-handle';
        rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';
        rotateHandle.title = 'Rotate Image';
        rotateHandle.style.fontSize = '8px';
        rotateHandle.style.padding = '3px';
        rotateHandle.style.borderRadius = '50%';
        rotateHandle.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        rotateHandle.style.color = '#333';

        const scaleHandle = document.createElement('div');
        scaleHandle.className = 'transform-handle scale-handle';
        scaleHandle.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
        scaleHandle.title = 'Scale Image';
        scaleHandle.style.fontSize = '8px';
        scaleHandle.style.padding = '3px';
        scaleHandle.style.borderRadius = '50%';
        scaleHandle.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        scaleHandle.style.color = '#333';

        // Add remove button for each view
        const removeButton = document.createElement('div');
        removeButton.className = 'transform-handle remove-handle';
        removeButton.innerHTML = '<i class="fas fa-times"></i>';
        removeButton.title = 'Remove Image';
        removeButton.style.fontSize = '8px';
        removeButton.style.padding = '3px';
        removeButton.style.borderRadius = '50%';
        removeButton.style.backgroundColor = 'rgba(255, 100, 100, 0.7)';
        removeButton.style.color = 'white';

        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            clearCustomImage(view);
        });

        controlsContainer.appendChild(rotateHandle);
        controlsContainer.appendChild(scaleHandle);
        controlsContainer.appendChild(removeButton);
        boundingBox.appendChild(controlsContainer);

        container.appendChild(boundingBox);
    }

    // Update CSS for all boxes to make them smaller
    document.querySelectorAll('.texture-bounding-box').forEach(box => {
        box.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        box.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.1)';
        box.style.transform = 'scale(0.8)'; // Make boxes smaller
    });

    // Initial positioning based on model configuration
    updateBoundingBoxPositions();

    // Create a debug view for the texture if needed
    if (!document.getElementById('texture-debug-view')) {
        const debugView = document.createElement('div');
        debugView.id = 'texture-debug-view';
        debugView.className = 'texture-debug-view';
        debugView.style.display = 'none'; // Hidden by default
        container.appendChild(debugView);
    }
}

/**
 * Update the positions of all bounding boxes based on current model config
 * This ensures bounding boxes match the UV mapping on the 3D model
 */
function updateBoundingBoxPositions() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    for (const view of availableViews) {
        const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        if (!boundingBox) continue;

        // Get specific bounds for this view from model config
        const bounds = modelConfig[textureState.currentModel].views[view].bounds;

        // Calculate pixel positions - make sure the boxes are correctly sized and positioned
        boundingBox.style.left = `${bounds.x * 100}%`;
        boundingBox.style.top = `${bounds.y * 100}%`;
        boundingBox.style.width = `${bounds.width * 100}%`;
        boundingBox.style.height = `${bounds.height * 100}%`;

        // Add a visual indicator of the active area
        boundingBox.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.8)';
    }
}

/**
 * Show bounding boxes appropriate for the current camera view
 * @param {string} cameraView - The current camera view (front, back, left, right)
 */
export function showBoundingBoxesForCameraView(cameraView) {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Hide all bounding boxes first
    const allBoxes = container.querySelectorAll('.texture-bounding-box');
    allBoxes.forEach(box => {
        // Reset 3D transforms
        box.style.transform = 'none';
        box.style.display = 'none';
        // Reset primary status
        box.dataset.primaryView = 'false';
    });

    // Determine which bounding boxes to show based on camera view
    // Now we'll allow multiple boxes to be visible based on the viewable areas
    let visibleViews = [];
    let primaryView = ''; // The main view in focus

    switch (cameraView) {
        case 'front':
            // Front angle shows front and partial arms
            visibleViews = ['front', 'left_arm', 'right_arm'];
            primaryView = 'front';
            break;
        case 'back':
            // Back angle shows back and partial arms
            visibleViews = ['back', 'left_arm', 'right_arm'];
            primaryView = 'back';
            break;
        case 'left':
            // Left side shows left arm and partial front/back
            visibleViews = ['left_arm', 'front', 'back'];
            primaryView = 'left_arm';
            break;
        case 'right':
            // Right side shows right arm and partial front/back
            visibleViews = ['right_arm', 'front', 'back'];
            primaryView = 'right_arm';
            break;
        default:
            // For any custom views, map to the most relevant texture area
            const mappedView = mapCameraViewToTextureView(cameraView);
            visibleViews = [mappedView];
            primaryView = mappedView;
    }

    // Show the visible boxes with 3D perspective effect
    visibleViews.forEach((view, index) => {
        const box = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        if (box) {
            // Only show if there's a texture or it's the active area
            const isPrimary = view === primaryView;

            if (textureState.customImages[view].texture ||
                textureState.activeBoundingBox === view ||
                isPrimary) {

                box.style.display = 'block';

                // Set primary view status
                box.dataset.primaryView = isPrimary ? 'true' : 'false';

                // Apply 3D perspective effect based on camera angle
                apply3DPerspective(box, view, cameraView, isPrimary, index);
            }
        }
    });

    // Update perspective transform based on camera view
    updatePerspectiveTransform(cameraView);

    // Update the active view in the texture state
    textureState.activeView = mapCameraViewToTextureView(cameraView);

    // For debugging
    console.log(`Camera view: ${cameraView}, Visible areas:`, visibleViews);
}

/**
 * Apply 3D perspective effect to make boxes appear to float above the model
 * @param {HTMLElement} box - The bounding box element
 * @param {string} view - The view this box represents
 * @param {string} cameraView - Current camera view
 * @param {boolean} isPrimary - Whether this is the primary view
 * @param {number} index - Index for staggered positioning
 */
function apply3DPerspective(box, view, cameraView, isPrimary, index) {
    // Base elevation (px) - how far the box floats above the model
    const baseElevation = isPrimary ? 50 : 30;

    // Different transformations for each camera angle
    let transform = '';
    let zIndex = 100 + (isPrimary ? 10 : index);

    // Calculate perspective strength based on angle
    const perspectiveStrength = isPrimary ? 1 : 0.7;

    // Apply appropriate transforms based on camera view and area
    switch (cameraView) {
        case 'front':
            if (view === 'front') {
                // Front box is directly facing camera
                transform = `translateZ(${baseElevation}px)`;
            } else if (view === 'left_arm') {
                // Left arm box is angled to the left
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(-30deg) translateX(-20px)`;
            } else if (view === 'right_arm') {
                // Right arm box is angled to the right
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(30deg) translateX(20px)`;
            }
            break;

        case 'back':
            if (view === 'back') {
                // Back box is directly facing camera when in back view
                transform = `translateZ(${baseElevation}px)`;
            } else if (view === 'left_arm') {
                // Left arm is now on the right side when viewing from back
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(30deg) translateX(20px)`;
            } else if (view === 'right_arm') {
                // Right arm is now on the left side when viewing from back
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(-30deg) translateX(-20px)`;
            }
            break;

        case 'left':
            if (view === 'left_arm') {
                // Left arm is primary when in left view
                transform = `translateZ(${baseElevation}px)`;
            } else if (view === 'front') {
                // Front is angled when viewing from left
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(45deg) translateX(15px)`;
            } else if (view === 'back') {
                // Back is angled when viewing from left
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(-45deg) translateX(-15px)`;
            }
            break;

        case 'right':
            if (view === 'right_arm') {
                // Right arm is primary when in right view
                transform = `translateZ(${baseElevation}px)`;
            } else if (view === 'front') {
                // Front is angled when viewing from right
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(-45deg) translateX(-15px)`;
            } else if (view === 'back') {
                // Back is angled when viewing from right
                transform = `translateZ(${baseElevation * 0.7}px) rotateY(45deg) translateX(15px)`;
            }
            break;
    }

    // Apply the 3D transform
    box.style.transform = transform;
    box.style.zIndex = zIndex;

    // Add 3D appearance class
    box.classList.add('box-3d');

    // Add modern material design label with view name
    if (!box.querySelector('.view-label')) {
        const viewLabel = document.createElement('div');
        viewLabel.className = 'view-label';
        viewLabel.innerHTML = `
            <i class="fas fa-layer-group"></i>
            <span>${view.replace('_', ' ').toUpperCase()}</span>
        `;
        box.appendChild(viewLabel);
    }

    // Add modern snapping indicator badges
    if (!box.querySelector('.snap-indicators')) {
        const snapIndicators = document.createElement('div');
        snapIndicators.className = 'snap-indicators';

        // Add position badges that show available positions
        const positions = ['center', 'top', 'bottom', 'left', 'right'];
        positions.forEach(pos => {
            const badge = document.createElement('div');
            badge.className = `snap-badge snap-${pos}`;
            badge.innerHTML = `<i class="fas fa-crosshairs"></i>`;
            badge.title = `Snap to ${pos}`;
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                setTexturePosition(pos, view);
            });
            snapIndicators.appendChild(badge);
        });

        box.appendChild(snapIndicators);
    }

    // Add float animation if primary
    if (isPrimary) {
        box.classList.add('box-float');

        // Add a pulsing highlight effect for the primary box
        box.style.animation = `floatBox 4s ease-in-out infinite${isPrimary ? ', pulseHighlight 2s ease-in-out infinite' : ''}`;
    } else {
        box.classList.remove('box-float');
        box.style.animation = '';
    }
}

/**
 * Show a specific bounding box and hide others
 * @param {string} view - The view to show (front, back, left_arm, right_arm)
 */
function showBoundingBox(view) {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Hide all bounding boxes
    const boxes = container.querySelectorAll('.texture-bounding-box');
    boxes.forEach(box => box.style.display = 'none');

    // Show the requested one
    const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
    if (boundingBox) {
        boundingBox.style.display = 'block';
        textureState.activeBoundingBox = view;
    }

    // Update perspective for the current view
    updatePerspectiveTransform(view);
}

/**
 * Update the 3D perspective transform for bounding boxes based on view
 * @param {string} view - The current view
 */
function updatePerspectiveTransform(view) {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    let perspective = '800px';
    let rotateY = '0deg';
    let rotateX = '0deg';

    // Set rotation angles based on view
    switch (view) {
        case 'front':
            rotateY = '0deg';
            break;
        case 'back':
            rotateY = '180deg';
            break;
        case 'left':
        case 'left_arm':
            rotateY = '-60deg';
            break;
        case 'right':
        case 'right_arm':
            rotateY = '60deg';
            break;
    }

    // Apply transforms to each visible box
    const visibleBoxes = container.querySelectorAll('.texture-bounding-box[style*="display: block"]');
    visibleBoxes.forEach(box => {
        // Apply perspective transform based on the view and box type
        box.style.transform = `perspective(${perspective}) rotateY(${rotateY}) rotateX(${rotateX})`;

        // Add custom transforms for specific boxes
        if (box.classList.contains('left_arm-view-box')) {
            box.style.transform += ' rotateY(-30deg)';
        } else if (box.classList.contains('right_arm-view-box')) {
            box.style.transform += ' rotateY(30deg)';
        }
    });
}

/**
 * Set up event listeners for texture interactions
 */
function setupInteractions() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    // Handle mousedown/touchstart on bounding boxes
    container.addEventListener('mousedown', startTransform);
    container.addEventListener('touchstart', startTransform, { passive: false });

    // Handle mousemove/touchmove
    window.addEventListener('mousemove', moveTransform);
    window.addEventListener('touchmove', moveTransform, { passive: false });

    // Handle mouseup/touchend
    window.addEventListener('mouseup', endTransform);
    window.addEventListener('touchend', endTransform);

    // Handle camera view changes
    window.addEventListener('camera-view-change', (e) => {
        const view = e.detail.view;

        // Map camera view to texture view
        const mappedView = mapCameraViewToTextureView(view);

        // Update active view but don't change the active bounding box
        // This preserves the active editing area across view changes
        textureState.activeView = mappedView;

        // Show the appropriate bounding boxes for this camera view
        showBoundingBoxesForCameraView(view);

        // Add visual feedback about the camera change
        const toastMessage = `Switched to ${view} view`;
        if (typeof showToast === 'function') {
            showToast(toastMessage);
        } else {
            console.log(toastMessage);
        }
    });

    // Listen for model changes
    window.addEventListener('model-loaded', (e) => {
        if (e.detail && e.detail.model) {
            textureState.currentModel = e.detail.model;

            // When model changes, update the bounding boxes
            setupBoundingBoxes();
            updateBoundingBoxPositions();
            updateCombinedTexture();

            // Show the appropriate bounding boxes for current view
            showBoundingBoxesForCameraView(state.cameraView || 'front');
        }
    });

    // Add debug key shortcut to toggle texture debug view
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D to toggle debug view
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            const debugView = document.getElementById('texture-debug-view');
            if (debugView) {
                debugView.style.display = debugView.style.display === 'none' ? 'block' : 'none';
            }
        }

        // Ctrl+Shift+A to toggle all bounding boxes
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            const allBoxes = container.querySelectorAll('.texture-bounding-box');
            const someHidden = Array.from(allBoxes).some(box => box.style.display === 'none');

            allBoxes.forEach(box => {
                box.style.display = someHidden ? 'block' : 'none';
            });
        }
    });

    // Add double-click to create a new image for a view
    container.addEventListener('dblclick', (e) => {
        const boundingBox = e.target.closest('.texture-bounding-box');
        if (boundingBox) {
            const view = boundingBox.dataset.view;
            if (view) {
                // Trigger file upload for this view
                if (typeof triggerFileUploadForView === 'function') {
                    triggerFileUploadForView(view);
                } else {
                    const fileInput = document.getElementById('file-upload');
                    if (fileInput) {
                        // Store the target view in a data attribute
                        fileInput.dataset.targetView = view;
                        fileInput.click();
                    }
                }
            }
        }
    });
}

/**
 * Start a transform operation (drag, scale, or rotate)
 * @param {Event} e - Mouse or touch event
 */
function startTransform(e) {
    e.preventDefault();

    const target = e.target;

    // Find if we're clicking on a bounding box or control
    let boundingBox = null;
    if (target.classList.contains('texture-bounding-box')) {
        boundingBox = target;
    } else if (target.closest('.texture-bounding-box')) {
        boundingBox = target.closest('.texture-bounding-box');
    }

    if (!boundingBox) return;

    const view = boundingBox.dataset.view;

    // If we already have an active bounding box, deactivate it
    if (textureState.activeBoundingBox && textureState.activeBoundingBox !== view) {
        const oldBox = document.querySelector(`.texture-bounding-box.${textureState.activeBoundingBox}-view-box`);
        if (oldBox) {
            oldBox.classList.remove('active');
        }
    }

    textureState.activeBoundingBox = view;

    // Get mouse/touch position
    const pos = getEventPosition(e);
    textureState.lastMousePosition = pos;

    // Determine the action based on what was clicked
    if (target.classList.contains('rotate-handle') || target.closest('.rotate-handle')) {
        textureState.isRotating = true;
    } else if (target.classList.contains('scale-handle') || target.closest('.scale-handle')) {
        textureState.isScaling = true;
    } else if (!target.classList.contains('transform-handle') && !target.closest('.transform-handle')) {
        textureState.isDragging = true;
    }

    // Add active class for visual feedback
    boundingBox.classList.add('active');

    // Add visual feedback - bring this box to front
    const allBoxes = document.querySelectorAll('.texture-bounding-box');
    allBoxes.forEach(box => {
        if (box !== boundingBox) {
            const zIndex = parseInt(box.style.zIndex || '100');
            box.style.zIndex = zIndex - 5;
        } else {
            // Bring active box to front
            box.style.zIndex = '200';
        }
    });

    // If this area doesn't have a texture yet, prompt for upload
    if (!textureState.customImages[view].texture) {
        // If there's no texture for this view, show a prompt
        const fileInput = document.getElementById('file-upload');
        if (fileInput) {
            // Store the target view in a data attribute
            fileInput.dataset.targetView = view;

            // Add toast suggesting upload
            if (typeof showToast === 'function') {
                showToast(`Double-click to add an image to ${view} area`);
            }
        }
    }
}

/**
 * Handle movement during a transform operation
 * @param {Event} e - Mouse or touch event
 */
function moveTransform(e) {
    if (!textureState.isDragging && !textureState.isScaling && !textureState.isRotating) return;
    if (!textureState.activeBoundingBox) return;

    e.preventDefault();

    const view = textureState.activeBoundingBox;
    const imageData = textureState.customImages[view];

    const currentPos = getEventPosition(e);
    const deltaX = currentPos.x - textureState.lastMousePosition.x;
    const deltaY = currentPos.y - textureState.lastMousePosition.y;

    // Get the container dimensions
    const container = document.querySelector('.canvas-container');
    const rect = container.getBoundingClientRect();

    // Handle drag movement
    if (textureState.isDragging) {
        // Calculate position change relative to bounding box size
        const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        const boxWidth = boundingBox.offsetWidth;
        const boxHeight = boundingBox.offsetHeight;

        // Update position - and restrict to the bounding box
        // This ensures the texture stays within the appropriate view area

        // Calculate new position
        const newPosX = imageData.position.x + deltaX / boxWidth;
        const newPosY = imageData.position.y + deltaY / boxHeight;

        // Get scale-adjusted boundaries to ensure image stays visible even when scaled
        const scaleFactor = imageData.scale;
        const maxBound = 1.0;
        const minBound = 0.0;

        // Apply constraints - prevent image from moving entirely out of bounds
        // The constraints use the scale to determine how much of the image can move outside the box
        imageData.position.x = Math.max(minBound, Math.min(maxBound, newPosX));
        imageData.position.y = Math.max(minBound, Math.min(maxBound, newPosY));
    }

    // Handle rotation
    if (textureState.isRotating) {
        // Calculate center of bounding box
        const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        const boxRect = boundingBox.getBoundingClientRect();
        const centerX = boxRect.left + boxRect.width / 2;
        const centerY = boxRect.top + boxRect.height / 2;

        // Calculate angles
        const lastAngle = Math.atan2(
            textureState.lastMousePosition.y - centerY,
            textureState.lastMousePosition.x - centerX
        );
        const currentAngle = Math.atan2(currentPos.y - centerY, currentPos.x - centerX);

        // Convert to degrees and add to current rotation
        const rotation = (currentAngle - lastAngle) * (180 / Math.PI);
        imageData.rotation = (imageData.rotation + rotation) % 360;
    }

    // Handle scaling
    if (textureState.isScaling) {
        // Calculate distance from center
        const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        const boxRect = boundingBox.getBoundingClientRect();
        const centerX = boxRect.left + boxRect.width / 2;
        const centerY = boxRect.top + boxRect.height / 2;

        const lastDist = Math.sqrt(
            Math.pow(textureState.lastMousePosition.x - centerX, 2) +
            Math.pow(textureState.lastMousePosition.y - centerY, 2)
        );
        const currentDist = Math.sqrt(
            Math.pow(currentPos.x - centerX, 2) +
            Math.pow(currentPos.y - centerY, 2)
        );

        // Calculate scale factor
        const scaleFactor = currentDist / lastDist;

        // Apply scaling with reasonable limits to prevent extreme scaling
        imageData.scale = Math.max(0.1, Math.min(3.0, imageData.scale * scaleFactor));
    }

    // Update the texture with the new transforms
    updateCombinedTexture();

    // Update mouse position
    textureState.lastMousePosition = currentPos;
}

/**
 * End a transform operation
 * @param {Event} e - Mouse or touch event
 */
function endTransform(e) {
    if (!textureState.isDragging && !textureState.isScaling && !textureState.isRotating) return;

    // Reset flags
    textureState.isDragging = false;
    textureState.isScaling = false;
    textureState.isRotating = false;

    // Remove active class
    const container = document.querySelector('.canvas-container');
    if (container) {
        const activeBox = container.querySelector('.texture-bounding-box.active');
        if (activeBox) {
            activeBox.classList.remove('active');
        }
    }
}

/**
 * Helper to get position from mouse or touch event
 * @param {Event} e - Mouse or touch event
 * @returns {Object} Position with x and y coordinates
 */
function getEventPosition(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
        return { x: e.clientX, y: e.clientY };
    }
}

/**
 * Change the model type
 * @param {string} modelType - The new model type ('tshirt', 'hoodie', etc)
 */
export function setModelType(modelType) {
    if (modelConfig[modelType]) {
        textureState.currentModel = modelType;
        updateBoundingBoxPositions();
        updateCombinedTexture();

        // Update perspective transforms
        updatePerspectiveTransform(textureState.activeView);
    }
}

/**
 * Remove the custom image for a specific view
 * @param {string} view - The view to clear (front, back, left_arm, right_arm, or 'all')
 */
export function clearCustomImage(view = 'all') {
    if (view === 'all') {
        for (const v of availableViews) {
            textureState.customImages[v].texture = null;
        }
    } else {
        // Map camera view to texture view if needed
        const mappedView = mapCameraViewToTextureView(view);

        if (textureState.customImages[mappedView]) {
            textureState.customImages[mappedView].texture = null;
        }
    }

    // Update the texture
    updateCombinedTexture();

    // Hide bounding boxes for cleared views
    const container = document.querySelector('.canvas-container');
    if (container) {
        if (view === 'all') {
            const boxes = container.querySelectorAll('.texture-bounding-box');
            boxes.forEach(box => box.style.display = 'none');
        } else {
            const mappedView = mapCameraViewToTextureView(view);
            const box = container.querySelector(`.texture-bounding-box.${mappedView}-view-box`);
            if (box) box.style.display = 'none';
        }
    }
}

/**
 * Set texture position using a predefined position preset
 * @param {string} position - Predefined position name (center, top, etc.)
 * @param {string} view - The view to apply the position to (front, back, etc.)
 */
export function setTexturePosition(position, view = null) {
    // If no view is provided, use the active view
    if (!view) {
        view = textureState.activeView;
    }

    // Map camera view to texture view if needed
    const mappedView = mapCameraViewToTextureView(view);

    // Skip if the position doesn't exist
    if (!predefinedPositions[position]) {
        console.warn(`Position "${position}" not found. Available positions: ${Object.keys(predefinedPositions).join(', ')}`);
        return;
    }

    // Skip if the view doesn't exist
    if (!textureState.customImages[mappedView]) {
        console.warn(`View "${mappedView}" not found. Available views: ${Object.keys(textureState.customImages).join(', ')}`);
        return;
    }

    // Get the position preset
    const preset = predefinedPositions[position];

    // Update the image data with the preset values
    const imageData = textureState.customImages[mappedView];
    imageData.position.x = preset.x;
    imageData.position.y = preset.y;
    imageData.scale = preset.scale;
    imageData.rotation = preset.rotation;

    // Update the texture
    updateCombinedTexture();

    // Highlight the active bounding box
    showBoundingBox(mappedView);

    // Provide feedback
    if (typeof showToast === 'function') {
        showToast(`Positioned image to ${position}`);
    }

    return true;
} 