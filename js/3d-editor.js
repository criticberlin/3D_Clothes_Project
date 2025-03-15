/**
 * 3D-Editor.js
 * Implements direct 3D editing capabilities for manipulating elements on the 3D model
 * Adapts Fabric.js transformation logic to work in a 3D environment
 */

import * as THREE from 'three';
import { state, updateState } from './state.js';
import { modelConfig } from './texture-mapper.js';
import { Logger, Performance, debounce } from './utils.js';

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
    scale: 'nwse-resize'
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
    const container = renderer.domElement.parentElement;

    // Mouse events
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);

    // Prevent context menu on right-click
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);
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

    // Detect if we're clicking on a transform handle
    const handleClicked = detectTransformHandleClick();
    if (handleClicked) {
        transformMode = handleClicked;
        document.body.style.cursor = cursors[transformMode];
        return;
    }

    // Cast a ray to detect object selection
    raycaster.setFromCamera(mouse, camera);

    // If we have a selected object and we're not clicking on a transform handle, 
    // check if we're clicking outside (to deselect)
    if (selectedObject) {
        const intersectsObject = detectObjectIntersection(selectedObject);
        if (!intersectsObject) {
            deselectObject();
            transformMode = 'none';
            document.body.style.cursor = cursors.default;
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
    // Convert screen space delta to UV space delta
    const deltaUV = screenToUVDelta(deltaX, deltaY);

    // Move the object
    object.left += deltaUV.x * canvasData.width;
    object.top += deltaUV.y * canvasData.height;

    // Ensure object stays within boundaries
    constrainObjectToUVBoundary(object);

    Logger.log('Moved object:', deltaUV);
}

/**
 * Rotate an object based on delta
 * @param {Object} object - The object to rotate
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 */
function rotateObject(object, deltaX, deltaY) {
    // Calculate rotation angle based on mouse movement
    // Use both X and Y deltas for more intuitive rotation

    // Get the point to rotate around (center of the object)
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;

    // Convert screen space deltas to world space
    const worldDeltas = screenToUVDelta(deltaX, deltaY);

    // Get the current point in UV space
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(shirtMesh);

    if (intersects.length > 0) {
        const uv = intersects[0].uv;
        const x = uv.x * canvasData.width;
        const y = uv.y * canvasData.height;

        // Calculate angle between center and current point
        const angle = Math.atan2(y - centerY, x - centerX);

        // Store the last angle if it's the first time
        if (object._lastRotationAngle === undefined) {
            object._lastRotationAngle = angle;
            return;
        }

        // Calculate the angle difference
        let angleDelta = angle - object._lastRotationAngle;

        // Convert to degrees for better sensitivity
        angleDelta *= (180 / Math.PI);

        // Update the object's rotation
        object.angle = (object.angle || 0) + angleDelta;

        // Store the current angle for next time
        object._lastRotationAngle = angle;
    } else {
        // Fallback to the old method if ray doesn't hit
        const rotationDelta = deltaX * 3; // Increased sensitivity
        object.angle = (object.angle || 0) + rotationDelta;
    }

    Logger.log('Rotated object:', object.angle);
}

/**
 * Scale an object based on delta
 * @param {Object} object - The object to scale
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 */
function scaleObject(object, deltaX, deltaY) {
    // Get world space deltas for more accurate scaling
    const worldDeltas = screenToUVDelta(deltaX, deltaY);

    // Calculate a more intuitive scale factor
    // Use the larger of the two deltas, and apply a multiplier for better responsiveness
    const scaleFactor = 1 + Math.max(Math.abs(worldDeltas.x * 3), Math.abs(worldDeltas.y * 3)) *
        (deltaX > 0 || deltaY > 0 ? 1 : -1);

    // Get object center
    const centerX = object.left + object.width / 2;
    const centerY = object.top + object.height / 2;

    // Apply scaling in a more controlled way
    // Never allow scaling below a minimum size to prevent objects from disappearing
    const minDimension = 20; // Minimum size in pixels

    // Apply scaling with limits
    const newWidth = Math.max(minDimension, object.width * scaleFactor);
    const newHeight = Math.max(minDimension, object.height * scaleFactor);

    // Update object properties
    object.width = newWidth;
    object.height = newHeight;

    // Keep the object centered at its original position
    object.left = centerX - newWidth / 2;
    object.top = centerY - newHeight / 2;

    // Ensure object stays within boundaries
    constrainObjectToUVBoundary(object);

    Logger.log('Scaled object to new dimensions:', newWidth, newHeight);
}

/**
 * Convert screen space delta to UV space delta
 * @param {number} deltaX - X movement in normalized coordinates
 * @param {number} deltaY - Y movement in normalized coordinates
 * @returns {THREE.Vector2} Delta in UV space
 */
function screenToUVDelta(deltaX, deltaY) {
    // This conversion depends on camera position, orientation, and FOV
    // This is a simplified version
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];

    // Convert based on the current view's UV rectangle
    const uvWidth = viewConfig.uvRect.u2 - viewConfig.uvRect.u1;
    const uvHeight = viewConfig.uvRect.v2 - viewConfig.uvRect.v1;

    return new THREE.Vector2(
        deltaX * uvWidth,
        deltaY * uvHeight
    );
}

/**
 * Ensure object stays within UV boundaries
 * @param {Object} object 
 */
function constrainObjectToUVBoundary(object) {
    // Get current view's UV boundaries
    const viewConfig = modelConfig[state.currentModel].views[state.cameraView];

    // Calculate boundaries in canvas space
    const minX = viewConfig.uvRect.u1 * canvasData.width;
    const maxX = viewConfig.uvRect.u2 * canvasData.width;
    const minY = viewConfig.uvRect.v1 * canvasData.height;
    const maxY = viewConfig.uvRect.v2 * canvasData.height;

    // Constrain left/right
    if (object.left < minX) object.left = minX;
    if (object.left + object.width > maxX) object.left = maxX - object.width;

    // Constrain top/bottom
    if (object.top < minY) object.top = minY;
    if (object.top + object.height > maxY) object.top = maxY - object.height;
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

    // Draw selection if we have a selected object
    if (selectedObject && transformControls.visible) {
        drawSelectionOverlay(selectedObject);
    }

    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvasData.canvas);
    texture.needsUpdate = true;

    // Apply the texture to the shirt material
    if (shirtMesh.material.map) {
        shirtMesh.material.map.dispose();
    }
    shirtMesh.material.map = texture;
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
        ctx.drawImage(
            object.img,
            -object.width / 2,
            -object.height / 2,
            object.width,
            object.height
        );
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
            // Get current view's UV boundaries
            const viewConfig = modelConfig[state.currentModel].views[state.cameraView];

            // Calculate position in canvas space - ensure it's visible in the current UV mapping area
            const uvMidX = (viewConfig.uvRect.u1 + viewConfig.uvRect.u2) / 2;
            const uvMidY = (viewConfig.uvRect.v1 + viewConfig.uvRect.v2) / 2;

            // Calculate position to center the image in the visible area of the current view
            const left = options.left || (uvMidX * canvasData.width);
            const top = options.top || (uvMidY * canvasData.height);

            // Calculate better initial scaling - ensure image isn't too large or too small
            // Use the view's UV rectangle to determine appropriate scale
            const viewWidth = (viewConfig.uvRect.u2 - viewConfig.uvRect.u1) * canvasData.width;
            const viewHeight = (viewConfig.uvRect.v2 - viewConfig.uvRect.v1) * canvasData.height;

            // Calculate scale factor that fits image within 50% of view bounds
            const scaleX = options.width ? (options.width / img.width) :
                (viewWidth * 0.5) / img.width;
            const scaleY = options.height ? (options.height / img.height) :
                (viewHeight * 0.5) / img.height;
            const scaleFactor = Math.min(scaleX, scaleY);

            // Create image object with adjusted positioning and scaling
            const imageObj = {
                type: 'image',
                img: img,
                left: left,
                top: top,
                width: img.width * scaleFactor,
                height: img.height * scaleFactor,
                angle: options.angle || 0,
                active: false,
                originX: 'center',
                originY: 'center'
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
    // Only handle keyboard events when in editor mode
    if (!state.editorMode) return;

    // Skip if we're in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    switch (event.key) {
        case 'Delete':
        case 'Backspace':
            // Delete selected object
            if (selectedObject) {
                removeObject(selectedObject);
                selectedObject = null;
                transformMode = 'none';
            }
            break;

        case 'Escape':
            // Deselect object
            if (selectedObject) {
                deselectObject();
                transformMode = 'none';
            }
            break;

        case 'ArrowUp':
            // Move object up
            if (selectedObject) {
                moveObject(selectedObject, 0, -0.01);
                updateShirt3DTexture();
                updateTransformControls();
            }
            break;

        case 'ArrowDown':
            // Move object down
            if (selectedObject) {
                moveObject(selectedObject, 0, 0.01);
                updateShirt3DTexture();
                updateTransformControls();
            }
            break;

        case 'ArrowLeft':
            // Move object left
            if (selectedObject) {
                moveObject(selectedObject, -0.01, 0);
                updateShirt3DTexture();
                updateTransformControls();
            }
            break;

        case 'ArrowRight':
            // Move object right
            if (selectedObject) {
                moveObject(selectedObject, 0.01, 0);
                updateShirt3DTexture();
                updateTransformControls();
            }
            break;

        case 'r':
            // Rotate mode
            if (selectedObject) {
                transformMode = 'rotate';
                document.body.style.cursor = cursors.rotate;
            }
            break;

        case 's':
            // Scale mode
            if (selectedObject) {
                transformMode = 'scale';
                document.body.style.cursor = cursors.scale;
            }
            break;

        case 'm':
            // Move mode
            if (selectedObject) {
                transformMode = 'move';
                document.body.style.cursor = cursors.move;
            }
            break;

        case 'c':
            // Copy selected object
            if (selectedObject) {
                // Create a copy of the object
                const copy = { ...selectedObject };
                // Offset slightly
                copy.left += 20;
                copy.top += 20;
                // Add to canvas
                addObject(copy);
            }
            break;
    }
}

// Export necessary functions
export default {
    init3DEditor,
    addImage,
    addText,
    addShape,
    clearCanvas,
    clearObjectsByView,
    exportCanvasImage
}; 