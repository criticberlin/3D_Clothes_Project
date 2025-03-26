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
import { updateShirtColor } from './scene.js';

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
    move: 'grab',
    rotate: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><path d=\'M12 2 C12 22 12 22 12 22\' stroke=\'#2196F3\' stroke-width=\'2\'/></svg>"), auto',
    scale: 'nwse-resize',
    edit: 'crosshair',
    grabbing: 'grabbing'
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

    // Set a clean initial color with a slight delay to ensure proper initialization
    setTimeout(() => {
        // Get the stored color from state or use default
        const initialColor = state.color || '#FFFFFF';
        console.log('Applying delayed initial color:', initialColor);
        updateShirtColor(initialColor);
    }, 100);
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
    canvas.addEventListener('dblclick', onDoubleClick);

    // Keyboard events
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);

    // Add text button event listener
    const addTextBtn = document.getElementById('add-text-btn');
    if (addTextBtn) {
        addTextBtn.addEventListener('click', handleAddText);
    }

    // Add shape button event listener
    const addShapeBtn = document.querySelector('[data-action="add-shape"]');
    if (addShapeBtn) {
        addShapeBtn.addEventListener('click', handleAddShape);
    }
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

            // Check if we clicked on a transform handle of the selected object first
            if (selectedObject) {
                const action = detectTransformHandleClick();
                if (action) {
                    // Lock t-shirt movement when interacting with decal controls
                    toggleCameraControls(false);
                    // Handle the control button click
                    handleEditableAreaClick(uv, intersects[0]);
                    return;
                }
            }

            // Check if we clicked on an object
            const clickedObject = detectObjectClick();
            if (clickedObject) {
                // Lock t-shirt movement when clicking on a decal
                toggleCameraControls(false);
                // If we clicked on an object, handle it
                handleEditableAreaClick(uv, intersects[0]);
                // Set transform mode to move only if we clicked directly on the object
                if (!clickedObject.isPinned) {
                    transformMode = 'move';
                    document.body.style.cursor = cursors.grabbing;
                }
            } else {
                // If we clicked on empty space, deselect current object and unlock t-shirt movement
                if (selectedObject) {
                    deselectObject();
                }
                selectedObject = null;
                transformMode = 'none';
                document.body.style.cursor = cursors.default;
                toggleCameraControls(true); // Unlock t-shirt movement
                updateShirt3DTexture();
            }
        } else {
            // Clicked on shirt but outside any editable area
            if (isEditingLocked) {
                unlockFromView();
            }
            if (selectedObject) {
                deselectObject();
            }
            transformMode = 'none';
            document.body.style.cursor = cursors.default;
            toggleCameraControls(true); // Unlock t-shirt movement
        }
    } else {
        // Clicked completely outside the shirt
        if (isEditingLocked) {
            unlockFromView();
        }
        if (selectedObject) {
            deselectObject();
        }
        selectedObject = null;
        transformMode = 'none';
        document.body.style.cursor = cursors.default;
        toggleCameraControls(true); // Unlock t-shirt movement
        updateShirt3DTexture();
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

    // Only proceed with transformation if we have a selected object and we're in move mode
    if (selectedObject) {
        // Store current point for transformations
        currentPoint.x = mouse.x;
        currentPoint.y = mouse.y;

        // Calculate delta movement
        const deltaX = currentPoint.x - startPoint.x;
        const deltaY = currentPoint.y - startPoint.y;

        // Handle different transform modes
        switch (transformMode) {
            case 'move':
                if (!selectedObject.isPinned) {
                    moveObject(selectedObject, deltaX, deltaY);
                }
                break;
            case 'rotate':
                if (selectedObject.isDecal || selectedObject.type === 'text') {
                    rotateObject(selectedObject, deltaX, deltaY);
                }
                break;
            case 'scale':
                if (!selectedObject.isPinned) {
                    scaleObject(selectedObject, deltaX, deltaY);
                }
                break;
        }

        // Update the texture
        debounce(updateShirt3DTexture, 50)();

        // Update the transform controls
        updateTransformControls();

        // Update the starting point for smooth transformations
        startPoint.copy(currentPoint);
    }
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event 
 */
function onMouseUp(event) {
    // Only take action if we're in a transform mode
    if (transformMode !== 'none') {
        // Finalize any transformations
        updateShirt3DTexture();
        
        // Save the state for undo/redo
        saveCurrentState();
        
        // Reset transform mode and cursor
        transformMode = 'none';
        document.body.style.cursor = cursors.default;
        
        // If no object is selected, unlock t-shirt movement
        if (!selectedObject) {
            toggleCameraControls(true);
        }
    }
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
 * @returns {string} The transform mode or action
 */
function detectTransformHandleClick() {
    if (!selectedObject) return null;

    // Calculate global mouse position
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);
    if (intersects.length === 0) return null;

    const uv = intersects[0].uv;
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;

    // Object dimensions and position
    const object = selectedObject;
    const width = object.width;
    const height = object.height;
    const centerX = object.left + width / 2;
    const centerY = object.top + height / 2;

    // Button size and padding
    const buttonRadius = 12;
    const buttonPadding = 5;
    const hitRadius = buttonRadius * 1.5; // Slightly larger hit area for better UX

    // Convert mouse position to object-relative coordinates
    const relX = (x - centerX);
    const relY = (y - centerY);

    // Apply inverse rotation to get coordinates in the object's local space
    const angle = object.angle || 0;
    const radians = -angle * Math.PI / 180;
    const localX = relX * Math.cos(radians) - relY * Math.sin(radians);
    const localY = relX * Math.sin(radians) + relY * Math.cos(radians);

    // Check each button with increased hit area
    const buttons = [
        // Delete button (bottom left)
        {
            x: -width / 2 - buttonRadius - buttonPadding,
            y: height / 2 + buttonRadius + buttonPadding,
            action: 'delete'
        },
        // Layers button (top center, only check if there are overlapping decals)
        {
            x: 0,
            y: -height / 2 - buttonRadius - buttonPadding,
            action: 'layers',
            condition: () => canvasData.objects.some(otherObj => 
                otherObj !== object && 
                otherObj.isDecal && 
                isObjectsOverlapping(object, otherObj)
            )
        },
        // Resize button (bottom right)
        {
            x: width / 2 + buttonRadius + buttonPadding,
            y: height / 2 + buttonRadius + buttonPadding,
            action: 'scale'
        },
        // Pin button (top left)
        {
            x: -width / 2 - buttonRadius - buttonPadding,
            y: -height / 2 - buttonRadius - buttonPadding,
            action: 'pin'
        },
        // Rotate button (top right)
        {
            x: width / 2 + buttonRadius + buttonPadding,
            y: -height / 2 - buttonRadius - buttonPadding,
            action: 'rotate'
        },
        // Duplicate button (bottom center)
        {
            x: 0,
            y: height / 2 + buttonRadius + buttonPadding,
            action: 'duplicate'
        }
    ];

    // Check each button
    for (const button of buttons) {
        // Skip checking layers button if condition is not met
        if (button.action === 'layers' && !button.condition()) {
            continue;
        }

        const distanceToButton = Math.sqrt(
            Math.pow(localX - button.x, 2) +
            Math.pow(localY - button.y, 2)
        );

        if (distanceToButton <= hitRadius) {
            return button.action;
        }
    }

    // Check if we're inside the object (for move)
    const padding = 5;
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
    
    // Handle non-rotated objects simply
    if (!object.angle || object.angle === 0) {
        return x >= left && x <= right && y >= top && y <= bottom;
    }
    
    // For rotated objects, need to check using rotation math
    const centerX = left + object.width / 2;
    const centerY = top + object.height / 2;
    const angle = object.angle * Math.PI / 180;
    
    // Translate point to origin relative to object center
    const relX = x - centerX;
    const relY = y - centerY;
    
    // Rotate point by negative angle to align with object
    const rotX = relX * Math.cos(-angle) - relY * Math.sin(-angle);
    const rotY = relX * Math.sin(-angle) + relY * Math.cos(-angle);
    
    // Check if rotated point is inside object bounds
    return Math.abs(rotX) <= object.width / 2 && Math.abs(rotY) <= object.height / 2;
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
    transformControls.visible = true;

    // Set the object as active
    object.active = true;

    // Update the texture to show selection overlay
    updateShirt3DTexture();

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
    // Invert the Y-axis movement by negating deltaUV.y
    object.left += deltaUV.x * canvasData.width * distortionFactorX;
    object.top -= deltaUV.y * canvasData.height * distortionFactorY;

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
    
    // Cast a ray to get current mouse position in world space
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length > 0) {
        const uv = intersects[0].uv;
        const x = uv.x * canvasData.width;
        const y = uv.y * canvasData.height;

        // Calculate angle between center and current point
        const angle = Math.atan2(y - centerY, x - centerX);

        // Initialize the last angle if needed
        if (object._lastRotationAngle === undefined) {
            object._lastRotationAngle = angle;
            return;
        }

        // Calculate the angle difference
        let angleDelta = angle - object._lastRotationAngle;

        // Normalize angleDelta to avoid jumps
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

        // Convert to degrees and apply a rotation speed adjustment
        const rotationSpeed = 1.5; // Increased from 1.0 to 1.5
        angleDelta *= (180 / Math.PI) * rotationSpeed;

        // Update the object's rotation with dampening
        const smoothingFactor = 0.8; // Lower = more dampening
        object.angle = (object.angle || 0) + (angleDelta * smoothingFactor);

        // Store the current angle for next time
        object._lastRotationAngle = angle;
    } else {
        // Fallback to a simpler method if ray doesn't hit
        const rotationFactor = 1.0; // Adjusted for appropriate rotation speed
        const rotationDelta = deltaX * rotationFactor;
        object.angle = (object.angle || 0) + rotationDelta;
    }

    // Ensure the object stays within boundaries
    constrainObjectToUVBoundary(object);

    Logger.log('Rotated object');
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

    // Convert screen deltas to UV space
    const worldDeltas = screenToUVDelta(deltaX, deltaY);

    // Get object center coordinates
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;

    // Cast a ray to get position on the model
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    // Calculate scale factor - positive delta = scale up, negative = scale down
    const movementMagnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const scaleDirection = (deltaX + deltaY) > 0 ? 1 : -1;
    const scaleFactor = 1 + (movementMagnitude * 0.03 * scaleDirection); // Reduced from 0.05 to 0.03 for less sensitivity

    // Apply scaling with constraints
    const minDimension = 20; // Minimum size in pixels
    const maxDimension = Math.min(canvasData.width, canvasData.height) * 0.8; // Maximum size

    // Calculate new dimensions
    let newWidth = Math.max(minDimension, Math.min(maxDimension, object.width * scaleFactor));
    let newHeight = Math.max(minDimension, Math.min(maxDimension, object.height * scaleFactor));

    // Maintain aspect ratio for images and text
    if ((object.type === 'image' && object.preserveAspectRatio !== false) || object.type === 'text') {
        const originalAspect = object.metadata?.originalWidth / object.metadata?.originalHeight || 
                               object.width / object.height;
        
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

    // Update object dimensions while keeping it centered
    object.width = newWidth;
    object.height = newHeight;
    object.left = centerX - newWidth / 2;
    object.top = centerY - newHeight / 2;

    // Ensure object stays within boundaries
    constrainObjectToUVBoundary(object);

    Logger.log('Scaled object');
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
    const uvWidth = Math.abs(uvRect.u2 - uvRect.u1);
    const uvHeight = Math.abs(uvRect.v2 - uvRect.v1);

    // Calculate the delta in UV space with basic perspective correction
    const xScale = uvWidth / visibleWidth;
    const yScale = uvHeight / visibleHeight;
    
    // Get sensitivity adjustment from user settings or default
    const sensitivity = state.mouseSensitivity || 1.0;
    
    return new THREE.Vector2(
        deltaX * xScale * sensitivity,
        deltaY * yScale * sensitivity
    );
}

/**
 * Ensure object stays within UV boundaries
 * @param {Object} object 
 */
function constrainObjectToUVBoundary(object) {
    // Get current view's UV boundaries from config
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
    if (!viewConfig) return;

    // Get the UV rectangle for the current view
    const uvRect = viewConfig.uvRect;

    // Calculate boundaries in canvas space
    const minX = Math.min(uvRect.u1, uvRect.u2) * canvasData.width;
    const maxX = Math.max(uvRect.u1, uvRect.u2) * canvasData.width;
    const minY = Math.min(uvRect.v1, uvRect.v2) * canvasData.height;
    const maxY = Math.max(uvRect.v1, uvRect.v2) * canvasData.height;

    // Calculate padding for the boundaries (2% of each dimension)
    const paddingX = (maxX - minX) * 0.02;
    const paddingY = (maxY - minY) * 0.02;
    
    // Apply padding to boundaries
    const effectiveMinX = minX + paddingX;
    const effectiveMaxX = maxX - paddingX;
    const effectiveMinY = minY + paddingY;
    const effectiveMaxY = maxY - paddingY;

    // Store the object center
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;

    // Get object boundaries, accounting for rotation
    let objectBounds;
    
    // If object is rotated, we need to calculate the rotated bounding box
    if (object.angle && Math.abs(object.angle) > 0.1) {
        const angleRad = object.angle * Math.PI / 180;
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
    } else {
        // For non-rotated objects, use simpler bounds
        objectBounds = {
            left: object.left,
            right: object.left + object.width,
            top: object.top,
            bottom: object.top + object.height
        };
    }

    // Determine if object exceeds boundaries
    const exceededLeft = objectBounds.left < effectiveMinX;
    const exceededRight = objectBounds.right > effectiveMaxX;
    const exceededTop = objectBounds.top < effectiveMinY;
    const exceededBottom = objectBounds.bottom > effectiveMaxY;

    // If object is completely outside boundaries, force it back inside
    const completelyOutside = 
        objectBounds.right < effectiveMinX || 
        objectBounds.left > effectiveMaxX || 
        objectBounds.bottom < effectiveMinY || 
        objectBounds.top > effectiveMaxY;

    if (completelyOutside) {
        // Center the object in the available area
        object.left = effectiveMinX + (effectiveMaxX - effectiveMinX - object.width) / 2;
        object.top = effectiveMinY + (effectiveMaxY - effectiveMinY - object.height) / 2;
        return;
    }

    // Apply different constraints based on rotation
    if (object.angle && Math.abs(object.angle) > 5) {
        // For rotated objects, adjust position
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

        // Apply adjustments
        object.left += adjustX;
        object.top += adjustY;
    } else {
        // For non-rotated objects, use direct constraints
        if (exceededLeft) {
            object.left = effectiveMinX;
        } else if (exceededRight) {
            object.left = effectiveMaxX - object.width;
        }

        if (exceededTop) {
            object.top = effectiveMinY;
        } else if (exceededBottom) {
            object.top = effectiveMaxY - object.height;
        }
    }

    // Scale down if object is too large for the boundary
    const availableWidth = effectiveMaxX - effectiveMinX;
    const availableHeight = effectiveMaxY - effectiveMinY;

    if (object.width > availableWidth * 0.95) {
        // Object is wider than 95% of available space
        const newWidth = availableWidth * 0.95;
        const scaleRatio = newWidth / object.width;
        const newHeight = object.height * scaleRatio;

        // Update object dimensions while preserving center
        const newCenterX = object.left + object.width / 2;
        const newCenterY = object.top + object.height / 2;
        
        object.width = newWidth;
        object.height = newHeight;
        object.left = newCenterX - newWidth / 2;
        object.top = newCenterY - newHeight / 2;
    }

    if (object.height > availableHeight * 0.95) {
        // Object is taller than 95% of available space
        const newHeight = availableHeight * 0.95;
        const scaleRatio = newHeight / object.height;
        const newWidth = object.width * scaleRatio;

        // Update object dimensions while preserving center
        const newCenterX = object.left + object.width / 2;
        const newCenterY = object.top + object.height / 2;
        
        object.width = newWidth;
        object.height = newHeight;
        object.left = newCenterX - newWidth / 2;
        object.top = newCenterY - newHeight / 2;
    }
    
    // Final check to ensure object is fully contained
    const newBounds = {
        left: object.left,
        right: object.left + object.width,
        top: object.top,
        bottom: object.top + object.height
    };
    
    // Force hard constraints for any remaining boundary violations
    if (newBounds.left < effectiveMinX) {
        object.left = effectiveMinX;
    }
    if (newBounds.right > effectiveMaxX) {
        object.left = effectiveMaxX - object.width;
    }
    if (newBounds.top < effectiveMinY) {
        object.top = effectiveMinY;
    }
    if (newBounds.bottom > effectiveMaxY) {
        object.top = effectiveMaxY - object.height;
    }
}

/**
 * Update the 3D shirt texture based on canvas data
 */
export function updateShirt3DTexture() {
    if (!canvasData.canvas || !shirtMesh) return;
    
    // Clear canvas with a fully transparent background
    canvasData.ctx.clearRect(0, 0, canvasData.width, canvasData.height);

    // Draw all objects
    for (const obj of canvasData.objects) {
        drawObjectToCanvas(obj);
    }

    // Draw editable area if in editing mode and we have a current area
    if (isEditingMode && currentEditableArea) {
        highlightEditableArea(currentEditableArea);
    }

    // Draw selection if we have a selected object
    if (selectedObject) {
        drawSelectionOverlay(selectedObject);
    }

    // Create a texture from the canvas
    const canvasTexture = new THREE.CanvasTexture(canvasData.canvas);
    
    // Apply correct orientation settings for the texture
    canvasTexture.flipY = false;
    canvasTexture.matrixAutoUpdate = false;
    canvasTexture.matrix.identity();
    
    // Update the texture on the model
    import('./scene.js').then(module => {
        if (typeof module.updateEditorCanvasTexture === 'function') {
            module.updateEditorCanvasTexture(canvasTexture);
        }
    }).catch(err => {
        console.error('Error updating editor canvas texture:', err);
    });
    
    Logger.log('3D texture updated');
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
    
    // Apply rotation if needed
    if (object.angle) ctx.rotate(object.angle * Math.PI / 180);

    // Draw based on object type
    if (object.type === 'image' && object.img) {
        // Determine if this is a decal (has transparency)
        const isDecal = object.isDecal || 
                       (object.metadata && object.metadata.hasTransparency) ||
                       object.src?.toLowerCase().endsWith('.png');
        
        // For decals with transparency, use the most direct rendering approach possible
        if (isDecal) {
            // Maximum quality settings for image drawing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Use source-over for best quality with transparency
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            
            // Draw at original dimensions to maintain fine details
            ctx.drawImage(
                object.img,
                -object.width / 2,
                -object.height / 2,
                object.width,
                object.height
            );
            
            // Ensure crisp edges for decals
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Remove any stroke or outline
            ctx.strokeStyle = 'transparent';
            ctx.lineWidth = 0;
        } else {
            // For regular images, use standard rendering
            ctx.globalCompositeOperation = 'source-over';
            
            // Draw the image
            ctx.drawImage(
                object.img,
                -object.width / 2,
                -object.height / 2,
                object.width,
                object.height
            );

            // Apply color filtering if needed
            if (object.removeColor === true) {
                ctx.globalCompositeOperation = 'luminosity';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);
            }
        }
    } else if (object.type === 'text') {
        // Load and apply the font
        const fontFamily = object.fontFamily || 'Arial';
        const fontSize = object.fontSize || 20;
        
        // Create a temporary canvas to measure text
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `${fontSize}px "${fontFamily}"`;
        
        // Set the main canvas font
        ctx.font = `${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = object.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text with outline for better visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = fontSize / 10;
        ctx.strokeText(object.text, 0, 0);
        
        // Draw the main text
        ctx.fillText(object.text, 0, 0);
    } else if (object.type === 'shape') {
        if (object.shapeType === 'rectangle') {
            ctx.fillStyle = object.color || '#000000';
            ctx.strokeStyle = object.color || '#000000';
            ctx.lineWidth = 1;
            
            // Draw rectangle with proper dimensions
            ctx.fillRect(-object.width / 2, -object.height / 2, object.width, object.height);
            ctx.strokeRect(-object.width / 2, -object.height / 2, object.width, object.height);
        } else if (object.shapeType === 'circle') {
            ctx.fillStyle = object.color || '#000000';
            ctx.strokeStyle = object.color || '#000000';
            ctx.lineWidth = 1;
            
            // Draw circle with proper radius
            ctx.beginPath();
            ctx.arc(0, 0, object.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (object.shapeType === 'triangle') {
            ctx.fillStyle = object.color || '#000000';
            ctx.strokeStyle = object.color || '#000000';
            ctx.lineWidth = 1;
            
            // Draw triangle
            ctx.beginPath();
            ctx.moveTo(0, -object.height / 2); // Top point
            ctx.lineTo(object.width / 2, object.height / 2); // Bottom right
            ctx.lineTo(-object.width / 2, object.height / 2); // Bottom left
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (object.shapeType === 'star') {
            ctx.fillStyle = object.color || '#000000';
            ctx.strokeStyle = object.color || '#000000';
            ctx.lineWidth = 1;
            
            // Draw 5-pointed star
            const radius = object.width / 2;
            const innerRadius = radius * 0.4; // Inner radius for star points
            
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                
                // Inner points
                const innerAngle = angle + Math.PI / 5;
                const innerX = innerRadius * Math.cos(innerAngle);
                const innerY = innerRadius * Math.sin(innerAngle);
                ctx.lineTo(innerX, innerY);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
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
    if (!object) return;

    const ctx = canvasData.ctx;

    // Save context state
    ctx.save();

    // Apply transformations for position only (no rotation for controls)
    ctx.translate(object.left + object.width / 2, object.top + object.height / 2);

    // Calculate the rotated bounding box dimensions
    let borderWidth = object.width;
    let borderHeight = object.height;
    let borderOffsetX = 0;
    let borderOffsetY = 0;

    if (object.angle && Math.abs(object.angle) > 0.1) {
        const angleRad = object.angle * Math.PI / 180;
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

        // Calculate the new border dimensions
        borderWidth = maxRotX - minRotX;
        borderHeight = maxRotY - minRotY;
        borderOffsetX = (minRotX + maxRotX) / 2;
        borderOffsetY = (minRotY + maxRotY) / 2;
    }

    // Draw selection outline with modern style
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    
    // Draw rectangle selection with padding
    const padding = 2;
    ctx.strokeRect(
        -borderWidth / 2 - padding + borderOffsetX,
        -borderHeight / 2 - padding + borderOffsetY,
        borderWidth + padding * 2,
        borderHeight + padding * 2
    );
    
    // Draw modern control buttons
    const buttonRadius = 12;
    const buttonPadding = 5;
    
    // Function to draw a control button with improved colors
    const drawControlButton = (x, y, icon, color = '#2196F3', backgroundColor = '#FFFFFF') => {
        ctx.beginPath();
        ctx.arc(x, y, buttonRadius, 0, Math.PI * 2);
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
        
        // Draw icon with improved contrast
        ctx.fillStyle = color;
        ctx.font = '14px FontAwesome';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x, y);
    };

    // Check if we should show the layers button (when there are overlapping decals)
    const hasOverlappingDecals = canvasData.objects.some(otherObj => 
        otherObj !== object && 
        otherObj.isDecal && 
        isObjectsOverlapping(object, otherObj)
    );
    
    // Draw delete button (bottom left) - Red color scheme
    drawControlButton(
        -borderWidth / 2 - buttonRadius - buttonPadding + borderOffsetX,
        borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
        '🗑',
        '#FF4444',
        '#FFF5F5'
    );
    
    // Draw layers button (top center, only if there are overlapping decals)
    if (hasOverlappingDecals) {
        drawControlButton(
            borderOffsetX,
            -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
            '⎘',
            '#4CAF50',
            '#F1F8E9'
        );
    }
    
    // Draw resize button (bottom right) - Blue color scheme
    drawControlButton(
        borderWidth / 2 + buttonRadius + buttonPadding + borderOffsetX,
        borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
        '↔',
        '#2196F3',
        '#E3F2FD'
    );
    
    // Draw pin button (top left) - Green color scheme when pinned
    drawControlButton(
        -borderWidth / 2 - buttonRadius - buttonPadding + borderOffsetX,
        -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
        object.isPinned ? '📌' : '📍',
        object.isPinned ? '#4CAF50' : '#2196F3',
        object.isPinned ? '#F1F8E9' : '#E3F2FD'
    );
    
    // Draw rotate button (top right) - Purple color scheme
    drawControlButton(
        borderWidth / 2 + buttonRadius + buttonPadding + borderOffsetX,
        -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
        '↻',
        '#9C27B0',
        '#F3E5F5'
    );
    
    // Draw duplicate button (bottom center) - Orange color scheme
    drawControlButton(
        borderOffsetX,
        borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
        'x2',
        '#FF9800',
        '#FFF3E0'
    );

    // Restore context state
    ctx.restore();
}

// Helper function to check if two objects are overlapping
function isObjectsOverlapping(obj1, obj2) {
    // Get the bounding boxes of both objects
    const rect1 = getRotatedBoundingBox(obj1);
    const rect2 = getRotatedBoundingBox(obj2);
    
    // Check for overlap with a small tolerance
    const tolerance = 2; // 2 pixels tolerance
    
    // Check if any edge of obj1 touches or overlaps with obj2
    return !(rect1.right + tolerance < rect2.left || 
             rect1.left - tolerance > rect2.right || 
             rect1.bottom + tolerance < rect2.top || 
             rect1.top - tolerance > rect2.bottom);
}

// Helper function to get rotated bounding box
function getRotatedBoundingBox(obj) {
    if (!obj.angle || Math.abs(obj.angle) < 0.1) {
        return {
            left: obj.left,
            right: obj.left + obj.width,
            top: obj.top,
            bottom: obj.top + obj.height
        };
    }

    const angleRad = obj.angle * Math.PI / 180;
    const centerX = obj.left + obj.width / 2;
    const centerY = obj.top + obj.height / 2;
    const halfWidth = obj.width / 2;
    const halfHeight = obj.height / 2;

    // Calculate corners
    const corners = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight }
    ];

    // Rotate corners
    const rotatedCorners = corners.map(corner => ({
        x: centerX + (corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad)),
        y: centerY + (corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad))
    }));

    // Find bounds
    return {
        left: Math.min(...rotatedCorners.map(c => c.x)),
        right: Math.max(...rotatedCorners.map(c => c.x)),
        top: Math.min(...rotatedCorners.map(c => c.y)),
        bottom: Math.max(...rotatedCorners.map(c => c.y))
    };
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
        // Get current view
        const targetView = options.view || state.cameraView;
        lastUsedView = targetView;

        // Create an image element to load the image
        const img = new Image();
        
        // Enable CORS if the image is from a different domain
        img.crossOrigin = 'Anonymous';
        
        // Handle successful load
        img.onload = () => {
            // Calculate optimal dimensions while maintaining aspect ratio
            const maxWidth = canvasData.width * 0.25; // Reduced from 0.3 to 0.25 (25% of canvas width)
            const maxHeight = canvasData.height * 0.25; // Reduced from 0.3 to 0.25 (25% of canvas height)
            
            const aspectRatio = img.width / img.height;
            let defaultWidth, defaultHeight;
            
            if (img.width > img.height) {
                defaultWidth = Math.min(img.width, maxWidth);
                defaultHeight = defaultWidth / aspectRatio;
                
                if (defaultHeight > maxHeight) {
                    defaultHeight = maxHeight;
                    defaultWidth = defaultHeight * aspectRatio;
                }
            } else {
                defaultHeight = Math.min(img.height, maxHeight);
                defaultWidth = defaultHeight * aspectRatio;
                
                if (defaultWidth > maxWidth) {
                    defaultWidth = maxWidth;
                    defaultHeight = defaultWidth / aspectRatio;
                }
            }
            
            // Check for transparency to auto-detect decals
            let hasTransparency = false;
            const isDecalType = /(png|svg|webp|gif)$/i.test(imageUrl);
            
            try {
                // Create a temporary canvas to check for transparency
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = Math.min(img.width, 100); // Sample at smaller size for efficiency
                tempCanvas.height = Math.min(img.height, 100);
                tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // Sample pixels to check for transparency
                const pixels = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
                
                // Check a reasonable number of pixels for transparency
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] < 240) { // Alpha channel less than 240 (not fully opaque)
                        hasTransparency = true;
                        break;
                    }
                }
                
                // If we detected transparency or it's a common decal format, mark as decal
                if (hasTransparency || isDecalType) {
                    options.isDecal = true;
                }
            } catch (e) {
                console.warn('Error checking image transparency:', e);
                // If we can't check, fall back to file extension check
                options.isDecal = isDecalType;
            }
            
            // Get current view's UV boundaries to ensure the image is placed within them
            const viewConfig = modelConfig[state.currentModel].views[targetView];
            if (!viewConfig) {
                reject(new Error('Invalid view configuration'));
                return;
            }

            const uvRect = viewConfig.uvRect;
            
            // Calculate safe placement area (with padding)
            const minX = uvRect.u1 * canvasData.width;
            const maxX = uvRect.u2 * canvasData.width;
            const minY = uvRect.v1 * canvasData.height;
            const maxY = uvRect.v2 * canvasData.height;
            
            // Apply padding (2% of area dimensions)
            const paddingX = (maxX - minX) * 0.02;
            const paddingY = (maxY - minY) * 0.02;
            
            const safeMinX = minX + paddingX;
            const safeMaxX = maxX - paddingX;
            const safeMinY = minY + paddingY;
            const safeMaxY = maxY - paddingY;
            
            // Calculate center of safe area
            const centerX = (safeMinX + safeMaxX) / 2;
            const centerY = (safeMinY + safeMaxY) / 2;
            
            // Ensure the image fits within the safe area
            let left, top;
            if (options.left !== undefined && options.top !== undefined) {
                // If position is specified, use it but constrain to safe area
                left = Math.max(safeMinX, Math.min(safeMaxX - defaultWidth, options.left));
                top = Math.max(safeMinY, Math.min(safeMaxY - defaultHeight, options.top));
            } else {
                // Otherwise center in the safe area
                left = centerX - (defaultWidth / 2);
                top = centerY - (defaultHeight / 2);
            }
            
            // Create the object with improved default properties for decals
            const obj = {
                type: 'image',
                img: img,
                src: imageUrl,
                left: left,
                top: top,
                width: options.width || defaultWidth,
                height: options.height || defaultHeight,
                angle: options.angle || 0,
                isDecal: options.isDecal || false, // Explicit decal flag
                removeColor: options.removeColor || false,
                view: targetView,
                metadata: {
                    originalWidth: img.width,
                    originalHeight: img.height,
                    hasTransparency: hasTransparency
                }
            };

            // Add object to collection
            canvasData.objects.push(obj);
            
            // Save state for undo
            historyStack.saveState();
            
            // Update the 3D texture
            updateShirt3DTexture();
            
            // Resolve with the created object
            resolve(obj);
            
            // Log success but with additional decal information
            Logger.log(`Added image${obj.isDecal ? ' (decal)' : ''}: ${imageUrl.substring(0, 50)}...`);
        };

        // Handle error
        img.onerror = (error) => {
            console.error('Error loading image:', error);
            reject(error);
        };

        // Set source to start loading
        img.src = imageUrl;
    });
}

// Define text colors
const TEXT_COLORS = [
    '#000000', // Black
    '#FFFFFF', // White
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FFA500', // Orange
    '#800080', // Purple
    '#A52A2A', // Brown
    '#808080', // Gray
    '#FFB6C1', // Pink
    '#90EE90', // Light Green
    '#ADD8E6', // Light Blue
    '#D3D3D3'  // Light Gray
];

// Define available fonts
const AVAILABLE_FONTS = [
    { name: 'Arial', value: 'Arial' },
    { name: 'Times New Roman', value: 'Times New Roman' },
    { name: 'Helvetica', value: 'Helvetica' },
    { name: 'Verdana', value: 'Verdana' },
    { name: 'Georgia', value: 'Georgia' },
    { name: 'Courier New', value: 'Courier New' },
    { name: 'Tahoma', value: 'Tahoma' },
    { name: 'Trebuchet MS', value: 'Trebuchet MS' },
    { name: 'Impact', value: 'Impact' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS' }
];

function createTextEditOverlay(existingText = '', existingColor = '#000000', existingFont = 'Arial') {
    const overlay = document.createElement('div');
    overlay.className = 'text-edit-overlay';
    
    const colorButtons = TEXT_COLORS.map(color => `
        <div class="color-option ${color === existingColor ? 'active' : ''}" 
             style="background-color: ${color}" 
             data-color="${color}">
        </div>
    `).join('');

    const fontOptions = AVAILABLE_FONTS.map(font => `
        <option value="${font.value}" ${font.value === existingFont ? 'selected' : ''}>
            ${font.name}
        </option>
    `).join('');

    overlay.innerHTML = `
        <div class="text-edit-container">
            <div class="text-edit-header">
                <h3>${existingText ? 'Edit Text' : 'Add Text'}</h3>
                <p>Enter your text and choose a color</p>
            </div>
            <textarea class="text-edit-input" placeholder="Enter your text here...">${existingText}</textarea>
            <div class="text-edit-options">
                <div class="font-select-container">
                    <label for="font-select">Font:</label>
                    <select id="font-select" class="font-select">
                        ${fontOptions}
                    </select>
                </div>
                <div class="text-edit-colors">
                    ${colorButtons}
                </div>
            </div>
            <div class="text-edit-buttons">
                <button class="text-edit-cancel">Cancel</button>
                <button class="text-edit-save">Save</button>
            </div>
        </div>
    `;

    // Apply the selected font to the textarea
    const textarea = overlay.querySelector('.text-edit-input');
    const fontSelect = overlay.querySelector('#font-select');
    
    const updateTextareaFont = () => {
        textarea.style.fontFamily = fontSelect.value;
    };
    
    fontSelect.addEventListener('change', updateTextareaFont);
    updateTextareaFont(); // Set initial font

    return overlay;
}

export async function addText(text = '', options = {}) {
    try {
        // Get current view's UV boundaries
        const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
        
        // Show text editor and wait for result
        const overlay = createTextEditOverlay(text, options.color || '#000000', options.fontFamily || 'Arial');
        document.body.appendChild(overlay);

        const result = await new Promise((resolve, reject) => {
            const textarea = overlay.querySelector('.text-edit-input');
            const colorOptions = overlay.querySelectorAll('.color-option');
            const fontSelect = overlay.querySelector('#font-select');
            let selectedColor = options.color || '#000000';
            let selectedFont = options.fontFamily || 'Arial';

            // Focus the textarea
            textarea.focus();
            textarea.select();

            // Handle color selection
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    selectedColor = option.dataset.color;
                });
            });

            // Handle save
            overlay.querySelector('.text-edit-save').addEventListener('click', () => {
                const newText = textarea.value.trim();
                if (newText) {
                    resolve({ text: newText, color: selectedColor, fontFamily: selectedFont });
                }
                overlay.remove();
            });

            // Handle cancel
            overlay.querySelector('.text-edit-cancel').addEventListener('click', () => {
                overlay.remove();
                reject('cancelled');
            });

            // Handle enter key
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newText = textarea.value.trim();
                    if (newText) {
                        resolve({ text: newText, color: selectedColor, fontFamily: selectedFont });
                    }
                    overlay.remove();
                }
            });

            // Handle escape key
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    reject('cancelled');
                }
            });

            // Handle click outside
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    reject('cancelled');
                }
            });
        });

        // Calculate position in canvas space
        const left = options.left || (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width - 100;
        const top = options.top || (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height - 20;

        // Create text object
        const textObj = {
            type: 'text',
            text: result.text,
            left: left,
            top: top,
            width: 200,
            height: 40,
            fontSize: 30,
            fontFamily: result.fontFamily || 'Arial',
            color: result.color,
            angle: 0,
            active: false
        };

        // Add to canvas
        addObject(textObj);

        // Return the created object
        return textObj;
    } catch (error) {
        if (error !== 'cancelled') {
            console.error('Error adding text:', error);
        }
        return null;
    }
}

// Define shape types and their default properties
const SHAPE_TYPES = {
    rectangle: { name: 'Rectangle', icon: 'fa-square' },
    circle: { name: 'Circle', icon: 'fa-circle' },
    triangle: { name: 'Triangle', icon: 'fa-play' },
    star: { name: 'Star', icon: 'fa-star' }
};

function createShapeEditOverlay(existingShape = null) {
    const overlay = document.createElement('div');
    overlay.className = 'text-edit-overlay';
    
    const shapeButtons = Object.entries(SHAPE_TYPES).map(([type, info]) => `
        <div class="shape-option ${existingShape?.type === type ? 'active' : ''}" 
             data-shape="${type}">
            <i class="fas ${info.icon}"></i>
            <span>${info.name}</span>
        </div>
    `).join('');

    const colorButtons = TEXT_COLORS.map(color => `
        <div class="color-option ${existingShape?.color === color ? 'active' : ''}" 
             style="background-color: ${color}" 
             data-color="${color}">
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="text-edit-container">
            <div class="text-edit-header">
                <h3>${existingShape ? 'Edit Shape' : 'Add Shape'}</h3>
                <p>Choose a shape and color</p>
            </div>
            <div class="text-edit-options">
                <div class="shape-options">
                    ${shapeButtons}
                </div>
                <div class="text-edit-colors">
                    ${colorButtons}
                </div>
            </div>
            <div class="text-edit-buttons">
                <button class="text-edit-cancel">Cancel</button>
                <button class="text-edit-save">Save</button>
            </div>
        </div>
    `;

    return overlay;
}

export async function addShape(shapeType = '', options = {}) {
    try {
        // Get current view's UV boundaries
        const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
        
        // Show shape editor and wait for result
        const overlay = createShapeEditOverlay();
        document.body.appendChild(overlay);

        const result = await new Promise((resolve, reject) => {
            const shapeOptions = overlay.querySelectorAll('.shape-option');
            const colorOptions = overlay.querySelectorAll('.color-option');
            let selectedShape = shapeType || 'rectangle';
            let selectedColor = options.color || '#000000';

            // Handle shape selection
            shapeOptions.forEach(option => {
                if (option.dataset.shape === selectedShape) {
                    option.classList.add('active');
                }
                option.addEventListener('click', () => {
                    shapeOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    selectedShape = option.dataset.shape;
                });
            });

            // Handle color selection
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    selectedColor = option.dataset.color;
                });
            });

            // Handle save
            overlay.querySelector('.text-edit-save').addEventListener('click', () => {
                resolve({ type: selectedShape, color: selectedColor });
                overlay.remove();
            });

            // Handle cancel
            overlay.querySelector('.text-edit-cancel').addEventListener('click', () => {
                overlay.remove();
                reject('cancelled');
            });

            // Handle click outside
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    reject('cancelled');
                }
            });
        });

        if (result) {
            // Calculate position in canvas space
            const left = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width - 50;
            const top = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height - 50;

            // Create shape object
            const shapeObj = {
                type: 'shape',
                shapeType: result.type,
                left: left,
                top: top,
                width: 100,
                height: 100,
                color: result.color,
                angle: 0,
                active: false
            };

            // Add to canvas
            addObject(shapeObj);
            
            // Update the texture
            updateShirt3DTexture();

            return shapeObj;
        }
    } catch (error) {
        if (error !== 'cancelled') {
            console.error('Error adding shape:', error);
        }
        return null;
    }
}

// Handle adding shape from the UI
async function handleAddShape() {
    try {
        await addShape();
    } catch (error) {
        if (error !== 'cancelled') {
            console.error('Error handling shape addition:', error);
        }
    }
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

    // Draw a visible highlight for the active editable area
    ctx.save();

    // Create highlight effect with animated dash
    ctx.strokeStyle = 'rgb(64, 127, 255)'; // Fixed bright blue
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = (Date.now() / 100) % 10;
    
    // Use composite operation that ensures the line is always visible
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw the rectangle
    ctx.strokeRect(x, y, width, height);

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
        if (typeof scene.lockCameraToView === 'function') {
            if (enabled) {
                // If enabling controls, unlock the camera
                scene.lockCameraToView(null, false);
            } else {
                // If disabling controls, lock to current view
                scene.lockCameraToView(mapViewNameToCameraView(currentLockedView || 'front'), true);
            }
        }
        // Also disable OrbitControls directly
        if (window.controls) {
            window.controls.enabled = enabled;
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
    // Only set mode if there's a selected object
    if (selectedObject) {
        transformMode = mode;
        
        // Set appropriate cursor
        document.body.style.cursor = cursors[mode] || cursors.default;
        
        Logger.log(`Set transform mode: ${mode}`);
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
    if (!canvasData || !ctx) return;

    const views = modelConfig[state.currentModel].views;
    if (!views) return;

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
        
        // Set up the style for the border
        ctx.strokeStyle = 'rgba(33, 150, 243, 0.5)'; // Semi-transparent blue
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = (Date.now() / 100) % 10; // Animated dash
        
        // Draw the rectangle
        ctx.strokeRect(x, y, width, height);
        
        // Add a subtle highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
        
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
        // Handle case where u1 > u2 or v1 > v2 due to inverted coordinates
        const uMin = Math.min(uvRect.u1, uvRect.u2);
        const uMax = Math.max(uvRect.u1, uvRect.u2);
        const vMin = Math.min(uvRect.v1, uvRect.v2);
        const vMax = Math.max(uvRect.v1, uvRect.v2);
        
        if (uv.x >= uMin && uv.x <= uMax && 
            uv.y >= vMin && uv.y <= vMax) {
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
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;

    // Get the current view from UV coordinates
    const hitView = detectViewFromUV(uv);
    if (hitView) {
        // Update current editable area
        currentEditableArea = modelConfig[state.currentModel].views[hitView].uvRect;
        isEditingMode = true;
        updateShirt3DTexture(); // Update to show the new editable area
    }

    // First check if we clicked on a transform handle of the selected object
    if (selectedObject) {
        const action = detectTransformHandleClick();
        if (action) {
            event.preventDefault();
            event.stopPropagation();

            // Lock t-shirt movement when using any control
            toggleCameraControls(false);

            switch (action) {
                case 'move':
                    if (!selectedObject.isPinned) {
                        transformMode = 'move';
                        document.body.style.cursor = cursors.grabbing;
                    }
                    break;

                case 'rotate':
                    if (selectedObject.isDecal) {
                        transformMode = 'rotate';
                        document.body.style.cursor = cursors.rotate;
                        // Initialize rotation tracking
                        selectedObject._lastRotationAngle = undefined;
                    }
                    break;

                case 'scale':
                    if (!selectedObject.isPinned) {
                        transformMode = 'scale';
                        document.body.style.cursor = cursors.scale;
                    }
                    break;

                case 'delete':
                    // Delete the selected object
                    const index = canvasData.objects.indexOf(selectedObject);
                    if (index > -1) {
                        canvasData.objects.splice(index, 1);
                        selectedObject = null;
                        transformMode = 'none';
                        document.body.style.cursor = cursors.default;
                        toggleCameraControls(true); // Unlock t-shirt movement after deletion
                        updateShirt3DTexture();
                    }
                    break;

                case 'pin':
                    // Toggle pin state
                    selectedObject.isPinned = !selectedObject.isPinned;
                    transformMode = 'none';
                    document.body.style.cursor = cursors.default;
                    updateShirt3DTexture();
                    break;

                case 'duplicate':
                    // Create a copy of the selected object
                    const clone = { ...selectedObject };
                    // Offset the clone slightly
                    clone.left += 20;
                    clone.top += 20;
                    canvasData.objects.push(clone);
                    selectObject(clone);
                    transformMode = 'move';
                    document.body.style.cursor = cursors.grabbing;
                    break;

                case 'layers':
                    // Find overlapping objects with improved detection
                    const overlappingObjects = canvasData.objects.filter(obj => 
                        obj !== selectedObject && 
                        obj.isDecal && 
                        isObjectsOverlapping(selectedObject, obj)
                    );
                    
                    if (overlappingObjects.length > 0) {
                        // Move selected object to top
                        const currentIndex = canvasData.objects.indexOf(selectedObject);
                        if (currentIndex > -1) {
                            canvasData.objects.splice(currentIndex, 1);
                            canvasData.objects.push(selectedObject);
                            updateShirt3DTexture();
                        }
                    }
                    break;
            }
            return;
        }
    }

    // If we didn't click a handle, check if we clicked an object
    const clickedObject = detectObjectClick();
    
    if (clickedObject) {
        // Lock t-shirt movement when selecting an object
        toggleCameraControls(false);
        // Allow selecting pinned objects
        selectObject(clickedObject);
        if (!clickedObject.isPinned) {
            transformMode = 'move';
            document.body.style.cursor = cursors.grabbing;
        } else {
            transformMode = 'none';
            document.body.style.cursor = cursors.default;
        }
        // Update texture to show control buttons
        updateShirt3DTexture();
    } else {
        // Clicked empty space
        if (selectedObject) {
            deselectObject();
        }
        selectedObject = null;
        transformMode = 'none';
        document.body.style.cursor = cursors.default;
        toggleCameraControls(true); // Unlock t-shirt movement
        updateShirt3DTexture();
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

/**
 * Handle double click events for text editing
 * @param {MouseEvent} event 
 */
function onDoubleClick(event) {
    if (!selectedObject || selectedObject.type !== 'text') return;

    const overlay = createTextEditOverlay(selectedObject.text, selectedObject.color);
    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('.text-edit-input');
    const colorOptions = overlay.querySelectorAll('.color-option');
    let selectedColor = selectedObject.color;

    // Focus the textarea
    textarea.focus();
    textarea.select();

    // Handle color selection
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            selectedColor = option.dataset.color;
        });
    });

    // Handle save
    overlay.querySelector('.text-edit-save').addEventListener('click', () => {
        const newText = textarea.value.trim();
        if (newText) {
            selectedObject.text = newText;
            selectedObject.color = selectedColor;
            updateShirt3DTexture();
        }
        overlay.remove();
    });

    // Handle cancel
    overlay.querySelector('.text-edit-cancel').addEventListener('click', () => {
        overlay.remove();
    });

    // Handle enter key
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const newText = textarea.value.trim();
            if (newText) {
                selectedObject.text = newText;
                selectedObject.color = selectedColor;
                updateShirt3DTexture();
            }
            overlay.remove();
        }
    });

    // Handle escape key
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
        }
    });

    // Handle click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
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

// Handle adding text from the UI
async function handleAddText() {
    try {
        // Get current view's UV boundaries
        const viewConfig = modelConfig[state.currentModel].views[state.cameraView];
        
        // Show text editor and wait for result
        const result = await addText();
        
        if (result) {
            // Calculate position in canvas space
            const left = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width - 100;
            const top = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height - 20;

            // Create text object
            const textObj = {
                type: 'text',
                text: result.text,
                left: left,
                top: top,
                width: 200,
                height: 40,
                fontSize: 30,
                fontFamily: result.fontFamily || 'Arial',
                color: result.color,
                angle: 0,
                active: false
            };

            // Add to canvas
            addObject(textObj);
            
            // Update the texture
            updateShirt3DTexture();
        }
    } catch (error) {
        if (error !== 'cancelled') {
            console.error('Error adding text:', error);
        }
    }
}