import { updateShirtTexture } from './scene.js';
import { transformFabricCanvasTo3D, calculateFabricColor, FABRIC_PROPERTIES } from './advanced-calculations.js';

// Global variables
let canvas;
let currentMode = 'select';
let selectedColor = '#000000';
let selectedFontFamily = 'Arial';
let selectedFontSize = 30;
let selectedLineWidth = 3;
let selectedFabricType = 'cotton';
let selectedTextureStyle = 'plain';
let editorTools; // Add a variable to hold the editor tools container
let lastUpdateTime = 0; // Timestamp of last texture update
const UPDATE_THROTTLE = 300; // Minimum time between updates in ms
let pendingUpdate = false; // Flag to track if an update is pending

// Fabric texture patterns
const FABRIC_PATTERNS = {
    plain: null,
    canvas: null,
    twill: null,
    herringbone: null,
    satin: null
};

/**
 * Initialize the Fabric.js canvas
 * @param {number} width - Optional canvas width (defaults to container width or 500)
 * @param {number} height - Optional canvas height (defaults to width for square canvas)
 */
export function initFabricCanvas(width, height) {
    // Get the canvas container element
    const container = document.querySelector('.fabric-canvas-wrapper');

    // Determine canvas size
    let canvasWidth = width || (container ? container.clientWidth : 500);
    let canvasHeight = height || canvasWidth;

    // Limit maximum size for performance
    canvasWidth = Math.min(canvasWidth, 800);
    canvasHeight = Math.min(canvasHeight, 800);

    // Create canvas instance
    canvas = new fabric.Canvas('fabric-canvas', {
        backgroundColor: 'rgba(255, 255, 255, 0.0)',
        preserveObjectStacking: true,
        width: canvasWidth,
        height: canvasHeight,
        selection: true
    });

    // Set up initial canvas state
    canvas.freeDrawingBrush.width = selectedLineWidth;
    canvas.freeDrawingBrush.color = selectedColor;

    // Add a background rectangle that represents the printable area
    const printArea = new fabric.Rect({
        left: 0,
        top: 0,
        width: canvas.width,
        height: canvas.height,
        fill: 'rgba(255, 255, 255, 1)',
        selectable: false,
        hoverCursor: 'default'
    });
    canvas.add(printArea);
    canvas.sendToBack(printArea);

    // Initialize fabric texture patterns
    initFabricPatterns();

    // Set up event listeners
    setupEventListeners();

    // Set initial canvas background based on theme
    updateCanvasBackgroundForTheme();

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
 * Initialize predefined fabric texture patterns
 */
function initFabricPatterns() {
    const patternSize = 20;

    // Plain weave pattern (basic over-under)
    FABRIC_PATTERNS.plain = createFabricPattern('plain', patternSize);

    // Canvas weave pattern (thicker threads, more textured)
    FABRIC_PATTERNS.canvas = createFabricPattern('canvas', patternSize);

    // Twill pattern (diagonal lines)
    FABRIC_PATTERNS.twill = createFabricPattern('twill', patternSize);

    // Herringbone pattern (zigzag twill)
    FABRIC_PATTERNS.herringbone = createFabricPattern('herringbone', patternSize);

    // Satin pattern (smooth with fewer intersections)
    FABRIC_PATTERNS.satin = createFabricPattern('satin', patternSize);
}

/**
 * Create a fabric texture pattern
 * @param {string} type - Pattern type
 * @param {number} size - Pattern size in pixels
 * @returns {fabric.Pattern} Fabric.js pattern object
 */
function createFabricPattern(type, size) {
    // Create a temporary canvas to draw the pattern
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size;
    patternCanvas.height = size;
    const ctx = patternCanvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, size, size);

    // Draw the pattern based on type
    switch (type) {
        case 'plain':
            // Simple grid pattern
            ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
            ctx.fillRect(0, 0, size / 2, size / 2);
            ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
            break;

        case 'canvas':
            // Thicker grid pattern
            ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
            ctx.fillRect(0, 0, size * 0.6, size * 0.6);
            ctx.fillRect(size * 0.6, size * 0.6, size * 0.4, size * 0.4);
            break;

        case 'twill':
            // Diagonal pattern
            ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
            for (let i = 0; i < size; i += 2) {
                ctx.fillRect(i, i, 1, 1);
                ctx.fillRect(i + size / 2, i + size / 2, 1, 1);
            }
            break;

        case 'herringbone':
            // Zigzag pattern
            ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
            const mid = size / 2;
            for (let i = 0; i < mid; i++) {
                // Top-right to bottom-left diagonal in top half
                ctx.fillRect(mid + i, i, 1, 1);
                // Bottom-right to top-left diagonal in bottom half
                ctx.fillRect(i, mid + i, 1, 1);
            }
            break;

        case 'satin':
            // Smooth pattern with fewer intersections
            ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
            for (let i = 0; i < size; i += 4) {
                ctx.fillRect(i, 0, 1, size);
            }
            for (let i = 0; i < size; i += 4) {
                ctx.fillRect(0, i, size, 1);
            }
            break;
    }

    // Create a pattern from the canvas
    return new fabric.Pattern({
        source: patternCanvas,
        repeat: 'repeat'
    });
}

/**
 * Set up event listeners for the Fabric.js canvas
 */
function setupEventListeners() {
    if (!canvas) return;

    // First, find or create the editor tools container
    editorTools = document.querySelector('.editor-tools');
    if (!editorTools) {
        editorTools = document.createElement('div');
        editorTools.className = 'editor-tools';

        // Create a tools title
        const toolsTitle = document.createElement('h3');
        toolsTitle.className = 'editor-section-title';
        toolsTitle.innerHTML = '<i class="fas fa-paint-brush"></i> Drawing Tools';

        // Add to fabric controls
        const fabricControls = document.querySelector('.fabric-controls');
        if (fabricControls) {
            fabricControls.appendChild(toolsTitle);
            fabricControls.appendChild(editorTools);
        } else {
            // If fabric-controls doesn't exist, create it
            const fabricCanvasWrapper = document.querySelector('.fabric-canvas-wrapper');
            if (fabricCanvasWrapper) {
                const controls = document.createElement('div');
                controls.className = 'fabric-controls';
                controls.appendChild(toolsTitle);
                controls.appendChild(editorTools);
                fabricCanvasWrapper.parentNode.appendChild(controls);
            } else {
                // Last resort: append to body
                document.body.appendChild(editorTools);
                console.warn('Could not find proper parent for editor tools, appending to body');
            }
        }
    }

    // Enable direct manipulation of objects with throttling
    canvas.on('object:modified', function (e) {
        // Update state whenever object properties change (position, scale, rotation)
        console.log('Object modified, applying to shirt texture');

        // Apply changes to the shirt in real-time for better UX, but throttled
        applyDesignToShirt(false); // Not forced, will be throttled
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
        addText('Edit this text');
    });

    // Image upload button
    let imageBtn = document.getElementById('add-image');
    if (!imageBtn) {
        imageBtn = document.createElement('button');
        imageBtn.id = 'add-image';
        imageBtn.className = 'tool-btn';
        imageBtn.innerHTML = '<i class="fas fa-image"></i> Image';
        imageBtn.title = 'Add image (Click to browse, drop to upload, or paste from clipboard)';
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
                addShape(shape);
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

    // Create a fabric properties section title
    const fabricTitle = document.createElement('h3');
    fabricTitle.className = 'editor-section-title';
    fabricTitle.innerHTML = '<i class="fas fa-tshirt"></i> Fabric Properties';

    // Add fabric type and texture selectors in a new section
    const fabricSection = document.createElement('div');
    fabricSection.className = 'control-group fabric-properties';

    // Add the fabric section after the tools
    const fabricControls = document.querySelector('.fabric-controls');
    if (fabricControls) {
        fabricControls.appendChild(fabricTitle);
        fabricControls.appendChild(fabricSection);
    }

    // Create and add fabric type selector
    addFabricTypeSelector(fabricSection);

    // Create and add texture style selector
    addTextureStyleSelector(fabricSection);

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
        fabricControls.appendChild(applyBtn);
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
 * Utility function to delay execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Add fabric type selector to the UI
 * @param {HTMLElement} container - The container to add the selector to
 */
function addFabricTypeSelector(container = document.querySelector('.fabric-controls')) {
    // Create the fabric type selector container
    const fabricTypeContainer = document.createElement('div');
    fabricTypeContainer.className = 'fabric-type-container';
    fabricTypeContainer.innerHTML = `
        <label for="fabric-type-select">Fabric Type:</label>
        <select id="fabric-type-select" class="fabric-select">
            <option value="cotton">Cotton</option>
            <option value="polyester">Polyester</option>
            <option value="silk">Silk</option>
            <option value="wool">Wool</option>
        </select>
    `;

    // Add to the specified container
    container.appendChild(fabricTypeContainer);

    // Add event listener for fabric type changes
    document.getElementById('fabric-type-select').addEventListener('change', (e) => {
        selectedFabricType = e.target.value;
        applyFabricPattern();
    });
}

/**
 * Add texture style selector to the UI
 * @param {HTMLElement} container - The container to add the selector to
 */
function addTextureStyleSelector(container = document.querySelector('.fabric-controls')) {
    // Create the texture style selector container
    const textureStyleContainer = document.createElement('div');
    textureStyleContainer.className = 'texture-style-container';
    textureStyleContainer.innerHTML = `
        <label for="texture-style-select">Weave Pattern:</label>
        <select id="texture-style-select" class="fabric-select">
            <option value="plain">Plain</option>
            <option value="canvas">Canvas</option>
            <option value="twill">Twill</option>
            <option value="herringbone">Herringbone</option>
            <option value="satin">Satin</option>
        </select>
    `;

    // Add to the specified container
    container.appendChild(textureStyleContainer);

    // Add event listener for texture style changes
    document.getElementById('texture-style-select').addEventListener('change', (e) => {
        selectedTextureStyle = e.target.value;
        applyFabricPattern();
    });
}

/**
 * Apply the selected fabric pattern to the background
 */
function applyFabricPattern() {
    if (!canvas) return;

    // Get the background rectangle (first object in canvas)
    const background = canvas.getObjects()[0];
    if (!background) return;

    // Get the pattern for the selected texture style
    const pattern = FABRIC_PATTERNS[selectedTextureStyle];

    // Apply the pattern to the background
    if (pattern) {
        background.set('fill', pattern);
    } else {
        background.set('fill', 'rgba(255, 255, 255, 1)');
    }

    // Update the background color based on the selected color
    // This is a simplified version; in a real implementation, you would
    // blend the pattern with the color more seamlessly
    canvas.renderAll();
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
    const textObj = new fabric.IText(text, {
        left: canvas.width / 2,
        top: canvas.height / 2,
        fontFamily: selectedFontFamily,
        fontSize: selectedFontSize,
        fill: selectedColor,
        originX: 'center',
        originY: 'center',
        centeredRotation: true
    });

    canvas.add(textObj);
    canvas.setActiveObject(textObj);

    // Explicitly apply text to the shirt texture
    applyDesignToShirt();
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
 * @param {boolean} force - Force update even if throttled
 */
export function applyDesignToShirt(force = false) {
    try {
        // Throttle updates to prevent performance issues
        const now = Date.now();
        if (!force && now - lastUpdateTime < UPDATE_THROTTLE) {
            // If an update is already pending, don't schedule another one
            if (!pendingUpdate) {
                pendingUpdate = true;
                setTimeout(() => {
                    pendingUpdate = false;
                    applyDesignToShirt(true); // Force update after delay
                }, UPDATE_THROTTLE - (now - lastUpdateTime));
            }
            return;
        }

        lastUpdateTime = now;

        // Get the canvas element
        const fabricCanvas = window.fabricCanvas || canvas;
        if (!fabricCanvas) {
            console.error("Fabric canvas not initialized");
            return;
        }

        // Add a visual indicator that updates are being applied
        showApplyingIndicator(true);

        // Lower the output resolution when many objects are on the canvas
        const objectCount = fabricCanvas.getObjects().length;
        let targetResolution = 1024;

        // Scale down resolution for complex scenes
        if (objectCount > 50) {
            targetResolution = 512;
        } else if (objectCount > 20) {
            targetResolution = 768;
        }

        // Apply perspective transformation for more realistic mapping
        const perspectiveOptions = {
            perspectiveX: 0.05,  // Slight horizontal perspective for realism
            perspectiveY: 0.1,   // Vertical perspective for chest curvature
            rotation: 0,          // No rotation by default
            stretchX: 1,         // No horizontal stretching
            stretchY: 1,         // No vertical stretching
            targetWidth: targetResolution,
            targetHeight: targetResolution
        };

        // Transform the fabric canvas to 3D with proper perspective
        let transformedTexture;
        try {
            transformedTexture = transformFabricCanvasTo3D(
                fabricCanvas.lowerCanvasEl,
                perspectiveOptions
            );
        } catch (error) {
            console.error("Error transforming canvas:", error);
            // Fallback to using the canvas directly without transformation
            transformedTexture = new THREE.CanvasTexture(fabricCanvas.lowerCanvasEl);
            transformedTexture.needsUpdate = true;
        }

        // Convert the texture to a data URL
        let designImage;
        try {
            designImage = transformedTexture.image.toDataURL('image/png');
        } catch (error) {
            console.error("Error converting texture to data URL:", error);
            // Fallback to using the canvas directly
            designImage = fabricCanvas.lowerCanvasEl.toDataURL('image/png');
        }

        // Import texture-mapper functions
        import('./texture-mapper.js').then((textureMapper) => {
            const currentView = textureMapper.getCurrentView ?
                textureMapper.getCurrentView() : 'front';

            // Apply design to the current view using the texture mapper
            textureMapper.loadCustomImage(designImage, currentView);

            console.log(`Applied design to ${currentView} view using texture mapper`);
            showNotification('Design applied to ' + currentView + ' view', 'success');

            // Hide the applying indicator
            showApplyingIndicator(false);
        }).catch(error => {
            console.error("Error importing texture mapper:", error);

            // Fallback to the old method if texture mapper import fails
            updateShirtTexture(designImage, 'full');
            showNotification('Design applied using fallback method', 'info');

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
        // Calculate optimal canvas size based on image dimensions
        const imgWidth = tempImg.width;
        const imgHeight = tempImg.height;

        // Set a reasonable max size for the editor
        const maxWidth = 650;
        const maxHeight = 650;

        // Calculate the optimal canvas size (maintain aspect ratio)
        let canvasWidth, canvasHeight;

        if (imgWidth > imgHeight) {
            // Landscape image
            canvasWidth = Math.min(imgWidth, maxWidth);
            canvasHeight = Math.round((imgHeight / imgWidth) * canvasWidth);
        } else {
            // Portrait or square image
            canvasHeight = Math.min(imgHeight, maxHeight);
            canvasWidth = Math.round((imgWidth / imgHeight) * canvasHeight);
        }

        // Ensure minimum dimensions
        canvasWidth = Math.max(canvasWidth, 400);
        canvasHeight = Math.max(canvasHeight, 400);

        // Initialize the canvas with the calculated dimensions
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
        }

        // Add an editing title to the fabric controls
        const editorContainer = document.querySelector('.fabric-controls');
        if (editorContainer) {
            // Remove any existing title
            const existingTitle = document.querySelector('.ai-edit-title');
            if (existingTitle) {
                existingTitle.remove();
            }

            // Add a prominent title for the AI editing mode
            const aiEditTitle = document.createElement('div');
            aiEditTitle.className = 'ai-edit-title';
            aiEditTitle.innerHTML = `
                <h2><i class="fas fa-magic"></i> Edit AI Generated Image</h2>
                <p>Customize your AI design using the tools below.</p>
            `;

            // Insert at the beginning of the container
            editorContainer.insertBefore(aiEditTitle, editorContainer.firstChild);

            // Add styles for the title if not already in the document
            if (!document.querySelector('style#ai-edit-styles')) {
                const styleElement = document.createElement('style');
                styleElement.id = 'ai-edit-styles';
                styleElement.textContent = `
                    .ai-edit-title {
                        text-align: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid var(--primary-color-light);
                    }
                    
                    .ai-edit-title h2 {
                        color: var(--primary-color);
                        margin: 0 0 10px 0;
                        font-size: 1.5rem;
                    }
                    
                    .ai-edit-title p {
                        color: var(--text-secondary);
                        margin: 0;
                        font-size: 0.95rem;
                    }
                    
                    .ai-edit-actions {
                        display: flex;
                        justify-content: center;
                        margin-top: 20px;
                        padding-top: 20px;
                        border-top: 2px solid var(--primary-color-light);
                    }
                `;
                document.head.appendChild(styleElement);
            }

            // Remove any existing finish button
            const existingFinishButton = document.getElementById('finish-ai-edit');
            if (existingFinishButton) {
                existingFinishButton.remove();
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
    if (!canvas) return;

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

/**
 * Set the selected color with advanced fabric color calculation
 * @param {string} color - The color to set
 */
export function setColor(color) {
    // Store the original color
    const originalColor = color;
    selectedColor = color;

    // Calculate fabric-specific color adjustment
    const threeColor = new THREE.Color(color);
    const adjustedColor = calculateFabricColor(
        threeColor,
        selectedFabricType,
        { weathered: 0, wet: 0, lighting: 'neutral' }
    );

    // Convert the adjusted color back to hex
    const adjustedHex = '#' + adjustedColor.getHexString();

    // Use the adjusted color for drawing
    canvas.freeDrawingBrush.color = adjustedHex;

    // Update selected object if any
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        if (activeObject.type === 'i-text') {
            activeObject.set('fill', adjustedHex);
        } else {
            activeObject.set('fill', adjustedHex);
        }
        canvas.renderAll();
    }
}

/**
 * Set fabric type
 * @param {string} fabricType - The fabric type to set
 */
export function setFabricType(fabricType) {
    if (FABRIC_PROPERTIES[fabricType]) {
        selectedFabricType = fabricType;

        // Update the UI selector
        const selector = document.getElementById('fabric-type-select');
        if (selector) {
            selector.value = fabricType;
        }

        // Apply the fabric pattern
        applyFabricPattern();
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

        fabric.Image.fromURL(imgData, function (img) {
            // Calculate scaling to fit the canvas while maintaining aspect ratio
            const scaleFactor = Math.min(
                (canvas.width * 0.6) / img.width,
                (canvas.height * 0.6) / img.height
            );

            // Apply scaling
            img.scale(scaleFactor);

            // Center the image
            img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                cornerSize: 8,
                borderColor: 'rgba(0, 0, 0, 0.2)',
                cornerColor: 'rgba(0, 0, 0, 0.2)',
                transparentCorners: false
            });

            // Add to canvas
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();

            // Show success notification
            showNotification('Image added to design', 'success');

            // Apply to shirt
            applyDesignToShirt();
        });
    };

    reader.readAsDataURL(file);
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
        pasteHint.style.fontSize = '0.8rem';
        pasteHint.style.color = 'var(--text-secondary, #777)';
        pasteHint.style.padding = '5px 0';
        pasteHint.style.textAlign = 'center';
        pasteHint.style.marginTop = '10px';

        fabricControls.appendChild(pasteHint);
    }
}

// Initialize and set up window resize listener
window.addEventListener('load', () => {
    initFabricCanvas();
    updateCanvasSize();

    window.addEventListener('resize', () => {
        updateCanvasSize();
    });
}); 