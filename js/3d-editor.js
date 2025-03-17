/**
 * 3D-Editor.js
 * Implements direct 3D editing capabilities for manipulating elements on the 3D model
 * Adapts Fabric.js transformation logic to work in a 3D environment
 */

import * as THREE from 'three';
import { state, updateState } from './state.js';
import { modelConfig } from './texture-mapper.js';
import { Logger, Performance, debounce } from './utils.js';
import { showToast } from './ui.js';

// Global variables
let scene, camera, renderer, raycaster, mouse;
let shirtMesh, textureCanvas;
let selectedObject = null;
let transformMode = 'none'; // none, move, rotate, scale
let startPoint = new THREE.Vector2();
let currentPoint = new THREE.Vector2();
let transformControls = {
    visible: false,
    handles: {
        topLeft: null,
        topRight: null,
        bottomLeft: null,
        bottomRight: null,
        rotationHandle: null
    },
    boundingBox: null
};

// New: Editing mode flags
let isEditingMode = false;
let cameraControlsEnabled = true;
let currentEditableArea = null;

// New: Add global variables to track editing state
let isEditingLocked = false;
let currentLockedView = null;

// References to canvas and other objects
let canvasData = {
    canvas: null,
    ctx: null,
    width: 1024,
    height: 1024,
    objects: []
};

// Cursors for different modes
const cursors = {
    default: 'default',
    move: 'move',
    rotate: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'><path d=\'M16 0 C16 32 16 32 16 32\' stroke=\'black\'/></svg>"), auto',
    scale: 'nwse-resize',
    // New: Add editing cursors
    edit: 'crosshair'
};

// Add global variables for drag-and-drop and advanced features
let isDragAndDropEnabled = true;
let smartImagePlacement = true;
let autoAdjustmentEnabled = true;
let lastUsedView = null;

// Clipboard functionality
let clipboard = null;

// History for undo/redo functionality
const historyStack = {
    undoStack: [],
    redoStack: [],
    maxStackSize: 20,

    // Save current state to history
    saveState() {
        // Create a deep copy of the current objects
        const currentState = JSON.stringify(canvasData.objects.map(obj => {
            // Create a copy without circular references
            const copy = { ...obj };

            // For image objects, store the source instead of the image object
            if (obj.type === 'image' && obj.img) {
                copy.imgSrc = obj.img.src;
                delete copy.img;
            }

            return copy;
        }));

        // Push to undo stack
        this.undoStack.push(currentState);

        // Clear redo stack since we've made a new change
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
    }
};

/**
 * Initialize the 3D editor
 * @param {THREE.Scene} threeScene - The Three.js scene
 * @param {THREE.Camera} threeCamera - The Three.js camera
 * @param {THREE.WebGLRenderer} threeRenderer - The Three.js renderer
 * @param {THREE.Mesh} targetMesh - The mesh to apply textures to
 */
export function init3DEditor(threeScene, threeCamera, threeRenderer, targetMesh) {
    scene = threeScene;
    camera = threeCamera;
    renderer = threeRenderer;
    shirtMesh = targetMesh;

    // Initialize raycaster for object selection
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Create a new canvas for texture manipulation
    createTextureCanvas();

    // Setup event listeners for 3D interaction
    setupEventListeners();

    // Setup drag and drop directly on the 3D view
    setupDragAndDropOn3DView();

    // Initial texture update
    updateShirt3DTexture();

    // Initialize history stack
    historyStack.undoStack = [];
    historyStack.redoStack = [];
    historyStack.saveState();

    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = 'Loading models...';
    }

    Logger.log('3D Editor initialized');
}

/**
 * Create a canvas for texture manipulation
 */
function createTextureCanvas() {
    // Create a new canvas element
    textureCanvas = document.createElement('canvas');
    textureCanvas.width = canvasData.width;
    textureCanvas.height = canvasData.height;

    // Store canvas and context in canvasData
    canvasData.canvas = textureCanvas;
    canvasData.ctx = textureCanvas.getContext('2d');

    // Set background to transparent
    canvasData.ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
}

/**
 * Setup event listeners for 3D interaction
 */
function setupEventListeners() {
    const canvas = renderer.domElement;

    // Mouse events
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);

    // Keyboard events
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);
}

/**
 * Handle mouse down events for selection and transformation
 * @param {MouseEvent} event 
 */
function onMouseDown(event) {
    // Get normalized mouse coordinates
    updateMousePosition(event);

    // Store starting point for transformations
    startPoint.x = mouse.x;
    startPoint.y = mouse.y;
    currentPoint.copy(startPoint);

    // Cast a ray to detect intersection with the shirt
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length > 0) {
        // We hit the shirt model - check if we're in an editable area
        const uv = intersects[0].uv;
        const hitView = detectViewFromUV(uv);

        if (hitView) {
            // We clicked inside a valid UV rectangle (editable area)
            if (!isEditingLocked || currentLockedView !== hitView) {
                // Lock to this view if not already locked
                lockToView(hitView);
            }

            // Handle object selection and transformation in the editable area
            handleEditableAreaClick(uv, intersects[0]);
        } else {
            // Clicked on shirt but outside any editable area
            if (isEditingLocked) {
                // User clicked outside editable area, unlock
                unlockFromView();
            }

            // Regular shirt interaction (rotate model, etc.)
            if (selectedObject) {
                deselectObject();
            }
            transformMode = 'none';
            document.body.style.cursor = cursors.default;
        }
    } else {
        // Clicked completely outside the shirt
        if (isEditingLocked) {
            unlockFromView();
        }

        if (selectedObject) {
            deselectObject();
        }
        transformMode = 'none';
        document.body.style.cursor = cursors.default;
    }
}

/**
 * Handle mouse move events for transformation
 * @param {MouseEvent} event 
 */
function onMouseMove(event) {
    // Update mouse position
    updateMousePosition(event);

    // If we're not in a transform mode, check for hover effects
    if (transformMode === 'none') {
        updateHoverState();
        return;
    }

    // Store current point for transformations
    currentPoint.x = mouse.x;
    currentPoint.y = mouse.y;

    // Calculate delta movement
    const deltaX = currentPoint.x - startPoint.x;
    const deltaY = currentPoint.y - startPoint.y;

    // Apply transformation based on mode
    if (selectedObject) {
        if (transformMode === 'move') {
            moveObject(selectedObject, deltaX, deltaY);
        } else if (transformMode === 'rotate') {
            rotateObject(selectedObject, deltaX, deltaY);
        } else if (transformMode === 'scale') {
            scaleObject(selectedObject, deltaX, deltaY);
        }

        // Update the texture
        debounce(updateShirt3DTexture, 50)();

        // Update the transform controls
        updateTransformControls();
    }

    // Update the starting point for smooth transformations
    startPoint.copy(currentPoint);
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event 
 */
function onMouseUp(event) {
    if (transformMode !== 'none') {
        // Finalize any transformations
        updateShirt3DTexture();

        // Reset cursor
        document.body.style.cursor = cursors.default;
    }

    transformMode = 'none';
}

/**
 * Handle click events for selection
 * @param {MouseEvent} event 
 */
function onClick(event) {
    // This is handled in mouseDown and mouseUp events
}

/**
 * Update mouse position based on event
 * @param {MouseEvent} event 
 */
function updateMousePosition(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Detect if user clicked on a transform handle
 * @returns {string} The transform mode or null
 */
function detectTransformHandleClick() {
    if (!transformControls.visible || !selectedObject) return null;

    // Get the model UV position from the raycaster
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length === 0) return null;

    const uv = intersects[0].uv;
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;

    // Object center and dimensions
    const centerX = selectedObject.left + selectedObject.width / 2;
    const centerY = selectedObject.top + selectedObject.height / 2;
    const width = selectedObject.width;
    const height = selectedObject.height;
    const angle = selectedObject.angle || 0;

    // Increase handle size for easier selection
    const handleSize = 12; // Increased from 8 for easier selection
    const rotationHandleOffset = 25; // Increased from 20 to make it easier to grab

    // Convert mouse position to object-relative coordinates
    // This accounts for object rotation
    const relX = (x - centerX);
    const relY = (y - centerY);

    // Apply inverse rotation to get coordinates in the object's local space
    const radians = -angle * Math.PI / 180;
    const localX = relX * Math.cos(radians) - relY * Math.sin(radians);
    const localY = relX * Math.sin(radians) + relY * Math.cos(radians);

    // Check if the rotation handle was clicked with increased tolerance
    const rotationHandleDistanceToCenter = Math.sqrt(
        Math.pow(localX, 2) +
        Math.pow(localY + height / 2 + rotationHandleOffset, 2)
    );

    if (rotationHandleDistanceToCenter <= handleSize * 1.5) { // Increased hit area
        return 'rotate';
    }

    // Check if any corner handles were clicked with increased tolerance

    // Define the corners in local object space
    const corners = [
        { x: -width / 2, y: -height / 2, mode: 'scale' }, // Top-left
        { x: width / 2, y: -height / 2, mode: 'scale' },  // Top-right
        { x: -width / 2, y: height / 2, mode: 'scale' },  // Bottom-left
        { x: width / 2, y: height / 2, mode: 'scale' }    // Bottom-right
    ];

    // Check each corner with increased tolerance
    for (const corner of corners) {
        const distanceToCorner = Math.sqrt(
            Math.pow(localX - corner.x, 2) +
            Math.pow(localY - corner.y, 2)
        );

        if (distanceToCorner <= handleSize * 1.5) { // Increased hit area
            return corner.mode;
        }
    }

    // Check if we're inside the object (for move) with a slightly larger hit area
    const padding = 5; // Add padding to make selection easier
    if (
        localX >= -width / 2 - padding &&
        localX <= width / 2 + padding &&
        localY >= -height / 2 - padding &&
        localY <= height / 2 + padding
    ) {
        return 'move';
    }

    return null;
}

/**
 * Detect if an object was clicked
 * @returns {Object} The clicked object or null
 */
function detectObjectClick() {
    raycaster.setFromCamera(mouse, camera);

    // Check UV position on the model
    const intersects = raycaster.intersectObject(shirtMesh);
    if (intersects.length > 0) {
        const uv = intersects[0].uv;

        // Find which element is at this UV position
        for (const obj of canvasData.objects) {
            if (isPointInObject(uv, obj)) {
                return obj;
            }
        }
    }

    return null;
}

/**
 * Check if a UV point is inside an object
 * @param {THREE.Vector2} uv - The UV coordinates
 * @param {Object} object - The object to check
 * @returns {boolean}
 */
function isPointInObject(uv, object) {
    // Convert UV to object space
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;

    // Check if point is inside object bounds
    const left = object.left;
    const top = object.top;
    const right = left + object.width;
    const bottom = top + object.height;

    return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Detect if a point is on the selected object
 * @param {Object} object - The object to check
 * @returns {boolean}
 */
function detectObjectIntersection(object) {
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(shirtMesh);
    if (intersects.length > 0) {
        const uv = intersects[0].uv;
        return isPointInObject(uv, object);
    }

    return false;
}

/**
 * Select an object
 * @param {Object} object 
 */
function selectObject(object) {
    selectedObject = object;

    // Create transform controls for the object
    createTransformControls(object);

    // Set the object as active
    object.active = true;

    Logger.log('Selected object:', object);
}

/**
 * Deselect current object
 */
function deselectObject() {
    if (selectedObject) {
        selectedObject.active = false;
        selectedObject = null;

        // Remove transform controls
        removeTransformControls();

        Logger.log('Deselected object');
    }
}

/**
 * Create transform controls for an object
 * @param {Object} object 
 */
function createTransformControls(object) {
    // Create bounding box and handles
    // This is a placeholder - implementation will depend on how we represent
    // these elements in the 3D space and shader

    transformControls.visible = true;

    Logger.log('Created transform controls');
}

/**
 * Remove transform controls
 */
function removeTransformControls() {
    transformControls.visible = false;

    Logger.log('Removed transform controls');
}

/**
 * Update transform controls position and size
 */
function updateTransformControls() {
    if (!selectedObject || !transformControls.visible) return;

    // Update position and size of controls based on selected object
    // This is a placeholder

    Logger.log('Updated transform controls');
}

/**
 * Update hover state based on mouse position
 */
function updateHoverState() {
    raycaster.setFromCamera(mouse, camera);

    // Check if we're hovering over an object
    const objectHovered = detectObjectClick();

    if (objectHovered) {
        document.body.style.cursor = cursors.move;
    } else {
        document.body.style.cursor = cursors.default;
    }
}

/**
 * Move an object based on delta
 * @param {Object} object - The object to move
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 */
function moveObject(object, deltaX, deltaY) {
    // Get view configuration
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return;

    // Convert screen space delta to UV space delta with advanced calculations
    const deltaUV = screenToUVDelta(deltaX, deltaY);

    // Get object's current position in UV space
    const objLeftUV = object.left / canvasData.width;
    const objTopUV = object.top / canvasData.height;

    // Calculate distortion factor based on position in UV map
    // Objects near edges might need to move differently due to UV distortion
    let distortionFactorX = 1.0;
    let distortionFactorY = 1.0;

    // Check if we're near edges of UV map where distortion might occur
    const edgeThreshold = 0.1;
    const uvRect = viewConfig.uvRect;

    // Adjust for distortion near edges - apply progressively stronger correction
    if (objLeftUV < uvRect.u1 + edgeThreshold) {
        // Left edge distortion correction
        distortionFactorX = 0.8 + (0.2 * (objLeftUV - uvRect.u1) / edgeThreshold);
    } else if (objLeftUV > uvRect.u2 - edgeThreshold) {
        // Right edge distortion correction
        distortionFactorX = 0.8 + (0.2 * (uvRect.u2 - objLeftUV) / edgeThreshold);
    }

    if (objTopUV < uvRect.v1 + edgeThreshold) {
        // Top edge distortion correction
        distortionFactorY = 0.8 + (0.2 * (objTopUV - uvRect.v1) / edgeThreshold);
    } else if (objTopUV > uvRect.v2 - edgeThreshold) {
        // Bottom edge distortion correction
        distortionFactorY = 0.8 + (0.2 * (uvRect.v2 - objTopUV) / edgeThreshold);
    }

    // Apply curvature correction based on model type and view
    // For curved surfaces like sleeves, additional correction is needed
    if (state.cameraView === 'left' || state.cameraView === 'right') {
        // Sleeves require special treatment due to curved surface
        const distanceFromCenter = Math.abs(objLeftUV - ((uvRect.u1 + uvRect.u2) / 2));
        const curvatureCorrection = 1.0 - (distanceFromCenter * 0.5);
        distortionFactorX *= curvatureCorrection;
    }

    // Apply the final movement with all corrections
    object.left += deltaUV.x * canvasData.width * distortionFactorX;
    object.top += deltaUV.y * canvasData.height * distortionFactorY;

    // Apply advanced constraints to keep object in valid UV space
    constrainObjectToUVBoundary(object);

    Logger.log('Moved object with advanced calculations');
}

/**
 * Rotate an object based on delta
 * @param {Object} object - The object to rotate
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 */
function rotateObject(object, deltaX, deltaY) {
    // Get view configuration
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return;

    // Get the center of the object in UV space
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;
    const centerU = centerX / canvasData.width;
    const centerV = centerY / canvasData.height;

    // Cast a ray to get current mouse position in world space
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length > 0) {
        const uv = intersects[0].uv;
        const worldPoint = intersects[0].point;
        const x = uv.x * canvasData.width;
        const y = uv.y * canvasData.height;

        // Calculate angle between center and current point more accurately
        // by considering 3D curvature
        const angle = Math.atan2(y - centerY, x - centerX);

        // Account for surface normal at the intersection point for more accurate rotation
        const normal = intersects[0].face.normal.clone();
        normal.transformDirection(shirtMesh.matrixWorld);

        // Adjust rotation based on surface orientation
        const upVector = new THREE.Vector3(0, 1, 0);
        const rightVector = new THREE.Vector3(1, 0, 0);
        const normalizedNormal = normal.normalize();

        // Calculate dot products to determine surface orientation
        const surfaceUp = upVector.dot(normalizedNormal);
        const surfaceRight = rightVector.dot(normalizedNormal);

        // Calculate rotation adjustment factor based on surface normal
        // This makes rotation more accurate on curved surfaces
        let rotationAdjustment = 1.0;

        // If the surface is highly curved (normal deviates significantly from z-axis),
        // adjust rotation sensitivity
        if (Math.abs(normalizedNormal.z) < 0.8) {
            rotationAdjustment = Math.max(0.5, Math.abs(normalizedNormal.z));
        }

        // Store the last angle if it's the first time
        if (object._lastRotationAngle === undefined) {
            object._lastRotationAngle = angle;
            return;
        }

        // Calculate the angle difference with adjustment for surface curvature
        let angleDelta = angle - object._lastRotationAngle;

        // Apply perspective correction based on camera position
        const cameraPosition = camera.position.clone();
        const distanceToIntersection = cameraPosition.distanceTo(worldPoint);
        const fovFactor = Math.tan(camera.fov * Math.PI / 360) * distanceToIntersection;

        // Normalize angleDelta to avoid jumps
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

        // Convert to degrees for better sensitivity, apply adjustments
        angleDelta *= (180 / Math.PI) * rotationAdjustment;

        // Apply view-specific rotation adjustments if available
        if (viewConfig.transformMatrix && viewConfig.transformMatrix.rotation) {
            const viewRotation = viewConfig.transformMatrix.rotation * Math.PI / 180;
            angleDelta *= Math.cos(viewRotation);
        }

        // Update the object's rotation with smooth dampening
        const smoothingFactor = 0.8; // Lower = more dampening
        object.angle = (object.angle || 0) + (angleDelta * smoothingFactor);

        // Store the current angle for next time
        object._lastRotationAngle = angle;
    } else {
        // Fallback to a simpler method if ray doesn't hit
        const rotationFactor = 2.5; // Adjusted for better sensitivity
        const rotationDelta = deltaX * rotationFactor;
        object.angle = (object.angle || 0) + rotationDelta;
    }

    Logger.log('Rotated object with advanced calculations');
}

/**
 * Scale an object based on delta
 * @param {Object} object - The object to scale
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 */
function scaleObject(object, deltaX, deltaY) {
    // Get view configuration
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return;

    // Get advanced world space deltas with perspective correction
    const worldDeltas = screenToUVDelta(deltaX, deltaY);

    // Get object center in both pixel and UV coordinates
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;
    const centerU = centerX / canvasData.width;
    const centerV = centerY / canvasData.height;

    // Cast a ray to get exact position on the 3D model
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    let scaleFactor = 1.0;
    let scaleX = 1.0;
    let scaleY = 1.0;

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const uv = intersection.uv;
        const worldPoint = intersection.point;

        // Calculate distance from object center to cursor in UV space
        const pixelX = uv.x * canvasData.width;
        const pixelY = uv.y * canvasData.height;
        const dx = pixelX - centerX;
        const dy = pixelY - centerY;
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);

        // Get surface normal at the intersection point
        const normal = intersection.face.normal.clone();
        normal.transformDirection(shirtMesh.matrixWorld);

        // Calculate UV distortion factor based on surface normal
        // This accounts for stretching of textures on curved surfaces
        const uvDistortionX = Math.max(0.5, Math.abs(normal.z));
        const uvDistortionY = Math.max(0.5, Math.abs(normal.z));

        // Calculate weighted scale factor based on mouse movement direction
        // and distance from center
        const movementMagnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const movementDirection = new THREE.Vector2(deltaX, deltaY).normalize();

        // Calculate dot product to determine if scaling up or down
        const movementFromCenter = new THREE.Vector2(dx, dy).normalize();
        const scalingDirection = movementFromCenter.dot(movementDirection);

        // Base scale factor on distance from center and movement magnitude
        const distanceFactor = Math.min(1.0, distanceToCenter / 100);
        const baseFactor = movementMagnitude * 2 * (scalingDirection > 0 ? 1 : -1);

        // Apply scale with non-linear scaling for better precision at different sizes
        if (object.width < 50 || object.height < 50) {
            // For small objects, make scaling more gradual
            scaleFactor = 1 + (baseFactor * distanceFactor * 0.5);
        } else {
            // For larger objects, normal scaling
            scaleFactor = 1 + (baseFactor * distanceFactor);
        }

        // Apply different scaling factors for X and Y if needed, based on UV distortion
        scaleX = Math.pow(scaleFactor, uvDistortionX);
        scaleY = Math.pow(scaleFactor, uvDistortionY);

        // Adjust for view-specific transformations
        if (viewConfig.transformMatrix && viewConfig.transformMatrix.scale) {
            const { x: transformScaleX, y: transformScaleY } = viewConfig.transformMatrix.scale;
            scaleX = Math.pow(scaleX, 1 / (transformScaleX || 1));
            scaleY = Math.pow(scaleY, 1 / (transformScaleY || 1));
        }
    } else {
        // Fallback if ray doesn't hit
        const scaleMagnitude = Math.max(Math.abs(worldDeltas.x * 3), Math.abs(worldDeltas.y * 3));
        const scaleDirection = (deltaX > 0 || deltaY > 0) ? 1 : -1;
        scaleFactor = 1 + (scaleMagnitude * scaleDirection);
        scaleX = scaleY = scaleFactor;
    }

    // Apply minimum and maximum scale constraints
    const minDimension = 20; // Minimum size in pixels
    const maxDimension = Math.min(canvasData.width, canvasData.height) * 0.8; // Maximum size (80% of canvas)

    // Calculate new dimensions
    let newWidth = Math.max(minDimension, Math.min(maxDimension, object.width * scaleX));
    let newHeight = Math.max(minDimension, Math.min(maxDimension, object.height * scaleY));

    // Optional: maintain aspect ratio for certain objects (like images)
    if (object.type === 'image' && object.preserveAspectRatio !== false) {
        const originalAspect = object.img.width / object.img.height;
        // Use the dimension that changed more as the primary scale
        if (Math.abs(newWidth / object.width) > Math.abs(newHeight / object.height)) {
            newHeight = newWidth / originalAspect;
        } else {
            newWidth = newHeight * originalAspect;
        }

        // Check bounds again after aspect ratio adjustment
        if (newHeight > maxDimension) {
            newHeight = maxDimension;
            newWidth = newHeight * originalAspect;
        }
        if (newWidth > maxDimension) {
            newWidth = maxDimension;
            newHeight = newWidth / originalAspect;
        }
    }

    // Update object properties - keep centered at original point
    const widthDiff = newWidth - object.width;
    const heightDiff = newHeight - object.height;
    object.width = newWidth;
    object.height = newHeight;
    object.left = centerX - newWidth / 2;
    object.top = centerY - newHeight / 2;

    // Ensure object stays within boundaries with the new size
    constrainObjectToUVBoundary(object);

    Logger.log('Scaled object with advanced calculations');
}

/**
 * Convert screen space delta to UV space delta
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 * @returns {THREE.Vector2} Delta in UV space
 */
function screenToUVDelta(deltaX, deltaY) {
    // Get current view's UV boundaries
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return new THREE.Vector2(0, 0);

    // Get the UV rectangle for the current view
    const uvRect = viewConfig.uvRect;

    // Get the current camera parameters
    const cameraDistance = camera.position.length();
    const fov = camera.fov * (Math.PI / 180); // Convert to radians

    // Calculate the visible height at the object's distance
    const visibleHeight = 2 * Math.tan(fov / 2) * cameraDistance;
    const visibleWidth = visibleHeight * camera.aspect;

    // Calculate scaling factors
    const uvWidth = uvRect.u2 - uvRect.u1;
    const uvHeight = uvRect.v2 - uvRect.v1;

    // Take into account camera perspective and model orientation
    // The scaling factor is affected by camera FOV, distance, and rotation
    const xScale = uvWidth / visibleWidth;
    const yScale = uvHeight / visibleHeight;

    // Get camera view direction to adjust for perspective
    const viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);

    // Adjust for camera angle to the surface
    const surfaceNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(shirtMesh.quaternion);
    const dotProduct = Math.abs(viewDirection.dot(surfaceNormal));

    // Apply perspective correction
    const perspectiveCorrection = Math.max(0.5, dotProduct);

    // Apply model-specific transformations if available
    let finalDeltaX = deltaX * xScale * perspectiveCorrection;
    let finalDeltaY = deltaY * yScale * perspectiveCorrection;

    // Apply view-specific transformations if available
    if (viewConfig.transformMatrix) {
        const { scale, rotation, offset } = viewConfig.transformMatrix;
        if (scale) {
            finalDeltaX *= scale.x || 1;
            finalDeltaY *= scale.y || 1;
        }

        // Apply rotation transformation if needed
        if (rotation) {
            const rad = rotation * Math.PI / 180;
            const cosTheta = Math.cos(rad);
            const sinTheta = Math.sin(rad);
            const rotatedX = finalDeltaX * cosTheta - finalDeltaY * sinTheta;
            const rotatedY = finalDeltaX * sinTheta + finalDeltaY * cosTheta;
            finalDeltaX = rotatedX;
            finalDeltaY = rotatedY;
        }
    }

    return new THREE.Vector2(finalDeltaX, finalDeltaY);
}

/**
 * Ensure object stays within UV boundaries with advanced 3D mapping
 * @param {Object} object 
 */
function constrainObjectToUVBoundary(object) {
    // Get current view's UV boundaries from config
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return;

    // Get the UV rectangle for the current view
    const uvRect = viewConfig.uvRect;

    // Calculate boundaries in canvas space
    const minX = uvRect.u1 * canvasData.width;
    const maxX = uvRect.u2 * canvasData.width;
    const minY = uvRect.v1 * canvasData.height;
    const maxY = uvRect.v2 * canvasData.height;

    // Get object boundaries, accounting for rotation
    let objectBounds = {
        left: object.left,
        right: object.left + object.width,
        top: object.top,
        bottom: object.top + object.height,
    };

    // If object is rotated, we need to calculate the rotated bounding box
    if (object.angle && object.angle !== 0) {
        const centerX = object.left + object.width / 2;
        const centerY = object.top + object.height / 2;
        const angleRad = object.angle * Math.PI / 180;

        // Calculate the rotated corners of the object
        const halfWidth = object.width / 2;
        const halfHeight = object.height / 2;

        // Calculate the four corners of the unrotated box
        const corners = [
            { x: -halfWidth, y: -halfHeight },  // Top-left
            { x: halfWidth, y: -halfHeight },   // Top-right
            { x: halfWidth, y: halfHeight },    // Bottom-right
            { x: -halfWidth, y: halfHeight }    // Bottom-left
        ];

        // Rotate each corner and find the extreme points
        let minRotX = Number.MAX_VALUE;
        let maxRotX = -Number.MAX_VALUE;
        let minRotY = Number.MAX_VALUE;
        let maxRotY = -Number.MAX_VALUE;

        corners.forEach(corner => {
            // Apply rotation transformation
            const rotX = corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
            const rotY = corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);

            // Update extreme points
            minRotX = Math.min(minRotX, rotX);
            maxRotX = Math.max(maxRotX, rotX);
            minRotY = Math.min(minRotY, rotY);
            maxRotY = Math.max(maxRotY, rotY);
        });

        // Calculate the new bounding box that contains the rotated object
        objectBounds = {
            left: centerX + minRotX,
            right: centerX + maxRotX,
            top: centerY + minRotY,
            bottom: centerY + maxRotY
        };
    }

    // Calculate a padding factor based on the view type
    // Sleeves and curved areas need more padding to account for distortion
    let paddingFactor = 0.02; // 2% padding by default
    if (state.cameraView === 'left_arm' || state.cameraView === 'right_arm') {
        paddingFactor = 0.05; // 5% padding for sleeves
    }

    // Apply padding to boundaries
    const paddingX = (maxX - minX) * paddingFactor;
    const paddingY = (maxY - minY) * paddingFactor;

    const effectiveMinX = minX + paddingX;
    const effectiveMaxX = maxX - paddingX;
    const effectiveMinY = minY + paddingY;
    const effectiveMaxY = maxY - paddingY;

    // Determine if object exceeds boundaries
    const exceededLeft = objectBounds.left < effectiveMinX;
    const exceededRight = objectBounds.right > effectiveMaxX;
    const exceededTop = objectBounds.top < effectiveMinY;
    const exceededBottom = objectBounds.bottom > effectiveMaxY;

    // Apply different constraints based on rotation and object size
    if (object.angle && Math.abs(object.angle) > 5) {
        // For rotated objects, we need to adjust the object's center
        // Calculate the needed adjustment
        let adjustX = 0;
        let adjustY = 0;

        if (exceededLeft) {
            adjustX = effectiveMinX - objectBounds.left;
        } else if (exceededRight) {
            adjustX = effectiveMaxX - objectBounds.right;
        }

        if (exceededTop) {
            adjustY = effectiveMinY - objectBounds.top;
        } else if (exceededBottom) {
            adjustY = effectiveMaxY - objectBounds.bottom;
        }

        // Apply the adjustments to the center of the object
        object.left += adjustX;
        object.top += adjustY;
    } else {
        // For non-rotated objects or slight rotations, use simpler constraints
        // Constrain left/right
        if (objectBounds.left < effectiveMinX) {
            object.left = effectiveMinX;
        } else if (objectBounds.right > effectiveMaxX) {
            object.left = effectiveMaxX - object.width;
        }

        // Constrain top/bottom
        if (objectBounds.top < effectiveMinY) {
            object.top = effectiveMinY;
        } else if (objectBounds.bottom > effectiveMaxY) {
            object.top = effectiveMaxY - object.height;
        }
    }

    // Apply additional specific adjustments for extreme cases
    // If object is too large for the boundary, scale it down
    const availableWidth = effectiveMaxX - effectiveMinX;
    const availableHeight = effectiveMaxY - effectiveMinY;

    if (object.width > availableWidth * 0.95) {
        // Object is wider than 95% of available space
        const newWidth = availableWidth * 0.95;
        const scaleRatio = newWidth / object.width;

        // Scale height proportionally
        const newHeight = object.height * scaleRatio;

        // Update object size while keeping center position
        const centerX = object.left + object.width / 2;
        const centerY = object.top + object.height / 2;

        object.width = newWidth;
        object.height = newHeight;
        object.left = centerX - newWidth / 2;
        object.top = centerY - newHeight / 2;
    }

    if (object.height > availableHeight * 0.95) {
        // Object is taller than 95% of available space
        const newHeight = availableHeight * 0.95;
        const scaleRatio = newHeight / object.height;

        // Scale width proportionally
        const newWidth = object.width * scaleRatio;

        // Update object size while keeping center position
        const centerX = object.left + object.width / 2;
        const centerY = object.top + object.height / 2;

        object.width = newWidth;
        object.height = newHeight;
        object.left = centerX - newWidth / 2;
        object.top = centerY - newHeight / 2;
    }
}

/**
 * Update the 3D shirt texture based on canvas data
 */
function updateShirt3DTexture() {
    if (!canvasData.canvas || !shirtMesh || !shirtMesh.material) return;

    // Clear canvas
    canvasData.ctx.clearRect(0, 0, canvasData.width, canvasData.height);

    // Draw all objects
    for (const obj of canvasData.objects) {
        drawObjectToCanvas(obj);
    }

    // Draw editable areas if enabled
    if (state.showEditableAreas) {
        drawEditableAreas(canvasData.ctx);
    }

    // Draw selection if we have a selected object
    if (selectedObject && transformControls.visible) {
        drawSelectionOverlay(selectedObject);
    }

    // If in editing mode, highlight the current editable area
    if (isEditingMode && currentEditableArea) {
        highlightEditableArea(currentEditableArea);
    }

    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvasData.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    // Save the current shirt color
    const currentColor = shirtMesh.material.color.clone();

    // Apply the texture to the shirt material
    if (shirtMesh.material.map) {
        shirtMesh.material.map.dispose();
    }

    // Set the texture map
    shirtMesh.material.map = texture;

    // Important: Preserve the shirt color when applying textures
    // Ensure color is preserved properly for dark colors like black
    shirtMesh.material.color.copy(currentColor);

    // Fix for black and dark colored shirts to ensure proper rendering
    if (currentColor.r < 0.1 && currentColor.g < 0.1 && currentColor.b < 0.1) {
        // For very dark colors, adjust the rendering to preserve black
        shirtMesh.material.colorWrite = true;
        shirtMesh.material.blending = THREE.NormalBlending;
    }

    // Set material to update and render
    shirtMesh.material.needsUpdate = true;

    // Render scene with new texture
    renderer.render(scene, camera);

    Logger.log('Updated 3D texture');
}

/**
 * Draw an object to the canvas
 * @param {Object} object 
 */
function drawObjectToCanvas(object) {
    const ctx = canvasData.ctx;

    // Save context state
    ctx.save();

    // Apply transformations
    ctx.translate(object.left + object.width / 2, object.top + object.height / 2);
    if (object.angle) ctx.rotate(object.angle * Math.PI / 180);

    // Draw based on object type
    if (object.type === 'image' && object.img) {
        // Add vertical flip transformation to fix upside-down images

        // Draw the image with natural colors
        ctx.globalCompositeOperation = 'source-over';

        // Draw the image
        ctx.drawImage(
            object.img,
            -object.width / 2,
            -object.height / 2,
            object.width,
            object.height
        );

        // Apply a white filter only if removeColor is explicitly set to true
        if (object.removeColor === true) {
            ctx.globalCompositeOperation = 'luminosity';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);
        }
    } else if (object.type === 'text') {

        ctx.font = `${object.fontSize || 20}px ${object.fontFamily || 'Arial'}`;
        ctx.fillStyle = object.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(object.text, 0, 0);
    } else if (object.type === 'shape') {

        ctx.fillStyle = object.fill || '#000000';
        ctx.strokeStyle = object.stroke || '#000000';
        ctx.lineWidth = object.strokeWidth || 1;

        if (object.shape === 'rect') {

            ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);
            if (object.strokeWidth) {
                ctx.strokeRect(-object.width / 2, -object.height / 2, object.width, object.height);
            }
        } else if (object.shape === 'circle') {

            const radius = Math.min(object.width, object.height) / 2;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            if (object.strokeWidth) {
                ctx.stroke();
            }
        }
    }

    // Restore context state
    ctx.restore();
}

/**
 * Draw selection overlay for selected object
 * @param {Object} object 
 */
function drawSelectionOverlay(object) {
    const ctx = canvasData.ctx;

    // Save context state
    ctx.save();

    // Apply transformations
    ctx.translate(object.left + object.width / 2, object.top + object.height / 2);
    if (object.angle) ctx.rotate(object.angle * Math.PI / 180);

    // Draw bounding box with improved visibility
    ctx.strokeStyle = '#2196F3'; // Brighter blue color
    ctx.lineWidth = 2.5; // Thicker line
    ctx.setLineDash([6, 4]); // Improved dash pattern
    ctx.strokeRect(-object.width / 2, -object.height / 2, object.width, object.height);

    // Draw control handles with improved visibility
    const handleSize = 12; // Larger handles 

    // Draw handles with shadow effect for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Fill style for handles
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2196F3'; // Match bounding box color
    ctx.lineWidth = 2; // Thicker border
    ctx.setLineDash([]); // Solid line for handles

    // Corner handles for scaling
    // Top-left
    ctx.beginPath();
    ctx.rect(-object.width / 2 - handleSize / 2, -object.height / 2 - handleSize / 2, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.rect(object.width / 2 - handleSize / 2, -object.height / 2 - handleSize / 2, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.rect(-object.width / 2 - handleSize / 2, object.height / 2 - handleSize / 2, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.rect(object.width / 2 - handleSize / 2, object.height / 2 - handleSize / 2, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();

    // Rotation handle - make it more distinctive
    const rotationHandleDistance = 30; // Increased distance

    // Draw rotation icon
    ctx.fillStyle = '#4CAF50'; // Green for rotation handle
    ctx.beginPath();
    ctx.arc(0, -object.height / 2 - rotationHandleDistance, handleSize / 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Add rotation arrow indicator inside the handle
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -object.height / 2 - rotationHandleDistance, handleSize / 3, 0.5, Math.PI * 1.5, false);
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(handleSize / 3, -object.height / 2 - rotationHandleDistance - handleSize / 6);
    ctx.lineTo(handleSize / 2, -object.height / 2 - rotationHandleDistance);
    ctx.lineTo(handleSize / 3, -object.height / 2 - rotationHandleDistance + handleSize / 6);
    ctx.stroke();

    // Line to rotation handle with pulsing effect for visibility
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]); // Dashed line for visual interest
    ctx.beginPath();
    ctx.moveTo(0, -object.height / 2);
    ctx.lineTo(0, -object.height / 2 - rotationHandleDistance + handleSize / 2);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Restore context state
    ctx.restore();
}

/**
 * Add a new object to the canvas
 * @param {Object} object - The object to add
 */
export function addObject(object) {
    // Add object to the canvas data
    canvasData.objects.push(object);

    // Update the texture
    updateShirt3DTexture();

    // Return the added object
    return object;
}

/**
 * Remove an object from the canvas
 * @param {Object} object - The object to remove
 */
export function removeObject(object) {
    // Find object index
    const index = canvasData.objects.indexOf(object);

    // Remove if found
    if (index !== -1) {
        canvasData.objects.splice(index, 1);

        // Update the texture
        updateShirt3DTexture();

        return true;
    }

    return false;
}

/**
 * Add an image to the canvas
 * @param {string} imageUrl - URL of the image to add
 * @param {Object} options - Options for positioning and sizing
 * @returns {Promise<Object>} The added image object
 */
export function addImage(imageUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            // Use target view or fallback to current camera view
            const targetView = options.view || state.cameraView || 'front';
            const viewConfig = modelConfig[state.currentModel].views[targetView];

            // Get current view's UV boundaries
            if (!viewConfig) {
                reject(new Error(`View "${targetView}" not found in model configuration`));
                return;
            }

            // Determine position - use options.left/top if provided, otherwise center in view
            let left, top;
            if (options.left !== undefined && options.top !== undefined) {
                left = options.left;
                top = options.top;
            } else {
                // Center the image in the view
                const uvMidX = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2;
                const uvMidY = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2;
                left = uvMidX * canvasData.width;
                top = uvMidY * canvasData.height;
            }

            // Smart placement adjustments
            if (options.smartPlacement) {
                // Make sure the image is fully within the UV rectangle of the view
                const uvRect = viewConfig.uvRect;
                const viewWidth = (uvRect.u2 - uvRect.u1) * canvasData.width;
                const viewHeight = (uvRect.v2 - uvRect.v1) * canvasData.height;

                // Ensure we're inside the view boundaries
                const minX = uvRect.u1 * canvasData.width;
                const maxX = uvRect.u2 * canvasData.width;
                const minY = uvRect.v1 * canvasData.height;
                const maxY = uvRect.v2 * canvasData.height;

                left = Math.max(minX, Math.min(maxX, left));
                top = Math.max(minY, Math.min(maxY, top));
            }

            // Calculate optimal scaling for the image
            let scaleFactor;

            if (options.width || options.height) {
                // User-specified dimensions
                const scaleX = options.width ? (options.width / img.width) : 1;
                const scaleY = options.height ? (options.height / img.height) : 1;
                scaleFactor = options.maintainAspectRatio ? Math.min(scaleX, scaleY) : { x: scaleX, y: scaleY };
            } else {
                // Auto-calculate based on view size
                const uvRect = viewConfig.uvRect;
                const viewWidth = (uvRect.u2 - uvRect.u1) * canvasData.width;
                const viewHeight = (uvRect.v2 - uvRect.v1) * canvasData.height;

                // Size to fit approximately 60% of the view area by default
                // Use smaller percentage for larger images to avoid overwhelming the view
                let fitPercentage = 0.6;
                if (img.width > 1000 || img.height > 1000) {
                    fitPercentage = 0.4;
                } else if (img.width < 200 || img.height < 200) {
                    fitPercentage = 0.8; // Small images can be larger relative to the view
                }

                const scaleX = (viewWidth * fitPercentage) / img.width;
                const scaleY = (viewHeight * fitPercentage) / img.height;
                scaleFactor = Math.min(scaleX, scaleY);

                // Ensure minimum/maximum reasonable size
                const minDimension = Math.min(viewWidth, viewHeight) * 0.1;
                const maxDimension = Math.max(viewWidth, viewHeight) * 0.8;

                const scaledWidth = img.width * scaleFactor;
                const scaledHeight = img.height * scaleFactor;

                if (scaledWidth < minDimension || scaledHeight < minDimension) {
                    // Scale up if too small
                    const upscaleX = minDimension / img.width;
                    const upscaleY = minDimension / img.height;
                    scaleFactor = Math.max(scaleFactor, Math.min(upscaleX, upscaleY));
                } else if (scaledWidth > maxDimension || scaledHeight > maxDimension) {
                    // Scale down if too large
                    const downscaleX = maxDimension / img.width;
                    const downscaleY = maxDimension / img.height;
                    scaleFactor = Math.min(scaleFactor, Math.min(downscaleX, downscaleY));
                }
            }

            // Apply auto color adjustments if enabled
            let imageFilters = {};
            if (options.autoAdjust) {
                // Add automatic image adjustments like brightness/contrast optimization
                // or background removal for better integration with the fabric
                imageFilters = {
                    brightness: 0,
                    contrast: 0,
                    removeBackground: options.removeBackground === true,
                    colorCorrection: true
                };
            }

            // Create image object with all calculated parameters
            const imageObj = {
                type: 'image',
                img: img,
                left: left,
                top: top,
                width: img.width * (typeof scaleFactor === 'object' ? scaleFactor.x : scaleFactor),
                height: img.height * (typeof scaleFactor === 'object' ? scaleFactor.y : scaleFactor),
                angle: options.angle || 0,
                active: false,
                originX: 'center',
                originY: 'center',
                removeColor: options.removeColor === true,
                targetView: targetView,
                filters: imageFilters,
                metadata: {
                    originalSize: { width: img.width, height: img.height },
                    uploadDate: new Date().toISOString(),
                    fileName: options.fileName || 'custom_image.png'
                }
            };

            // Add to canvas
            addObject(imageObj);

            // Select the new object immediately
            selectObject(imageObj);

            // Update texture to show the new object
            updateShirt3DTexture();

            // Resolve with the created object
            resolve(imageObj);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = imageUrl;
    });
}

/**
 * Add text to the canvas
 * @param {string} text - The text to add
 * @param {Object} options - Options for text styling and positioning
 * @returns {Object} The added text object
 */
export function addText(text, options = {}) {
    // Get current view's UV boundaries
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];

    // Calculate position in canvas space
    const left = options.left || (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width - 100;
    const top = options.top || (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height - 20;

    // Create text object
    const textObj = {
        type: 'text',
        text: text,
        left: left,
        top: top,
        width: options.width || 200,
        height: options.height || 40,
        fontSize: options.fontSize || 30,
        fontFamily: options.fontFamily || 'Arial',
        color: options.color || '#000000',
        angle: options.angle || 0,
        active: false
    };

    // Add to canvas
    addObject(textObj);

    // Return the created object
    return textObj;
}

/**
 * Add a shape to the canvas
 * @param {string} shapeType - Type of shape ('rect', 'circle', etc.)
 * @param {Object} options - Options for shape styling and positioning
 * @returns {Object} The added shape object
 */
export function addShape(shapeType, options = {}) {
    // Get current view's UV boundaries
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];

    // Calculate position in canvas space
    const left = options.left || (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width - 50;
    const top = options.top || (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height - 50;

    // Create shape object
    const shapeObj = {
        type: 'shape',
        shape: shapeType,
        left: left,
        top: top,
        width: options.width || 100,
        height: options.height || 100,
        fill: options.fill || '#000000',
        stroke: options.stroke,
        strokeWidth: options.strokeWidth || 0,
        angle: options.angle || 0,
        active: false
    };

    // Add to canvas
    addObject(shapeObj);

    // Return the created object
    return shapeObj;
}

/**
 * Clear all objects from the canvas
 */
export function clearCanvas() {
    // Clear objects array
    canvasData.objects = [];

    // Deselect any selected object
    deselectObject();

    // Update texture
    updateShirt3DTexture();
}

/**
 * Clear objects from a specific view or all views
 * @param {string} view - The view to clear (front, back, left_arm, right_arm, or 'all')
 */
export function clearObjectsByView(view = 'all') {
    if (view === 'all') {
        // Clear all objects (same as clearCanvas)
        clearCanvas();
        return;
    }

    // Get the UV boundaries for the specified view
    const viewConfig = modelConfig[state.currentModel].views[view];
    if (!viewConfig) {
        console.warn(`View ${view} not found in model configuration`);
        return;
    }

    // Calculate boundaries in canvas space
    const minU = viewConfig.uvRect.u1;
    const maxU = viewConfig.uvRect.u2;
    const minV = viewConfig.uvRect.v1;
    const maxV = viewConfig.uvRect.v2;

    // Filter objects that are within this view's UV boundaries
    canvasData.objects = canvasData.objects.filter(obj => {
        // Calculate object's center point in UV space
        const objCenterX = obj.left / canvasData.width;
        const objCenterY = obj.top / canvasData.height;

        // Check if object's center is outside this view's boundaries
        return !(objCenterX >= minU && objCenterX <= maxU &&
            objCenterY >= minV && objCenterY <= maxV);
    });

    // Deselect if selected object was removed
    if (selectedObject && !canvasData.objects.includes(selectedObject)) {
        deselectObject();
    }

    // Update texture
    updateShirt3DTexture();
}

/**
 * Export the current canvas as an image
 * @returns {string} Data URL of the canvas image
 */
export function exportCanvasImage() {
    // Temporarily hide selection overlay
    const wasSelected = selectedObject;
    if (wasSelected) {
        deselectObject();
    }

    // Draw all objects without selection
    canvasData.ctx.clearRect(0, 0, canvasData.width, canvasData.height);
    for (const obj of canvasData.objects) {
        drawObjectToCanvas(obj);
    }

    // Get data URL
    const dataURL = canvasData.canvas.toDataURL('image/png');

    // Restore selection if needed
    if (wasSelected) {
        selectObject(wasSelected);
        updateShirt3DTexture();
    }

    return dataURL;
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event 
 */
function onKeyDown(event) {
    // Only handle shortcuts if not typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }

    // Handle keyboard shortcuts only when in edit mode or a design tab is active
    const isEditingOrDesigning = isEditingMode || document.querySelector('.tab-content[data-tab="design"].active, .tab-content[data-tab="customize"].active');
    if (!isEditingOrDesigning) return;

    // Common operations with keyboard shortcuts
    const key = event.key.toLowerCase();

    // Delete selected object with Delete key
    if (key === 'delete' || key === 'backspace') {
        if (deleteSelectedObject()) {
            showToast('Object deleted');
            event.preventDefault();
        }
    }

    // Copy, Cut, Paste with Ctrl/Cmd
    if (event.ctrlKey || event.metaKey) {
        switch (key) {
            case 'c': // Copy
                if (copySelectedObject()) {
                    showToast('Object copied');
                    event.preventDefault();
                }
                break;

            case 'x': // Cut
                if (copySelectedObject() && deleteSelectedObject()) {
                    showToast('Object cut');
                    event.preventDefault();
                }
                break;

            case 'v': // Paste
                pasteObject().then(obj => {
                    if (obj) showToast('Object pasted');
                });
                event.preventDefault();
                break;

            case 'd': // Duplicate
                duplicateSelectedObject().then(obj => {
                    if (obj) showToast('Object duplicated');
                });
                event.preventDefault();
                break;

            case 'z': // Undo
                if (event.shiftKey) {
                    // Redo with Ctrl+Shift+Z
                    redo();
                } else {
                    // Undo with Ctrl+Z
                    undo();
                }
                event.preventDefault();
                break;

            case 'y': // Redo with Ctrl+Y
                redo();
                event.preventDefault();
                break;

            case 'a': // Select all with Ctrl+A
                selectAllObjects();
                event.preventDefault();
                break;

            case 'e': // Toggle edit mode with Ctrl+E
                toggleEditMode(!isEditingMode);
                event.preventDefault();
                break;
        }
    }

    // Arrow keys for nudging objects
    if (selectedObject && (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown')) {
        // Amount to move in pixels (use shift for larger movements)
        const amount = event.shiftKey ? 10 : 1;

        switch (key) {
            case 'arrowleft':
                selectedObject.left -= amount;
                break;
            case 'arrowright':
                selectedObject.left += amount;
                break;
            case 'arrowup':
                selectedObject.top -= amount;
                break;
            case 'arrowdown':
                selectedObject.top += amount;
                break;
        }

        // Update transform controls if visible
        if (transformControls.visible) {
            updateTransformControls();
        }

        // Update texture
        updateShirt3DTexture();

        event.preventDefault();
    }

    // Space to center the selected object
    if (key === ' ' && selectedObject) {
        centerSelectedObject();
        showToast('Object centered');
        event.preventDefault();
    }

    // Rotate with R key + arrows
    if (key === 'r' && selectedObject) {
        setTransformMode('rotate');
        showToast('Rotate mode activated');
        event.preventDefault();
    }

    // Scale with S key
    if (key === 's' && selectedObject) {
        setTransformMode('scale');
        showToast('Scale mode activated');
        event.preventDefault();
    }

    // Move with M key
    if (key === 'm' && selectedObject) {
        setTransformMode('move');
        showToast('Move mode activated');
        event.preventDefault();
    }

    // Function keys for view selection
    if (key.startsWith('f') && !isNaN(key.substring(1))) {
        const viewIndex = parseInt(key.substring(1)) - 1;

        // Import dynamically to avoid circular dependencies
        import('./texture-mapper.js').then(textureMapper => {
            const views = textureMapper.getAllViews();

            if (views && viewIndex >= 0 && viewIndex < views.length) {
                const view = views[viewIndex];
                textureMapper.quickJumpToView(view);
                showToast(`Switched to ${view} view`);
                event.preventDefault();
            }
        });
    }
}

/**
 * Handle keyup events
 * @param {KeyboardEvent} event - The keyup event
 */
function onKeyUp(event) {
    // Reset any temporary states related to key modifiers
}

/**
 * NEW: Highlight the editable area on the texture
 * @param {Object} area - The area to highlight
 */
function highlightEditableArea(area) {
    const ctx = canvasData.ctx;
    const { u1, v1, u2, v2 } = area;

    const x = u1 * canvasData.width;
    const y = v1 * canvasData.height;
    const width = (u2 - u1) * canvasData.width;
    const height = (v2 - v1) * canvasData.height;

    // Draw a more visible highlight for the active editable area
    ctx.save();

    // Create highlight effect with animated dash
    const dashOffset = (Date.now() / 100) % 16;
    ctx.strokeStyle = 'rgba(76, 149, 175, 0.7)';  // Fixed color format and increased opacity
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = dashOffset;
    ctx.strokeRect(x, y, width, height);

    // Remove the fill to only keep the border highlight
    // ctx.fillStyle = 'rgba(76, 149, 175, 0.08)';  // Very light green
    // ctx.fillRect(x, y, width, height);

    // Add a label for the current view
    const viewName = currentLockedView ?
        (modelConfig[state.currentModel].views[currentLockedView].name || currentLockedView) :
        'Editing Area';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.strokeStyle = 'rgb(76, 149, 175)';  // Fixed color format for text stroke
    ctx.lineWidth = 2;
    ctx.font = 'bold 16px Arial';
    const textWidth = ctx.measureText(viewName).width;
    const labelX = x + (width - textWidth) / 2;
    const labelY = y - 10;
    ctx.fillText(viewName, labelX, labelY);
    ctx.strokeText(viewName, labelX, labelY);

    ctx.restore();
}

/**
 * NEW: Check if the current mouse position is inside the editable area
 * @returns {boolean} - True if inside the editable area
 */
function checkIfInEditableArea() {
    if (!currentEditableArea || !isEditingMode) return false;

    // Get the UV position from raycaster
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length === 0) return false;

    const uv = intersects[0].uv;
    const { u1, v1, u2, v2 } = currentEditableArea;

    // Check if UV is within the editable area boundaries
    return (uv.x >= u1 && uv.x <= u2 && uv.y >= v1 && uv.y <= v2);
}

/**
 * NEW: Toggle editing mode for a specific area
 * @param {string} viewName - The view name (front, back, left_arm, right_arm)
 * @param {boolean} enabled - Whether to enable or disable edit mode
 */
export function toggleEditMode(viewName, enabled = true) {
    // Get the appropriate editable area from modelConfig
    const views = modelConfig[state.modelType || 'tshirt'].views;
    const view = views[viewName];

    if (!view) {
        console.error(`View '${viewName}' not found in model config`);
        return;
    }

    isEditingMode = enabled;

    if (enabled) {
        // Store the editable area
        currentEditableArea = view.uvRect;

        // Disable camera controls to lock shirt movement
        cameraControlsEnabled = false;

        // Set cursor to edit mode
        document.body.style.cursor = cursors.edit;

        // Show a status message
        const viewDisplayName = view.name || viewName;
        showToast(`Editing ${viewDisplayName} area. T-shirt movement locked.`);
    } else {
        // Reset when disabling edit mode
        currentEditableArea = null;
        cameraControlsEnabled = true;
        document.body.style.cursor = cursors.default;

        // Deselect any selected object
        if (selectedObject) {
            deselectObject();
        }

        showToast('Exited edit mode. T-shirt movement enabled.');
    }

    // Update the texture to show or hide the highlighted area
    updateShirt3DTexture();

    try {
        window.console.log('Editor mode ' + (enabled ? 'enabled' : 'disabled') + ' for view: ' + viewName);
    } catch (e) {
        // Silently fail if logging doesn't work
    }

    return isEditingMode;
}

/**
 * Toggle camera controls (for external use)
 * @param {boolean} enabled - Whether to enable camera controls
 */
export function toggleCameraControls(enabled) {
    cameraControlsEnabled = enabled;

    // Use scene.js's lockCameraToView if available
    import('./scene.js').then(scene => {
        if (currentLockedView && !enabled) {
            // If we have a locked view and we're disabling controls, ensure the camera stays locked
            if (typeof scene.lockCameraToView === 'function') {
                scene.lockCameraToView(mapViewNameToCameraView(currentLockedView), true);
            }
        } else if (enabled) {
            // If enabling controls, unlock the camera
            if (typeof scene.lockCameraToView === 'function') {
                scene.lockCameraToView(mapViewNameToCameraView(currentLockedView || 'front'), false);
            }
        }
    }).catch(err => {
        console.error('Failed to toggle camera controls:', err);
    });

    return cameraControlsEnabled;
}

/**
 * NEW: Check if editing mode is active
 * @returns {boolean} - True if in editing mode
 */
export function isInEditMode() {
    return isEditingMode;
}

/**
 * NEW: Set the transform mode explicitly (for UI controls)
 * @param {string} mode - The mode to set (move, rotate, scale, none)
 */
export function setTransformMode(mode) {
    if (!['move', 'rotate', 'scale', 'none'].includes(mode)) {
        console.error(`Invalid transform mode: ${mode}`);
        return;
    }

    // If we don't have a selected object and we're setting to anything other than none,
    // we need to check if there are any objects in the current editable area
    if (!selectedObject && mode !== 'none' && currentEditableArea) {
        // Find the first object in the current editable area
        const objectsInArea = canvasData.objects.filter(obj => {
            // Calculate object boundaries in UV space
            const objLeft = obj.left / canvasData.width;
            const objRight = (obj.left + obj.width) / canvasData.width;
            const objTop = obj.top / canvasData.height;
            const objBottom = (obj.top + obj.height) / canvasData.height;

            // Check for intersection with editable area
            const { u1, v1, u2, v2 } = currentEditableArea;

            // Check if any part of the object is within the editable area
            return !(objRight < u1 || objLeft > u2 || objBottom < v1 || objTop > v2);
        });

        // Select the first object if any
        if (objectsInArea.length > 0) {
            selectObject(objectsInArea[0]);
        } else {
            console.warn('No objects found in the editable area');
            return;
        }
    }

    // If we have a selected object, set the transform mode
    if (selectedObject) {
        transformMode = mode;

        // Set appropriate cursor
        if (mode === 'none') {
            document.body.style.cursor = isEditingMode ? cursors.edit : cursors.default;
        } else {
            document.body.style.cursor = cursors[mode];
        }

        // Dispatch event for UI to update
        window.dispatchEvent(new CustomEvent('transform-mode-changed', {
            detail: { mode }
        }));

        return true;
    } else {
        console.warn('No object selected for transform mode');
        return false;
    }
}

/**
 * NEW: Show bounding boxes for editable areas
 * This can help users understand where they can click to edit
 */
export function showEditableAreas(show = true) {
    // Update state
    state.showEditableAreas = show;

    // Redraw
    updateShirt3DTexture();

    return show;
}

/**
 * Draw all editable areas on the texture
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 */
function drawEditableAreas(ctx) {
    if (!state.showEditableAreas) return;

    const views = modelConfig[state.currentModel].views;

    // Draw each view's editable area
    for (const [viewName, viewConfig] of Object.entries(views)) {
        const { uvRect } = viewConfig;

        // Convert UV to pixel coordinates
        const x = uvRect.u1 * canvasData.width;
        const y = uvRect.v1 * canvasData.height;
        const width = (uvRect.u2 - uvRect.u1) * canvasData.width;
        const height = (uvRect.v2 - uvRect.v1) * canvasData.height;

        // Draw a subtle outline
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.4)'; // Light blue
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);

        // Add view name label
        ctx.fillStyle = 'rgba(100, 149, 237, 0.8)';
        ctx.font = '14px Arial';
        ctx.fillText(viewConfig.name || viewName, x + 10, y + 20);
        ctx.restore();
    }
}

/**
 * Detect which view a UV coordinate falls within
 * @param {THREE.Vector2} uv - The UV coordinate
 * @returns {string|null} - The view name or null if not in any view
 */
function detectViewFromUV(uv) {
    const views = modelConfig[state.currentModel].views;

    // Check each view's UV rectangle
    for (const [viewName, viewConfig] of Object.entries(views)) {
        const { uvRect } = viewConfig;

        // Check if UV is within this view's boundaries
        if (uv.x >= uvRect.u1 && uv.x <= uvRect.u2 &&
            uv.y >= uvRect.v1 && uv.y <= uvRect.v2) {
            return viewName;
        }
    }

    return null; // Not in any defined view
}

/**
 * Lock editing to a specific view
 * @param {string} viewName - The view to lock to
 */
function lockToView(viewName) {
    isEditingLocked = true;
    currentLockedView = viewName;
    currentEditableArea = modelConfig[state.currentModel].views[viewName].uvRect;

    // Lock camera to this view
    import('./scene.js').then(scene => {
        if (typeof scene.lockCameraToView === 'function') {
            scene.lockCameraToView(mapViewNameToCameraView(viewName));
        } else if (typeof scene.changeCameraView === 'function') {
            // Fallback to just changing the view if locking isn't available
            scene.changeCameraView(mapViewNameToCameraView(viewName));
        }
    }).catch(err => {
        console.error('Failed to lock camera:', err);
    });

    // Enable editing mode
    isEditingMode = true;

    // Change cursor to indicate editing mode
    document.body.style.cursor = cursors.edit;

    // Disable camera controls
    toggleCameraControls(false);

    Logger.log(`Locked to ${viewName} view for editing`);

    // Update texture to show highlighted area
    updateShirt3DTexture();
}

/**
 * Unlock from the current view
 */
function unlockFromView() {
    isEditingLocked = false;
    currentLockedView = null;
    currentEditableArea = null;

    // Exit editing mode
    isEditingMode = false;

    // Reset cursor
    document.body.style.cursor = cursors.default;

    // Re-enable camera controls
    toggleCameraControls(true);

    Logger.log('Unlocked from view');

    // Update texture to remove highlighted area
    updateShirt3DTexture();
}

/**
 * Handle clicks within the editable area
 * @param {THREE.Vector2} uv - The UV coordinate of the click
 * @param {Object} intersection - The ray intersection data
 */
function handleEditableAreaClick(uv, intersection) {
    // Convert UV to canvas coordinates
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;

    // Check if we're clicking on a transform handle
    const handleClicked = detectTransformHandleClick();
    if (handleClicked) {
        transformMode = handleClicked;
        document.body.style.cursor = cursors[transformMode];
        return;
    }

    // If we have a selected object, check if we're clicking outside (to deselect)
    if (selectedObject) {
        const intersectsObject = detectObjectIntersection(selectedObject);
        if (!intersectsObject) {
            deselectObject();
            transformMode = 'none';
            document.body.style.cursor = cursors.edit;
            return;
        } else {
            // We're clicking on the selected object
            transformMode = 'move';
            document.body.style.cursor = cursors.move;
            return;
        }
    }

    // Try to select an object
    const objectClicked = detectObjectClick();
    if (objectClicked) {
        selectObject(objectClicked);
        transformMode = 'move';
        document.body.style.cursor = cursors.move;
    } else {
        transformMode = 'none';
        document.body.style.cursor = cursors.edit;
    }
}

/**
 * Convert view name to camera view
 * @param {string} viewName - The internal view name
 * @returns {string} - The camera view name
 */
function mapViewNameToCameraView(viewName) {
    switch (viewName) {
        case 'front': return 'front';
        case 'back': return 'back';
        case 'left_arm': return 'left';
        case 'right_arm': return 'right';
        default: return viewName;
    }
}

/**
 * Setup drag and drop functionality directly on the 3D view
 */
function setupDragAndDropOn3DView() {
    const canvas = renderer.domElement;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        canvas.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Highlight drop area
    ['dragenter', 'dragover'].forEach(eventName => {
        canvas.addEventListener(eventName, () => {
            if (isDragAndDropEnabled) {
                canvas.classList.add('drag-highlight');
                // Show helper overlay
                showDropOverlay(true);
            }
        }, false);
    });

    // Remove highlight
    ['dragleave', 'drop'].forEach(eventName => {
        canvas.addEventListener(eventName, () => {
            canvas.classList.remove('drag-highlight');
            // Hide helper overlay
            showDropOverlay(false);
        }, false);
    });

    // Handle dropped files
    canvas.addEventListener('drop', (e) => {
        if (!isDragAndDropEnabled) return;

        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            // Get drop position in UV coordinates
            updateMousePosition(e);

            // Detect which view was targeted for the drop
            const view = detectViewFromMousePosition();

            // Handle the file with the detected view
            handleDroppedFile(files[0], view, mouse);
        }
    }, false);
}

/**
 * Show or hide the drop overlay with visual guidance
 * @param {boolean} show - Whether to show or hide the overlay
 */
function showDropOverlay(show) {
    let overlay = document.getElementById('drop-overlay');

    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'drop-overlay';
            overlay.innerHTML = `
                <div class="drop-message">
                    <i class="fas fa-arrow-down"></i>
                    <p>Drop image here to place on model</p>
                    <small>The image will be placed on the area you drop it</small>
                </div>
                <div class="view-indicators"></div>
            `;
            document.body.appendChild(overlay);

            // Add view indicators based on current model config
            const indicators = overlay.querySelector('.view-indicators');
            Object.entries(modelConfig[state.currentModel].views).forEach(([viewName, config]) => {
                const indicator = document.createElement('div');
                indicator.className = 'view-indicator';
                indicator.dataset.view = viewName;
                indicator.style.left = `${config.bounds.x * 100}%`;
                indicator.style.top = `${config.bounds.y * 100}%`;
                indicator.style.width = `${config.bounds.width * 100}%`;
                indicator.style.height = `${config.bounds.height * 100}%`;
                indicator.innerHTML = `<span>${config.name || viewName}</span>`;
                indicators.appendChild(indicator);
            });
        }
        overlay.classList.add('active');
    } else if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Detect which view on the model the mouse is currently over
 * @returns {string} The name of the view or null if not over any view
 */
function detectViewFromMousePosition() {
    // Cast a ray from the mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length > 0) {
        // Get the UV coordinates at the intersection point
        const uv = intersects[0].uv;
        return detectViewFromUV(uv);
    }

    // Default to current camera view if no intersection
    return state.cameraView || 'front';
}

/**
 * Handle a file dropped onto the 3D view
 * @param {File} file - The dropped file
 * @param {string} targetView - The view where the file was dropped
 * @param {THREE.Vector2} position - The mouse position where the file was dropped
 */
function handleDroppedFile(file, targetView, position) {
    if (!file.type.startsWith('image/')) {
        showToast('Only image files are supported');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        // Get UV coordinates from mouse position
        raycaster.setFromCamera(position, camera);
        const intersects = raycaster.intersectObject(shirtMesh);

        if (intersects.length > 0) {
            const uv = intersects[0].uv;

            // Calculate position in canvas coordinates
            const left = uv.x * canvasData.width;
            const top = uv.y * canvasData.height;

            // Add the image at the drop position
            addImage(e.target.result, {
                left: left,
                top: top,
                view: targetView,
                smartPlacement: smartImagePlacement,
                autoAdjust: autoAdjustmentEnabled
            }).then(obj => {
                showToast(`Image added to ${targetView} view`);
                lastUsedView = targetView;

                // Switch to the view where the image was placed if not already there
                if (state.cameraView !== targetView) {
                    changeCameraView(targetView);
                }
            }).catch(error => {
                showToast('Error adding image: ' + error.message);
            });
        } else {
            // If no intersection, add to center of current view
            addImage(e.target.result, {
                view: targetView,
                center: true,
                smartPlacement: smartImagePlacement,
                autoAdjust: autoAdjustmentEnabled
            }).then(obj => {
                showToast(`Image added to ${targetView} view`);
                lastUsedView = targetView;
            }).catch(error => {
                showToast('Error adding image: ' + error.message);
            });
        }
    };

    reader.readAsDataURL(file);
}

// Add clipboard functionality and advanced object manipulation
/**
 * Copy the currently selected object to the clipboard
 * @returns {boolean} Whether the copy was successful
 */
export function copySelectedObject() {
    if (!selectedObject) {
        showToast('No object selected to copy');
        return false;
    }

    // Create a deep copy of the object's properties
    clipboard = JSON.parse(JSON.stringify({
        type: selectedObject.type,
        left: selectedObject.left,
        top: selectedObject.top,
        width: selectedObject.width,
        height: selectedObject.height,
        angle: selectedObject.angle,
        originX: selectedObject.originX,
        originY: selectedObject.originY,
        targetView: selectedObject.targetView,
        filters: selectedObject.filters,
        metadata: selectedObject.metadata
    }));

    // For images, store the image source
    if (selectedObject.type === 'image' && selectedObject.img) {
        clipboard.imgSrc = selectedObject.img.src;
    }

    // For text, store the text content and font properties
    if (selectedObject.type === 'text') {
        clipboard.text = selectedObject.text;
        clipboard.fontFamily = selectedObject.fontFamily;
        clipboard.fontSize = selectedObject.fontSize;
        clipboard.fontWeight = selectedObject.fontWeight;
        clipboard.fontStyle = selectedObject.fontStyle;
        clipboard.textAlign = selectedObject.textAlign;
        clipboard.fill = selectedObject.fill;
    }

    return true;
}

/**
 * Paste the object from the clipboard
 * @returns {Promise<Object|null>} The pasted object or null if paste failed
 */
export function pasteObject() {
    return new Promise((resolve, reject) => {
        if (!clipboard) {
            showToast('Nothing to paste');
            resolve(null);
            return;
        }

        // Determine which view to paste into
        const targetView = state.cameraView || 'front';

        // Offset the pasted object slightly from the original
        const offset = 20; // pixels

        // Create a new object based on the clipboard type
        if (clipboard.type === 'image' && clipboard.imgSrc) {
            // Create a new image from the stored source
            addImage(clipboard.imgSrc, {
                left: clipboard.left + offset,
                top: clipboard.top + offset,
                width: clipboard.width,
                height: clipboard.height,
                angle: clipboard.angle,
                view: targetView,
                filters: clipboard.filters
            }).then(newObject => {
                resolve(newObject);
            }).catch(error => {
                showToast('Failed to paste image: ' + error.message);
                reject(error);
            });
        } else if (clipboard.type === 'text') {
            // Create a new text object
            addText(clipboard.text, {
                left: clipboard.left + offset,
                top: clipboard.top + offset,
                width: clipboard.width,
                height: clipboard.height,
                angle: clipboard.angle,
                fontFamily: clipboard.fontFamily,
                fontSize: clipboard.fontSize,
                fontWeight: clipboard.fontWeight,
                fontStyle: clipboard.fontStyle,
                textAlign: clipboard.textAlign,
                fill: clipboard.fill,
                view: targetView
            }).then(newObject => {
                resolve(newObject);
            }).catch(error => {
                showToast('Failed to paste text: ' + error.message);
                reject(error);
            });
        } else if (clipboard.type === 'shape') {
            // Create a new shape
            addShape(clipboard.shapeType, {
                left: clipboard.left + offset,
                top: clipboard.top + offset,
                width: clipboard.width,
                height: clipboard.height,
                angle: clipboard.angle,
                fill: clipboard.fill,
                stroke: clipboard.stroke,
                strokeWidth: clipboard.strokeWidth,
                view: targetView
            }).then(newObject => {
                resolve(newObject);
            }).catch(error => {
                showToast('Failed to paste shape: ' + error.message);
                reject(error);
            });
        } else {
            showToast('Unsupported object type for paste');
            resolve(null);
        }
    });
}

/**
 * Delete the currently selected object
 * @returns {boolean} Whether the deletion was successful
 */
export function deleteSelectedObject() {
    if (!selectedObject) {
        showToast('No object selected to delete');
        return false;
    }

    // Find the object's index in the objects array
    const index = canvasData.objects.indexOf(selectedObject);
    if (index !== -1) {
        // Remove the object
        canvasData.objects.splice(index, 1);

        // Update the texture
        updateShirt3DTexture();

        // Clear selection
        deselectObject();

        return true;
    }

    return false;
}

/**
 * Duplicate the currently selected object
 * @returns {Promise<Object|null>} The duplicated object or null if duplication failed
 */
export function duplicateSelectedObject() {
    if (!selectedObject) {
        showToast('No object selected to duplicate');
        return Promise.resolve(null);
    }

    // First copy the object to clipboard
    if (copySelectedObject()) {
        // Then paste it to create a duplicate
        return pasteObject();
    }

    return Promise.resolve(null);
}

/**
 * Center the selected object in the current view
 * @returns {boolean} Whether centering was successful
 */
export function centerSelectedObject() {
    if (!selectedObject) {
        showToast('No object selected to center');
        return false;
    }

    // Get current view's UV boundaries
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return false;

    // Calculate center position in canvas coordinates
    const uvMidX = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2;
    const uvMidY = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2;

    // Set object position to center of view
    selectedObject.left = uvMidX * canvasData.width;
    selectedObject.top = uvMidY * canvasData.height;

    // Update transform controls if visible
    if (transformControls.visible) {
        updateTransformControls();
    }

    // Update the texture
    updateShirt3DTexture();

    return true;
}

/**
 * Undo the last action
 * @returns {boolean} Whether the undo was successful
 */
function undo() {
    if (historyStack.undoStack.length <= 1) {
        showToast('Nothing to undo');
        return false;
    }

    // Save current state to redo stack
    historyStack.redoStack.push(historyStack.undoStack.pop());

    // Get previous state
    const previousState = JSON.parse(historyStack.undoStack[historyStack.undoStack.length - 1]);

    // Restore objects from previous state
    restoreFromState(previousState);

    showToast('Undo');
    return true;
}

/**
 * Redo the last undone action
 * @returns {boolean} Whether the redo was successful
 */
function redo() {
    if (historyStack.redoStack.length === 0) {
        showToast('Nothing to redo');
        return false;
    }

    // Get state to redo
    const redoState = JSON.parse(historyStack.redoStack.pop());

    // Save current state to undo stack
    historyStack.undoStack.push(JSON.stringify(canvasData.objects.map(obj => {
        const copy = { ...obj };
        if (obj.type === 'image' && obj.img) {
            copy.imgSrc = obj.img.src;
            delete copy.img;
        }
        return copy;
    })));

    // Restore objects from redo state
    restoreFromState(redoState);

    showToast('Redo');
    return true;
}

/**
 * Restore objects from a saved state
 * @param {Array} stateObjects - The objects to restore
 */
function restoreFromState(stateObjects) {
    // Clear current objects
    canvasData.objects = [];

    // Restore objects
    const promises = stateObjects.map(obj => {
        if (obj.type === 'image' && obj.imgSrc) {
            // Restore image object
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    obj.img = img;
                    delete obj.imgSrc;
                    canvasData.objects.push(obj);
                    resolve();
                };
                img.src = obj.imgSrc;
            });
        } else {
            // Restore other object types
            canvasData.objects.push(obj);
            return Promise.resolve();
        }
    });

    // Wait for all objects to be restored
    Promise.all(promises).then(() => {
        // Update texture
        updateShirt3DTexture();

        // Clear selection
        deselectObject();
    });
}

/**
 * Select all objects in the current view
 * @returns {number} The number of objects selected
 */
function selectAllObjects() {
    // TODO: Implement multi-selection
    showToast('Multi-selection coming soon');
    return 0;
}

// Touch event handlers for mobile compatibility
function onTouchStart(event) {
    // Convert touch event to mouse event
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    onMouseDown(mouseEvent);
}

function onTouchMove(event) {
    // Prevent default scrolling when in edit mode
    if (isEditingMode) {
        event.preventDefault();
    }

    // Convert touch event to mouse event
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    onMouseMove(mouseEvent);
}

function onTouchEnd(event) {
    // Convert touch event to mouse event
    const mouseEvent = new MouseEvent('mouseup', {});
    onMouseUp(mouseEvent);

    // Also trigger click event for touch end
    if (!transformMode || transformMode === 'none') {
        const clickEvent = new MouseEvent('click', {});
        onClick(clickEvent);
    }
}

// Save state when objects are modified
function saveCurrentState() {
    historyStack.saveState();
}

// Hook into object modification functions to save state before changes
const originalAddObject = addObject;
addObject = function (object) {
    saveCurrentState();
    return originalAddObject(object);
};

const originalRemoveObject = removeObject;
removeObject = function (object) {
    saveCurrentState();
    return originalRemoveObject(object);
};

// Add new state hooks
function afterObjectModified() {
    // Save state after object is modified
    saveCurrentState();
    // Update texture
    updateShirt3DTexture();
}

// Add state saving after various transformations
const originalMoveObject = moveObject;
moveObject = function (object, deltaX, deltaY) {
    const result = originalMoveObject(object, deltaX, deltaY);
    afterObjectModified();
    return result;
};

/**
 * Toggle drag and drop functionality
 * @param {boolean} enabled - Whether to enable or disable drag and drop
 */
export function toggleDragAndDrop(enabled) {
    isDragAndDropEnabled = enabled;
    return isDragAndDropEnabled;
}

/**
 * Toggle smart image placement
 * @param {boolean} enabled - Whether to enable or disable smart placement
 */
export function toggleSmartPlacement(enabled) {
    smartImagePlacement = enabled;
    return smartImagePlacement;
}

/**
 * Toggle automatic image adjustments
 * @param {boolean} enabled - Whether to enable or disable auto adjustments
 */
export function toggleAutoAdjustment(enabled) {
    autoAdjustmentEnabled = enabled;
    return autoAdjustmentEnabled;
}

/**
 * Get the last used view for image placement
 * @returns {string|null} The last used view or null if none
 */
export function getLastUsedView() {
    return lastUsedView;
}

// Export the enhanced 3D editor
export default {
    init3DEditor,
    addObject,
    removeObject,
    addImage,
    addText,
    addShape,
    clearCanvas,
    clearObjectsByView,
    exportCanvasImage,
    toggleEditMode,
    toggleCameraControls,
    isInEditMode: () => isEditingMode,
    isEditorLocked: () => isEditingLocked,
    getCurrentLockedView: () => currentLockedView,
    toggleDragAndDrop,
    toggleSmartPlacement,
    toggleAutoAdjustment,
    getLastUsedView,
    copySelectedObject,
    pasteObject,
    deleteSelectedObject,
    duplicateSelectedObject,
    centerSelectedObject,
    undo,
    redo
}; 