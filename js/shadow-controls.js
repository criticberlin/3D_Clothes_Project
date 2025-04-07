// Improve slider dragging behavior
function enhanceSliderBehavior() {
    const sliders = document.querySelectorAll('input[type="range"]');
    
    sliders.forEach(slider => {
        let isDragging = false;
        
        // Mouse events
        slider.addEventListener('mousedown', () => {
            isDragging = true;
            document.body.style.userSelect = 'none'; // Prevent text selection during drag
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            // Calculate the new value based on mouse position
            const rect = slider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const min = parseFloat(slider.min) || 0;
            const max = parseFloat(slider.max) || 100;
            const value = min + percent * (max - min);
            
            // Update the slider value
            slider.value = Math.round(value);
            
            // Trigger the input event manually
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                
                // Trigger the change event manually
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        // Touch events for mobile
        slider.addEventListener('touchstart', (e) => {
            isDragging = true;
            document.body.style.userSelect = 'none';
            document.body.style.touchAction = 'none'; // Prevent scrolling during touch
            e.preventDefault();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            // Get touch position
            const touch = e.touches[0];
            const rect = slider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const min = parseFloat(slider.min) || 0;
            const max = parseFloat(slider.max) || 100;
            const value = min + percent * (max - min);
            
            // Update the slider value
            slider.value = Math.round(value);
            
            // Trigger the input event
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            
            e.preventDefault();
        });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
                document.body.style.touchAction = ''; 
                
                // Trigger the change event
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });
}

// Function to handle shadow modal setup and interactions
function setupShadowModal() {
    const modal = document.getElementById('shadow-selection-modal');
    const closeButton = document.getElementById('close-shadow-modal');
    const shadowToggle = document.getElementById('shadow-toggle');
    const shadowOptions = document.getElementById('shadow-options');
    const customControls = document.getElementById('shadow-custom-controls');
    const shadowPreviews = document.querySelectorAll('.shadow-preview');
    const applyButton = document.getElementById('apply-shadow-btn');
    const cancelButton = document.getElementById('cancel-shadow-btn');
    const textPanel = document.getElementById('text-panel');
    
    // Show modal
    function showModal() {
        if (textPanel && modal) {
            // Position the shadow modal at the same position as the text panel
            const textPanelRect = textPanel.getBoundingClientRect();
            modal.style.top = textPanelRect.top + 'px';
            modal.style.right = (window.innerWidth - textPanelRect.right) + 'px';
            modal.style.width = textPanelRect.width + 'px';
            modal.style.height = textPanelRect.height + 'px';
            
            // Hide text panel
            textPanel.style.display = 'none';
            
            // Show shadow modal
            modal.classList.add('active');
            modal.style.display = 'block';
            
            // Update content
            updatePreviewText();
            updateColorPreview(); // Initialize color preview
            enhanceSliderBehavior(); // Add enhanced slider behavior
        }
    }
    
    // Hide modal
    function hideModal() {
        if (modal) {
            // Hide shadow modal
            modal.classList.remove('active');
            modal.style.display = 'none';
            
            // Show text panel
            if (textPanel) {
                textPanel.style.display = 'block';
            }
        }
    }
    
    // Update preview text with current input
    function updatePreviewText() {
        const previewText = document.getElementById('shadow-preview-text');
        const textInput = document.querySelector('.text-edit-input');
        if (previewText && textInput && textInput.value) {
            previewText.textContent = textInput.value;
        } else if (previewText) {
            previewText.textContent = 'Preview Text';
        }
        
        // Update text color
        const activeColor = document.querySelector('.color-option.active');
        if (activeColor && previewText) {
            previewText.style.color = activeColor.getAttribute('data-color');
        }
    }
    
    // Shadow toggle change
    if (shadowToggle) {
        shadowToggle.addEventListener('change', function() {
            if (this.checked) {
                shadowOptions.style.display = 'block';
            } else {
                shadowOptions.style.display = 'none';
            }
        });
    }
    
    // Select shadow type
    shadowPreviews.forEach(preview => {
        preview.addEventListener('click', function() {
            // Remove active class from all previews
            shadowPreviews.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked preview
            this.classList.add('active');
            
            // Check if custom shadow is selected
            if (this.getAttribute('data-shadow-type') === 'custom') {
                customControls.style.display = 'block';
            } else {
                customControls.style.display = 'none';
            }
            
            // Apply the shadow to the preview text
            applyShadowToPreview(this.getAttribute('data-shadow-type'));
        });
    });
    
    // Apply shadow to preview
    function applyShadowToPreview(shadowType) {
        const previewText = document.getElementById('shadow-preview-text');
        if (!previewText) return;
        
        // Get color from the color picker
        const colorPicker = document.getElementById('shadow-color');
        const color = colorPicker ? colorPicker.value : '#000000';
        const colorObj = hexToRgb(color);
        
        // Reset shadow
        previewText.style.textShadow = 'none';
        
        // Apply shadow based on type
        switch(shadowType) {
            case 'drop':
                const dropOpacity = 0.5;
                const dropBlur = 4;
                const dropDistance = 3;
                const dropAngle = 45;
                
                // Calculate x and y based on angle and distance
                const dropRadians = (dropAngle * Math.PI) / 180;
                const dropX = Math.cos(dropRadians) * dropDistance;
                const dropY = Math.sin(dropRadians) * dropDistance;
                
                const dropShadowColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${dropOpacity})`;
                previewText.style.textShadow = `${dropX}px ${dropY}px ${dropBlur}px ${dropShadowColor}`;
                break;
                
            case 'inner':
                // Inner shadows aren't directly supported with CSS text-shadow
                // Using a workaround with multiple shadows
                const innerOpacity = 0.6;
                const innerShadowColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${innerOpacity})`;
                previewText.style.textShadow = 
                    `0 0 1px ${innerShadowColor}, ` +
                    `0 0 2px ${innerShadowColor}, ` +
                    `0 0 3px ${innerShadowColor}`;
                break;
                
            case 'glow':
                // Glow effect with multiple shadows
                const glowOpacity = 0.7;
                const glowShadowColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${glowOpacity})`;
                previewText.style.textShadow = 
                    `0 0 2px ${glowShadowColor}, ` +
                    `0 0 4px ${glowShadowColor}, ` +
                    `0 0 8px ${glowShadowColor}`;
                break;
                
            case 'custom':
                applyCustomShadow();
                break;
                
            default:
                // No shadow
                break;
        }
    }
    
    // Apply custom shadow
    function applyCustomShadow() {
        const previewText = document.getElementById('shadow-preview-text');
        if (!previewText) return;
        
        const intensity = document.getElementById('shadow-opacity').value / 100;
        const blur = document.getElementById('shadow-blur').value;
        const distance = document.getElementById('shadow-distance').value;
        const angle = document.getElementById('shadow-angle').value;
        const color = document.getElementById('shadow-color').value;
        
        // Calculate x and y based on angle and distance
        const radians = (angle * Math.PI) / 180;
        const x = Math.cos(radians) * distance;
        const y = Math.sin(radians) * distance;
        
        // Create rgba color with opacity
        const colorObj = hexToRgb(color);
        const shadowColor = `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${intensity})`;
        
        // Apply shadow
        previewText.style.textShadow = `${x}px ${y}px ${blur}px ${shadowColor}`;
    }
    
    // Helper function to convert hex to rgb
    function hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Convert short hex to full form
        if (hex.length === 3) {
            hex = hex.split('').map(h => h + h).join('');
        }
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
    }
    
    // Function to update the color preview
    function updateColorPreview() {
        const colorPicker = document.getElementById('shadow-color');
        const colorPreview = document.getElementById('color-preview');
        const colorValue = document.getElementById('color-value');
        
        if (colorPicker && colorPreview && colorValue) {
            colorPreview.style.backgroundColor = colorPicker.value;
            colorValue.textContent = colorPicker.value.toUpperCase();
            
            // Update shadow preview if custom is active
            const activePreview = document.querySelector('.shadow-preview.active');
            if (activePreview && activePreview.getAttribute('data-shadow-type') === 'custom') {
                applyCustomShadow();
            } else if (activePreview) {
                // Apply to other shadow types as well
                applyShadowToPreview(activePreview.getAttribute('data-shadow-type'));
            }
        }
    }
    
    // Setup custom shadow controls
    const blurSlider = document.getElementById('shadow-blur');
    const distanceSlider = document.getElementById('shadow-distance');
    const angleSlider = document.getElementById('shadow-angle');
    const colorPicker = document.getElementById('shadow-color');
    const opacitySlider = document.getElementById('shadow-opacity');
    
    // Update value displays
    if (blurSlider) {
        blurSlider.addEventListener('input', function() {
            document.getElementById('blur-value').textContent = this.value + 'px';
            if (document.querySelector('.shadow-preview[data-shadow-type="custom"]').classList.contains('active')) {
                applyCustomShadow();
            }
        });
    }
    
    if (distanceSlider) {
        distanceSlider.addEventListener('input', function() {
            document.getElementById('distance-value').textContent = this.value + 'px';
            if (document.querySelector('.shadow-preview[data-shadow-type="custom"]').classList.contains('active')) {
                applyCustomShadow();
            }
        });
    }
    
    if (angleSlider) {
        angleSlider.addEventListener('input', function() {
            document.getElementById('angle-value').textContent = this.value + '°';
            if (document.querySelector('.shadow-preview[data-shadow-type="custom"]').classList.contains('active')) {
                applyCustomShadow();
            }
        });
    }
    
    if (opacitySlider) {
        opacitySlider.addEventListener('input', function() {
            document.getElementById('opacity-value').textContent = this.value + '%';
            if (document.querySelector('.shadow-preview[data-shadow-type="custom"]').classList.contains('active')) {
                applyCustomShadow();
            }
        });
    }
    
    if (colorPicker) {
        colorPicker.addEventListener('input', function() {
            updateColorPreview();
        });
    }
    
    // Connect shadow button to modal
    const shadowButton = document.getElementById('shadow-btn');
    if (shadowButton) {
        shadowButton.addEventListener('click', showModal);
    }
    
    // Handle apply button
    if (applyButton) {
        applyButton.addEventListener('click', function() {
            const shadowConfig = getShadowConfig();
            
            // Save shadow config to localStorage
            localStorage.setItem('shadowEnabled', shadowConfig.enabled);
            localStorage.setItem('shadowType', shadowConfig.type);
            localStorage.setItem('shadowCustomConfig', JSON.stringify(shadowConfig.customConfig));
            
            // Update shadow button text
            updateShadowButtonText();
            
            // Close modal
            hideModal();
        });
    }
    
    // Handle cancel button
    if (cancelButton) {
        cancelButton.addEventListener('click', hideModal);
    }
    
    // Close modal when clicking close button
    if (closeButton) {
        closeButton.addEventListener('click', hideModal);
    }
    
    // Get shadow configuration
    window.getShadowConfig = function() {
        const enabled = shadowToggle.checked;
        let type = 'none';
        const activePreview = document.querySelector('.shadow-preview.active');
        
        if (activePreview) {
            type = activePreview.getAttribute('data-shadow-type');
        }
        
        let customConfig = null;
        if (type === 'custom') {
            customConfig = {
                intensity: intensitySlider ? intensitySlider.value / 100 : 0.5,
                blur: blurSlider ? blurSlider.value : 5,
                distance: distanceSlider ? distanceSlider.value : 3,
                angle: angleSlider ? angleSlider.value : 45,
                color: colorPicker ? colorPicker.value : '#000000',
                opacity: opacitySlider ? opacitySlider.value / 100 : 0.5
            };
        }
        
        return {
            enabled,
            type,
            customConfig
        };
    };
    
    // Update shadow button text
    function updateShadowButtonText() {
        const shadowButton = document.getElementById('shadow-btn');
        if (!shadowButton) return;
        
        const shadowEnabled = localStorage.getItem('shadowEnabled') === 'true';
        const shadowType = localStorage.getItem('shadowType') || 'none';
        
        if (!shadowEnabled || shadowType === 'none') {
            shadowButton.innerHTML = `<i class="fas fa-shadow"></i> Text Shadow`;
            shadowButton.style.color = '';
        } else {
            const displayName = shadowType.charAt(0).toUpperCase() + shadowType.slice(1);
            shadowButton.innerHTML = `<i class="fas fa-shadow"></i> Shadow: ${displayName}`;
            shadowButton.style.color = 'var(--primary-color)';
        }
    }
    
    // Initialize from saved settings
    function initFromSavedSettings() {
        const shadowEnabled = localStorage.getItem('shadowEnabled') === 'true';
        const shadowType = localStorage.getItem('shadowType') || 'none';
        const customConfigStr = localStorage.getItem('shadowCustomConfig');
        
        if (shadowToggle) {
            shadowToggle.checked = shadowEnabled;
            if (shadowEnabled) {
                shadowOptions.style.display = 'block';
            }
        }
        
        // Set active shadow type
        const targetPreview = document.querySelector(`.shadow-preview[data-shadow-type="${shadowType}"]`);
        if (targetPreview) {
            shadowPreviews.forEach(p => p.classList.remove('active'));
            targetPreview.classList.add('active');
            
            if (shadowType === 'custom') {
                customControls.style.display = 'block';
                
                // Apply custom settings if available
                if (customConfigStr) {
                    try {
                        const customConfig = JSON.parse(customConfigStr);
                        
                        if (intensitySlider && customConfig.intensity) {
                            intensitySlider.value = customConfig.intensity * 100;
                            document.getElementById('intensity-value').textContent = intensitySlider.value + '%';
                        }
                        
                        if (blurSlider && customConfig.blur) {
                            blurSlider.value = customConfig.blur;
                            document.getElementById('blur-value').textContent = blurSlider.value + 'px';
                        }
                        
                        if (distanceSlider && customConfig.distance) {
                            distanceSlider.value = customConfig.distance;
                            document.getElementById('distance-value').textContent = distanceSlider.value + 'px';
                        }
                        
                        if (angleSlider && customConfig.angle) {
                            angleSlider.value = customConfig.angle;
                            document.getElementById('angle-value').textContent = angleSlider.value + '°';
                        }
                        
                        if (colorPicker && customConfig.color) {
                            colorPicker.value = customConfig.color;
                            document.getElementById('shadow-color-preview').style.backgroundColor = colorPicker.value;
                        }
                        
                        if (opacitySlider && customConfig.opacity) {
                            opacitySlider.value = customConfig.opacity * 100;
                            document.getElementById('opacity-value').textContent = opacitySlider.value + '%';
                        }
                    } catch (e) {
                        console.error('Error parsing saved custom shadow config:', e);
                    }
                }
            }
            
            applyShadowToPreview(shadowType);
        }
        
        // Update the shadow button text
        updateShadowButtonText();
    }
    
    // Initialize on startup
    initFromSavedSettings();
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', setupShadowModal); 