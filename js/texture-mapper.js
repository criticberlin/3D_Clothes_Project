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
        fabricTextureStrength: 0.6,
        bumpMapStrength: 0.05,
        materialSettings: {
            roughness: 0.7,
            metalness: 0.05
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
 * Create the base texture combining fabric texture and any custom images
 * @returns {THREE.Texture} The combined texture
 */
function createBaseTexture() {
    // Create a canvas to draw the combined texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Draw base fabric texture
    if (textureState.fabricTexture && textureState.fabricTexture.image) {
        ctx.globalAlpha = modelConfig[textureState.currentModel].fabricTextureStrength;
        ctx.drawImage(textureState.fabricTexture.image, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    } else {
        // Fill with default color if no fabric texture
        ctx.fillStyle = state.color || '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Composite custom images for each view
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

            // Position adjustment based on image position
            const posX = centerX + (imageData.position.x - 0.5) * width;
            const posY = centerY + (imageData.position.y - 0.5) * height;

            // Apply transformations: translate to position, rotate, and scale
            ctx.translate(posX, posY);
            ctx.rotate(imageData.rotation * Math.PI / 180);
            ctx.scale(imageData.scale, imageData.scale);

            // Draw the image centered at origin
            const imgWidth = imageData.texture.image.width;
            const imgHeight = imageData.texture.image.height;
            ctx.drawImage(
                imageData.texture.image,
                -imgWidth / 2,
                -imgHeight / 2,
                imgWidth,
                imgHeight
            );

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
        const img = new Image();
        img.src = canvas.toDataURL();
        img.style.width = '100%';
        img.style.height = 'auto';
        debugTextureView.appendChild(img);
    }

    return texture;
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

        // Add title for the box
        const boxTitle = document.createElement('div');
        boxTitle.className = 'box-title';
        boxTitle.textContent = modelConfig[textureState.currentModel].views[view].name || view;
        boundingBox.appendChild(boxTitle);

        // Create transform controls
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'transform-handle rotate-handle';
        rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';

        const scaleHandle = document.createElement('div');
        scaleHandle.className = 'transform-handle scale-handle';
        scaleHandle.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';

        boundingBox.appendChild(rotateHandle);
        boundingBox.appendChild(scaleHandle);

        container.appendChild(boundingBox);
    }

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
 */
function updateBoundingBoxPositions() {
    const container = document.querySelector('.canvas-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    for (const view of availableViews) {
        const boundingBox = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        if (!boundingBox) continue;

        const bounds = modelConfig[textureState.currentModel].views[view].bounds;

        // Calculate pixel positions
        boundingBox.style.left = `${bounds.x * 100}%`;
        boundingBox.style.top = `${bounds.y * 100}%`;
        boundingBox.style.width = `${bounds.width * 100}%`;
        boundingBox.style.height = `${bounds.height * 100}%`;
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
    allBoxes.forEach(box => box.style.display = 'none');

    // Determine which bounding boxes to show based on camera view
    let boxesToShow = [];

    switch (cameraView) {
        case 'front':
            boxesToShow = ['front', 'left_arm', 'right_arm'];
            break;
        case 'back':
            boxesToShow = ['back'];
            break;
        case 'left':
            boxesToShow = ['left_arm'];
            break;
        case 'right':
            boxesToShow = ['right_arm'];
            break;
        default:
            boxesToShow = [mapCameraViewToTextureView(cameraView)];
    }

    // Show the appropriate boxes
    boxesToShow.forEach(view => {
        const box = container.querySelector(`.texture-bounding-box.${view}-view-box`);
        if (box && textureState.customImages[view].texture) {
            box.style.display = 'block';
        }
    });

    // Update perspective transform based on camera view
    updatePerspectiveTransform(cameraView);
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
 * Set up mouse/touch interactions for transforming images
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
        textureState.activeView = mapCameraViewToTextureView(view);

        // Show the appropriate bounding boxes for this camera view
        showBoundingBoxesForCameraView(view);
    });

    // Listen for model changes
    window.addEventListener('model-loaded', (e) => {
        if (e.detail && e.detail.model) {
            textureState.currentModel = e.detail.model;
            updateBoundingBoxPositions();
            updateCombinedTexture();
        }
    });

    // Add debug key shortcut to toggle texture debug view
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            const debugView = document.getElementById('texture-debug-view');
            if (debugView) {
                debugView.style.display = debugView.style.display === 'none' ? 'block' : 'none';
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
    textureState.activeBoundingBox = view;

    // Get mouse/touch position
    const pos = getEventPosition(e);
    textureState.lastMousePosition = pos;

    // Determine the action based on what was clicked
    if (target.classList.contains('rotate-handle')) {
        textureState.isRotating = true;
    } else if (target.classList.contains('scale-handle')) {
        textureState.isScaling = true;
    } else {
        textureState.isDragging = true;
    }

    // Add active class for visual feedback
    boundingBox.classList.add('active');
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

        // Update position, keeping within bounds
        imageData.position.x = Math.max(0, Math.min(1, imageData.position.x + deltaX / boxWidth));
        imageData.position.y = Math.max(0, Math.min(1, imageData.position.y + deltaY / boxHeight));
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
        imageData.scale = Math.max(0.1, Math.min(2.0, imageData.scale * scaleFactor));
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