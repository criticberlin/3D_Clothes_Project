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
    const width = colorWheel.width;
    const height = colorWheel.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Create a circular color wheel gradient
    const gradient = createColorWheelGradient(ctx, centerX, centerY, radius);
    
    // Draw the circular color wheel
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Create a white center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.15, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    
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
 * Create a color wheel gradient
 */
function createColorWheelGradient(ctx, centerX, centerY, radius) {
    // We'll create a conical gradient by using multiple radial gradients
    // for each hue section
    
    // First, draw a white-to-transparent radial gradient as a base
    ctx.save();
    const baseGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
    );
    baseGradient.addColorStop(0, 'white');
    baseGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = baseGradient;
    ctx.fill();
    ctx.restore();
    
    // Create a conical gradient by drawing color segments
    for (let angle = 0; angle < 360; angle += 1) {
        const startAngle = (angle - 0.5) * (Math.PI / 180);
        const endAngle = (angle + 0.5) * (Math.PI / 180);
        
        // Get the color for this angle
        const hue = angle;
        const color = `hsl(${hue}, 100%, 50%)`;
        
        // Draw a segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fill();
    }
    
    ctx.globalCompositeOperation = 'source-over';
    
    // Return a base gradient for compatibility with the function caller
    return baseGradient;
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
    
    // Get the pixel color at the clicked position
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];
    
    // Calculate the brightness and saturation based on RGB values
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // If the color is too dark or too light (close to white/black), skip it
    if (max < 20 || (max > 235 && min > 235)) {
        return;
    }
    
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
}

/**
 * Update the color information in UI
 */
function updateColorInfo(color) {
    // Update hex display
    colorHexElement.textContent = color;
    
    // Update color name (if known)
    const colorName = COLOR_NAMES[color.toUpperCase()] || 'Custom Color';
    colorNameElement.textContent = colorName;
}

/**
 * Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Public method to set color from external components
 */
export function setColor(color) {
    setActiveColor(color);
} 