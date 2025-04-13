// Simplified color picker functionality - Version 2.0
document.addEventListener('DOMContentLoaded', function() {
    console.log('✨ Simple color picker v2.0 loaded');
    
    // Track initialization state
    let initialized = false;
    let mutationObserver = null;
    let lastTimeout = null;
    
    /**
     * Main entry point - sets up the color picker
     */
    function setupColorPicker() {
        // Prevent multiple initializations
        if (initialized) return;
        
        // Find color sections
        const colorSections = document.querySelectorAll('.text-edit-colors');
        if (!colorSections.length) return;
        
        // Clean up any existing color pickers first
        cleanupExistingColorPickers();
        
        // Process the first section
        const section = colorSections[0];
        if (section.querySelector('.simplified-color-selector')) return;
        
        // Create the new color picker UI
        createColorPickerUI(section);
        
        // Mark as initialized
        initialized = true;
        console.log('✅ Color picker initialized successfully');
    }
    
    /**
     * Remove any existing color pickers to prevent duplicates
     */
    function cleanupExistingColorPickers() {
        // Remove any existing color circles
        document.querySelectorAll('.simplified-color-selector').forEach(el => el.remove());
        
        // Clean up any orphaned listeners
        document.querySelectorAll('.text-edit-colors').forEach(section => {
            // Remove old color options if they exist
            section.querySelectorAll('.color-circle, .color-option, .color-btn').forEach(el => el.remove());
            // Clear the section
            section.innerHTML = '';
        });
    }
    
    /**
     * Create the color picker UI components
     */
    function createColorPickerUI(section) {
        // Create container
        const container = document.createElement('div');
        container.className = 'simplified-color-selector';
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.gap = '15px';
        container.style.padding = '10px';
        
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
                applyColorToText(colorInfo.color);
                highlightActiveColor(container, circle);
            });
            
            container.appendChild(circle);
        });
        
        // Create custom color picker
        const customPicker = createCustomColorPicker(container);
        container.appendChild(customPicker);
        
        // Add to section
        section.appendChild(container);
        
        // Set black as active by default
        const blackCircle = container.querySelector('[data-color="#000000"]');
        if (blackCircle) {
            highlightActiveColor(container, blackCircle);
            applyColorToText('#000000');
        }
    }
    
    /**
     * Create the custom color picker button with color input
     */
    function createCustomColorPicker(container) {
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
            applyColorToText(color);
            colorIndicator.style.backgroundColor = color;
            highlightActiveColor(container, customPicker);
        });
        
        // Add click handler
        customPicker.addEventListener('click', function() {
            colorInput.click();
        });
        
        customPicker.appendChild(colorInput);
        return customPicker;
    }
    
    /**
     * Apply selected color to text input
     */
    function applyColorToText(color) {
        // Save color for future use
        localStorage.setItem('lastTextColor', color);
        
        // Find and apply to text input
        const textInput = document.querySelector('.text-edit-input');
        if (textInput) {
            textInput.style.color = color;
            console.log(`Applied color ${color} to text input`);
        }
        
        // Update 3D text color if available in scene
        updateTextColor3D(color);
    }
    
    /**
     * Update text color in 3D scene if applicable
     */
    function updateTextColor3D(color) {
        // Check if window.updateTextColor exists (from 3d-editor.js)
        if (typeof window.updateActiveTextColor === 'function') {
            try {
                window.updateActiveTextColor(color);
                console.log('Updated 3D text color');
            } catch (e) {
                console.warn('Could not update 3D text color:', e);
            }
        }
    }
    
    /**
     * Highlight the active color option
     */
    function highlightActiveColor(container, activeElement) {
        // Remove active class from all options
        container.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        
        // Add active class to selected option
        activeElement.classList.add('active');
    }
    
    /**
     * Get the last used color from storage or default
     */
    function getLastUsedColor() {
        return localStorage.getItem('lastTextColor') || '#000000';
    }
    
    /**
     * Set up a mutation observer to detect new text panels
     */
    function setupObserver() {
        if (mutationObserver) {
            mutationObserver.disconnect();
        }
        
        mutationObserver = new MutationObserver(function(mutations) {
            // Reset initialization when DOM changes
            if (!document.querySelector('.simplified-color-selector')) {
                initialized = false;
                
                // Debounce to prevent multiple rapid initializations
                if (lastTimeout) clearTimeout(lastTimeout);
                lastTimeout = setTimeout(setupColorPicker, 300);
            }
        });
        
        mutationObserver.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
    
    // Initialize with delay
    setTimeout(setupColorPicker, 500);
    
    // Setup when text panel opens
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-text, #text-upload-btn, .text-btn, .edit-text-btn')) {
            // Reset for new panel
            initialized = false;
            setTimeout(setupColorPicker, 500);
        }
    });
    
    // Set up observer
    setupObserver();
    
    // Provide global access for debugging
    window.reinitializeColorPicker = function() {
        initialized = false;
        setupColorPicker();
        return "Color picker reinitialized";
    };
});
