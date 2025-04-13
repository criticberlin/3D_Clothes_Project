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
        
        // Append the shadow container to the text panel content
        textPanelContent.appendChild(shadowContainer);
        
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
                type: 'drop',
                color: '#000000',
                blur: 2,
                offsetX: 1,
                offsetY: 1,
                spread: 0,
                opacity: 20
            },
            medium: {
                type: 'drop',
                color: '#000000',
                blur: 4,
                offsetX: 2,
                offsetY: 2,
                spread: 0,
                opacity: 30
            },
            strong: {
                type: 'drop',
                color: '#000000',
                blur: 6,
                offsetX: 3,
                offsetY: 3,
                spread: 0,
                opacity: 40
            },
            glow: {
                type: 'drop',
                color: '#4285f4',
                blur: 8,
                offsetX: 0,
                offsetY: 0,
                spread: 0,
                opacity: 80
            },
            neon: {
                type: 'drop',
                color: '#00b4d8',
                blur: 10,
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
                spread: 1,
                opacity: 100
            },
            '3d': {
                type: 'drop',
                color: '#777777',
                blur: 0,
                offsetX: 3,
                offsetY: 3,
                spread: 0,
                opacity: 100
            },
            custom: {
                type: 'drop',
                color: '#4361ee',
                blur: 5,
                offsetX: 2,
                offsetY: 2,
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
                console.log("Creating high-quality text texture for 3D model...");
                
                // Get text properties for rendering
                const text = window.activeTextElement.text || "Sample Text";
                const fontSize = window.activeTextElement.fontSize || 80;
                const fontFamily = window.activeTextElement.font || "Arial";
                
                // Create shadow settings object
                const shadowSettings = {
                    type: presetName === 'outline' ? 'outline' : 
                          presetName === 'none' ? 'none' : 'drop',
                    color: color,
                    blur: blur * 1.25,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    preset: presetName
                };
                
                // Store settings on the element
                window.activeTextElement.shadowSettings = shadowSettings;
                
                // COMPLETELY NEW APPROACH: Create a high-resolution canvas texture for the text
                try {
                    // Create a high-resolution canvas (4x the size for better quality)
                    const canvas = document.createElement('canvas');
                    const scale = 4; // Increased scale for super sharp rendering
                    canvas.width = Math.max(1024, text.length * fontSize * scale * 0.6);
                    canvas.height = fontSize * scale * 2;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Use a better text rendering approach with proper scaling
                    ctx.scale(scale, scale);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    // For white text - add a dark contrasting background during generation 
                    // (will be transparent in final render)
                    if (window.activeTextElement.color === '#ffffff' || window.activeTextElement.color === 'white') {
                        ctx.fillStyle = 'rgba(0,0,0,0.1)'; // Very light black for testing contrast
                        ctx.fillRect(0, 0, canvas.width/scale, canvas.height/scale);
                    }
                    
                    // Set maximum quality settings
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Apply correct font with weight
                    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
                    
                    // Apply different effects based on shadow type
                    if (shadowSettings.type === 'outline') {
                        // Create strong outline effect for better visibility
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 3; // Thicker outline for better visibility
                        ctx.lineJoin = 'round'; // Round joins for smoother outlines
                        ctx.miterLimit = 2;
                        
                        // Draw several outlined versions for a stronger effect
                        for (let i = 0; i < 3; i++) {
                            ctx.strokeText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                        }
                        
                        // Fill with transparent or original color
                        ctx.fillStyle = 'rgba(255,255,255,0)';
                        ctx.fillText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                        
                    } else if (shadowSettings.type === 'drop') {
                        // Apply drop shadow effect
                        ctx.shadowColor = color;
                        ctx.shadowBlur = blur * 1.5; // Increase blur for better shadow effect
                        ctx.shadowOffsetX = offsetX;
                        ctx.shadowOffsetY = offsetY;
                        
                        // For white text on light backgrounds, add a subtle outline as well
                        if (window.activeTextElement.color === '#ffffff' || window.activeTextElement.color === 'white') {
                            // First draw a subtle black outline to improve contrast
                            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                            ctx.lineWidth = 1;
                            ctx.strokeText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                        }
                        
                        // Draw the main text with shadow
                        ctx.fillStyle = window.activeTextElement.color || color;
                        ctx.fillText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                        
                    } else {
                        // No shadow - still ensure text is crisp and visible
                        
                        // For white text on light backgrounds, add a subtle outline
                        if (window.activeTextElement.color === '#ffffff' || window.activeTextElement.color === 'white') {
                            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                            ctx.lineWidth = 0.5;
                            ctx.strokeText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                        }
                        
                        ctx.fillStyle = window.activeTextElement.color || color;
                        ctx.fillText(text, canvas.width/(2*scale), canvas.height/(2*scale));
                    }
                    
                    // Convert canvas to a data URL
                    const textureDataURL = canvas.toDataURL('image/png');
                    
                    // Apply this high-quality texture to the 3D model
                    if (window.scene) {
                        console.log("Applying high-quality canvas texture to 3D text...");
                        
                        // Create a loader for the texture
                        if (window.THREE) {
                            const textureLoader = new window.THREE.TextureLoader();
                            
                            // Load the texture asynchronously
                            textureLoader.load(textureDataURL, function(texture) {
                                // Set high-quality texture properties
                                texture.anisotropy = window.renderer.capabilities.maxAnisotropy || 16;
                                texture.minFilter = window.THREE.LinearMipMapLinearFilter;
                                texture.magFilter = window.THREE.LinearFilter;
                                texture.generateMipmaps = true;
                                texture.needsUpdate = true;
                                
                                // Find and update all relevant text objects
                                window.scene.traverse(function(object) {
                                    if (object.type === "Mesh" && 
                                       (object.userData.type === "text" || 
                                        (object.name && object.name.toLowerCase().includes("text")))) {
                                        
                                        console.log("Applying high-quality texture to:", object.name || "unnamed text");
                                        
                                        // Create a material that uses the high-res texture
                                        const material = new window.THREE.MeshBasicMaterial({
                                            map: texture,
                                            transparent: true,
                                            side: window.THREE.DoubleSide,
                                            depthWrite: true,
                                            depthTest: true
                                        });
                                        
                                        // Replace the object's material
                                        object.material = material;
                                        object.material.needsUpdate = true;
                                    }
                                });
                                
                                // Force a high-quality render
                                window.renderer.setPixelRatio(Math.max(window.devicePixelRatio || 1, 2));
                                window.renderer.render(window.scene, window.camera);
                                
                                console.log("Successfully applied high-quality text texture");
                            });
                        } else {
                            // Fallback approach if THREE isn't available
                            try {
                                // Find text objects in the scene
                                window.scene.traverse(function(object) {
                                    if (object.type === "Mesh" && 
                                       (object.userData.type === "text" || 
                                        (object.name && object.name.toLowerCase().includes("text")))) {
                                        
                                        // Create an image element to load the texture
                                        const img = new Image();
                                        img.onload = function() {
                                            // Apply the texture to the object if possible
                                            if (object.material && object.material.map) {
                                                object.material.map.image = img;
                                                object.material.map.needsUpdate = true;
                                                object.material.needsUpdate = true;
                                                
                                                // Force a render
                                                if (window.renderer && window.camera) {
                                                    window.renderer.render(window.scene, window.camera);
                                                }
                                            }
                                        };
                                        img.src = textureDataURL;
                                    }
                                });
                            } catch (e) {
                                console.warn("Error using fallback texture approach:", e);
                            }
                        }
                    }
                    
                    // Call any existing update functions as a fallback
                    if (window.updateActiveTextShadow) {
                        window.updateActiveTextShadow(shadowSettings);
                    }
                    
                    if (window.refreshTextRendering) {
                        window.refreshTextRendering();
                    }
                    
                    console.log("Applied high-quality text rendering");
                } catch (e) {
                    console.warn("Error creating high-quality text:", e);
                    
                    // Fallback to original approach if canvas texture fails
                    try {
                        if (window.updateActiveTextShadow) {
                            window.updateActiveTextShadow(shadowSettings);
                        }
                    } catch (fallbackError) {
                        console.error("Critical error applying text effects:", fallbackError);
                    }
                }
            } else {
                console.warn("No active text element found to apply shadow");
            }
            
            // Hide options
            shadowContainer.style.display = 'none';
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
    }
    
    console.log("Shadow panel toggle complete");
};

console.log("Modern shadow controls loaded"); 