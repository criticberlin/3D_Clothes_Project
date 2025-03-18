/**
 * Color Manager Module
 * Handles the color wheel and color selection functionality
 */
import { updateShirtColor } from './scene.js';
import { updateState } from './state.js';

// Color name mapping
const COLOR_NAMES = {
    '#FFFFFF': 'White',
    '#000000': 'Black',
    '#4A4A4A': 'Charcoal',
    '#162955': 'Navy Blue',
    '#E1C699': 'Beige',
    '#556B2F': 'Olive Green',
    '#654321': 'Brown',
    '#800020': 'Burgundy'
};

// Variables
let colorWheel;
let colorNameElement;
let colorHexElement;
let activeColor = '#FFFFFF';
let colorButtons;
let isDrawing = false;

/**
 * Initialize the color wheel and color selection
 */
export function initColorManager() {
    console.log('Initializing Color Manager');
    
    // Get elements
    colorWheel = document.getElementById('color-wheel');
    colorNameElement = document.getElementById('color-name');
    colorHexElement = document.getElementById('color-hex');
    colorButtons = document.querySelectorAll('.color-btn');
    
    if (!colorWheel || !colorNameElement || !colorHexElement) {
        console.error('Required color elements not found');
        return;
    }
    
    // Initialize color wheel
    initColorWheel();
    
    // Initialize preset color buttons
    initColorButtons();
    
    // Set initial color
    setActiveColor('#FFFFFF');
}

/**
 * Initialize the color wheel canvas
 */
function initColorWheel() {
    const ctx = colorWheel.getContext('2d');
    const centerX = colorWheel.width / 2;
    const centerY = colorWheel.height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    
    // Draw color wheel
    drawColorWheel(ctx, centerX, centerY, radius);
    
    // Add event listeners for color selection
    colorWheel.addEventListener('mousedown', startColorSelection);
    colorWheel.addEventListener('mousemove', moveColorSelection);
    colorWheel.addEventListener('mouseup', endColorSelection);
    colorWheel.addEventListener('mouseleave', endColorSelection);
    
    // Touch support
    colorWheel.addEventListener('touchstart', handleTouchStart);
    colorWheel.addEventListener('touchmove', handleTouchMove);
    colorWheel.addEventListener('touchend', handleTouchEnd);
    colorWheel.addEventListener('touchcancel', handleTouchEnd);
}

/**
 * Draw the color wheel on canvas
 */
function drawColorWheel(ctx, centerX, centerY, radius) {
    // Create gradient
    for (let angle = 0; angle < 360; angle += 0.1) {
        const startAngle = (angle - 0.1) * (Math.PI / 180);
        const endAngle = angle * (Math.PI / 180);
        
        for (let r = 0; r < radius; r++) {
            const hue = angle;
            const saturation = r / radius;
            const lightness = 0.5;
            
            // Convert HSL to RGB
            ctx.fillStyle = `hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, startAngle, endAngle, false);
            ctx.lineTo(centerX, centerY);
            ctx.fill();
        }
    }
    
    // Draw white circle in center
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.1, 0, Math.PI * 2, false);
    ctx.fill();
}

/**
 * Start color selection on mouse down
 */
function startColorSelection(e) {
    isDrawing = true;
    selectColorFromWheel(e);
}

/**
 * Continue color selection on mouse move
 */
function moveColorSelection(e) {
    if (isDrawing) {
        selectColorFromWheel(e);
    }
}

/**
 * End color selection on mouse up
 */
function endColorSelection() {
    isDrawing = false;
}

/**
 * Handle touch start event
 */
function handleTouchStart(e) {
    e.preventDefault();
    isDrawing = true;
    selectColorFromWheel(e.touches[0]);
}

/**
 * Handle touch move event
 */
function handleTouchMove(e) {
    if (isDrawing) {
        e.preventDefault();
        selectColorFromWheel(e.touches[0]);
    }
}

/**
 * Handle touch end event
 */
function handleTouchEnd() {
    isDrawing = false;
}

/**
 * Select color from the wheel based on position
 */
function selectColorFromWheel(e) {
    const rect = colorWheel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = colorWheel.getContext('2d');
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];
    
    const hexColor = rgbToHex(r, g, b);
    setActiveColor(hexColor);
}

/**
 * Initialize preset color buttons
 */
function initColorButtons() {
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            const color = button.getAttribute('data-color');
            setActiveColor(color, true);
        });
    });
}

/**
 * Set the active color
 * @param {string} color - The hex color code
 * @param {boolean} isPreset - Whether the color is a preset
 */
function setActiveColor(color, isPreset = false) {
    console.log(`Setting active color to: ${color}, isPreset: ${isPreset}`);
    
    // Set active color
    activeColor = color;
    
    // Update UI
    updateColorInfo(color);
    
    // Update active button state if it's a preset
    if (isPreset) {
        colorButtons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-color') === color);
        });
    } else {
        // Deactivate all preset buttons if it's not a preset
        colorButtons.forEach(button => {
            button.classList.remove('active');
        });
    }
    
    // Apply color to the shirt using both methods for reliability
    console.log(`Calling updateShirtColor with color: ${color}`);
    updateShirtColor(color);
    
    // Also use the direct force method if available
    if (window.forceShirtColor) {
        console.log(`Using force method with color: ${color}`);
        window.forceShirtColor(color);
    }
}

/**
 * Update the color information in UI
 */
function updateColorInfo(color) {
    // Update hex display
    colorHexElement.textContent = color;
    
    // Update color name (if known)
    const colorName = COLOR_NAMES[color.toUpperCase()] || getClosestColorName(color);
    colorNameElement.textContent = colorName;
}

/**
 * Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Get the closest known color name for a hex color
 */
function getClosestColorName(hexColor) {
    // Convert to RGB for comparison
    const r1 = parseInt(hexColor.substring(1, 3), 16);
    const g1 = parseInt(hexColor.substring(3, 5), 16);
    const b1 = parseInt(hexColor.substring(5, 7), 16);
    
    let closestColor = '';
    let minDistance = Number.MAX_VALUE;
    
    // Compare with known colors
    for (const [knownHex, name] of Object.entries(COLOR_NAMES)) {
        const r2 = parseInt(knownHex.substring(1, 3), 16);
        const g2 = parseInt(knownHex.substring(3, 5), 16);
        const b2 = parseInt(knownHex.substring(5, 7), 16);
        
        // Calculate color distance using Euclidean distance
        const distance = Math.sqrt(
            Math.pow(r1 - r2, 2) + 
            Math.pow(g1 - g2, 2) + 
            Math.pow(b1 - b2, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = name;
        }
    }
    
    // If it's too far from any known color, just call it "Custom"
    return minDistance < 50 ? closestColor : 'Custom Color';
}

// Export the set active color function for external use
export function setColor(color) {
    setActiveColor(color, false);
} 