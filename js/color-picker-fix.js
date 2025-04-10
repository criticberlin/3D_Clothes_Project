// Completely revised color picker implementation with better deduplication and cleanup
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Color picker fix loading - Version 2.0');
    
    // Configuration options
    const CONFIG = {
        MARKER: 'color-picker-v2-processed',
        DEFAULT_COLOR: '#ff0000',
        DEBUG: true,
        Z_INDEX: 99999,
        INIT_DELAY: 100,
        CLEANUP_INTERVAL: 1000 // Check and clean up every second
    };
    
    // Debug logging helper
    function log(...args) {
        if (CONFIG.DEBUG) console.log('🎨', ...args);
    }
    
    // Error logging helper
    function logError(...args) {
        console.error('❌', ...args);
    }
    
    // Ensure we have a color in localStorage
    function ensureStoredColor() {
        if (!localStorage.getItem('lastTextColor')) {
            localStorage.setItem('lastTextColor', CONFIG.DEFAULT_COLOR);
            log('Set default color in localStorage:', CONFIG.DEFAULT_COLOR);
        } else {
            log('Found existing color in localStorage:', localStorage.getItem('lastTextColor'));
        }
        return localStorage.getItem('lastTextColor') || CONFIG.DEFAULT_COLOR;
    }
    
    // Apply color to the 3D model or text element
    function applyColorToModel(color) {
        if (!color || typeof color !== 'string' || color === 'undefined' || color === 'null') {
            logError('Invalid color provided:', color);
            color = ensureStoredColor();
        }
        
        log('Applying color:', color);
        localStorage.setItem('lastTextColor', color);
        
        try {
            // 1. Apply to activeTextElement if it exists
            if (window.activeTextElement) {
                log('Found activeTextElement, applying color');
                window.activeTextElement.color = color;
                
                if (window.activeTextElement.fillColor !== undefined) {
                    window.activeTextElement.fillColor = color;
                }
                if (window.activeTextElement.textColor !== undefined) {
                    window.activeTextElement.textColor = color;
                }
            }
            
            // 2. Apply to DOM text elements
            document.querySelectorAll('[data-text], .text, .text-element, [data-type="text"], .canvas-text').forEach(el => {
                el.style.color = color;
            });
            
            // 3. Apply to 3D scene text objects
            if (window.scene) {
                log('Searching 3D scene for text objects');
                window.scene.traverse(object => {
                    // Check for text object
                    if ((object.type === "Mesh" || object.type === "Object3D" || object.type === "Group") && 
                       (object.userData.type === "text" || 
                        object.userData.isText ||
                        object.isText ||
                        (object.name && object.name.toLowerCase().includes("text")))) {
                        
                        // Apply to material
                        if (object.material) {
                            if (Array.isArray(object.material)) {
                                object.material.forEach(mat => {
                                    if (mat && mat.color) {
                                        mat.color.set(color);
                                        mat.needsUpdate = true;
                                    }
                                });
                            } else if (object.material.color) {
                                object.material.color.set(color);
                                object.material.needsUpdate = true;
                            }
                        }
                        
                        // Apply to direct color properties
                        ['color', 'textColor', 'fillColor', 'fontColor'].forEach(prop => {
                            if (object[prop]) {
                                if (typeof object[prop] === 'object' && object[prop].set) {
                                    object[prop].set(color);
                                } else {
                                    object[prop] = color;
                                }
                            }
                        });
                        
                        // Check children
                        if (object.children && object.children.length > 0) {
                            object.children.forEach(child => {
                                if (child.material && child.material.color) {
                                    child.material.color.set(color);
                                    child.material.needsUpdate = true;
                                }
                            });
                        }
                    }
                });
                
                // Render update
                if (window.renderer && window.camera) {
                    window.renderer.render(window.scene, window.camera);
                }
            }
            
            // 4. Try global text objects
            ['textObject', 'textMesh', 'activeText', 'currentText', 'designText', 
             'canvasText', 'tshirtText', 'textElement'].forEach(objName => {
                if (window[objName]) {
                    if (window[objName].color) {
                        if (typeof window[objName].color === 'object' && window[objName].color.set) {
                            window[objName].color.set(color);
                        } else {
                            window[objName].color = color;
                        }
                    }
                    
                    if (window[objName].material) {
                        if (Array.isArray(window[objName].material)) {
                            window[objName].material.forEach(m => {
                                if (m && m.color) {
                                    m.color.set(color);
                                    m.needsUpdate = true;
                                }
                            });
                        } else if (window[objName].material.color) {
                            window[objName].material.color.set(color);
                            window[objName].material.needsUpdate = true;
                        }
                    }
                }
            });
            
            // 5. Dispatch events
            const colorEvent = new CustomEvent('textColorChanged', {
                detail: { color: color },
                bubbles: true
            });
            document.dispatchEvent(colorEvent);
            
            // Also try other event names
            document.dispatchEvent(new CustomEvent('colorChanged', { 
                detail: { color: color }, bubbles: true 
            }));
            
            // 6. Call update functions
            if (window.updateText) window.updateText({ color: color });
            if (window.updateTextColor) window.updateTextColor(color);
            if (window.updateColor) window.updateColor(color);
            if (window.updateActiveText) window.updateActiveText({ color: color });
            if (window.setColor) window.setColor(color);
            if (window.applyColor) window.applyColor(color);
            if (window.updateScene) window.updateScene();
            if (window.renderScene) window.renderScene();
            if (window.refreshCanvas) window.refreshCanvas();
            
            // 7. Try framework-specific model access
            if (window.designer && window.designer.text) {
                if (typeof window.designer.text.setColor === 'function') {
                    window.designer.text.setColor(color);
                }
            }
            
            if (window.editor && window.editor.text) {
                if (typeof window.editor.text.updateColor === 'function') {
                    window.editor.text.updateColor(color);
                }
            }
            
            // 8. Canvas objects
            if (window.canvas && window.canvas.getObjects) {
                window.canvas.getObjects().forEach(obj => {
                    if (obj.isText || obj.type === 'text' || obj.type === 'i-text') {
                        obj.set('fill', color);
                    }
                });
                if (window.canvas.renderAll) window.canvas.renderAll();
            }
            
            log('Color application complete');
        } catch (err) {
            logError('Error applying color:', err);
        }
    }
    
    // Create the CSS styles for our color picker
    function createStyles() {
        // Remove any existing styles
        document.querySelectorAll('style[data-color-picker-styles]').forEach(el => el.remove());
        
        const style = document.createElement('style');
        style.setAttribute('data-color-picker-styles', 'v2');
        style.textContent = `
            /* Force hide all default color pickers */
            .text-edit-colors .color-row,
            .text-edit-colors .color-options-wrapper,
            .text-edit-colors .color-palette,
            .text-edit-colors .color-picker-wrapper,
            .text-edit-colors .custom-color-picker,
            .text-edit-colors > div:not(.color-picker-v2) {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                pointer-events: none !important;
                position: absolute !important;
                z-index: -1 !important;
            }
            
            /* Our new color picker */
            .color-picker-v2 {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 12px !important;
                padding: 12px !important;
                background: transparent !important;
                position: relative !important;
                z-index: ${CONFIG.Z_INDEX} !important;
                box-sizing: border-box !important;
                width: 100% !important;
            }
            
            .color-picker-v2 * {
                box-sizing: border-box !important;
            }
            
            .color-circle {
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                cursor: pointer !important;
                transition: transform 0.2s, box-shadow 0.2s !important;
                position: relative !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${CONFIG.Z_INDEX + 1} !important;
            }
            
            .color-circle:hover {
                transform: scale(1.1) !important;
            }
            
            .color-circle.active {
                box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3a86ff !important;
                z-index: ${CONFIG.Z_INDEX + 2} !important;
            }
            
            .color-circle-black {
                background-color: #000 !important;
            }
            
            .color-circle-white {
                background-color: #fff !important;
                border-color: rgba(0, 0, 0, 0.1) !important;
            }
            
            .color-circle-custom {
                background-color: var(--saved-color, ${ensureStoredColor()}) !important;
                border-color: rgba(0, 0, 0, 0.1) !important;
            }
            
            .color-picker-button {
                width: 36px !important;
                height: 36px !important;
                border-radius: 50% !important;
                background: rgba(255, 255, 255, 0.1) !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
                cursor: pointer !important;
                position: relative !important;
                overflow: hidden !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: ${CONFIG.Z_INDEX + 1} !important;
            }
            
            .color-picker-button:hover {
                background: rgba(255, 255, 255, 0.2) !important;
                transform: scale(1.1) !important;
            }
            
            .color-picker-button i {
                color: rgba(255, 255, 255, 0.8) !important;
                font-size: 16px !important;
            }
            
            .color-picker-button input[type="color"] {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                opacity: 0 !important;
                cursor: pointer !important;
                z-index: ${CONFIG.Z_INDEX + 2} !important;
            }
        `;
        
        // Insert at the beginning of head for highest priority
        document.head.insertBefore(style, document.head.firstChild);
        log('Styles injected with high priority');
    }
    
    // Completely remove any existing color picker implementations
    function cleanupImplementations() {
        // Remove our previous implementation
        document.querySelectorAll('.color-picker-v2, .simplified-color-selector').forEach(el => {
            log('Removing existing picker:', el.className);
            el.remove();
        });
        
        // Remove any markers from color sections
        document.querySelectorAll(`[data-${CONFIG.MARKER}]`).forEach(el => {
            el.removeAttribute(`data-${CONFIG.MARKER}`);
        });
        
        // Find and hide competing implementations
        document.querySelectorAll('.color-row, .color-options-wrapper, .color-palette, .color-option:not(.color-circle)').forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        });
        
        log('Cleanup complete');
    }
    
    // Create the color picker UI in the specified container
    function createColorPicker(container) {
        if (!container) {
            logError('No container provided for color picker');
            return;
        }
        
        // Skip if already processed
        if (container.hasAttribute(`data-${CONFIG.MARKER}`)) {
            return;
        }
        
        log('Creating color picker in:', container);
        
        // Mark as processed
        container.setAttribute(`data-${CONFIG.MARKER}`, 'true');
        
        // Clear the container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        // Get the saved color
        const savedColor = ensureStoredColor();
        
        // Create the wrapper
        const picker = document.createElement('div');
        picker.className = 'color-picker-v2';
        picker.id = 'color-picker-' + Date.now();
        
        // Create black circle
        const blackCircle = document.createElement('div');
        blackCircle.className = 'color-circle color-circle-black';
        blackCircle.setAttribute('data-color', '#000000');
        
        // Create white circle
        const whiteCircle = document.createElement('div');
        whiteCircle.className = 'color-circle color-circle-white';
        whiteCircle.setAttribute('data-color', '#ffffff');
        
        // Create custom color circle
        const customCircle = document.createElement('div');
        customCircle.className = 'color-circle color-circle-custom';
        customCircle.setAttribute('data-color', savedColor);
        customCircle.style.setProperty('--saved-color', savedColor);
        
        // Create color picker button
        const pickerButton = document.createElement('div');
        pickerButton.className = 'color-picker-button';
        
        // Add icon to picker button
        const icon = document.createElement('i');
        icon.className = 'fas fa-palette';
        pickerButton.appendChild(icon);
        
        // Create color input
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = savedColor;
        pickerButton.appendChild(colorInput);
        
        // Add all elements to the wrapper
        picker.appendChild(blackCircle);
        picker.appendChild(whiteCircle);
        picker.appendChild(customCircle);
        picker.appendChild(pickerButton);
        
        // Add the wrapper to the container
        container.appendChild(picker);
        
        // Set initial active state
        if (savedColor === '#000000') {
            blackCircle.classList.add('active');
        } else if (savedColor === '#ffffff') {
            whiteCircle.classList.add('active');
        } else {
            customCircle.classList.add('active');
        }
        
        // Add event listeners
        blackCircle.addEventListener('click', function() {
            setActiveColor('#000000', [blackCircle, whiteCircle, customCircle]);
        });
        
        whiteCircle.addEventListener('click', function() {
            setActiveColor('#ffffff', [blackCircle, whiteCircle, customCircle]);
        });
        
        customCircle.addEventListener('click', function() {
            const customColor = customCircle.getAttribute('data-color');
            setActiveColor(customColor, [blackCircle, whiteCircle, customCircle]);
        });
        
        colorInput.addEventListener('input', function(e) {
            const selectedColor = e.target.value;
            
            // Update the custom circle
            customCircle.style.setProperty('--saved-color', selectedColor);
            customCircle.setAttribute('data-color', selectedColor);
            
            // Set as active
            setActiveColor(selectedColor, [blackCircle, whiteCircle, customCircle]);
        });
        
        pickerButton.addEventListener('click', function() {
            colorInput.click();
        });
        
        log('Color picker created with ID:', picker.id);
    }
    
    // Set the active color and apply it
    function setActiveColor(color, circles) {
        if (!color) return;
        
        // Remove active class from all circles
        circles.forEach(circle => circle.classList.remove('active'));
        
        // Find the matching circle and activate it
        for (const circle of circles) {
            if (circle.getAttribute('data-color') === color) {
                circle.classList.add('active');
                break;
            }
        }
        
        // If color is custom, always activate the custom circle
        if (color !== '#000000' && color !== '#ffffff') {
            circles.find(c => c.classList.contains('color-circle-custom'))?.classList.add('active');
        }
        
        // Apply the color
        applyColorToModel(color);
    }
    
    // Set up DOM change observers
    function setupObservers() {
        // Disconnect any existing observers
        if (window.colorPickerObserver) {
            window.colorPickerObserver.disconnect();
            window.colorPickerObserver = null;
        }
        
        log('Setting up DOM observers');
        
        // Use a more aggressive approach to find text edit panels as they open
        // Search for common panel classes
        const checkForPanels = () => {
            const panels = document.querySelectorAll('.text-edit-panel, .color-edit-panel, .text-panel, .edit-panel, [data-role="text-editor"]');
            if (panels.length > 0) {
                log('Found text panels:', panels.length);
                
                // Look for color sections
                panels.forEach(panel => {
                    const colorSections = panel.querySelectorAll('.text-edit-colors, .color-section, .color-picker, .color-options');
                    if (colorSections.length > 0) {
                        log('Found color sections in panel:', colorSections.length);
                        setTimeout(initializeColorPicker, 10);
                    }
                });
                
                // Also initialize directly
                setTimeout(initializeColorPicker, 50);
            }
        };
        
        // Check for panels immediately
        checkForPanels();
        
        // And periodically
        setInterval(checkForPanels, 1000);
        
        // Create a new observer for DOM changes
        const observer = new MutationObserver(function(mutations) {
            let shouldInitialize = false;
            
            for (const mutation of mutations) {
                // Check for added nodes
                if (mutation.addedNodes.length) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue; // Skip non-element nodes
                        
                        // Look for any elements that might be panels or contain our target elements
                        if (node.classList) {
                            const classString = Array.from(node.classList).join(' ').toLowerCase();
                            if (classString.includes('panel') || classString.includes('text') || 
                                classString.includes('edit') || classString.includes('color')) {
                                log('Detected potential panel/color element:', node);
                                shouldInitialize = true;
                            }
                        }
                        
                        // Check if this is a color edit section
                        if (node.classList && (
                            node.classList.contains('text-edit-colors') || 
                            node.classList.contains('color-section') ||
                            node.classList.contains('color-picker') ||
                            node.classList.contains('color-editor'))) {
                            shouldInitialize = true;
                            break;
                        }
                        
                        // Check if this contains color edit sections - expanded selector
                        if (node.querySelectorAll) {
                            const colorSections = node.querySelectorAll('.text-edit-colors, .color-section, .color-picker, .color-options, [data-role="color-picker"]');
                            if (colorSections.length > 0) {
                                shouldInitialize = true;
                                break;
                            }
                        }
                    }
                }
                
                // Check for attribute changes that might reveal panels
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    
                    if (!target.classList) continue;
                    
                    // Expanded class list check
                    const classList = Array.from(target.classList);
                    const hasRelevantClass = classList.some(cls => 
                        cls.includes('panel') || cls.includes('text') || 
                        cls.includes('edit') || cls.includes('color')
                    );
                    
                    if (hasRelevantClass) {
                        const style = window.getComputedStyle(target);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            log('Panel-like element became visible:', target);
                            shouldInitialize = true;
                        }
                    }
                }
            }
            
            if (shouldInitialize) {
                log('DOM changes detected, initializing color picker');
                setTimeout(initializeColorPicker, CONFIG.INIT_DELAY);
            }
        });
        
        // Start observing the document
        observer.observe(document.body, {
            childList: true, 
            subtree: true,
            attributes: true, 
            attributeFilter: ['style', 'class', 'display', 'visibility']
        });
        
        window.colorPickerObserver = observer;
        log('DOM observer started');
    }
    
    // Initialize and create the color picker - with broader selector
    function initializeColorPicker() {
        log('Initializing color picker');
        
        // Create styles first to override any existing styles
        createStyles();
        
        // Clean up existing implementations
        cleanupImplementations();
        
        // Find all color edit sections - use expanded selector
        const colorSections = document.querySelectorAll(
            '.text-edit-colors, .color-section, .color-options, .color-picker, ' +
            '[data-role="color-picker"], [class*="color-edit"], [class*="text-color"]'
        );
        log('Found color sections:', colorSections.length);
        
        if (colorSections.length === 0) {
            // Try a more aggressive approach - look for any container that might be a color section
            log('No color sections found with standard selectors, trying fallback selectors');
            
            // Try to find by context - panels that might contain color options
            const textPanels = document.querySelectorAll('.text-edit-panel, .edit-panel, .text-panel, [data-panel="text"]');
            let foundSections = false;
            
            textPanels.forEach(panel => {
                // Look for potential color containers in this panel
                const colorContainers = panel.querySelectorAll('div[class*="color"], div[class*="palette"], div[id*="color"]');
                
                if (colorContainers.length > 0) {
                    log('Found potential color containers in panel:', colorContainers.length);
                    
                    // Try to create color picker in each potential container
                    colorContainers.forEach(container => {
                        if (!container.querySelector('.color-picker-v2')) {
                            createColorPicker(container);
                            foundSections = true;
                        }
                    });
                }
            });
            
            if (!foundSections) {
                // As a last resort, try to find the main text edit section and inject there
                const mainTextEdit = document.querySelector('#text-edit-panel, .text-edit-panel, .text-panel');
                if (mainTextEdit) {
                    log('Found main text edit panel, creating color picker there');
                    
                    // Create a container if needed
                    let colorContainer = mainTextEdit.querySelector('.color-container, .color-section');
                    if (!colorContainer) {
                        colorContainer = document.createElement('div');
                        colorContainer.className = 'color-section';
                        mainTextEdit.appendChild(colorContainer);
                    }
                    
                    createColorPicker(colorContainer);
                    foundSections = true;
                }
            }
            
            if (!foundSections) {
                log('No color sections found, will try again later');
                return false;
            }
        } else {
            // Create color picker in each section
            colorSections.forEach(section => createColorPicker(section));
        }
        
        // Apply the current color
        const currentColor = ensureStoredColor();
        setTimeout(() => applyColorToModel(currentColor), 50);
        
        return true;
    }
    
    // Set up event listeners with more trigger points
    function setupEventListeners() {
        // Listen for panel openings - expanded selector
        const triggerSelectors = [
            '.floating-btn', '#text-upload-btn', '.text-panel-toggle', 
            '[data-target="text-edit-panel"]', '.text-edit-button', '.edit-text-btn',
            '.text-tool', '.text-editor-btn', 'button[class*="text"]', '[data-action="edit-text"]',
            '.add-text', '.edit-text', '#add-text-btn', '#text-tool', '.text-button'
        ].join(',');
        
        log('Setting up click listeners for selectors:', triggerSelectors);
        
        document.addEventListener('click', function(e) {
            // Check for clicks on text-related buttons
            const target = e.target.closest(triggerSelectors);
            if (target) {
                log('Text panel trigger clicked:', target);
                // First try immediately
                initializeColorPicker();
                // Then with delays to catch panel transitions
                setTimeout(initializeColorPicker, 100);
                setTimeout(initializeColorPicker, 300);
                setTimeout(initializeColorPicker, 800);
            }
            
            // Also check if any click was inside a panel
            const isInPanel = e.target.closest('.panel, .text-panel, .edit-panel, .text-edit-panel');
            if (isInPanel) {
                log('Click detected inside a panel');
                setTimeout(initializeColorPicker, 100);
            }
        });
        
        // Listen for keyup events on document - common for opening UI panels
        document.addEventListener('keyup', function(e) {
            // "T" key is often used for text tools
            if (e.key === 't' || e.key === 'T') {
                log('T key pressed, checking for panels');
                setTimeout(initializeColorPicker, 300);
            }
        });
        
        // Force initialization on load and when page becomes visible
        window.addEventListener('pageshow', initializeColorPicker);
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                log('Page became visible, initializing color picker');
                initializeColorPicker();
            }
        });
        
        // Add direct initialization methods to window
        window.applyTextColor = applyColorToModel;
        window.initializeColorPicker = initializeColorPicker;
        window.forceColorPicker = function() {
            cleanupImplementations();
            return initializeColorPicker();
        };
        
        log('Event listeners set up');
    }
    
    // Periodic cleanup to prevent duplicates
    function startCleanupInterval() {
        const checkAndCleanup = () => {
            const pickers = document.querySelectorAll('.color-picker-v2');
            if (pickers.length > 1) {
                log('Multiple pickers detected, cleaning up');
                cleanupImplementations();
                initializeColorPicker();
            }
        };
        
        // Run the first check soon
        setTimeout(checkAndCleanup, CONFIG.INIT_DELAY * 2);
        
        // Set up interval for continuous checking
        setInterval(checkAndCleanup, CONFIG.CLEANUP_INTERVAL);
        
        log('Cleanup interval started');
    }
    
    // Main initialization function
    function init() {
        log('Starting initialization');
        
        // Increase debugging for troubleshooting
        CONFIG.DEBUG = true;
        
        // Ensure we have a default color
        ensureStoredColor();
        
        // Set up styles
        createStyles();
        
        // Set up observers
        setupObservers();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize now and after a delay
        initializeColorPicker();
        
        // Try multiple times to catch delayed loading
        setTimeout(initializeColorPicker, 100);
        setTimeout(initializeColorPicker, 500);
        setTimeout(initializeColorPicker, 1000);
        setTimeout(initializeColorPicker, 2000);
        
        // Start the cleanup interval
        startCleanupInterval();
        
        // Also initialize on load
        window.addEventListener('load', function() {
            log('Window loaded, initializing color picker');
            initializeColorPicker();
            setTimeout(initializeColorPicker, 500);
        });
        
        // Create global force initialize function
        window.forceInitColorPicker = function() {
            log('Force initializing color picker');
            cleanupImplementations();
            return initializeColorPicker();
        };
        
        // Add console command for easy debugging
        console.log('Color picker fix loaded. Type forceColorPicker() in console to manually initialize.');
        
        log('Initialization complete');
    }
    
    // Start the initialization
    init();
}); 