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
 */
export function initFabricCanvas() {
    // Create canvas instance
    canvas = new fabric.Canvas('fabric-canvas', {
        backgroundColor: 'rgba(255, 255, 255, 0.0)',
        preserveObjectStacking: true,
        width: 300,
        height: 300,
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
 * Set up event listeners for Fabric.js tools
 */
function setupEventListeners() {
    // Text button
    document.getElementById('add-text').addEventListener('click', () => {
        setMode('text');
        addText('Edit this text');
    });

    // Shape button
    document.getElementById('add-shape').addEventListener('click', () => {
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
        const shapeButton = document.getElementById('add-shape');
        shapeButton.parentNode.appendChild(shapeMenu);

        // Add event listeners for shape buttons
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shape = e.target.dataset.shape;
                addShape(shape);
                shapeMenu.remove();
            });
        });
    });

    // Free drawing button
    document.getElementById('draw-free').addEventListener('click', () => {
        setMode('draw');
        canvas.isDrawingMode = true;
    });

    // Create and add fabric type selector
    addFabricTypeSelector();

    // Create and add texture style selector
    addTextureStyleSelector();

    // Apply to shirt button
    document.getElementById('apply-to-shirt').addEventListener('click', () => {
        applyDesignToShirt();
    });
}

/**
 * Add fabric type selector to the UI
 */
function addFabricTypeSelector() {
    // Create the fabric type selector container
    const fabricTypeContainer = document.createElement('div');
    fabricTypeContainer.className = 'fabric-type-container control-group';
    fabricTypeContainer.innerHTML = `
        <label for="fabric-type-select">Fabric Type:</label>
        <select id="fabric-type-select" class="fabric-select">
            <option value="cotton">Cotton</option>
            <option value="polyester">Polyester</option>
            <option value="silk">Silk</option>
            <option value="wool">Wool</option>
        </select>
    `;

    // Add to the fabric controls
    const fabricControls = document.querySelector('.fabric-controls');
    fabricControls.appendChild(fabricTypeContainer);

    // Add event listener for fabric type changes
    document.getElementById('fabric-type-select').addEventListener('change', (e) => {
        selectedFabricType = e.target.value;
        applyFabricPattern();
    });
}

/**
 * Add texture style selector to the UI
 */
function addTextureStyleSelector() {
    // Create the texture style selector container
    const textureStyleContainer = document.createElement('div');
    textureStyleContainer.className = 'texture-style-container control-group';
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

    // Add to the fabric controls
    const fabricControls = document.querySelector('.fabric-controls');
    fabricControls.appendChild(textureStyleContainer);

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
    }
}

/**
 * Apply the current design to the 3D shirt
 */
function applyDesignToShirt() {
    try {
        // Get the canvas element
        const canvas = window.fabricCanvas;
        if (!canvas) {
            console.error("Fabric canvas not initialized");
            return;
        }

        // Apply perspective transformation for more realistic mapping
        const perspectiveOptions = {
            perspectiveX: 0.05,  // Slight horizontal perspective for realism
            perspectiveY: 0.1,   // Vertical perspective for chest curvature
            rotation: 0,          // No rotation by default
            stretchX: 1,         // No horizontal stretching
            stretchY: 1,         // No vertical stretching
            targetWidth: 1024,   // High resolution output
            targetHeight: 1024
        };

        // Transform the fabric canvas to 3D with proper perspective
        let transformedTexture;
        try {
            transformedTexture = transformFabricCanvasTo3D(
                canvas.lowerCanvasEl,
                perspectiveOptions
            );
        } catch (error) {
            console.error("Error transforming canvas:", error);
            // Fallback to using the canvas directly without transformation
            transformedTexture = new THREE.CanvasTexture(canvas.lowerCanvasEl);
            transformedTexture.needsUpdate = true;
        }

        // Convert the texture to a data URL
        let designImage;
        try {
            designImage = transformedTexture.image.toDataURL('image/png');
        } catch (error) {
            console.error("Error converting texture to data URL:", error);
            // Fallback to using the canvas directly
            designImage = canvas.lowerCanvasEl.toDataURL('image/png');
        }

        // Apply as full texture to the t-shirt
        updateShirtTexture(designImage, 'full');

        // Show success message
        showNotification('Design applied successfully!', 'success');
    } catch (error) {
        console.error("Failed to apply design to shirt:", error);
        showNotification('Failed to apply design. Please try again.', 'error');
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
 * Clear the canvas
 */
export function clearCanvas() {
    canvas.getObjects().forEach(obj => {
        if (obj !== canvas.getObjects()[0]) { // Keep the background
            canvas.remove(obj);
        }
    });
    canvas.renderAll();
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
 * Update canvas background color based on theme
 */
function updateCanvasBackgroundForTheme() {
    const isDarkMode = document.documentElement.classList.contains('dark-theme') ||
        !document.documentElement.classList.contains('light-theme');

    const fabricContainer = document.querySelector('.canvas-container');
    if (fabricContainer) {
        fabricContainer.style.backgroundColor = isDarkMode ? '#222222' : '#ffffff';
    }

    // Also listen for theme changes
    window.addEventListener('theme-changed', (e) => {
        const isDarkMode = e.detail && e.detail.darkMode !== false;
        if (fabricContainer) {
            fabricContainer.style.backgroundColor = isDarkMode ? '#222222' : '#ffffff';
        }
    });
}

// Initialize and set up window resize listener
window.addEventListener('load', () => {
    initFabricCanvas();
    updateCanvasSize();

    window.addEventListener('resize', () => {
        updateCanvasSize();
    });
}); 