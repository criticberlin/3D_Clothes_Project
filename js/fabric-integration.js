import { updateShirtTexture } from './scene.js';
import { Performance, Logger, debounce } from './utils.js';
import { state, updateState } from './state.js';
import { addImage, addText as add3DText, addShape as add3DShape } from './3d-editor.js';

// Global variables
let canvas;
let currentMode = 'select';
let selectedColor = '#000000';
let selectedFontFamily = 'Arial';
let selectedFontSize = 30;
let selectedLineWidth = 3;
let editorTools; // Add this variable to store the editor tools container
let use3DEditor = true; // Flag to determine if we should use the 3D editor

/**
 * Initialize the Fabric.js canvas
 * @param {number} width - Optional canvas width (defaults to container width or 500)
 * @param {number} height - Optional canvas height (defaults to width for square canvas)
 */
export function initFabricCanvas(width, height) {
    // Get the canvas container element
    const container = document.querySelector('.fabric-canvas-wrapper');

    // If we're using the 3D editor, we don't need to initialize the fabric canvas
    if (use3DEditor) {
        // We still need to set up some UI elements
        setupEditorTools();

        // Hide the fabric canvas container if it exists
        if (container) {
            container.style.display = 'none';
        }

        // Enable 3D editor mode in scene.js
        updateState({ editorMode: true });

        Logger.log('Using 3D editor instead of Fabric canvas');
        return null;
    }

    // Use consistent canvas size for all cases
    // Determine canvas size
    let canvasWidth = width || (container ? container.clientWidth : 500);
    let canvasHeight = height || canvasWidth;

    // Limit maximum size for performance
    canvasWidth = Math.min(canvasWidth, 320);
    canvasHeight = Math.min(canvasHeight, 400);
    // Create canvas instance
    canvas = new fabric.Canvas('fabric-canvas', {
        preserveObjectStacking: true,
        width: canvasWidth,
        height: canvasHeight,
        selection: true,
        backgroundColor: 'transparent'  // Set transparent background
    });

    // Store canvas in window for global access
    window.fabricCanvas = canvas;

    // Set up initial canvas state
    canvas.freeDrawingBrush.width = selectedLineWidth;
    canvas.freeDrawingBrush.color = selectedColor;

    // Add a background rectangle that represents the printable area
    const printArea = new fabric.Rect({
        left: 0,
        top: 0,
        width: canvas.width,
        height: canvas.height,
        fill: 'rgba(246, 246, 246, 0)',
        selectable: false,
        hoverCursor: 'default'
    });
    canvas.add(printArea);
    canvas.sendToBack(printArea);

    // Set up event listeners
    setupEventListeners();

    // Update any container styling if needed
    if (container) {
        container.style.height = canvasHeight + 'px';
        container.style.width = canvasWidth + 'px';
        container.style.margin = '0 auto';

        // Setup drag and drop for images
        setupDragAndDrop(container);
    }

    // Setup clipboard paste support for images
    setupClipboardPasteSupport();

    return canvas;
}

/**
 * Setup drag and drop functionality for the canvas container
 * @param {HTMLElement} container - The canvas container element
 */
function setupDragAndDrop(container) {
    if (!container) return;

    // Add visual indicator for drag and drop
    const dropOverlay = document.createElement('div');
    dropOverlay.className = 'drop-overlay';
    dropOverlay.innerHTML = '<div class="drop-message"><i class="fas fa-cloud-upload-alt"></i><p>Drop image here</p></div>';
    dropOverlay.style.position = 'absolute';
    dropOverlay.style.top = '0';
    dropOverlay.style.left = '0';
    dropOverlay.style.width = '100%';
    dropOverlay.style.height = '100%';
    dropOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dropOverlay.style.color = 'white';
    dropOverlay.style.display = 'none';
    dropOverlay.style.justifyContent = 'center';
    dropOverlay.style.alignItems = 'center';
    dropOverlay.style.textAlign = 'center';
    dropOverlay.style.zIndex = '1000';

    // Style the drop message
    const messageStyle = document.createElement('style');
    messageStyle.textContent = `
        .drop-message {
            padding: 20px;
            border-radius: 10px;
            background-color: rgba(0, 0, 0, 0.7);
        }
        .drop-message i {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .drop-message p {
            margin: 0;
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(messageStyle);

    // Make sure container has position relative for overlay positioning
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    container.appendChild(dropOverlay);

    // Add event listeners for drag and drop
    container.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.style.display = 'flex';
    });

    container.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Only hide if we're leaving the container (not entering a child)
        const rect = container.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            dropOverlay.style.display = 'none';
        }
    });

    container.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.style.display = 'none';

        // Process dropped files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]; // Get the first file

            if (file.type.match('image.*')) {
                addImageFromFile(file);
            } else {
                showNotification('Please drop an image file', 'error');
            }
        }
    });
}

/**
 * Set up event listeners for the Fabric.js canvas
 */
function setupEventListeners() {
    if (!canvas) return;

    // Create a container for the editor tools if it doesn't exist
    editorTools = document.querySelector('.editor-tools');
    if (!editorTools) {
        editorTools = document.createElement('div');
        editorTools.className = 'editor-tools';

        // Find the best container to append the editor tools to
        const fabricControls = document.querySelector('.fabric-controls');
        if (fabricControls) {
            // Add a section title
            const toolsTitle = document.createElement('h3');
            toolsTitle.className = 'editor-section-title';
            toolsTitle.innerHTML = '<i class="fas fa-paint-brush"></i> Drawing Tools';

            fabricControls.insertBefore(toolsTitle, fabricControls.firstChild);
            fabricControls.insertBefore(editorTools, fabricControls.children[1]);
        } else {
            // Fallback: append to the canvas container
            const canvasContainer = document.querySelector('.canvas-container');
            if (canvasContainer) {
                canvasContainer.parentNode.insertBefore(editorTools, canvasContainer.nextSibling);
            } else {
                // Last resort: append to body
                document.body.appendChild(editorTools);
            }
        }
    }

    // Enable direct manipulation of objects
    canvas.on('object:modified', function (e) {
        // Update state whenever object properties change (position, scale, rotation)
        console.log('Object modified, applying to shirt texture');

        // Apply changes to the shirt in real-time for better UX
        applyDesignToShirt();
    });

    // Also apply when new objects are added
    canvas.on('object:added', function (e) {
        // Skip the background rectangle which is the first object added
        if (canvas.getObjects().indexOf(e.target) === 0) return;

        console.log('New object added, applying to shirt texture');
        applyDesignToShirt();
    });

    canvas.on('selection:created', function (e) {
        // Enable controls for the selected object
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            // Set consistent controls for all object types
            activeObject.setControlsVisibility({
                mt: true, // top-center
                mb: true, // bottom-center
                ml: true, // middle-left
                mr: true, // middle-right
                bl: true, // bottom-left
                br: true, // bottom-right
                tl: true, // top-left
                tr: true, // top-right
                mtr: true // rotate
            });

            // Update UI to show the object's properties
            updateObjectPropertiesUI(activeObject);
        }
    });

    // Mode buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const mode = this.dataset.mode;
            if (mode) setMode(mode);

            // Remove active class from all buttons
            document.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.remove('active');
            });

            // Add active class to clicked button
            this.classList.add('active');
        });
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', function () {
            setColor(this.value);
        });
    }

    // Text button
    let textBtn = document.getElementById('add-text');
    if (!textBtn) {
        textBtn = document.createElement('button');
        textBtn.id = 'add-text';
        textBtn.className = 'tool-btn';
        textBtn.innerHTML = '<i class="fas fa-font"></i> Text';
        editorTools.appendChild(textBtn);
    }

    textBtn.addEventListener('click', () => {
        setMode('text');
        if (use3DEditor) {
            add3DText('Edit this text', {
                fontFamily: selectedFontFamily,
                fontSize: selectedFontSize,
                color: selectedColor
            });
        } else {
            addText('Edit this text');
        }
    });

    // Image upload button
    let imageBtn = document.getElementById('add-image');
    if (!imageBtn) {
        imageBtn = document.createElement('button');
        imageBtn.id = 'add-image';
        imageBtn.className = 'tool-btn primary';
        imageBtn.innerHTML = '<i class="fas fa-image"></i> Add Image';
        imageBtn.title = 'Add image (Click to browse, drop to upload, or paste from clipboard)';
        imageBtn.style.backgroundColor = 'var(--primary-color, #4a6cf7)';
        imageBtn.style.color = 'white';
        imageBtn.style.padding = '8px 12px';
        imageBtn.style.borderRadius = '4px';
        imageBtn.style.margin = '5px';
        editorTools.appendChild(imageBtn);

        // Add tooltip styles if they don't exist
        if (!document.getElementById('tooltip-styles')) {
            const tooltipStyles = document.createElement('style');
            tooltipStyles.id = 'tooltip-styles';
            tooltipStyles.textContent = `
                .tool-btn {
                    position: relative;
                }
                .tool-btn::after {
                    content: attr(title);
                    position: absolute;
                    bottom: 125%;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 6px 10px;
                    background-color: rgba(0, 0, 0, 0.8);
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                    z-index: 1000;
                    pointer-events: none;
                    width: max-content;
                    max-width: 250px;
                }
                .tool-btn:hover::after {
                    opacity: 1;
                    visibility: visible;
                }
            `;
            document.head.appendChild(tooltipStyles);
        }
    }

    // Create a hidden file input for image uploads
    let imageInput = document.getElementById('image-upload-input');
    if (!imageInput) {
        imageInput = document.createElement('input');
        imageInput.id = 'image-upload-input';
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.style.display = 'none';
        document.body.appendChild(imageInput);
    }

    // Connect the button to the file input
    imageBtn.addEventListener('click', () => {
        setMode('image');
        imageInput.click();
    });

    // Handle file selection
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            addImageFromFile(e.target.files[0]);
            // Reset the input so the same file can be selected again
            e.target.value = '';
        }
    });

    // Shape button
    let shapeBtn = document.getElementById('add-shape');
    if (!shapeBtn) {
        shapeBtn = document.createElement('button');
        shapeBtn.id = 'add-shape';
        shapeBtn.className = 'tool-btn';
        shapeBtn.innerHTML = '<i class="fas fa-shapes"></i> Shape';
        editorTools.appendChild(shapeBtn);
    }

    shapeBtn.addEventListener('click', () => {
        setMode('shape');
        const shapeMenu = document.createElement('div');
        shapeMenu.className = 'shape-menu';
        shapeMenu.innerHTML = `
            <button class="shape-btn" data-shape="rect">Rectangle</button>
            <button class="shape-btn" data-shape="circle">Circle</button>
            <button class="shape-btn" data-shape="triangle">Triangle</button>
        `;

        // Remove any existing menu
        const existingMenu = document.querySelector('.shape-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Add and position the menu
        shapeBtn.parentNode.appendChild(shapeMenu);
        const btnRect = shapeBtn.getBoundingClientRect();
        shapeMenu.style.left = btnRect.left + 'px';
        shapeMenu.style.top = (btnRect.bottom + 5) + 'px';

        // Add event listeners for shape buttons
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shape = e.target.dataset.shape;
                if (use3DEditor) {
                    add3DShape(shape, {
                        fill: selectedColor
                    });
                } else {
                    addShape(shape);
                }
                shapeMenu.remove();
            });
        });

        // Close menu when clicking elsewhere
        document.addEventListener('click', function closeMenu(e) {
            if (!shapeMenu.contains(e.target) && e.target !== shapeBtn) {
                shapeMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    });

    // Free drawing button
    let drawBtn = document.getElementById('draw-free');
    if (!drawBtn) {
        drawBtn = document.createElement('button');
        drawBtn.id = 'draw-free';
        drawBtn.className = 'tool-btn';
        drawBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Draw';
        editorTools.appendChild(drawBtn);
    }

    drawBtn.addEventListener('click', () => {
        setMode('draw');
        canvas.isDrawingMode = true;

        // Add event listener for path creation in drawing mode
        if (!canvas._pathCreatedHandler) {
            canvas._pathCreatedHandler = function () {
                console.log('Drawing path created, applying to shirt texture');
                applyDesignToShirt();
            };
            canvas.on('path:created', canvas._pathCreatedHandler);
        }
    });

    // Selection tool button
    let selectBtn = document.getElementById('select-tool');
    if (!selectBtn) {
        selectBtn = document.createElement('button');
        selectBtn.id = 'select-tool';
        selectBtn.className = 'tool-btn';
        selectBtn.innerHTML = '<i class="fas fa-mouse-pointer"></i> Select';
        editorTools.appendChild(selectBtn);
    }

    selectBtn.addEventListener('click', () => {
        setMode('select');
        canvas.isDrawingMode = false;
    });

    // Apply to shirt button - with proper styling
    let applyBtn = document.getElementById('apply-to-shirt');
    if (!applyBtn) {
        applyBtn = document.createElement('button');
        applyBtn.id = 'apply-to-shirt';
        applyBtn.className = 'button primary';
        applyBtn.style.marginTop = '20px';
        applyBtn.style.width = '100%';
        applyBtn.style.padding = '10px';
        applyBtn.innerHTML = '<i class="fas fa-tshirt"></i> Apply to Shirt';
        const fabricControls = document.querySelector('.fabric-controls');
        if (fabricControls) {
            fabricControls.appendChild(applyBtn);
        }
    }

    applyBtn.addEventListener('click', () => {
        applyDesignToShirt();
    });
}

/**
 * Update UI to reflect the properties of the selected object
 * @param {fabric.Object} object - The selected Fabric.js object
 */
function updateObjectPropertiesUI(object) {
    // Update color picker if applicable
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker && object.fill && typeof object.fill === 'string') {
        colorPicker.value = object.fill;
    }

    // Update other properties UI if needed
    // For example, font controls for text objects
    if (object.type === 'text' || object.type === 'i-text') {
        // Update font family selector
        const fontSelector = document.getElementById('font-family');
        if (fontSelector) {
            fontSelector.value = object.fontFamily;
        }

        // Update font size input
        const fontSizeInput = document.getElementById('font-size');
        if (fontSizeInput) {
            fontSizeInput.value = object.fontSize;
        }
    }
}

/**
 * Set the current editing mode
 * @param {string} mode - The mode to set
 */
function setMode(mode) {
    currentMode = mode;

    // Reset all tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate the selected tool button
    switch (mode) {
        case 'text':
            document.getElementById('add-text').classList.add('active');
            break;
        case 'shape':
            document.getElementById('add-shape').classList.add('active');
            break;
        case 'draw':
            document.getElementById('draw-free').classList.add('active');
            break;
        case 'image':
            document.getElementById('add-image').classList.add('active');
            break;
    }

    // Update canvas mode
    canvas.isDrawingMode = mode === 'draw';
}

/**
 * Add text to the canvas
 * @param {string} text - The text to add
 */
function addText(text) {
    // Create a high-quality text object
    const textObj = new fabric.IText(text, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fontFamily: selectedFontFamily,
        fontSize: selectedFontSize,
        fill: selectedColor,
        textAlign: 'center',
        editable: true,
        centeredRotation: true,
        originX: 'center',
        originY: 'center'
    });

    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();

    // Return the created object
    return textObj;
}

/**
 * Add a shape to the canvas
 * @param {string} shapeType - The type of shape to add
 */
function addShape(shapeType) {
    let shape;

    switch (shapeType) {
        case 'rect':
            shape = new fabric.Rect({
                left: canvas.width / 2,
                top: canvas.height / 2,
                width: 100,
                height: 100,
                fill: selectedColor,
                originX: 'center',
                originY: 'center'
            });
            break;
        case 'circle':
            shape = new fabric.Circle({
                left: canvas.width / 2,
                top: canvas.height / 2,
                radius: 50,
                fill: selectedColor,
                originX: 'center',
                originY: 'center'
            });
            break;
        case 'triangle':
            shape = new fabric.Triangle({
                left: canvas.width / 2,
                top: canvas.height / 2,
                width: 100,
                height: 100,
                fill: selectedColor,
                originX: 'center',
                originY: 'center'
            });
            break;
    }

    if (shape) {
        canvas.add(shape);
        canvas.setActiveObject(shape);

        // Explicitly apply shape to the shirt texture
        applyDesignToShirt();
    }
}

/**
 * Apply the current Fabric.js canvas design to the t-shirt using the texture mapper
 */
export function applyDesignToShirt() {
    try {
        // Get the canvas element
        const canvas = window.fabricCanvas;
        if (!canvas) {
            console.error("Fabric canvas not initialized");
            // Try to initialize it if not available
            if (typeof initFabricCanvas === 'function') {
                console.log("Attempting to initialize Fabric canvas");
                window.fabricCanvas = initFabricCanvas();

                // If still not available, exit gracefully
                if (!window.fabricCanvas) {
                    console.warn("Could not initialize Fabric canvas, operation aborted");
                    return;
                }
            } else {
                return;
            }
        }

        // Add a visual indicator that updates are being applied
        showApplyingIndicator(true);

        // Get the current canvas dimensions
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // Temporarily upscale canvas for higher quality export if needed
        const scaleMultiplier = 2; // Upscale by 2x for better quality

        // Only upscale if the canvas is below a certain size threshold
        if (canvasWidth < 1024 || canvasHeight < 1024) {
            // Store original dimensions and scaling
            const originalWidth = canvas.width;
            const originalHeight = canvas.height;
            const originalScaleFactor = canvas.getZoom();

            // Scale up canvas temporarily
            canvas.setWidth(originalWidth * scaleMultiplier);
            canvas.setHeight(originalHeight * scaleMultiplier);
            canvas.setZoom(originalScaleFactor * scaleMultiplier);
            canvas.renderAll();

            // After export, we'll restore the original dimensions
        }

        // Convert the canvas to a high-quality data URL
        const designImage = canvas.lowerCanvasEl.toDataURL('image/png', 1.0);

        // Restore canvas to original dimensions if we upscaled
        if (canvasWidth < 1024 || canvasHeight < 1024) {
            canvas.setWidth(canvasWidth);
            canvas.setHeight(canvasHeight);
            canvas.setZoom(canvas.getZoom() / scaleMultiplier);
            canvas.renderAll();
        }

        // Import texture-mapper functions
        import('./texture-mapper.js').then((textureMapper) => {
            const currentView = textureMapper.getCurrentView ?
                textureMapper.getCurrentView() : 'front';

            // Apply design to the current view using the texture mapper
            textureMapper.loadCustomImage(designImage, currentView)
                .then(() => {
                    console.log(`Applied design to ${currentView} view using texture mapper`);
                    showNotification('Design applied to ' + currentView + ' view', 'success');
                })
                .catch(error => {
                    console.error("Error applying design to view:", error);
                    showNotification('Failed to apply design to ' + currentView + ' view', 'error');
                })
                .finally(() => {
                    // Hide the applying indicator
                    showApplyingIndicator(false);
                });
        }).catch(error => {
            console.error("Error importing texture mapper:", error);

            // Fallback to the old method if texture mapper import fails
            if (typeof updateShirtTexture === 'function') {
                updateShirtTexture(designImage, 'full');
                showNotification('Design applied using fallback method', 'info');
            } else {
                console.error("updateShirtTexture function not available");
                showNotification('Could not apply design - missing updateShirtTexture function', 'error');
            }

            // Hide the applying indicator
            showApplyingIndicator(false);
        });
    } catch (error) {
        console.error("Failed to apply design to shirt:", error);
        showNotification('Failed to apply design. Please try again.', 'error');

        // Hide the applying indicator
        showApplyingIndicator(false);
    }
}

/**
 * Show or hide an indicator that design is being applied to the shirt
 * @param {boolean} show - Whether to show or hide the indicator
 */
function showApplyingIndicator(show) {
    // Get or create the indicator element
    let indicator = document.getElementById('applying-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'applying-indicator';
        indicator.innerHTML = '<i class="fas fa-sync fa-spin"></i> Applying to shirt...';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '4px';
        indicator.style.fontSize = '14px';
        indicator.style.zIndex = '9999';
        indicator.style.transition = 'opacity 0.3s ease';
        indicator.style.display = 'none';

        document.body.appendChild(indicator);
    }

    if (show) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 10);
    } else {
        indicator.style.opacity = '0';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 300);
    }
}

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Show notification
    notification.style.display = 'block';
    notification.style.opacity = '1';

    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

/**
 * Simulate fabric lighting and shadows on the design
 * @param {HTMLCanvasElement} canvasEl - The canvas element to process
 * @returns {HTMLCanvasElement} Processed canvas with lighting effects
 */
function simulateFabricLighting(canvasEl) {
    const properties = FABRIC_PROPERTIES[selectedFabricType];

    // Create a temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const ctx = tempCanvas.getContext('2d');

    // Draw the original canvas
    ctx.drawImage(canvasEl, 0, 0);

    // Get image data for manipulation
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Simulate fabric lighting based on thread pattern
    for (let i = 0; i < data.length; i += 4) {
        // Skip transparent pixels
        if (data[i + 3] === 0) continue;

        // Get pixel coordinates
        const x = (i / 4) % tempCanvas.width;
        const y = Math.floor((i / 4) / tempCanvas.width);

        // Calculate fabric weave pattern at this point
        let weaveValue = 1.0;

        if (selectedTextureStyle === 'plain') {
            // Plain weave pattern
            weaveValue = ((x + y) % 2 === 0) ? 1.0 : 0.95;
        } else if (selectedTextureStyle === 'twill') {
            // Twill pattern
            weaveValue = (((x + y) % 8) < 4) ? 1.0 : 0.93;
        } else if (selectedTextureStyle === 'herringbone') {
            // Herringbone pattern
            const modX = x % 16;
            const modY = y % 16;
            if (modY < 8) {
                weaveValue = (modX + modY) % 8 < 4 ? 1.0 : 0.92;
            } else {
                weaveValue = (modX - modY + 16) % 8 < 4 ? 1.0 : 0.92;
            }
        }

        // Apply the weave lighting effect
        data[i] = Math.min(255, Math.max(0, data[i] * weaveValue));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * weaveValue));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * weaveValue));
    }

    // Put the modified data back
    ctx.putImageData(imageData, 0, 0);

    return tempCanvas;
}

/**
 * Open an image in the fabric editor
 * @param {string} imageData - Base64 image data
 * @param {function} callback - Function to call with the edited image data
 */
export function openImageInEditor(imageData, callback) {
    // Create temporary image to get dimensions
    const tempImg = new Image();
    tempImg.onload = function () {
        // Use consistent canvas size
        const canvasWidth = 320;
        const canvasHeight = 400;

        // Initialize the canvas with the fixed dimensions
        if (!canvas) {
            initFabricCanvas(canvasWidth, canvasHeight);
        } else {
            // Resize existing canvas
            canvas.setWidth(canvasWidth);
            canvas.setHeight(canvasHeight);

            // Resize the background rectangle
            const background = canvas.getObjects()[0];
            if (background) {
                background.set({
                    width: canvasWidth,
                    height: canvasHeight
                });
            }
        }

        // Clear any existing content (except the background)
        clearCanvas(true);

        // Switch to the file tab to show the editor
        const fileTab = document.querySelector('.tab-btn[data-tab="file"]');
        if (fileTab) {
            fileTab.click();
        } else {
            // If file tab doesn't exist, activate the editor without switching tabs
            const editorContainer = document.querySelector('.fabric-controls');
            if (editorContainer) {
                editorContainer.style.display = 'block';
            }
        }

        // Load the image into the canvas
        fabric.Image.fromURL(imageData, function (img) {
            // Calculate scaling to fit the canvas while maintaining aspect ratio
            const scaleFactor = Math.min(
                (canvas.width - 40) / img.width,
                (canvas.height - 40) / img.height
            );

            // Apply scaling
            img.scale(scaleFactor);

            // Center the image
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center'
            });

            // Add to canvas
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();

            // Update container styling
            const container = document.querySelector('.fabric-canvas-wrapper');
            if (container) {
                container.style.height = canvasHeight + 'px';
                container.style.width = canvasWidth + 'px';
                container.style.margin = '0 auto';
                container.style.overflow = 'hidden';
            }

            // Show notification
            showNotification('AI image loaded for editing. Use the tools to customize it.');

            // Add a special button to finish editing in a dedicated container
            const editorContainer = document.querySelector('.fabric-controls');
            if (editorContainer) {
                // Create a container for the finish action
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'ai-edit-actions';

                // Create the finish button
                const finishButton = document.createElement('button');
                finishButton.id = 'finish-ai-edit';
                finishButton.className = 'button primary';
                finishButton.innerHTML = '<i class="fas fa-check"></i> Save and Return to AI';

                // Add the button to the container
                actionsContainer.appendChild(finishButton);

                // Add the container to the editor
                editorContainer.appendChild(actionsContainer);

                // Add event listener to the finish button
                finishButton.addEventListener('click', function () {
                    // Convert canvas to image data
                    const editedImageData = canvas.toDataURL('image/png');

                    // Switch back to AI tab
                    const aiTab = document.querySelector('.tab-btn[data-tab="ai"]');
                    if (aiTab) {
                        aiTab.click();
                    }

                    // Call the callback with the edited image
                    if (typeof callback === 'function') {
                        callback(editedImageData);
                    }

                    // Clean up after editing is complete
                    // Remove the AI editing title
                    const aiEditTitle = document.querySelector('.ai-edit-title');
                    if (aiEditTitle) {
                        aiEditTitle.remove();
                    }

                    // Remove the actions container
                    actionsContainer.remove();

                    // Show notification
                    showNotification('Edited image saved! You can now apply it to your shirt.');
                });
            }
        });
    };

    // Set the source to load the image
    tempImg.src = imageData;
}

/**
 * Clear the canvas
 * @param {boolean} keepBackground - Whether to keep the background rectangle
 */
export function clearCanvas(keepBackground = false) {
    if (use3DEditor) {
        // Use 3D editor's clear method
        if (window.confirm('Are you sure you want to clear all elements?')) {
            // Import clearCanvas function from 3d-editor
            const { clearCanvas } = require('./3d-editor.js');
            clearCanvas();
        }
    } else if (canvas) {
        if (keepBackground) {
            // Keep only the background rectangle (first object)
            const background = canvas.getObjects()[0];
            canvas.clear();
            if (background) {
                canvas.add(background);
            }
        } else {
            // Get the background rectangle (first object)
            const background = canvas.getObjects()[0];

            // Clear the canvas
            canvas.clear();

            // Add back the background if it existed
            if (background) {
                canvas.add(background);
            }

            // Reset all objects on top of the background
            canvas.renderAll();
        }
    }
}

/**
 * Set the selected color with advanced fabric color calculation
 * @param {string} color - The color to set
 */
export function setColor(color) {
    selectedColor = color;

    if (use3DEditor) {
        // The 3D editor will use this color for new objects
        // Existing objects can be modified through the 3D editor's UI
    } else if (canvas) {
        // Original fabric.js object update
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'i-text') {
                activeObject.set('fill', color);
            } else {
                activeObject.set('fill', color);
            }
            canvas.renderAll();
        }
    }
}

/**
 * Download the current design
 */
export function downloadDesign() {
    const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1
    });

    const link = document.createElement('a');
    link.download = 'shirt-design.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Set fabric type (placeholder function)
 * @param {string} fabricType - The fabric type to set (ignored in this implementation)
 */
export function setFabricType(fabricType) {
    // This is a placeholder function that does nothing
    // We keep it to avoid breaking imports in other files
    console.log('setFabricType called with:', fabricType);
    // The actual fabric type functionality has been removed
}

/**
 * Update canvas size on window resize
 */
function updateCanvasSize() {
    const container = document.querySelector('.fabric-canvas-wrapper');
    if (container && canvas) {
        const width = container.clientWidth;
        canvas.setWidth(width);
        canvas.setHeight(width); // Make it square
        canvas.renderAll();
    }
}

/**
 * Update canvas background color to match current theme
 */
function updateCanvasBackgroundForTheme() {
    const fabricContainer = document.querySelector('.canvas-container');
    if (fabricContainer) {
        fabricContainer.style.backgroundColor = 'transparent';
    }

    // Also listen for theme changes
    window.addEventListener('theme-changed', (e) => {
        if (fabricContainer) {
            fabricContainer.style.backgroundColor = 'transparent';
        }
    });
}

/**
 * Add an image to the canvas from a file upload
 * @param {File} file - The image file to add
 */
function addImageFromFile(file) {
    if (!file || !file.type.match('image.*')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const imgData = e.target.result;

        // Pre-load image to get dimensions and apply advanced processing
        const img = new Image();
        img.onload = function () {
            // Create a temporary canvas for image processing
            const tempCanvas = document.createElement('canvas');
            let tempWidth = img.width;
            let tempHeight = img.height;

            // Limit maximum dimensions while preserving aspect ratio
            const maxDimension = 2048; // Maximum size for high-quality images

            if (tempWidth > maxDimension || tempHeight > maxDimension) {
                if (tempWidth > tempHeight) {
                    tempHeight = (tempHeight / tempWidth) * maxDimension;
                    tempWidth = maxDimension;
                } else {
                    tempWidth = (tempWidth / tempHeight) * maxDimension;
                    tempHeight = maxDimension;
                }
            }

            // Set canvas size to the calculated dimensions
            tempCanvas.width = tempWidth;
            tempCanvas.height = tempHeight;

            // Enable high quality image processing
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            // Fix image orientation based on EXIF data
            fixImageOrientation(img, tempCtx, tempWidth, tempHeight);

            // Get processed image data
            const processedImgData = tempCanvas.toDataURL('image/png', 1.0);

            // Add the processed image to the fabric canvas
            fabric.Image.fromURL(processedImgData, function (fabricImg) {
                // Calculate scaling to fit the canvas while maintaining aspect ratio
                const scaleFactor = Math.min(
                    (canvas.width * 0.6) / fabricImg.width,
                    (canvas.height * 0.6) / fabricImg.height
                );

                // Apply scaling
                fabricImg.scale(scaleFactor);

                // Center the image
                fabricImg.set({
                    left: canvas.width / 2,
                    top: canvas.height / 2,
                    originX: 'center',
                    originY: 'center',
                    cornerSize: 10, // Increased from 8 for easier grabbing
                    borderColor: 'rgba(0, 0, 0, 0.3)', // Made slightly more visible
                    cornerColor: 'rgba(0, 102, 204, 0.5)', // Blue, more visible handles
                    transparentCorners: false,
                    lockUniScaling: false, // Allow non-uniform scaling
                    hasControls: true,
                    hasBorders: true,
                    borderScaleFactor: 1.5, // Larger border when selected
                    padding: 5 // Add padding to make selection easier
                });

                // Add to canvas with improved anti-aliasing
                canvas.add(fabricImg);
                canvas.setActiveObject(fabricImg);
                canvas.renderAll();

                // Show success notification
                showNotification('High-quality image added to design', 'success');

                // Apply to shirt
                applyDesignToShirt();
            }, { crossOrigin: 'anonymous' });
        };

        // Load the image
        img.src = imgData;
    };

    reader.readAsDataURL(file);
}

/**
 * Fix image orientation based on EXIF data
 * @param {HTMLImageElement} img - The image element to fix
 * @param {CanvasRenderingContext2D} ctx - Canvas context to draw the fixed image
 * @param {number} width - The width to use for the fixed image
 * @param {number} height - The height to use for the fixed image
 */
function fixImageOrientation(img, ctx, width, height) {
    // First clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Apply transformations to fix the upside-down issue
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.PI); // 180 degrees - fixes upside down
    ctx.scale(1, -1); // Flip vertically
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(img, 0, 0, width, height);
    ctx.restore();

    // Note: For a more comprehensive solution, we would typically:
    // 1. Extract EXIF orientation data from the image
    // 2. Apply the appropriate transformations based on the orientation value
    // For a production application, consider using a library like exif-js
}

/**
 * Setup support for pasting images from clipboard
 */
function setupClipboardPasteSupport() {
    // Listen for paste events on the document
    document.addEventListener('paste', function (e) {
        // Only proceed if the canvas exists and is visible
        const canvasWrapper = document.querySelector('.fabric-canvas-wrapper');
        if (!canvas || !canvasWrapper || getComputedStyle(canvasWrapper).display === 'none') {
            return;
        }

        // Check if we have clipboard items (modern browsers)
        if (e.clipboardData && e.clipboardData.items) {
            // Look for images in the clipboard items
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    // We found an image - get the blob
                    const blob = items[i].getAsFile();

                    if (blob) {
                        // Process the blob as a file
                        addImageFromFile(blob);

                        // Show a notification
                        showNotification('Image pasted from clipboard', 'success');

                        // We're done, prevent default behavior
                        e.preventDefault();
                        return;
                    }
                }
            }
        }
    });

    // Add a visual indicator that paste is supported
    const fabricControls = document.querySelector('.fabric-controls');
    if (fabricControls) {
        const pasteHint = document.createElement('div');
        pasteHint.className = 'paste-hint';
        pasteHint.innerHTML = '<i class="fas fa-clipboard"></i> You can also paste images from clipboard (Ctrl+V)';
        pasteHint.style.fontSize = '0.9rem';
        pasteHint.style.color = 'var(--text-primary, #333)';
        pasteHint.style.padding = '10px';
        pasteHint.style.margin = '10px 0';
        pasteHint.style.textAlign = 'center';
        pasteHint.style.backgroundColor = 'var(--bg-light, #f5f5f5)';
        pasteHint.style.borderRadius = '5px';
        pasteHint.style.border = '1px dashed var(--border-color, #ddd)';

        fabricControls.appendChild(pasteHint);
    }
}

/**
 * Setup editor tools for both 2D and 3D editing
 */
function setupEditorTools() {
    // Create editor tools container if it doesn't exist
    if (!document.querySelector('.editor-tools')) {
        editorTools = document.createElement('div');
        editorTools.className = 'editor-tools';
        editorTools.innerHTML = `
            <div class="tool-group">
                <button class="tool-btn" data-tool="select" title="Select"><i class="fas fa-mouse-pointer"></i></button>
                <button class="tool-btn" data-tool="text" title="Add Text"><i class="fas fa-font"></i></button>
                <button class="tool-btn" data-tool="image" title="Add Image"><i class="fas fa-image"></i></button>
                <button class="tool-btn" data-tool="shape" title="Add Shape"><i class="fas fa-shapes"></i></button>
            </div>
            <div class="tool-group">
                <input type="color" id="color-picker" value="${selectedColor}" title="Color">
                <select id="font-family" title="Font">
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times</option>
                    <option value="Courier New">Courier</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                </select>
                <select id="font-size" title="Size">
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="30" selected>30</option>
                    <option value="36">36</option>
                    <option value="48">48</option>
                    <option value="60">60</option>
                </select>
            </div>
            <div class="tool-group">
                <button class="tool-btn" data-tool="delete" title="Delete Selected"><i class="fas fa-trash"></i></button>
                <button class="tool-btn" data-tool="clear" title="Clear All"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="tool-group mode-toggle">
                <button class="tool-btn" data-mode="2d" title="2D Editing"><i class="fas fa-square"></i></button>
                <button class="tool-btn active" data-mode="3d" title="3D Editing"><i class="fas fa-cube"></i></button>
            </div>
        `;

        // Add to document
        document.body.appendChild(editorTools);

        // Add event listeners
        setupEditorToolListeners();
    }
}

/**
 * Setup event listeners for editor tools
 */
function setupEditorToolListeners() {
    if (!editorTools) return;

    // Tool buttons
    const toolButtons = editorTools.querySelectorAll('[data-tool]');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            toolButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            // Set current mode
            currentMode = button.dataset.tool;

            // Handle tool action
            handleToolAction(currentMode);
        });
    });

    // Mode toggle
    const modeButtons = editorTools.querySelectorAll('[data-mode]');
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all mode buttons
            modeButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            // Toggle 3D editor mode
            use3DEditor = button.dataset.mode === '3d';

            // Update state and UI
            toggleEditorMode();
        });
    });

    // Color picker
    const colorPicker = editorTools.querySelector('#color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
            selectedColor = e.target.value;
            setColor(selectedColor);
        });
    }

    // Font family
    const fontFamily = editorTools.querySelector('#font-family');
    if (fontFamily) {
        fontFamily.addEventListener('change', (e) => {
            selectedFontFamily = e.target.value;
            updateSelectedObjectProperty('fontFamily', selectedFontFamily);
        });
    }

    // Font size
    const fontSize = editorTools.querySelector('#font-size');
    if (fontSize) {
        fontSize.addEventListener('change', (e) => {
            selectedFontSize = parseInt(e.target.value);
            updateSelectedObjectProperty('fontSize', selectedFontSize);
        });
    }
}

/**
 * Handle tool action based on selected mode
 * @param {string} tool - The selected tool
 */
function handleToolAction(tool) {
    if (use3DEditor) {
        // Handle action in 3D editor
        switch (tool) {
            case 'select':
                // Select mode is the default, no action needed
                break;
            case 'text':
                // Add text in 3D
                const text = prompt('Enter text:', 'Your text here');
                if (text) {
                    add3DText(text, {
                        fontFamily: selectedFontFamily,
                        fontSize: selectedFontSize,
                        color: selectedColor
                    });
                }
                break;
            case 'image':
                // Trigger file input for image upload
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            addImage(event.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                };
                fileInput.click();
                break;
            case 'shape':
                // Show shape options
                const shape = prompt('Enter shape type (rect, circle):', 'rect');
                if (shape === 'rect' || shape === 'circle') {
                    add3DShape(shape, {
                        fill: selectedColor
                    });
                }
                break;
            case 'delete':
                // Handled by 3D editor's keydown event
                break;
            case 'clear':
                if (confirm('Are you sure you want to clear all elements?')) {
                    clearCanvas();
                }
                break;
        }
    } else if (canvas) {
        // Handle action in 2D fabric canvas (original code)
        switch (tool) {
            case 'select':
                canvas.isDrawingMode = false;
                break;
            case 'text':
                canvas.isDrawingMode = false;
                const fabricText = prompt('Enter text:', 'Your text here');
                if (fabricText) {
                    addText(fabricText);
                }
                break;
            case 'shape':
                canvas.isDrawingMode = false;
                const fabricShape = prompt('Enter shape type (rect, circle, triangle):', 'rect');
                if (['rect', 'circle', 'triangle'].includes(fabricShape)) {
                    addShape(fabricShape);
                }
                break;
            case 'draw':
                canvas.isDrawingMode = true;
                break;
            case 'delete':
                const activeObject = canvas.getActiveObject();
                if (activeObject) {
                    canvas.remove(activeObject);
                    canvas.renderAll();
                }
                break;
            case 'clear':
                if (confirm('Are you sure you want to clear all elements?')) {
                    clearCanvas();
                }
                break;
        }
    }
}

/**
 * Toggle between 3D and 2D editing modes
 */
function toggleEditorMode() {
    // Get fabric canvas container
    const container = document.querySelector('.fabric-canvas-wrapper');

    // Update UI
    if (use3DEditor) {
        // Hide fabric canvas
        if (container) container.style.display = 'none';
        // Enable 3D editor mode
        updateState({ editorMode: true });
    } else {
        // Show fabric canvas
        if (container) container.style.display = 'block';
        // Disable 3D editor mode
        updateState({ editorMode: false });

        // Initialize fabric canvas if it doesn't exist
        if (!canvas) {
            initFabricCanvas();
        }
    }

    Logger.log(`Switched to ${use3DEditor ? '3D' : '2D'} editing mode`);
}

/**
 * Update property of selected object
 * @param {string} property - The property to update
 * @param {any} value - The new value
 */
function updateSelectedObjectProperty(property, value) {
    if (use3DEditor) {
        // This will be handled by the 3D editor internally
        // The 3D editor will update its selected object
    } else if (canvas) {
        // Original fabric.js object update
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            activeObject.set(property, value);
            canvas.renderAll();
        }
    }
}

// Initialize and set up window resize listener
window.addEventListener('load', () => {
    console.log('Window loaded - initializing Fabric canvas');

    // Check if the canvas element exists
    const canvasElement = document.getElementById('fabric-canvas');
    if (!canvasElement) {
        console.error('Canvas element #fabric-canvas not found in DOM');

        // Create the canvas element if it doesn't exist
        const canvasWrapper = document.querySelector('.fabric-canvas-wrapper');
        if (canvasWrapper) {
            console.log('Creating canvas element within .fabric-canvas-wrapper');
            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'fabric-canvas';
            canvasWrapper.appendChild(newCanvas);
        } else {
            console.error('Canvas wrapper .fabric-canvas-wrapper not found');
            // Try to create both elements
            const mainContainer = document.querySelector('.main-container') || document.body;
            const newWrapper = document.createElement('div');
            newWrapper.className = 'fabric-canvas-wrapper';
            newWrapper.style.width = '500px';
            newWrapper.style.height = '500px';
            newWrapper.style.margin = '0 auto';
            newWrapper.style.position = 'relative';

            const newCanvas = document.createElement('canvas');
            newCanvas.id = 'fabric-canvas';
            newWrapper.appendChild(newCanvas);
            mainContainer.appendChild(newWrapper);
            console.log('Created fabric-canvas-wrapper and canvas elements');
        }
    }

    // Initialize the canvas
    try {
        const canvas = initFabricCanvas();
        window.fabricCanvas = canvas; // Ensure global access
        updateCanvasSize();
        console.log('Fabric canvas initialized successfully');
    } catch (error) {
        console.error('Error initializing Fabric canvas:', error);
    }

    // Set up resize listener
    window.addEventListener('resize', () => {
        try {
            updateCanvasSize();
        } catch (error) {
            console.error('Error updating canvas size:', error);
        }
    });

    // Apply initial design if needed
    if (window.initialDesign) {
        console.log('Applying initial design');
        setTimeout(() => {
            applyDesignToShirt();
        }, 500);
    }
}); 