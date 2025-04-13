/**
 * Enhanced Color Picker System - v1.0
 * Provides centralized color management for the 3D clothes editor
 */
(function() {
    // Configuration
    const config = {
        debug: true,
        colorPickerSelector: '.text-edit-colors',
        defaultColor: '#000000',
        storageKey: 'lastTextColor',
        initDelay: 500,
        checkInterval: 300
    };
    
    // State management
    let state = {
        initialized: false,
        textPanelOpen: false,
        lastAppliedColor: null,
        colorPickerContainer: null,
        pendingTimeout: null,
        lastColorSection: null
    };
    
    // Initialize when DOM is ready
    window.addEventListener('DOMContentLoaded', function() {
        log('Color Picker Fix loaded');
        
        // Initialize with short delay to ensure DOM is fully ready
        setTimeout(init, config.initDelay);
        
        // Setup interval check to ensure color picker is always available
        setInterval(checkForColorSections, config.checkInterval);
    });
    
    /**
     * Initialize the color picker system
     */
    function init() {
        // Clean up any existing implementations
        cleanupExistingImplementations();
        
        // Setup global event listeners for panel opening
        setupGlobalEventListeners();
        
        // Try to initialize right away if panels already exist
        initializeColorPicker();
        
        log('Color Picker Fix initialization complete');
    }
    
    /**
     * Remove any existing color picker implementations to prevent duplicates
     */
    function cleanupExistingImplementations() {
        // Remove simplified-color-selector elements
        document.querySelectorAll('.simplified-color-selector').forEach(el => {
            el.remove();
            log('Removed existing color selector');
        });
        
        // Clean existing color sections
        document.querySelectorAll(config.colorPickerSelector).forEach(section => {
            // Save reference to last section
            state.lastColorSection = section;
            
            // Remove existing color options
            section.querySelectorAll('.color-circle, .color-option, .color-btn').forEach(el => el.remove());
            
            // Clear innerHTML to ensure clean slate
            section.innerHTML = '';
        });
    }
    
    /**
     * Setup global event listeners to detect panels opening
     */
    function setupGlobalEventListeners() {
        // Listen for clicks on text editing buttons
        document.addEventListener('click', function(e) {
            if (e.target.closest('.btn-text, #text-upload-btn, .text-btn, .edit-text-btn')) {
                log('Text edit button clicked, scheduling initialization');
                state.textPanelOpen = true;
                
                // Reset and schedule new initialization
                state.initialized = false;
                if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
                state.pendingTimeout = setTimeout(initializeColorPicker, config.initDelay);
            }
        });
        
        // Setup mutation observer to detect DOM changes
        const observer = new MutationObserver(function(mutations) {
            if (!document.querySelector('.simplified-color-selector') && state.textPanelOpen) {
                log('DOM changed, color picker missing - reinitializing');
                state.initialized = false;
                
                if (state.pendingTimeout) clearTimeout(state.pendingTimeout);
                state.pendingTimeout = setTimeout(initializeColorPicker, 200);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    /**
     * Check for color sections and initialize if found
     */
    function checkForColorSections() {
        if (state.initialized) return;
        
        const colorSections = document.querySelectorAll(config.colorPickerSelector);
        if (colorSections.length > 0) {
            log('Found color sections during interval check');
            initializeColorPicker();
        }
    }
    
    /**
     * Initialize the color picker UI in appropriate sections
     */
    function initializeColorPicker() {
        // Don't initialize twice
        if (state.initialized) return;
        
        // Find color edit sections
        const colorSections = document.querySelectorAll(config.colorPickerSelector);
        
        if (colorSections.length === 0) {
            log('No color sections found, will retry later');
            return;
        }
        
        // Clean up any existing implementations first
        cleanupExistingImplementations();
        
        // Get the first section (or use last known section if current ones were removed)
        let section = colorSections[0] || state.lastColorSection;
        
        if (!section) {
            log('No valid section found');
            return;
        }
        
        // Create the color picker UI
        createColorPickerUI(section);
        
        // Mark as initialized
        state.initialized = true;
        log('Color picker initialized successfully');
        
        // Restore the last used color
        restoreLastUsedColor();
    }
    
    /**
     * Create the color picker UI within a section
     */
    function createColorPickerUI(section) {
        // Create container
        const container = document.createElement('div');
        container.className = 'simplified-color-selector';
        
        // Add black and white color options
        const colors = [
            { color: '#000000', name: 'Black' },
            { color: '#FFFFFF', name: 'White' }
        ];
        
        // Create color circles
        colors.forEach(colorInfo => {
            const circle = document.createElement('div');
            circle.className = 'color-option';
            circle.setAttribute('data-color', colorInfo.color);
            circle.setAttribute('title', colorInfo.name);
            circle.style.backgroundColor = colorInfo.color;
            
            // Add border for white
            if (colorInfo.color === '#FFFFFF') {
                circle.style.border = '1px solid #ddd';
            }
            
            // Add click handler
            circle.addEventListener('click', function() {
                applyColorToModel(colorInfo.color);
                highlightActiveColor(circle);
            });
            
            container.appendChild(circle);
        });
        
        // Create custom color picker
        const customPicker = createCustomColorPicker();
        container.appendChild(customPicker);
        
        // Save reference to container
        state.colorPickerContainer = container;
        
        // Add to section
        section.appendChild(container);
    }
    
    /**
     * Create the custom color picker button with color input
     */
    function createCustomColorPicker() {
        const customPicker = document.createElement('div');
        customPicker.className = 'color-option custom-color-option';
        
        // Add color indicator
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'selected-color-indicator';
        colorIndicator.style.backgroundColor = getLastUsedColor();
        customPicker.appendChild(colorIndicator);
        
        // Create color input
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'hidden-color-picker';
        colorInput.value = getLastUsedColor();
        
        // Add input handler
        colorInput.addEventListener('input', function(e) {
            const color = e.target.value;
            applyColorToModel(color);
            colorIndicator.style.backgroundColor = color;
            highlightActiveColor(customPicker);
        });
        
        // Add click handler
        customPicker.addEventListener('click', function() {
            colorInput.click();
        });
        
        customPicker.appendChild(colorInput);
        return customPicker;
    }
    
    /**
     * Apply selected color to text and 3D model if applicable
     */
    function applyColorToModel(color) {
        // Save color for future use
        localStorage.setItem(config.storageKey, color);
        state.lastAppliedColor = color;
        
        // Find and apply to text input
        const textInput = document.querySelector('.text-edit-input');
        if (textInput) {
            textInput.style.color = color;
            log('Applied color ' + color + ' to text input');
        }
        
        // Update 3D text color if available in scene
        if (typeof window.updateTextColor === 'function') {
            try {
                window.updateTextColor(color);
                log('Updated 3D text color');
            } catch (e) {
                log('Error updating 3D text color: ' + e.message, 'warn');
            }
        } else if (typeof window.updateActiveTextColor === 'function') {
            try {
                window.updateActiveTextColor(color);
                log('Updated active 3D text color');
            } catch (e) {
                log('Error updating active 3D text color: ' + e.message, 'warn');
            }
        }
    }
    
    /**
     * Highlight the active color option
     */
    function highlightActiveColor(activeElement) {
        if (!state.colorPickerContainer) return;
        
        // Remove active class from all options
        state.colorPickerContainer.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // Add active class to selected option
        activeElement.classList.add('active');
    }
    
    /**
     * Get the last used color from storage or default
     */
    function getLastUsedColor() {
        return localStorage.getItem(config.storageKey) || config.defaultColor;
    }
    
    /**
     * Restore the last used color for consistency
     */
    function restoreLastUsedColor() {
        const lastColor = getLastUsedColor();
        
        // Apply to model
        applyColorToModel(lastColor);
        
        // Highlight correct option
        if (state.colorPickerContainer) {
            const colorOption = state.colorPickerContainer.querySelector(`[data-color="${lastColor}"]`);
            
            if (colorOption) {
                highlightActiveColor(colorOption);
            } else {
                // If custom color, highlight the custom picker
                const customPicker = state.colorPickerContainer.querySelector('.custom-color-option');
                if (customPicker) {
                    highlightActiveColor(customPicker);
                    
                    // Update indicator
                    const indicator = customPicker.querySelector('.selected-color-indicator');
                    if (indicator) {
                        indicator.style.backgroundColor = lastColor;
                    }
                }
            }
        }
    }
    
    /**
     * Logging helper with prefix
     */
    function log(message, type = 'log') {
        if (!config.debug && type === 'log') return;
        
        const prefix = '[ColorPickerFix] ';
        if (type === 'warn') {
            console.warn(prefix + message);
        } else if (type === 'error') {
            console.error(prefix + message);
        } else {
            console.log(prefix + message);
        }
    }
    
    // Expose global methods for external access
    window.ColorPickerFix = {
        reinitialize: function() {
            state.initialized = false;
            initializeColorPicker();
            return "Color picker re-initialized";
        },
        applyColor: function(color) {
            applyColorToModel(color);
            return "Color applied: " + color;
        },
        getState: function() {
            return {...state};
        }
    };
})(); 