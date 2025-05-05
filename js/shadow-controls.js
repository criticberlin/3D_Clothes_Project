// Shadow controls - modern implementation
console.log("Loading modern shadow-controls.js");

// Create direct toggle function immediately without waiting for DOM content
window.directToggleShadowOptions = function() {
    console.log("Toggle shadow options called");
    
    // Find the text panel - could be either the static #text-panel or dynamically created #text-edit-panel
    let textPanel = document.getElementById('text-edit-panel');
    if (!textPanel) {
        textPanel = document.getElementById('text-panel');
    }
    
    if (!textPanel) {
        console.error("No text panel found (neither text-panel nor text-edit-panel)");
        return;
    }
    
    // Find the content area in the text panel where we'll add the shadow options
    const textPanelContent = textPanel.querySelector('.panel-content') || textPanel.querySelector('.text-edit-options');
    if (!textPanelContent) {
        console.error("Text panel content area not found");
        return;
    }
    
    // Get panel theme - check if parent has light-theme class
    const isLightTheme = document.documentElement.classList.contains('light-theme');
    const themeColors = {
        background: isLightTheme ? '#ffffff' : '#1e1e1e',
        backgroundSecondary: isLightTheme ? '#f5f5f5' : '#2d2d2d',
        text: isLightTheme ? '#333' : '#e6e6e6',
        textSecondary: isLightTheme ? '#666' : '#aaa',
        border: isLightTheme ? '#e0e0e0' : '#444',
        primaryColor: isLightTheme ? '#4361ee' : '#4361ee',
        primaryLight: isLightTheme ? '#eef1ff' : '#2e3b81',
        accentColor: isLightTheme ? '#00b4d8' : '#00b4d8'
    };
    
    // Check if shadow options container already exists in the text panel
    let shadowContainer = textPanel.querySelector('.shadow-container-wrapper');
    
    // Get the current text from the text panel's input if available
    let currentText = "Sample";
    const textInput = textPanel.querySelector('.text-edit-input');
    if (textInput && textInput.value.trim()) {
        currentText = textInput.value.trim();
        // Limit to first 15 characters if longer
        if (currentText.length > 15) {
            currentText = currentText.substring(0, 15) + "...";
        }
    }
    
    if (!shadowContainer) {
        console.log("Creating new shadow options container for", textPanel.id);
        
        // Create a container wrapper for the shadow options
        shadowContainer = document.createElement('div');
        shadowContainer.className = 'shadow-container-wrapper';
        shadowContainer.style.position = 'relative';
        shadowContainer.style.width = '100%';
        shadowContainer.style.marginTop = '10px';
        shadowContainer.style.display = 'none';
        
        // Create shadow options container
        const shadowOptions = document.createElement('div');
        shadowOptions.id = 'shadow-options-container';
        shadowOptions.className = 'shadow-options-container';
        shadowOptions.style.width = '100%';
        shadowOptions.innerHTML = `
            <div class="shadow-options-header">
                <div class="shadow-header-title">Text Shadow</div>
                <button class="close-shadow-options" aria-label="Close shadow options">×</button>
            </div>
            
            <div class="shadow-preview-large" id="shadow-large-preview">
                <span>${currentText}</span>
            </div>
            
            <div class="shadow-presets">
                <div class="shadow-preset-row">
                    <div class="shadow-preset" data-preset="none">None</div>
                    <div class="shadow-preset" data-preset="subtle">Subtle</div>
                    <div class="shadow-preset" data-preset="medium">Medium</div>
                </div>
                <div class="shadow-preset-row">
                    <div class="shadow-preset" data-preset="strong">Strong</div>
                    <div class="shadow-preset" data-preset="glow">Glow</div>
                    <div class="shadow-preset" data-preset="outline">Outline</div>
                </div>
            </div>
            
            <div class="shadow-controls">
                <div class="shadow-control-row">
                    <label>Color</label>
                    <input type="color" id="shadow-color" value="#000000">
                </div>
                
                <div class="shadow-control-row">
                    <label>Blur</label>
                    <input type="range" id="shadow-blur" min="0" max="20" value="5">
                </div>
                
                <div class="shadow-control-row">
                    <label>X Offset</label>
                    <input type="range" id="shadow-offset-x" min="-10" max="10" value="2">
                </div>
                
                <div class="shadow-control-row">
                    <label>Y Offset</label>
                    <input type="range" id="shadow-offset-y" min="-10" max="10" value="2">
                </div>
            </div>
            
            <div class="shadow-actions">
                <button id="reset-shadow-btn">Reset</button>
                <button id="apply-shadow-btn">Apply</button>
            </div>
        `;
        
        // Add the shadow options to the shadow container
        shadowContainer.appendChild(shadowOptions);
        
        // Add styles for shadow options
        const style = document.createElement('style');
        style.textContent = `
            .shadow-container-wrapper {
                padding: 0;
                margin-bottom: 15px;
            }
            
            .shadow-options-container {
                background: ${themeColors.background};
                border-radius: 8px;
                padding: 15px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                border: 1px solid ${themeColors.border};
                color: ${themeColors.text};
            }
            
            .shadow-options-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .shadow-header-title {
                font-size: 16px;
                font-weight: 600;
                color: ${themeColors.text};
            }
            
            .close-shadow-options {
                background: none;
                border: none;
                cursor: pointer;
                color: ${themeColors.textSecondary};
                font-size: 18px;
                line-height: 1;
                padding: 5px;
            }
            
            .close-shadow-options:hover {
                color: ${themeColors.text};
            }
            
            .shadow-preview-large {
                margin-bottom: 15px;
                padding: 20px;
                text-align: center;
                background: ${isLightTheme ? 
                    'linear-gradient(to bottom, #f8f9fa, #e9ecef)' : 
                    'linear-gradient(to bottom, #232323, #1a1a1a)'};
                border-radius: 6px;
                border: 1px solid ${themeColors.border};
            }
            
            .shadow-preview-large span {
                font-size: 24px;
                font-weight: 600;
            }
            
            .shadow-presets {
                margin-bottom: 15px;
            }
            
            .shadow-preset-row {
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .shadow-preset {
                flex: 1;
                padding: 8px;
                text-align: center;
                background: ${isLightTheme ? '#f5f5f5' : '#2d2d2d'};
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                border: 1px solid ${themeColors.border};
                transition: all 0.2s;
            }
            
            .shadow-preset:hover {
                background: ${isLightTheme ? '#e9e9e9' : '#333333'};
            }
            
            .shadow-preset.active {
                background: ${themeColors.primaryColor};
                color: white;
                border-color: ${themeColors.primaryColor};
            }
            
            .shadow-controls {
                margin-bottom: 15px;
            }
            
            .shadow-control-row {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .shadow-control-row label {
                width: 80px;
                font-size: 14px;
                color: ${themeColors.text};
            }
            
            .shadow-control-row input[type="range"] {
                flex: 1;
                height: 5px;
                border-radius: 2px;
                background: ${isLightTheme ? '#e9ecef' : '#333'};
            }
            
            .shadow-control-row input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: ${themeColors.primaryColor};
                cursor: pointer;
                border: none;
            }
            
            .shadow-control-row input[type="color"] {
                width: 30px;
                height: 30px;
                border: 1px solid ${themeColors.border};
                padding: 0;
                background: none;
                cursor: pointer;
                border-radius: 4px;
            }
            
            .shadow-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            
            .shadow-actions button {
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                border: 1px solid ${themeColors.border};
            }
            
            #reset-shadow-btn {
                background: none;
                color: ${themeColors.textSecondary};
            }
            
            #apply-shadow-btn {
                background: ${themeColors.primaryColor};
                color: white;
                border-color: ${themeColors.primaryColor};
            }
            
            /* Shadow preset styles */
            .shadow-preset[data-preset="subtle"] {
                text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            }
            
            .shadow-preset[data-preset="medium"] {
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            
            .shadow-preset[data-preset="strong"] {
                text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
            }
            
            .shadow-preset[data-preset="glow"] {
                text-shadow: 0 0 8px rgba(66, 133, 244, 0.8);
                color: white;
            }
            
            .shadow-preset[data-preset="outline"] {
                -webkit-text-stroke: 1px #000;
                color: transparent;
            }
        `;
        
        document.head.appendChild(style);
        
        // Find the text-edit-buttons container to insert shadow panel before it
        const textEditButtons = textPanelContent.querySelector('.text-edit-buttons');
        
        if (textEditButtons) {
            // Insert before the buttons container for better UI flow
            textPanelContent.insertBefore(shadowContainer, textEditButtons);
        } else {
            // Fallback: append to the text panel content if buttons container not found
        textPanelContent.appendChild(shadowContainer);
        }
        
        // Shadow presets configuration
        const shadowPresets = {
            none: {
                type: 'none',
                color: '#000000',
                blur: 0,
                offsetX: 0,
                offsetY: 0,
                spread: 0,
                opacity: 100
            },
            subtle: {
                type: 'subtle',
                color: '#000000',
                blur: 3,
                offsetX: 1,
                offsetY: 1,
                spread: 0,
                opacity: 25
            },
            medium: {
                type: 'medium',
                color: '#000000',
                blur: 5,
                offsetX: 2,
                offsetY: 2,
                spread: 0,
                opacity: 35
            },
            strong: {
                type: 'strong',
                color: '#000000',
                blur: 8,
                offsetX: 3,
                offsetY: 3,
                spread: 0,
                opacity: 50
            },
            glow: {
                type: 'glow',
                color: '#4285f4',
                blur: 12,
                offsetX: 0,
                offsetY: 0,
                spread: 0,
                opacity: 80
            },
            neon: {
                type: 'neon',
                color: '#00b4d8',
                blur: 15,
                offsetX: 0,
                offsetY: 0,
                spread: 2,
                opacity: 100
            },
            outline: {
                type: 'outline',
                color: '#000000',
                blur: 0,
                offsetX: 0,
                offsetY: 0,
                spread: 1.5,
                opacity: 100
            },
            '3d': {
                type: 'drop',
                color: '#333333',
                blur: 0,
                offsetX: 3,
                offsetY: 3,
                angle: 135,
                distance: 4,
                spread: 0,
                opacity: 70
            },
            custom: {
                type: 'drop',
                color: '#4361ee',
                blur: 5,
                offsetX: 2,
                offsetY: 2,
                angle: 135,
                distance: 3,
                spread: 0,
                opacity: 60
            }
        };
        
        // Load custom shadow from localStorage if available
        try {
            const savedCustomShadow = localStorage.getItem('customShadowPreset');
            if (savedCustomShadow) {
                shadowPresets.custom = JSON.parse(savedCustomShadow);
            }
        } catch (e) {
            console.error('Error loading custom shadow preset:', e);
        }
        
        // Function to update the preview based on current settings
        function updatePreview() {
            const preview = shadowOptions.querySelector('#shadow-large-preview span');
            const color = shadowOptions.querySelector('#shadow-color').value;
            const blur = shadowOptions.querySelector('#shadow-blur').value;
            const offsetX = shadowOptions.querySelector('#shadow-offset-x').value;
            const offsetY = shadowOptions.querySelector('#shadow-offset-y').value;
            
            // Reset styles
            preview.style.textShadow = 'none';
            preview.style.webkitTextStroke = 'none';
            preview.style.color = themeColors.text;
            
            // Get active preset if any
            const activePreset = shadowOptions.querySelector('.shadow-preset.active');
            const presetName = activePreset?.getAttribute('data-preset');
            
            if (presetName === 'outline') {
                preview.style.webkitTextStroke = `1px ${color}`;
                preview.style.color = 'transparent';
            } else if (presetName === 'none') {
                // Do nothing - already reset
            } else {
                // Default: apply drop shadow
                preview.style.textShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`;
            }
        }
        
        // Handle close button
        const closeBtn = shadowOptions.querySelector('.close-shadow-options');
        closeBtn.addEventListener('click', function() {
            shadowContainer.style.display = 'none';
        });
        
        // Handle preset selection
        const presetItems = shadowOptions.querySelectorAll('.shadow-preset');
        presetItems.forEach(preset => {
            preset.addEventListener('click', function() {
                const presetName = this.getAttribute('data-preset');
                
                // Remove active class from all presets
                presetItems.forEach(p => p.classList.remove('active'));
                
                // Add active class to selected preset
                this.classList.add('active');
                
                // Apply the preset
                if (presetName && shadowPresets[presetName]) {
                    const preset = shadowPresets[presetName];
                    
                    // Update the controls with preset values
                    shadowOptions.querySelector('#shadow-color').value = preset.color;
                    shadowOptions.querySelector('#shadow-blur').value = preset.blur;
                    shadowOptions.querySelector('#shadow-offset-x').value = preset.offsetX;
                    shadowOptions.querySelector('#shadow-offset-y').value = preset.offsetY;
                    
                    // Update the preview
                    updatePreview();
                }
            });
        });
        
        // Handle range & color inputs
        const inputs = shadowOptions.querySelectorAll('input[type="range"], input[type="color"]');
        inputs.forEach(input => {
            input.addEventListener('input', updatePreview);
        });
    
    // Handle apply button
        const applyBtn = shadowOptions.querySelector('#apply-shadow-btn');
        applyBtn.addEventListener('click', function() {
            const color = shadowOptions.querySelector('#shadow-color').value;
            const blur = parseInt(shadowOptions.querySelector('#shadow-blur').value);
            const offsetX = parseInt(shadowOptions.querySelector('#shadow-offset-x').value);
            const offsetY = parseInt(shadowOptions.querySelector('#shadow-offset-y').value);
            
            // Get active preset
            const activePreset = shadowOptions.querySelector('.shadow-preset.active');
            const presetName = activePreset?.getAttribute('data-preset');
            
            if (window.activeTextElement) {
                console.log("Applying shadow settings to text object...");
                
                // Update the shadow properties on the active text element
                window.activeTextElement.shadow = presetName !== 'none'; // Enable shadow if not 'none'
                
                // Calculate angle and distance from X and Y offsets for more natural 3D control
                const distance = Math.sqrt(offsetX*offsetX + offsetY*offsetY);
                const angle = Math.atan2(offsetY, offsetX) * 180 / Math.PI;
                
                // Create shadow configuration based on the selected preset
                window.activeTextElement.shadowConfig = {
                    type: presetName,
                    color: color,
                    blur: blur,
                    distance: distance,
                    angle: angle,
                    offsetX: offsetX,  // Keep original offsets for backward compatibility
                    offsetY: offsetY,  // Keep original offsets for backward compatibility
                    opacity: 0.8,      // Default opacity
                    spread: presetName === 'outline' ? 1.5 : 0  // Set spread for outline
                };
                
                // Apply special settings for specific shadow types
                if (presetName === 'glow') {
                    window.activeTextElement.shadowConfig.opacity = 0.8;
                    window.activeTextElement.shadowConfig.blur = Math.max(blur, 12); // Minimum blur for glow
                } else if (presetName === 'neon') {
                    window.activeTextElement.shadowConfig.opacity = 1.0;
                    window.activeTextElement.shadowConfig.blur = Math.max(blur, 15); // Minimum blur for neon
                } else if (presetName === 'strong') {
                    window.activeTextElement.shadowConfig.opacity = 0.6;
                    window.activeTextElement.shadowConfig.blur = Math.max(blur, 8); // Minimum blur for strong
                } else if (presetName === 'outline') {
                    window.activeTextElement.shadowConfig.spread = blur / 4 + 0.5; // Use blur to control outline thickness
                }
                
                // Save custom preset for future use if this is a custom setting
                if (presetName === 'custom') {
                    try {
                        localStorage.setItem('customShadowPreset', JSON.stringify(window.activeTextElement.shadowConfig));
                    } catch (e) {
                        console.error('Error saving custom shadow preset:', e);
                    }
                }
                
                // Close the shadow panel
                shadowContainer.style.display = 'none';
                        
                // Update the canvas to reflect the changes
                if (typeof window.updateShirt3DTexture === 'function') {
                    console.log("Updating 3D texture with new shadow settings...");
                    window.updateShirt3DTexture();
                    } else {
                    console.error("updateShirt3DTexture function not found");
                }
                
                // Show success toast if the function exists
                if (typeof window.showToast === 'function') {
                    window.showToast("Shadow applied");
                }
            } else {
                console.error("No active text element found");
                if (typeof window.showToast === 'function') {
                    window.showToast("Error: No text selected", "error");
                }
            }
        });
        
        // Handle reset button
        const resetBtn = shadowOptions.querySelector('#reset-shadow-btn');
        resetBtn.addEventListener('click', function() {
            // Select none preset
            const nonePreset = shadowOptions.querySelector('.shadow-preset[data-preset="none"]');
            if (nonePreset) {
                // Trigger click to apply the none preset
                nonePreset.click();
            } else {
                // Manual reset
                shadowOptions.querySelector('#shadow-color').value = '#000000';
                shadowOptions.querySelector('#shadow-blur').value = 0;
                shadowOptions.querySelector('#shadow-offset-x').value = 0;
                shadowOptions.querySelector('#shadow-offset-y').value = 0;
                
                updatePreview();
            }
        });
        
        // Initialize by selecting the "none" preset
        const nonePreset = shadowOptions.querySelector('.shadow-preset[data-preset="none"]');
        if (nonePreset) {
            nonePreset.click();
        }
        
    } else {
        console.log("Using existing shadow container");
        
        // Update preview text if it exists
        const previewSpan = shadowContainer.querySelector('#shadow-large-preview span');
        if (previewSpan && currentText) {
            previewSpan.textContent = currentText;
        }
    }
    
    // Toggle shadow options visibility
    if (shadowContainer.style.display === 'block') {
        shadowContainer.style.display = 'none';
    } else {
        shadowContainer.style.display = 'block';
        
        // Scroll to make the shadow options visible
        setTimeout(() => {
            shadowContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    }
    
    console.log("Shadow panel toggle complete");
};

console.log("Modern shadow controls loaded"); 