/**
 * 3D-Editor.js
 * Implements direct 3D editing capabilities for manipulating elements on the 3D model
 * Adapts Fabric.js transformation logic to work in a 3D environment
 */

import * as THREE from 'three';
import { state, updateState, loadPanelSettings, addPanelItem, removePanelItem } from './state.js';
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
    width: 2048,
    height: 2048,
    objects: []
};

// Cursors for different modes
const cursors = {
    default: 'default',
    move: 'grab',
    rotate: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><path d=\'M12 2 C12 22 12 22 12 22\' stroke=\'#2196F3\' stroke-width=\'2\'/></svg>"), auto',
    scale: 'nwse-resize',
    edit: 'crosshair',
    grabbing: 'grabbing',
    nwseResize: 'nwse-resize'
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
    canvas.addEventListener('mousedown', onMouseDown, { passive: false });
    canvas.addEventListener('mousemove', onMouseMove, { passive: false });
    canvas.addEventListener('mouseup', onMouseUp, { passive: false });
    canvas.addEventListener('click', onClick, { passive: false });
    
    // Add double-click event listener with capture phase to ensure it runs before other handlers
    canvas.addEventListener('dblclick', onDoubleClick, { 
        passive: false,
        capture: true 
    });

    // Keyboard events
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

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
            
            // Don't lock to view unless actually editing - only lock when touching a decal or control
            const clickedObject = detectObjectClick();
            
            // Check if we clicked on a transform handle of a selected object first
            if (selectedObject) {
                const action = detectTransformHandleClick();
                if (action) {
                    // Lock t-shirt movement when interacting with decal controls
                    toggleCameraControls(false);
                    lockToView(hitView);
                    
                    // Reset scaling state variables at the start of scaling
                    if (action === 'scale') {
                        delete selectedObject._initialScaleDistance;
                        delete selectedObject._initialWidth;
                        delete selectedObject._initialHeight;
                    }
                    
                    // Handle the control button click
                    handleEditableAreaClick(uv, intersects[0]);
                    return;
                }
            }

            // If we clicked on an object, lock the view for editing
            if (clickedObject) {
                // Lock to this view for editing
                lockToView(hitView);
                
                // Handle the editable area click (select object, set transform mode, etc.)
                handleEditableAreaClick(uv, intersects[0]);
            } else {
                // We didn't click on a decal or control, so keep the model free moving
                // Only enable editing mode without locking camera controls
                isEditingMode = true;
                handleEditableAreaClick(uv, intersects[0]);
                
                // Don't lock camera movement if we're just clicking on the shirt
                toggleCameraControls(true);
                
                // But still highlight the editable area
                currentEditableArea = modelConfig[state.currentModel].views[hitView].uvRect;
                updateShirt3DTexture();
            }
        } else {
            // If we click outside all editable areas, ensure camera is unlocked
            unlockFromView();
        }
    } else {
        // We clicked on something other than the shirt model
        // If it wasn't a UI element, deselect current object
        if (!event.target.closest('.ui-element')) {
            deselectObject();
        }
        
        // Ensure camera is unlocked
        unlockFromView();
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

        // Track if transformation actually occurred
        let transformApplied = false;

        // Handle different transform modes
        switch (transformMode) {
            case 'move':
                if (!selectedObject.isPinned) {
                    moveObject(selectedObject, deltaX, deltaY);
                    transformApplied = true;
                }
                break;
            case 'rotate':
                // Allow rotation for both decals and text objects
                if (selectedObject.isDecal || selectedObject.type === 'text') {
                    rotateObject(selectedObject, deltaX, deltaY);
                    transformApplied = true;
                }
                break;
            case 'scale':
                if (!selectedObject.isPinned) {
                    scaleObject(selectedObject, deltaX, deltaY);
                    transformApplied = true;
                }
                break;
        }

        // Only update if transformation was applied
        if (transformApplied) {
            // Use requestAnimationFrame for smoother updates
            if (!window._updateAnimationFrame) {
                window._updateAnimationFrame = requestAnimationFrame(() => {
                    // Update the texture with optimized debouncing
                    updateShirt3DTexture();
                    // Update the transform controls
                    updateTransformControls();
                    // Clear the animation frame flag
                    window._updateAnimationFrame = null;
                });
            }
        }

        // Update the starting point for smooth transformations
        startPoint.copy(currentPoint);
    }
}

/**
 * Handle mouse up events
 * @param {MouseEvent} event 
 */
function onMouseUp(event) {
    // Only re-enable camera controls if we're not in editing mode or 
    // if we're done with a transformation
    if (transformMode !== 'none') {
        // If we were rotating, clean up the rotation variables
        if (transformMode === 'rotate' && selectedObject) {
            // Clean up rotation tracking variables but keep the final angle
            delete selectedObject._lastRotationAngle;
            delete selectedObject._startAngle;
            // Keep _startRotation for future rotations
        }
        
        // Reset scaling state variables when operation is complete
        if (transformMode === 'scale' && selectedObject) {
            delete selectedObject._initialScaleDistance;
            delete selectedObject._initialWidth;
            delete selectedObject._initialHeight;
        }
        
        // Done with transformation, but still in edit mode
        transformMode = 'none';
        
        // Keep camera controls disabled if we still have a selected object
        if (selectedObject) {
            // Only show edit cursor when we have a selected object
            document.body.style.cursor = cursors.edit;
        } else {
            // If no object is selected, reset cursor and enable camera
            document.body.style.cursor = cursors.default;
            toggleCameraControls(true);
        }
    }

    // Save state for undo
    if (stateChanged) {
        historyStack.saveState();
        stateChanged = false;
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
 * @returns {string|null} Action name or null if no handle was clicked
 */
function detectTransformHandleClick() {
    if (!selectedObject) return null;

    // Get object from the collection
    const object = selectedObject;
    
    // Get current mouse position in UV space from raycaster
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);
    if (intersects.length === 0) return null;
    
    const uv = intersects[0].uv;
    const x = uv.x * canvasData.width;
    const y = uv.y * canvasData.height;
    
    // Calculate object center in canvas space
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;
    
    // Calculate the rotated bounding box dimensions - MUST MATCH drawSelectionOverlay
    let borderWidth = object.width;
    let borderHeight = object.height;
    let borderOffsetX = 0;
    let borderOffsetY = 0;

    if (object.angle && Math.abs(object.angle) > 0.1) {
        const angleRad = object.angle * Math.PI / 180;
        const halfWidth = object.width / 2;
        const halfHeight = object.height / 2;

        // Calculate the four corners of the unrotated box - EXACTLY match drawSelectionOverlay
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

        // Calculate the new border dimensions - EXACTLY match drawSelectionOverlay
        borderWidth = maxRotX - minRotX;
        borderHeight = maxRotY - minRotY;
        borderOffsetX = (minRotX + maxRotX) / 2;
        borderOffsetY = (minRotY + maxRotY) / 2;
    }
    
    // Translate mouse position to object's coordinate system
    const relX = x - centerX;
    const relY = y - centerY;
    
    // Size and positioning for control buttons - MUST MATCH drawSelectionOverlay
    const buttonRadius = 12;
    const buttonPadding = 5;
    const hitRadius = buttonRadius * 1.5; // Slightly larger hit area for better usability
    
    // Define control button positions - MUST MATCH drawSelectionOverlay
    const buttons = [
        // Delete button (bottom left)
        {
            x: -borderWidth / 2 - buttonRadius - buttonPadding + borderOffsetX,
            y: borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
            action: 'delete'
        },
        // Layers button (top center, only check if there are overlapping decals)
        {
            x: borderOffsetX,
            y: -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
            action: 'layers',
            condition: () => canvasData.objects.some(otherObj => 
                otherObj !== object && 
                isObjectsOverlapping(object, otherObj)
            )
        },
        // Resize button (bottom right)
        {
            x: borderWidth / 2 + buttonRadius + buttonPadding + borderOffsetX,
            y: borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
            action: 'scale'
        },
        // Pin button (top left)
        {
            x: -borderWidth / 2 - buttonRadius - buttonPadding + borderOffsetX,
            y: -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
            action: 'pin'
        },
        // Rotate button (top right)
        {
            x: borderWidth / 2 + buttonRadius + buttonPadding + borderOffsetX,
            y: -borderHeight / 2 - buttonRadius - buttonPadding + borderOffsetY,
            action: 'rotate'
        },
        // Duplicate button (bottom center)
        {
            x: borderOffsetX,
            y: borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
            action: 'duplicate'
        }
    ];

    // Check each button - no need to apply inverse rotation as we're using the rotated bounding box
    for (const button of buttons) {
        // Skip checking layers button if condition is not met
        if (button.action === 'layers' && !button.condition()) {
            continue;
        }

        const distanceToButton = Math.sqrt(
            Math.pow(relX - button.x, 2) +
            Math.pow(relY - button.y, 2)
        );

        if (distanceToButton <= hitRadius) {
            return button.action;
        }
    }

    // Check if we're inside the object (for move)
    // For rotated objects, we need to apply inverse rotation to check if point is inside
    if (object.angle && Math.abs(object.angle) > 0.1) {
        const angleRad = -object.angle * Math.PI / 180; // Negative for inverse rotation
        const dx = relX;
        const dy = relY;
        
        // Apply inverse rotation
        const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        
        // Check if within the object bounds plus padding
        const padding = 5;
        if (Math.abs(localX) <= object.width / 2 + padding && 
            Math.abs(localY) <= object.height / 2 + padding) {
            return 'move';
        }
    } else {
        // For non-rotated objects, simple boundary check
        const padding = 5;
        if (Math.abs(relX) <= object.width / 2 + padding && 
            Math.abs(relY) <= object.height / 2 + padding) {
            return 'move';
        }
    }

    return null;
}

/**
 * Detect if an object was clicked
 * @returns {Object} The clicked object or null
 */
function detectObjectClick() {
    console.log('Detecting object click');
    console.log('Mouse position:', mouse);
    
    raycaster.setFromCamera(mouse, camera);

    // Check UV position on the model
    const intersects = raycaster.intersectObject(shirtMesh);
    console.log('Intersects:', intersects.length);
    
    if (intersects.length > 0) {
        const uv = intersects[0].uv;
        console.log('UV coordinates:', uv);

        // Find which element is at this UV position
        for (const obj of canvasData.objects) {
            if (isPointInObject(uv, obj)) {
                console.log('Found object:', obj);
                return obj;
            }
        }
    }

    console.log('No object found at click position');
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
        const isInside = x >= left && x <= right && y >= top && y <= bottom;
        if (isInside) {
            console.log('Point inside non-rotated object:', object);
        }
        return isInside;
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
    const isInside = Math.abs(rotX) <= object.width / 2 && Math.abs(rotY) <= object.height / 2;
    if (isInside) {
        console.log('Point inside rotated object:', object);
    }
    return isInside;
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

    // Optimize movement with direct positioning instead of incremental updates
    // Get object's current position in UV space for calculations
    const objLeftUV = object.left / canvasData.width;
    const objTopUV = object.top / canvasData.height;

    // Calculate distortion factor based on position in UV map with improved smoothing
    let distortionFactorX = 1.0;
    let distortionFactorY = 1.0;

    // Check if we're near edges of UV map where distortion might occur
    const edgeThreshold = 0.1;
    const uvRect = viewConfig.uvRect;

    // Adjust for distortion near edges - apply progressively stronger correction with improved smoothing
    if (objLeftUV < uvRect.u1 + edgeThreshold) {
        // Left edge distortion correction with improved smoothing
        distortionFactorX = 0.9 + (0.1 * (objLeftUV - uvRect.u1) / edgeThreshold);
    } else if (objLeftUV > uvRect.u2 - edgeThreshold) {
        // Right edge distortion correction with improved smoothing
        distortionFactorX = 0.9 + (0.1 * (uvRect.u2 - objLeftUV) / edgeThreshold);
    }

    if (objTopUV < uvRect.v1 + edgeThreshold) {
        // Top edge distortion correction with improved smoothing
        distortionFactorY = 0.9 + (0.1 * (objTopUV - uvRect.v1) / edgeThreshold);
    } else if (objTopUV > uvRect.v2 - edgeThreshold) {
        // Bottom edge distortion correction with improved smoothing
        distortionFactorY = 0.9 + (0.1 * (uvRect.v2 - objTopUV) / edgeThreshold);
    }

    // Apply curvature correction based on model type and view
    // For curved surfaces like sleeves, additional correction is needed
    if (state.cameraView === 'left' || state.cameraView === 'right') {
        // Sleeves require special treatment due to curved surface
        const distanceFromCenter = Math.abs(objLeftUV - ((uvRect.u1 + uvRect.u2) / 2));
        const curvatureCorrection = 1.0 - (distanceFromCenter * 0.5);
        distortionFactorX *= curvatureCorrection;
    }

    // Apply the final movement with all corrections and improved precision
    // Invert the Y-axis movement by negating deltaUV.y
    const newLeft = object.left + deltaUV.x * canvasData.width * distortionFactorX;
    const newTop = object.top - deltaUV.y * canvasData.height * distortionFactorY;
    
    // Use direct assignment for smoother updates rather than incremental changes
    object.left = newLeft;
    object.top = newTop;

    // Apply advanced constraints to keep object in valid UV space
    constrainObjectToUVBoundary(object);

    Logger.log('Moved object with improved smooth calculations');
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

        // Store initial angle and rotation when beginning a new rotation action
        if (object._lastRotationAngle === undefined) {
            object._lastRotationAngle = angle;
            object._startAngle = angle;
            object._startRotation = object.angle || 0;
            return;
        }

        // Calculate the angle difference
        let angleDelta = angle - object._lastRotationAngle;
     
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

        // Convert to degrees and apply a rotation speed adjustment
        const rotationSpeed = 1.5; // Increased from 1.0 to 1.5
        angleDelta *= (180 / Math.PI) * rotationSpeed;

        // Calculate new angle based on total change from start position
        // This prevents drift and ensures smooth continuation of rotation
        object.angle = object._startRotation + ((angle - object._startAngle) * (180 / Math.PI) * rotationSpeed);

        // Update the last angle for next calculation
        object._lastRotationAngle = angle;
    } else {
        // Fallback to a simpler method if ray doesn't hit
        const rotationFactor = 1.0; // Adjusted for appropriate rotation speed
        const rotationDelta = deltaX * rotationFactor;
        
        // Initialize start values if needed
        if (object._startRotation === undefined) {
            object._startRotation = object.angle || 0;
        }
        
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

    // Get object center coordinates
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;

    // Cast a ray to get position on the model
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);
    
    if (intersects.length === 0) return;
    
    const uv = intersects[0].uv;
    const mouseX = uv.x * canvasData.width;
    const mouseY = uv.y * canvasData.height;
    
    // Calculate the distance from center to current mouse position
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    // If this is the first move, store the initial distance and object size
    if (!object._initialScaleDistance) {
        object._initialScaleDistance = currentDistance;
        object._initialWidth = object.width;
        object._initialHeight = object.height;
        
        // For text objects, also store the initial fontSize
        if (object.type === 'text') {
            object._initialFontSize = object.fontSize || 30;
        }
        return;
    }
    
    // Calculate the scale ratio based on distance change
    const scaleFactor = currentDistance / object._initialScaleDistance;
    
    // Apply the scale relative to the initial size
    let newWidth = object._initialWidth * scaleFactor;
    let newHeight = object._initialHeight * scaleFactor;
    
    // Apply minimum and maximum constraints
    const minDimension = 20; // Minimum size in pixels
    const maxDimension = Math.min(canvasData.width, canvasData.height) * 0.8; // Maximum size
    
    newWidth = Math.max(minDimension, Math.min(maxDimension, newWidth));
    newHeight = Math.max(minDimension, Math.min(maxDimension, newHeight));
    
    // Special handling for text objects
    if (object.type === 'text') {
        // Scale the font size proportionally
        const newFontSize = Math.max(12, object._initialFontSize * scaleFactor);
        object.fontSize = newFontSize;
        
        // For text objects, measure the new dimensions based on the scaled font size
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `bold ${newFontSize}px "${object.font || 'Arial'}"`;
        const textMetrics = tempCtx.measureText(object.text);
        
        // Update dimensions based on the new font size
        newWidth = textMetrics.width || newWidth;
        newHeight = newFontSize * 1.2; // Approximation for text height
    }
    // Normal aspect ratio handling for non-text objects
    else if ((object.type === 'image' && object.preserveAspectRatio !== false)) {
        const originalAspect = object.metadata?.originalWidth / object.metadata?.originalHeight || 
                             object._initialWidth / object._initialHeight;
        
        // Adjust height based on width to maintain aspect ratio
        newHeight = newWidth / originalAspect;
        
        // Check bounds again
        if (newHeight > maxDimension) {
            newHeight = maxDimension;
            newWidth = newHeight * originalAspect;
        }
    }

    // Update object dimensions while keeping it centered
    object.width = newWidth;
    object.height = newHeight;
    object.left = centerX - newWidth / 2;
    object.top = centerY - newHeight / 2;

    // Ensure object stays within boundaries
    constrainObjectToUVBoundary(object);

    Logger.log('Scaled object with natural scaling behavior');
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
        // Reset filter
        canvasData.ctx.filter = 'none';
        
        // Draw the object to canvas - filters will be applied in drawObjectToCanvas
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
        
        // Create a temporary canvas for applying filters
        let sourceImage = object.img;
        
        // If the object has temporary filters being previewed or permanent filters
        if (object._tempFilters || object.currentFilters) {
            // Use temporary filters for preview while editing, or permanent filters otherwise
            const currentFilter = object._tempFilters || object.currentFilters || 'contrast(120%) saturate(130%) brightness(105%)';
            
            // Apply filters directly to the context
            ctx.filter = currentFilter;
            
            // No need to modify the source image
            sourceImage = object.img;
        } else if (isDecal) {
            // Apply default enhancement for decals if no filters are specified
            ctx.filter = 'contrast(120%) saturate(130%) brightness(105%)';
        }
        
        // For decals with transparency, use the most direct rendering approach possible
        if (isDecal) {
            // Maximum quality settings for image drawing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Use source-over for best quality with transparency
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            
            // Create a temporary high-resolution canvas for better quality rendering
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sourceImage.naturalWidth;
            tempCanvas.height = sourceImage.naturalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Apply maximum quality settings
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';
            
            // Draw original image to temp canvas
            tempCtx.drawImage(sourceImage, 0, 0, sourceImage.naturalWidth, sourceImage.naturalHeight);
            
            // Draw the image from temp canvas to main canvas at the desired size
            ctx.drawImage(
                tempCanvas,
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
                sourceImage,
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
        const fontFamily = object.font || 'Arial';  // Fixed: Changed fontFamily to font to match object property
        const fontSize = object.fontSize || 30; // Increased default font size
        
        // Create a temporary canvas to measure text
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `bold ${fontSize}px "${fontFamily}"`; // Added bold
        
        // Set the main canvas font
        ctx.font = `bold ${fontSize}px "${fontFamily}"`; // Added bold
        ctx.fillStyle = object.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Add a slight shadow for better visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw the stroke with increased width for better visibility
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = fontSize / 8; // Increased stroke width
        ctx.strokeText(object.text, 0, 0);
        
        // Draw the main text
        ctx.fillText(object.text, 0, 0);
        
        // Reset shadow after drawing
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
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

    // Apply transformations for position (center of object)
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

    // Draw selection outline - non-rotating rectangular boundary
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    
    // Use padding for better visibility
    const padding = 4;
    
    // Draw a rectangular boundary that doesn't rotate, just like the control buttons
    ctx.strokeRect(
        borderOffsetX - borderWidth/2 - padding,
        borderOffsetY - borderHeight/2 - padding,
        borderWidth + padding * 2,
        borderHeight + padding * 2
    );
    
    // Draw center point for reference (if object is rotated)
    if (object.angle && Math.abs(object.angle) > 0.1) {
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
    }
    
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
    
    // Draw duplicate button (bottom center)
    drawControlButton(
        borderOffsetX,
        borderHeight / 2 + buttonRadius + buttonPadding + borderOffsetY,
        '📋',
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
        
        // Create new image with high quality settings
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // Set image quality settings
        img.imageSmoothingEnabled = true;
        img.imageSmoothingQuality = 'high';
        
        // When the image loads
        img.onload = () => {
            // Calculate optimal dimensions while maintaining aspect ratio
            const aspectRatio = img.width / img.height;
            
            // Default width based on canvas size, or user-specified width
            const defaultWidth = canvasData.width * 0.2;
            
            // Calculate height based on aspect ratio
            const defaultHeight = defaultWidth / aspectRatio;
            
            // Get view configuration for correct placement
            const viewConfig = modelConfig[state.currentModel]?.views?.[targetView];
            if (!viewConfig) {
                reject(new Error(`Invalid view configuration for ${targetView}`));
                return;
            }
            
            // Get the position based on options or calculate a default position
            let left, top;
            if (options.left !== undefined && options.top !== undefined) {
                // Use provided position
                left = options.left;
                top = options.top;
            } else {
                // Always center the image in the view for consistent placement
                const uvRect = viewConfig.uvRect;
                const centerX = (uvRect.u1 + uvRect.u2) / 2 * canvasData.width;
                const centerY = (uvRect.v1 + uvRect.v2) / 2 * canvasData.height;
                left = centerX - defaultWidth / 2;
                top = centerY - defaultHeight / 2;
            }
            
            // Check if this is a decal type image
            let hasTransparency = false;
            const isDecalType = /\.(png|webp|gif)$/i.test(imageUrl) || 
                                imageUrl.includes("data:image/png") || 
                                imageUrl.includes("data:image/webp") ||
                                options.isDecal || 
                                options.removeColor;
            
            try {
                // Create a temporary canvas to check for transparency
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = img.width; // Use original image dimensions
                tempCanvas.height = img.height;
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
            
            const uvRect = viewConfig.uvRect;
            
            // Calculate safe placement area (with padding)
            const minX = uvRect.u1 * canvasData.width;
            const minY = uvRect.v1 * canvasData.height;
            const maxX = uvRect.u2 * canvasData.width;
            const maxY = uvRect.v2 * canvasData.height;
            
            // Ensure the image position is within valid UV bounds
            left = Math.max(minX, Math.min(maxX - defaultWidth / 2, left));
            top = Math.max(minY, Math.min(maxY - defaultHeight / 2, top));
            
            // Create the object with improved default properties for decals
            const obj = {
                id: 'img_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                type: 'image',
                img: img,
                src: imageUrl,
                left: left,
                top: top,
                width: options.width || defaultWidth,
                height: options.height || defaultHeight,
                angle: options.angle || 0,
                isDecal: options.isDecal || false,
                isAIGenerated: options.isAIGenerated || false,
                removeColor: options.removeColor || false,
                view: targetView,
                // Apply default enhancement filters to make decals more vibrant
                currentFilters: options.currentFilters || 'contrast(120%) saturate(130%) brightness(105%)',
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
            
            // Save to panel settings if it's a decal
            if (obj.isDecal) {
                if (obj.isAIGenerated) {
                    addPanelItem('ai', obj);
                } else {
                    addPanelItem('photo', obj);
                }
            }
            
            // Update the 3D texture
            updateShirt3DTexture();
            
            // Resolve with the created object
            resolve(obj);
            
            // Log success but with additional decal information
            Logger.log(`Added image${obj.isDecal ? ' (decal)' : ''}: ${imageUrl.substring(0, 50)}...`);
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
    // Create a floating panel
    const panel = document.createElement('div');
    panel.className = 'floating-panel';
    panel.id = 'text-edit-panel';
    
    // Add panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = existingText ? 'Edit Text' : 'Add Text';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close';
    closeBtn.setAttribute('aria-label', 'Close Panel');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    
    // Create panel content
    const content = document.createElement('div');
    content.className = 'panel-content';

    const fontOptions = AVAILABLE_FONTS.map(font => `
        <option value="${font.value}" ${font.value === existingFont ? 'selected' : ''}>
            ${font.name}
        </option>
    `).join('');

    const colorButtons = TEXT_COLORS.map(color => `
        <div class="color-option ${color === existingColor ? 'active' : ''}" 
             style="background-color: ${color}" 
             data-color="${color}">
        </div>
    `).join('');

    content.innerHTML = `
        <div class="section-title">
            <h3>${existingText ? 'Edit Your Text' : 'Add Text to Design'}</h3>
            <p>Enter your text and customize its appearance</p>
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
    `;
    
    // Add to panel
    panel.appendChild(header);
    panel.appendChild(content);
    
    // Add to document body
    document.body.appendChild(panel);
    
    // Position the panel with fixed left position
    positionFloatingPanel(panel, { left: 100 });
    
    // Add event listeners to prevent panel from closing when clicking inside
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    return panel;
}

// Add text to canvas
export async function addText(text = '', options = {}) {
    try {
        // Get the position if this is called from a button click
        const position = options.fromButton ? getButtonPosition('add-text-btn') : null;
        
        // Show text editor and wait for result
        const panel = createTextEditOverlay(text, options.color || '#000000', options.font || 'Arial');
        
        // Position the panel
        positionFloatingPanel(panel, position);
        
        // Add active class to show the panel
        panel.classList.add('active');

        const textResult = await new Promise((resolve, reject) => {
            const textarea = panel.querySelector('.text-edit-input');
            const colorOptions = panel.querySelectorAll('.color-option');
            const fontSelect = panel.querySelector('#font-select');
            let selectedColor = options.color || '#000000';
            let selectedFont = options.font || 'Arial';

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
            
            // Handle close button
            panel.querySelector('.panel-close').addEventListener('click', () => {
                panel.remove();
                reject('cancelled');
            });

            // Handle save
            panel.querySelector('.text-edit-save').addEventListener('click', () => {
                const newText = textarea.value.trim();
                if (newText) {
                    resolve({ text: newText, color: selectedColor, font: fontSelect.value });
                }
                panel.remove();
            });

            // Handle cancel
            panel.querySelector('.text-edit-cancel').addEventListener('click', () => {
                panel.remove();
                reject('cancelled');
            });

            // Handle enter key
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newText = textarea.value.trim();
                    if (newText) {
                        resolve({ text: newText, color: selectedColor, font: fontSelect.value });
                    }
                    panel.remove();
                }
            });

            // Handle escape key
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    panel.remove();
                    reject('cancelled');
                }
            });
        });

        // After getting text details, show view selection modal
        return new Promise((resolve, reject) => {
            import('./ui.js').then(ui => {
                // Generate a preview image of the text
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = 400;
                previewCanvas.height = 100;
                const ctx = previewCanvas.getContext('2d');
                
                // Draw background
                ctx.fillStyle = '#f5f5f5';
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                
                // Draw text
                ctx.font = `30px ${textResult.font}`;
                ctx.fillStyle = textResult.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(textResult.text, previewCanvas.width / 2, previewCanvas.height / 2);
                
                // Get data URL for preview
                const previewImage = previewCanvas.toDataURL('image/png');
                
                // Show the view selection modal
                ui.showViewSelectionModal(previewImage, (selectedView) => {
                    if (selectedView) {
                        // Get view config for the selected view
                        const viewConfig = modelConfig[state.currentModel].views[selectedView];
                        
                        // Calculate the center of the editable area
                        const centerX = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width;
                        const centerY = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height;

                        // Set font size based on canvas size - make it smaller
                        const fontSize = 30; // Reduced font size
                        
                        // Measure text dimensions (create a temporary canvas context)
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.font = `bold ${fontSize}px "${textResult.font || 'Arial'}"`;
                        const textMetrics = tempCtx.measureText(textResult.text);
                        
                        // Calculate text width and height
                        const textWidth = textMetrics.width;
                        const textHeight = fontSize * 1.2;

                        // Create text object with unique ID - exactly centered
                        const textObj = {
                            id: 'text_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                            type: 'text',
                            text: textResult.text,
                            font: textResult.font || 'Arial',
                            fontSize: fontSize,
                            color: textResult.color,
                            left: centerX - textWidth/2, // Center horizontally
                            top: centerY - textHeight/2, // Center vertically
                            width: textWidth,
                            height: textHeight,
                            angle: 0,
                            view: selectedView,
                            isDecal: true,
                            textAlign: 'center',
                            lineHeight: 1.2,
                            backgroundColor: 'transparent',
                            padding: 0,
                            stroke: null,
                            strokeWidth: 0
                        };

                        // Add to canvas
                        addObject(textObj);
                        
                        // Save to panel settings
                        addPanelItem('text', textObj);
                        
                        // Update the texture
                        updateShirt3DTexture();

                        // Switch to the selected view
                        import('./scene.js').then(scene => {
                            scene.changeCameraView(selectedView);
                        });
                        
                        ui.showToast(`Text added to ${selectedView} view`);
                        resolve(textObj);
                    } else {
                        reject('cancelled');
                    }
                }, 'Choose Where to Add Text');
            });
        });
    } catch (error) {
        console.error('Error in addText:', error);
        throw error;
    }
}

// Define shape types and their default properties
const SHAPE_TYPES = {
    rectangle: { name: 'Rectangle', icon: 'fa-square' },
    circle: { name: 'Circle', icon: 'fa-circle' },
    triangle: { name: 'Triangle', icon: 'fa-play' },
    star: { name: 'Star', icon: 'fa-star' }
};

function createShapeEditOverlay(existingShape = null, position = null) {
    // Create a floating panel instead of an overlay
    const panel = document.createElement('div');
    panel.className = 'floating-panel';
    panel.id = 'shape-edit-panel';
    
    // Add panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = existingShape ? 'Edit Shape' : 'Add Shape';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close';
    closeBtn.setAttribute('aria-label', 'Close Panel');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    
    // Create panel content
    const content = document.createElement('div');
    content.className = 'panel-content';
    
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

    content.innerHTML = `
        <div class="section-title">
            <h3>${existingShape ? 'Edit Your Shape' : 'Add Shape to Design'}</h3>
            <p>Choose a shape and customize its appearance</p>
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
    `;

    // Add to panel
    panel.appendChild(header);
    panel.appendChild(content);
    
    // Add to document body
    document.body.appendChild(panel);
    
    // Position the panel with fixed left position
    positionFloatingPanel(panel, { left: 100 });
    
    // Add event listeners to prevent panel from closing when clicking inside
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    return panel;
}

export async function addShape(shapeType = '', options = {}) {
    try {
        // Get the position if this is called from a button click
        const position = options.fromButton ? getButtonPosition('add-shape-btn') : null;
        
        // Show shape editor and wait for result
        const panel = createShapeEditOverlay(null);
        
        // Position the panel
        positionFloatingPanel(panel, position);
        
        // Add active class to show the panel
        panel.classList.add('active');

        const shapeResult = await new Promise((resolve, reject) => {
            const shapeOptions = panel.querySelectorAll('.shape-option');
            const colorOptions = panel.querySelectorAll('.color-option');
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
            
            // Handle close button
            panel.querySelector('.panel-close').addEventListener('click', () => {
                panel.remove();
                reject('cancelled');
            });

            // Handle save
            panel.querySelector('.text-edit-save').addEventListener('click', () => {
                resolve({ type: selectedShape, color: selectedColor });
                panel.remove();
            });

            // Handle cancel
            panel.querySelector('.text-edit-cancel').addEventListener('click', () => {
                panel.remove();
                reject('cancelled');
            });

            // Handle escape key
            document.addEventListener('keydown', function handleEscape(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEscape);
                    panel.remove();
                    reject('cancelled');
                }
            });
        });

        if (shapeResult) {
            // After getting shape details, show view selection modal
            return new Promise((resolve, reject) => {
                import('./ui.js').then(ui => {
                    // Generate a preview image of the shape
                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = 200;
                    previewCanvas.height = 200;
                    const ctx = previewCanvas.getContext('2d');
                    
                    // Draw background
                    ctx.fillStyle = '#f5f5f5';
                    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    
                    // Draw shape based on type
                    ctx.fillStyle = shapeResult.color;
                    ctx.strokeStyle = '#333333';
                    ctx.lineWidth = 2;
                    
                    const centerX = previewCanvas.width / 2;
                    const centerY = previewCanvas.height / 2;
                    const size = Math.min(previewCanvas.width, previewCanvas.height) * 0.6;
                    
                    ctx.beginPath();
                    
                    switch (shapeResult.type) {
                        case 'rectangle':
                            ctx.rect(centerX - size/2, centerY - size/2, size, size);
                            break;
                        case 'circle':
                            ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
                            break;
                        case 'triangle':
                            ctx.moveTo(centerX, centerY - size/2);
                            ctx.lineTo(centerX - size/2, centerY + size/2);
                            ctx.lineTo(centerX + size/2, centerY + size/2);
                            ctx.closePath();
                            break;
                        case 'star':
                            // Draw a 5-point star
                            const outerRadius = size/2;
                            const innerRadius = outerRadius * 0.4; // Inner radius for star points
                            
                            for (let i = 0; i < 10; i++) {
                                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                                const angle = Math.PI * 2 * i / 10 - Math.PI / 2;
                                const x = centerX + radius * Math.cos(angle);
                                const y = centerY + radius * Math.sin(angle);
                                
                                if (i === 0) {
                                    ctx.moveTo(x, y);
                                } else {
                                    ctx.lineTo(x, y);
                                }
                            }
                            ctx.closePath();
                            break;
                    }
                    
                    ctx.fill();
                    ctx.stroke();
                    
                    // Get data URL for preview
                    const previewImage = previewCanvas.toDataURL('image/png');
                    
                    // Show the view selection modal
                    ui.showViewSelectionModal(previewImage, (selectedView) => {
                        if (selectedView) {
                            // Get view config for the selected view
                            const viewConfig = modelConfig[state.currentModel].views[selectedView];
                            
                            // Calculate the center point of the editable area
                            const centerX = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2 * canvasData.width;
                            const centerY = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2 * canvasData.height;
                            
                            // Calculate the size of the editable area
                            const areaWidth = Math.abs(viewConfig.uvRect.u2 - viewConfig.uvRect.u1) * canvasData.width;
                            const areaHeight = Math.abs(viewConfig.uvRect.v2 - viewConfig.uvRect.v1) * canvasData.height;
                            
                            // Make shapes smaller - use 15% of the smaller dimension
                            const shapeSize = Math.min(areaWidth, areaHeight) * 0.15;

                            // Create shape object - smaller and centered
                            const shapeObj = {
                                id: 'shape_' + Date.now() + '_' + Math.floor(Math.random() * 1000), // Add unique ID
                                type: 'shape',
                                shapeType: shapeResult.type,
                                width: shapeSize,
                                height: shapeSize,
                                color: shapeResult.color,
                                left: centerX - shapeSize/2,
                                top: centerY - shapeSize/2,
                                angle: 0,
                                view: selectedView,
                                isDecal: true
                            };

                            // Add to canvas
                            addObject(shapeObj);
                            
                            // Save to panel settings
                            addPanelItem('shape', shapeObj);
                            
                            // Update texture
                            updateShirt3DTexture();

                            // Switch to the selected view
                            import('./scene.js').then(scene => {
                                scene.changeCameraView(selectedView);
                            });
                            
                            ui.showToast(`Shape added to ${selectedView} view`);
                            resolve(shapeObj);
                        } else {
                            reject('cancelled');
                        }
                    }, 'Choose Where to Add Shape');
                });
            });
        }
    } catch (error) {
        console.error('Error in addShape:', error);
        throw error;
    }
}

// Handle adding shape from the UI
async function handleAddShape() {
    try {
        await addShape('', { fromButton: true });
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
    
    // Reset the transform mode
    transformMode = 'none';

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
    if (transformMode !== 'none') return;
    
    // Check if we clicked on a transform handle of the selected object
    if (selectedObject) {
        const action = detectTransformHandleClick();
        if (action) {
            switch (action) {
                case 'delete':
                    deleteSelectedObject();
                    break;
                    
                case 'scale':
                    if (!selectedObject.isPinned) {
                        transformMode = 'scale';
                        document.body.style.cursor = cursors.nwseResize;
                        // Lock camera when scaling
                        toggleCameraControls(false);
                    }
                    break;
                    
                case 'rotate':
                    // Allow rotation for both decals and text objects
                    if (selectedObject.isDecal || selectedObject.type === 'text') {
                        transformMode = 'rotate';
                        document.body.style.cursor = cursors.rotate;
                        // Lock camera when rotating
                        toggleCameraControls(false);
                    }
                    break;
                    
                case 'pin':
                    // Toggle pin state
                    selectedObject.isPinned = !selectedObject.isPinned;
                    updateShirt3DTexture();
                    historyStack.saveState();
                    break;
                    
                case 'duplicate':
                    duplicateSelectedObject();
                    break;
                    
                case 'layers':
                    // Handle layers button - find overlapping objects
                    const overlappingObjects = canvasData.objects.filter(obj => 
                        obj !== selectedObject && isObjectsOverlapping(selectedObject, obj)
                    );
                    
                    if (overlappingObjects.length > 0) {
                        // Bring to front
                        const index = canvasData.objects.indexOf(selectedObject);
                        if (index !== -1) {
                            canvasData.objects.splice(index, 1);
                            canvasData.objects.push(selectedObject);
                            updateShirt3DTexture();
                        }
                    }
                    break;
                    
                case 'move':
                    if (!selectedObject.isPinned) {
                        transformMode = 'move';
                        document.body.style.cursor = cursors.grabbing;
                        // Lock camera when moving decal
                        toggleCameraControls(false);
                    }
                    break;
            }
            return;
        }
    }
    
    // If a specific action wasn't triggered, check for object clicks
    const clickedObject = detectObjectClick();
    
    if (clickedObject) {
        selectObject(clickedObject);
        
        if (!clickedObject.isPinned) {
            transformMode = 'move';
            document.body.style.cursor = cursors.grabbing;
            // Lock camera when moving decal
            toggleCameraControls(false);
        }
        updateShirt3DTexture();
    } else {
        // If not clicking on an object or control, deselect and enable camera controls
        if (selectedObject) {
            deselectObject();
        }
        // Re-enable camera controls since we're not interacting with decals
        toggleCameraControls(true);
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

    // Show confirmation dialog before deleting
    const objType = selectedObject.type === 'image' ? 'photo' : selectedObject.type;
    import('./ui.js').then(ui => {
        ui.showDeleteConfirmationDialog(objType, () => {
            // Find the object's index in the objects array
            const index = canvasData.objects.indexOf(selectedObject);
            if (index !== -1) {
                // Remove from panel settings
                const panelType = selectedObject.type === 'image' 
                    ? (selectedObject.isAIGenerated ? 'ai' : 'photo') 
                    : selectedObject.type;
                removePanelItem(panelType, selectedObject.id);
                
                // Remove the object
                canvasData.objects.splice(index, 1);
                selectedObject = null;
                transformMode = 'none';
                document.body.style.cursor = cursors.default;
                toggleCameraControls(true); // Unlock t-shirt movement after deletion
                updateShirt3DTexture();
                historyStack.saveState(); // Save state for undo after deletion
            }
        });
    });

    return true;
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
 * Handle double click events for text and photo editing
 * @param {MouseEvent} event 
 */
function onDoubleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    updateMousePosition(event);
    const clickedObject = detectObjectClick();
    
    if (clickedObject && clickedObject.type === 'text') {
        const textEditOverlay = createTextEditOverlay(
            clickedObject.text,
            clickedObject.color,
            clickedObject.font
        );
        
        if (textEditOverlay) {
            const textInput = textEditOverlay.querySelector('.text-edit-input');
            const fontSelect = textEditOverlay.querySelector('.font-select');
            const colorOptions = textEditOverlay.querySelectorAll('.color-option');
            const saveBtn = textEditOverlay.querySelector('.text-edit-save');
            const cancelBtn = textEditOverlay.querySelector('.text-edit-cancel');
            const closeBtn = textEditOverlay.querySelector('.panel-close');
            
            // Store original values
            const originalText = clickedObject.text;
            const originalColor = clickedObject.color;
            const originalFont = clickedObject.font;
            
            // Handle text changes
            textInput.addEventListener('input', () => {
                clickedObject.text = textInput.value;
                updateShirt3DTexture();
            });
            
            // Handle font changes
            fontSelect.addEventListener('change', () => {
                clickedObject.font = fontSelect.value;
                updateShirt3DTexture();
            });
            
            // Handle color changes
            colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    colorOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    clickedObject.color = option.dataset.color;
                    updateShirt3DTexture();
                });
            });
            
            // Handle save
            saveBtn.addEventListener('click', () => {
                textEditOverlay.remove();
            });
            
            // Handle cancel
            cancelBtn.addEventListener('click', () => {
                clickedObject.text = originalText;
                clickedObject.color = originalColor;
                clickedObject.font = originalFont;
                updateShirt3DTexture();
                textEditOverlay.remove();
            });
            
            // Handle close button
            closeBtn.addEventListener('click', () => {
                clickedObject.text = originalText;
                clickedObject.color = originalColor;
                clickedObject.font = originalFont;
                updateShirt3DTexture();
                textEditOverlay.remove();
            });
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    clickedObject.text = originalText;
                    clickedObject.color = originalColor;
                    clickedObject.font = originalFont;
                    updateShirt3DTexture();
                    textEditOverlay.remove();
                }
            };
            document.addEventListener('keydown', handleEscape);
            
            // Clean up event listener when panel is removed
            textEditOverlay.addEventListener('remove', () => {
                document.removeEventListener('keydown', handleEscape);
            });
        }
    } else if (clickedObject && clickedObject.type === 'image') {
        const photoEditOverlay = createPhotoEditOverlay(clickedObject);
        if (photoEditOverlay) {
            photoEditOverlay.classList.add('active');
        }
    }
}

/**
 * Create photo edit overlay for the selected photo
 * @param {Object} photoObject - The photo object to edit
 */
function createPhotoEditOverlay(photoObject) {
    // Create a floating panel
    const panel = document.createElement('div');
    panel.id = 'photo-edit-panel';
    panel.className = 'floating-panel';

    // Create header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
        <h3>Edit Photo</h3>
        <button class="panel-close" aria-label="Close Panel">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Create content
    const content = document.createElement('div');
    content.className = 'panel-content';
    content.innerHTML = `
        <div class="section-title">
            <h3>Photo Editor</h3>
            <p>Customize your photo appearance</p>
        </div>
        <div class="preview-container">
            <img id="photo-preview" alt="Photo Preview">
        </div>
        <div class="photo-edit-options">
            <div class="crop-container">
                <button class="crop-button">
                    <i class="fas fa-crop"></i> Crop Photo
                </button>
            </div>
            <div class="adjustment-controls">
                <div class="adjustment-dropdown">
                    <button class="adjustment-toggle">
                        <i class="fas fa-sliders-h"></i> Adjust <i class="fas fa-chevron-down toggle-icon"></i>
                    </button>
                    <div class="adjustment-content">
                        <div class="slider-container">
                            <label>Brightness</label>
                            <input type="range" min="0" max="200" value="100" class="brightness-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Contrast</label>
                            <input type="range" min="0" max="200" value="100" class="contrast-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Exposure</label>
                            <input type="range" min="0" max="200" value="100" class="exposure-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Shadows</label>
                            <input type="range" min="0" max="200" value="100" class="shadows-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Highlights</label>
                            <input type="range" min="0" max="200" value="100" class="highlights-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Saturation</label>
                            <input type="range" min="0" max="200" value="100" class="saturation-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Temperature</label>
                            <input type="range" min="0" max="200" value="100" class="temperature-slider">
                            <span class="slider-value">100%</span>
                        </div>
                        <div class="slider-container">
                            <label>Sharpness</label>
                            <input type="range" min="0" max="200" value="100" class="sharpness-slider">
                            <span class="slider-value">100%</span>
                        </div>
                    </div>
                </div>
                <div class="adjustment-dropdown">
                    <button class="filters-toggle">
                        <i class="fas fa-magic"></i> Filters <i class="fas fa-chevron-down toggle-icon"></i>
                    </button>
                    <div class="filters-content">
                        <div class="filter-options">
                            <div class="filter-option" data-filter="none">
                                <div class="filter-preview">Original</div>
                                <span>None</span>
                            </div>
                            <div class="filter-option" data-filter="vintage">
                                <div class="filter-preview filter-vintage"></div>
                                <span>Vintage</span>
                            </div>
                            <div class="filter-option" data-filter="bw">
                                <div class="filter-preview filter-bw"></div>
                                <span>B&W</span>
                            </div>
                            <div class="filter-option" data-filter="hdr">
                                <div class="filter-preview filter-hdr"></div>
                                <span>HDR</span>
                            </div>
                            <div class="filter-option" data-filter="cinematic">
                                <div class="filter-preview filter-cinematic"></div>
                                <span>Cinematic</span>
                            </div>
                            <div class="filter-option" data-filter="retro">
                                <div class="filter-preview filter-retro"></div>
                                <span>Retro</span>
                            </div>
                            <div class="filter-option" data-filter="film">
                                <div class="filter-preview filter-film"></div>
                                <span>Film</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="enhancement-buttons">
                <button class="enhance-resolution">
                    <i class="fas fa-magic"></i> Enhance Resolution
                </button>
                <button class="remove-background">
                    <i class="fas fa-cut"></i> Remove Background
                </button>
            </div>
            <div class="photo-edit-buttons">
                <button class="photo-edit-reset">Reset</button>
                <button class="photo-edit-cancel">Cancel</button>
                <button class="photo-edit-save">Save Changes</button>
            </div>
        </div>
    `;

    // Add to panel
    panel.appendChild(header);
    panel.appendChild(content);

    // Add to document body
    document.body.appendChild(panel);

    // Position the panel
    positionFloatingPanel(panel, { left: 100 });

    // Store original values
    const originalFilters = photoObject.currentFilters || '';
    const originalImg = photoObject.img;

    // Setup preview
    const previewImg = panel.querySelector('#photo-preview');
    const previewContainer = panel.querySelector('.preview-container');
    
    // Image dimensions and aspect ratio
    const imgWidth = photoObject.img.naturalWidth;
    const imgHeight = photoObject.img.naturalHeight;
    const aspectRatio = imgWidth / imgHeight;
    
    // Set maximum dimensions for the preview
    const maxWidth = 300;
    const maxHeight = 300;
    
    // Calculate dimensions to maintain aspect ratio
    let containerWidth, containerHeight;
    if (aspectRatio > 1) {
        // Wide image
        containerWidth = Math.min(maxWidth, imgWidth);
        containerHeight = containerWidth / aspectRatio;
    } else {
        // Tall image
        containerHeight = Math.min(maxHeight, imgHeight);
        containerWidth = containerHeight * aspectRatio;
    }
    
    // Update container and image styles
    if (previewContainer) {
        previewContainer.style.width = `${containerWidth}px`;
        previewContainer.style.height = `${containerHeight}px`;
        previewContainer.style.margin = '0 auto';
        previewContainer.style.position = 'relative';
        previewContainer.style.overflow = 'hidden';
    }
    
    // Set the image styles
    previewImg.style.width = '100%';
    previewImg.style.height = '100%';
    previewImg.style.objectFit = 'contain';
    previewImg.src = photoObject.img.src;
    
    // If the image already has filters, apply them to the preview
    if (photoObject.currentFilters) {
        previewImg.style.filter = photoObject.currentFilters;
        
        // Parse existing filter values to set slider positions
        // This will handle cases where the image already has filters applied
        try {
            const filterValues = {};
            const filterRegex = /(brightness|contrast|saturate|drop-shadow|)\(([^)]+)\)/g;
            let match;
            
            // Always leave UI sliders at default positions (100%)
            // This ensures the UI stays at neutral while still applying the enhanced filters
            
            // Applied filter settings are managed internally in updatePhotoFilters
            // which now automatically adds the base enhancement filter
            
            // Initialize with default filter settings when first opening
            updatePhotoFilters(photoObject, panel);
            
            while ((match = filterRegex.exec(photoObject.currentFilters)) !== null) {
                if (match[1] === 'brightness') {
                    const value = parseInt(match[2]);
                    if (!isNaN(value)) filterValues.brightness = value;
                } else if (match[1] === 'contrast') {
                    const value = parseInt(match[2]);
                    if (!isNaN(value)) filterValues.contrast = value;
                } else if (match[1] === 'saturate') {
                    const value = parseInt(match[2]);
                    if (!isNaN(value)) filterValues.saturation = value;
                } else if (match[1] === 'drop-shadow') {
                    // Extract shadow size from the drop-shadow filter
                    const shadowParts = match[2].split(' ');
                    if (shadowParts.length >= 3) {
                        const shadowSize = parseInt(shadowParts[2]);
                        if (!isNaN(shadowSize)) filterValues.shadows = shadowSize;
                    }
                }
            }
            
            // Keep UI at defaults, enhancements apply automatically
            // Don't update UI sliders with parsed values
        } catch (e) {
            console.warn('Error parsing filters:', e);
        }
    } else {
        // For new images with no filters yet, initialize with default enhancement
        updatePhotoFilters(photoObject, panel);
    }

    // Setup adjustment dropdown toggle
    const adjustmentToggle = panel.querySelector('.adjustment-toggle');
    const adjustmentContent = panel.querySelector('.adjustment-content');
    
    adjustmentToggle.addEventListener('click', () => {
        adjustmentToggle.classList.toggle('open');
        adjustmentContent.classList.toggle('open');
    });
    
    // Setup filters dropdown toggle
    const filtersToggle = panel.querySelector('.filters-toggle');
    const filtersContent = panel.querySelector('.filters-content');
    
    filtersToggle.addEventListener('click', () => {
        filtersToggle.classList.toggle('open');
        filtersContent.classList.toggle('open');
    });
    
    // Setup filter options
    const filterOptions = panel.querySelectorAll('.filter-option');
    
    // Apply the actual photo to filter previews
    filterOptions.forEach(option => {
        const filterType = option.dataset.filter;
        const previewDiv = option.querySelector('.filter-preview');
        
        if (previewDiv && filterType !== 'none') {
            // Create preview with the actual photo
            const previewImg = document.createElement('img');
            previewImg.src = photoObject.img.src;
            previewImg.style.width = '100%';
            previewImg.style.height = '100%';
            previewImg.style.objectFit = 'cover';
            
            // Apply the filter
            switch (filterType) {
                case 'vintage':
                    previewImg.style.filter = 'sepia(50%) saturate(150%) contrast(120%)';
                    break;
                case 'bw':
                    previewImg.style.filter = 'grayscale(100%) contrast(120%)';
                    break;
                case 'hdr':
                    previewImg.style.filter = 'contrast(150%) saturate(140%) brightness(110%)';
                    break;
                case 'cinematic':
                    previewImg.style.filter = 'contrast(130%) saturate(90%) brightness(90%) sepia(30%)';
                    break;
                case 'retro':
                    previewImg.style.filter = 'sepia(60%) hue-rotate(-20deg) saturate(90%) brightness(105%)';
                    break;
                case 'film':
                    previewImg.style.filter = 'contrast(110%) brightness(110%) sepia(30%) saturate(130%)';
                    break;
            }
            
            // Clear existing content and add the image
            previewDiv.innerHTML = '';
            previewDiv.appendChild(previewImg);
        } else if (filterType === 'none' && previewDiv) {
            // For "none" filter option, show the original image
            const previewImg = document.createElement('img');
            previewImg.src = photoObject.img.src;
            previewImg.style.width = '100%';
            previewImg.style.height = '100%';
            previewImg.style.objectFit = 'cover';
            
            // Clear existing content and add the image
            previewDiv.innerHTML = '';
            previewDiv.appendChild(previewImg);
        }
        
        option.addEventListener('click', () => {
            // Remove active class from all options
            filterOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            option.classList.add('active');
            
            // Update filters
            updatePhotoFilters(photoObject, panel);
        });
    });
    
    // Set the "None" filter as active by default
    const noneFilter = panel.querySelector('.filter-option[data-filter="none"]');
    if (noneFilter) {
        noneFilter.classList.add('active');
    }
    
    // Setup sliders
    const sliders = panel.querySelectorAll('.slider-container input[type="range"]');
    sliders.forEach(slider => {
        const valueDisplay = slider.nextElementSibling;
        slider.addEventListener('input', () => {
            valueDisplay.textContent = `${slider.value}%`;
            updatePhotoFilters(photoObject, panel);
        });
    });

    // Setup buttons
    const closeBtn = panel.querySelector('.panel-close');
    const cancelBtn = panel.querySelector('.photo-edit-cancel');
    const resetBtn = panel.querySelector('.photo-edit-reset');
    const saveBtn = panel.querySelector('.photo-edit-save');
    const cropBtn = panel.querySelector('.crop-button');
    const enhanceBtn = panel.querySelector('.enhance-resolution');
    const removeBgBtn = panel.querySelector('.remove-background');

    // Handle close/cancel
    const closePanel = () => {
        // Clear any update timer
        if (photoObject._updateTimer) {
            clearTimeout(photoObject._updateTimer);
            photoObject._updateTimer = null;
        }
        
        // Clear any temporary filters
        if (photoObject._tempFilters) {
            delete photoObject._tempFilters;
        }
        
        // Restore original state
        photoObject.currentFilters = originalFilters;
        
        // Update the texture with original state
        updateShirt3DTexture();
        
        // Remove the panel directly rather than just hiding it
        panel.remove();
    };

    closeBtn.addEventListener('click', closePanel);
    cancelBtn.addEventListener('click', closePanel);

    // Handle reset
    resetBtn.addEventListener('click', () => {
        // Reset all sliders to 100%
        sliders.forEach(slider => {
            slider.value = 100;
            slider.nextElementSibling.textContent = '100%';
        });
        
        // Reset filter selection
        const filterOptions = panel.querySelectorAll('.filter-option');
        filterOptions.forEach(opt => opt.classList.remove('active'));
        
        // Activate the 'none' filter
        const noneFilter = panel.querySelector('.filter-option[data-filter="none"]');
        if (noneFilter) {
            noneFilter.classList.add('active');
        }
        
        // Instead of clearing filters completely, reset to default enhancement filter
        // Apply the base enhancement filter
        updatePhotoFilters(photoObject, panel);
        
        // Update the texture to show reset state
        updateShirt3DTexture();
    });

    // Handle save
    saveBtn.addEventListener('click', () => {
        // Clear update timer
        if (photoObject._updateTimer) {
            clearTimeout(photoObject._updateTimer);
            photoObject._updateTimer = null;
        }
        
        // Apply the temporary filters permanently
        if (photoObject._tempFilters) {
            photoObject.currentFilters = photoObject._tempFilters;
            delete photoObject._tempFilters;
            
            // Store original image if not already stored
            if (!photoObject.originalImg && photoObject.img) {
                photoObject.originalImg = photoObject.img.cloneNode(true);
            }
        }
        
        // Save the current state for undo/redo functionality
        saveCurrentState();
        
        // Update the texture one last time
        updateShirt3DTexture();
        
        // Remove the panel directly
        panel.remove();
    });

    // Handle crop
    cropBtn.addEventListener('click', () => {
        // Pass the panel to createCropPanel 
        createCropPanel(photoObject, panel);
    });

    // Handle enhance resolution
    enhanceBtn.addEventListener('click', () => {
        // TODO: Implement resolution enhancement
        showToast('Resolution enhancement coming soon!');
    });

    // Handle remove background
    removeBgBtn.addEventListener('click', () => {
        // TODO: Implement background removal
        showToast('Background removal coming soon!');
    });

    // Add event listener to prevent panel from closing when clicking inside
    panel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    return panel;
}

/**
 * Update photo filters based on slider values and preset filters
 * @param {Object} photoObject - The photo object to update
 * @param {HTMLElement} panel - The photo edit panel
 */
function updatePhotoFilters(photoObject, panel) {
    // Get slider values
    const brightness = panel.querySelector('.brightness-slider').value;
    const contrast = panel.querySelector('.contrast-slider').value;
    const exposure = panel.querySelector('.exposure-slider').value;
    const shadows = panel.querySelector('.shadows-slider').value;
    const highlights = panel.querySelector('.highlights-slider').value;
    const saturation = panel.querySelector('.saturation-slider').value;
    const temperature = panel.querySelector('.temperature-slider').value;
    const sharpness = panel.querySelector('.sharpness-slider').value;
    
    // Get active preset filter if any
    const activeFilter = panel.querySelector('.filter-option.active');
    let presetFilter = '';
    
    if (activeFilter && activeFilter.dataset.filter !== 'none') {
        switch (activeFilter.dataset.filter) {
            case 'vintage':
                presetFilter = 'sepia(50%) saturate(150%) contrast(120%)';
                break;
            case 'bw':
                presetFilter = 'grayscale(100%) contrast(120%)';
                break;
            case 'hdr':
                presetFilter = 'contrast(150%) saturate(140%) brightness(110%)';
                break;
            case 'cinematic':
                presetFilter = 'contrast(130%) saturate(90%) brightness(90%) sepia(30%)';
                break;
            case 'retro':
                presetFilter = 'sepia(60%) hue-rotate(-20deg) saturate(90%) brightness(105%)';
                break;
            case 'film':
                presetFilter = 'contrast(110%) brightness(110%) sepia(30%) saturate(130%)';
                break;
        }
    }

    // Create temperature filter (add blue or orange tint)
    let tempFilter = '';
    if (temperature < 100) {
        // Cooler/blue
        const blueAmount = 100 - temperature;
        tempFilter = `hue-rotate(${blueAmount * 0.3}deg) saturate(${100 + blueAmount * 0.5}%)`;
    } else if (temperature > 100) {
        // Warmer/orange
        const orangeAmount = temperature - 100;
        tempFilter = `hue-rotate(-${orangeAmount * 0.3}deg) saturate(${100 + orangeAmount * 0.5}%)`;
    }
    
    // Create sharpness filter
    let sharpnessFilter = '';
    if (sharpness > 100) {
        const amount = (sharpness - 100) / 10;
        // Sharpen using a combination of contrast and brightness
        sharpnessFilter = `contrast(${100 + amount * 2}%) brightness(${100 + amount}%)`;
    }

    // Create exposure filter
    const exposureFilter = exposure !== 100 ? `brightness(${exposure}%)` : '';
    
    // Create adjustment filters
    const adjustmentFilters = [
        `brightness(${brightness}%)`,
        `contrast(${contrast}%)`,
        `saturate(${saturation}%)`,
        `drop-shadow(0 0 ${shadows}px rgba(0,0,0,0.5))`,
        `brightness(${highlights}%)`,
        tempFilter,
        sharpnessFilter,
        exposureFilter
    ].filter(f => f !== ''); // Remove empty filters

    // Add base enhancement filter that's always applied (not shown in UI)
    const baseEnhancementFilter = 'contrast(120%) saturate(130%) brightness(105%)';
    
    // Combine preset and adjustment filters
    const filters = presetFilter ? 
        [baseEnhancementFilter, presetFilter, ...adjustmentFilters].join(' ') : 
        [baseEnhancementFilter, ...adjustmentFilters].join(' ');

    // Apply filters to the preview image
    const previewImg = panel.querySelector('#photo-preview');
    if (previewImg) {
        previewImg.style.filter = filters;
    }
    
    // Store filters temporarily on the object
    photoObject._tempFilters = filters;
    
    // Debounce updates to prevent too many renders
    if (photoObject._updateTimer) {
        clearTimeout(photoObject._updateTimer);
    }
    
    photoObject._updateTimer = setTimeout(() => {
        // Update the 3D texture using the proper method
        updateShirt3DTexture();
        photoObject._updateTimer = null;
    }, 50);
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
        await add3DText('', { fromButton: true });
    } catch (error) {
        if (error !== 'cancelled') {
            console.error('Error handling text addition:', error);
        }
    }
}

// Add helper function to get button position
function getButtonPosition(buttonSelector) {
    let button;
    
    // Try to find by ID first
    button = document.getElementById(buttonSelector);
    
    // If not found, try by class
    if (!button) {
        const buttons = document.querySelectorAll('.model-control-btn');
        for (const btn of buttons) {
            if (buttonSelector === 'add-text-btn' && btn.title === 'Add Text') {
                button = btn;
                break;
            } else if (buttonSelector === 'add-shape-btn' && btn.title === 'Add Shape') {
                button = btn;
                break;
            }
        }
    }
    
    if (!button) return null;
    
    const rect = button.getBoundingClientRect();
    
    // Position the panel to the left of the right-side buttons with some offset
    return {
        top: rect.top,
        left: rect.left - 320, // Position panel 320px to the left of the button
    };
}

// Add this function to handle panel positioning
function positionFloatingPanel(panel, position) {
    if (!panel) return;
    
    // Standard positioning for all panels (ignoring custom position)
    // This ensures consistent positioning for all panels including crop panel
    const left = 100; // Fixed left position to match other panels
    let top = window.innerHeight / 2;
    
    panel.style.position = 'fixed';
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.transform = 'translateY(-50%)';
    panel.style.zIndex = '1000';
    
    // Ensure panel stays within viewport
    setTimeout(() => {
    const panelRect = panel.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    if (panelRect.bottom > viewportHeight) {
        panel.style.top = `${viewportHeight - panelRect.height - 20}px`;
            panel.style.transform = 'none';
    }
    
    if (panelRect.right > viewportWidth) {
        panel.style.left = `${viewportWidth - panelRect.width - 20}px`;
    }
    }, 0);
    
    // Add active class to show the panel
    panel.classList.add('active');
}

/**
 * Creates a floating panel for image cropping
 * @param {Object} photoObject - The photo object to crop
 * @param {HTMLElement} parentPanel - The parent panel (photo edit panel)
 */
function createCropPanel(photoObject, parentPanel) {
    // Create the crop panel
    const cropPanel = document.createElement('div');
    cropPanel.id = 'photo-crop-panel';
    cropPanel.className = 'floating-panel';
    
    // Hide the parent panel when crop panel opens
    if (parentPanel) {
        parentPanel.classList.remove('active');
        parentPanel.style.display = 'none';
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `
        <h3>Crop Photo</h3>
        <button class="panel-close" aria-label="Close Panel">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'panel-content';
    
    // Calculate dimensions to maintain aspect ratio
    const maxWidth = 300;
    const maxHeight = 300;
    const aspectRatio = photoObject.img.naturalWidth / photoObject.img.naturalHeight;
    
    let previewWidth, previewHeight;
    if (aspectRatio > 1) {
        previewWidth = maxWidth;
        previewHeight = maxWidth / aspectRatio;
    } else {
        previewHeight = maxHeight;
        previewWidth = maxHeight * aspectRatio;
    }
    
    content.innerHTML = `
        <div class="crop-container" style="width: ${previewWidth}px; height: ${previewHeight}px;">
            <div class="crop-image-container">
                <img src="${photoObject.img.src}" class="crop-image" 
                     style="width: ${previewWidth}px; height: ${previewHeight}px;">
                <div class="crop-overlay"></div>
                <div class="crop-box">
                    <div class="crop-handle top-left"></div>
                    <div class="crop-handle top-right"></div>
                    <div class="crop-handle bottom-left"></div>
                    <div class="crop-handle bottom-right"></div>
                </div>
            </div>
        </div>
        <div class="aspect-ratio-options">
            <button class="aspect-ratio-btn active" data-ratio="free">Free</button>
            <button class="aspect-ratio-btn" data-ratio="1:1">1:1</button>
            <button class="aspect-ratio-btn" data-ratio="4:3">4:3</button>
            <button class="aspect-ratio-btn" data-ratio="16:9">16:9</button>
        </div>
        <div class="crop-actions">
            <button class="crop-cancel-btn">Cancel</button>
            <button class="crop-apply-btn">Apply Crop</button>
        </div>
    `;
    
    // Add to panel
    cropPanel.appendChild(header);
    cropPanel.appendChild(content);
    
    // Add to document body
    document.body.appendChild(cropPanel);
    
    // Position the panel
    positionFloatingPanel(cropPanel, { 
        left: parentPanel.offsetLeft + parentPanel.offsetWidth + 20,
        top: parentPanel.offsetTop
    });
    
    // Show the panel
    cropPanel.classList.add('active');
    
    // Set up crop box functionality
    const cropBox = cropPanel.querySelector('.crop-box');
    const cropImage = cropPanel.querySelector('.crop-image');
    const cropContainer = cropPanel.querySelector('.crop-container');
    const handles = cropPanel.querySelectorAll('.crop-handle');
    
    // Initial crop box to cover the whole image
    let cropBoxData = {
        left: 0,
        top: 0,
        width: previewWidth,
        height: previewHeight
    };
    
    // Set initial crop box position
    updateCropBox();
    
    // Set up aspect ratio buttons
    const aspectBtns = cropPanel.querySelectorAll('.aspect-ratio-btn');
    let currentAspectRatio = null;
    
    aspectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            aspectBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const ratio = btn.dataset.ratio;
            if (ratio === 'free') {
                currentAspectRatio = null;
            } else {
                const [width, height] = ratio.split(':').map(Number);
                currentAspectRatio = width / height;
                
                // Adjust crop box to maintain aspect ratio
                let newWidth, newHeight;
                
                if (cropBoxData.width / cropBoxData.height > currentAspectRatio) {
                    // Current box is wider than target ratio
                    newHeight = cropBoxData.height;
                    newWidth = newHeight * currentAspectRatio;
                } else {
                    // Current box is taller than target ratio
                    newWidth = cropBoxData.width;
                    newHeight = newWidth / currentAspectRatio;
                }
                
                // Center the crop box
                cropBoxData.left = (previewWidth - newWidth) / 2;
                cropBoxData.top = (previewHeight - newHeight) / 2;
                cropBoxData.width = newWidth;
                cropBoxData.height = newHeight;
                
                updateCropBox();
            }
        });
    });
    
    // Handle crop box dragging
    let isDragging = false;
    let startX, startY;
    let dragType = ''; // 'move', 'resize-tl', 'resize-tr', etc.
    
    cropBox.addEventListener('mousedown', (e) => {
        if (e.target === cropBox) {
            isDragging = true;
            dragType = 'move';
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        }
    });
    
    // Handle resize from corners
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragType = 'resize-' + handle.className.replace('crop-handle ', '');
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    // Handle mouse move for both dragging and resizing
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        if (dragType === 'move') {
            // Move the crop box
            cropBoxData.left = Math.max(0, Math.min(previewWidth - cropBoxData.width, cropBoxData.left + deltaX));
            cropBoxData.top = Math.max(0, Math.min(previewHeight - cropBoxData.height, cropBoxData.top + deltaY));
        } else if (dragType.startsWith('resize-')) {
            // Handle resizing from different corners
            const corner = dragType.replace('resize-', '');
            
            let newLeft = cropBoxData.left;
            let newTop = cropBoxData.top;
            let newWidth = cropBoxData.width;
            let newHeight = cropBoxData.height;
            
            if (corner === 'top-left') {
                newLeft = Math.min(cropBoxData.left + cropBoxData.width - 50, cropBoxData.left + deltaX);
                newTop = Math.min(cropBoxData.top + cropBoxData.height - 50, cropBoxData.top + deltaY);
                newWidth = cropBoxData.width - (newLeft - cropBoxData.left);
                newHeight = cropBoxData.height - (newTop - cropBoxData.top);
            } else if (corner === 'top-right') {
                newTop = Math.min(cropBoxData.top + cropBoxData.height - 50, cropBoxData.top + deltaY);
                newWidth = Math.max(50, cropBoxData.width + deltaX);
                newHeight = cropBoxData.height - (newTop - cropBoxData.top);
            } else if (corner === 'bottom-left') {
                newLeft = Math.min(cropBoxData.left + cropBoxData.width - 50, cropBoxData.left + deltaX);
                newWidth = cropBoxData.width - (newLeft - cropBoxData.left);
                newHeight = Math.max(50, cropBoxData.height + deltaY);
            } else if (corner === 'bottom-right') {
                newWidth = Math.max(50, cropBoxData.width + deltaX);
                newHeight = Math.max(50, cropBoxData.height + deltaY);
            }
            
            // Enforce aspect ratio if needed
            if (currentAspectRatio !== null) {
                if (corner === 'top-left' || corner === 'bottom-right') {
                    newHeight = newWidth / currentAspectRatio;
                } else {
                    newWidth = newHeight * currentAspectRatio;
                }
            }
            
            // Check boundaries
            if (newLeft + newWidth > previewWidth) {
                newWidth = previewWidth - newLeft;
                if (currentAspectRatio !== null) {
                    newHeight = newWidth / currentAspectRatio;
                }
            }
            
            if (newTop + newHeight > previewHeight) {
                newHeight = previewHeight - newTop;
                if (currentAspectRatio !== null) {
                    newWidth = newHeight * currentAspectRatio;
                }
            }
            
            // Update crop box data
            cropBoxData.left = newLeft;
            cropBoxData.top = newTop;
            cropBoxData.width = newWidth;
            cropBoxData.height = newHeight;
        }
        
        updateCropBox();
        startX = e.clientX;
        startY = e.clientY;
    });
    
    // Handle mouse up to stop dragging/resizing
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Update crop box position and dimensions
    function updateCropBox() {
        cropBox.style.left = `${cropBoxData.left}px`;
        cropBox.style.top = `${cropBoxData.top}px`;
        cropBox.style.width = `${cropBoxData.width}px`;
        cropBox.style.height = `${cropBoxData.height}px`;
    }
    
    // Handle close button
    const closeBtn = cropPanel.querySelector('.panel-close');
    closeBtn.addEventListener('click', () => {
        // Remove the crop panel
        cropPanel.remove();
        
        // Show the parent panel again with proper styling
        if (parentPanel) {
            parentPanel.classList.add('active');
            parentPanel.style.display = 'flex';
            document.body.appendChild(parentPanel); // Re-add to document if needed
        }
        
        // Clean up event listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    });
    
    // Handle cancel button
    const cancelBtn = cropPanel.querySelector('.crop-cancel-btn');
    cancelBtn.addEventListener('click', () => {
        // Remove the crop panel
        cropPanel.remove();
        
        // Show the parent panel again with proper styling
        if (parentPanel) {
            parentPanel.classList.add('active');
            parentPanel.style.display = 'flex';
            document.body.appendChild(parentPanel); // Re-add to document if needed
        }
    });
    
    // Handle apply crop button
    const applyBtn = cropPanel.querySelector('.crop-apply-btn');
    applyBtn.addEventListener('click', () => {
        // Apply crop to the image and get the new image source
        const newImageSrc = applyCrop(photoObject, cropBoxData, previewWidth, previewHeight);
        
        // Remove the crop panel
        cropPanel.remove();
        
        // Show the parent panel again with proper styling
        if (parentPanel) {
            parentPanel.classList.add('active');
            parentPanel.style.display = 'flex';
            document.body.appendChild(parentPanel); // Re-add to document if needed
            
            // Update the preview in the parent panel
            const previewImg = parentPanel.querySelector('#photo-preview');
            const previewContainer = parentPanel.querySelector('.preview-container');
            
            if (previewImg) {
                // Force reload of the preview image with the new cropped dimensions
                previewImg.onload = () => {
                    // After image loads, update the preview container to match the new aspect ratio
                    if (previewContainer) {
                        // Calculate the new aspect ratio based on the crop dimensions
                        const cropAspectRatio = cropBoxData.width / cropBoxData.height;
                        
                        // Set max width/height for the preview container
                        const maxWidth = 300;
                        const maxHeight = 300;
                        
                        // Calculate dimensions to maintain aspect ratio
                        let containerWidth, containerHeight;
                        if (cropAspectRatio > 1) {
                            // Wide image
                            containerWidth = Math.min(maxWidth, previewImg.naturalWidth);
                            containerHeight = containerWidth / cropAspectRatio;
                        } else {
                            // Tall image
                            containerHeight = Math.min(maxHeight, previewImg.naturalHeight);
                            containerWidth = containerHeight * cropAspectRatio;
                        }
                        
                        // Update container and image styles
                        previewContainer.style.width = `${containerWidth}px`;
                        previewContainer.style.height = `${containerHeight}px`;
                        previewImg.style.width = '100%';
                        previewImg.style.height = '100%';
                        previewImg.style.objectFit = 'contain';
                    }
                };
                
                // Set the image source after setting up the onload handler
                previewImg.src = newImageSrc;
            }
        }
        
        // Update the shirt texture - this is now also done in applyCrop when image loads
        updateShirt3DTexture();
    });
}

/**
 * Apply crop to an image
 * @param {Object} photoObject - The photo object to crop
 * @param {Object} cropData - The crop box data
 * @param {number} previewWidth - The preview width
 * @param {number} previewHeight - The preview height
 */
function applyCrop(photoObject, cropData, previewWidth, previewHeight) {
    // Create a canvas to perform the crop
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Original image dimensions
    const originalWidth = photoObject.img.naturalWidth;
    const originalHeight = photoObject.img.naturalHeight;
    
    // Calculate the scale between preview and original image
    const scaleX = originalWidth / previewWidth;
    const scaleY = originalHeight / previewHeight;
    
    // Calculate crop dimensions in original image scale
    const cropX = cropData.left * scaleX;
    const cropY = cropData.top * scaleY;
    const cropWidth = cropData.width * scaleX;
    const cropHeight = cropData.height * scaleY;
    
    // Set canvas dimensions to the cropped size
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // Draw only the cropped portion to the canvas
    ctx.drawImage(
        photoObject.img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );
    
    // Store the original image if not already stored
    if (!photoObject.originalImg) {
        photoObject.originalImg = photoObject.img.cloneNode(true);
    }
    
    // Create a new image with the cropped data
    const croppedImage = new Image();
    
    // Wait for the image to load before updating the shirt texture
    croppedImage.onload = () => {
        // Replace the current image with the cropped one
        photoObject.img = croppedImage;
        
        // Update dimensions to match the new cropped size
        photoObject.width = cropWidth;
        photoObject.height = cropHeight;
        
        // Update object aspect ratio if it exists
        if (photoObject.aspectRatio !== undefined) {
            photoObject.aspectRatio = cropWidth / cropHeight;
        }
        
        // If the photo object has position data, we might need to adjust it
        if (photoObject.x !== undefined && photoObject.y !== undefined) {
            // The object may need position adjustment based on new dimensions
            if (photoObject.originalWidth && photoObject.originalHeight) {
                // Calculate scale change
                const widthRatio = cropWidth / photoObject.originalWidth;
                const heightRatio = cropHeight / photoObject.originalHeight;
                
                // Store the new dimensions
                photoObject.originalWidth = cropWidth;
                photoObject.originalHeight = cropHeight;
            } else {
                // If original dimensions weren't stored, store them now
                photoObject.originalWidth = cropWidth;
                photoObject.originalHeight = cropHeight;
            }
        }
        
        // Save the current state for undo functionality
        saveCurrentState();
        
        // Update the shirt texture immediately
        updateShirt3DTexture();
    };
    
    // Set the source to the canvas data
    croppedImage.src = canvas.toDataURL('image/png');
    
    // Immediate update for the preview - don't wait for onload
    return croppedImage.src;
}

/**
 * Initialize a canvas with the specified width and height
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} - Canvas data object
 */
function initializeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    return {
        canvas: canvas,
        ctx: ctx,
        width: width,
        height: height,
        objects: []
    };
}

// Initialize 3D scene and canvas
export function init(container, modelType = 'tshirt') {
    container = container || document.getElementById('editor-container');
    if (!container) {
        console.error('Container element not found');
        return;
    }

    // Create a global ref to container
    editorContainer = container;

    // Initialize canvas
    canvasData = initializeCanvas(2048, 2048);
    
    // Load saved panel settings
    loadPanelSettings();

    // Set up the scene
    scene = new THREE.Scene();
    
    // Create camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0, 400);

    // Rest of init function continues...
}