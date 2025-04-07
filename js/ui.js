import { updateState, state } from './state.js';
import { updateShirtTexture, toggleTexture, changeCameraView, updateThemeBackground, setupEventListeners } from './scene.js';
import { loadCustomImage, clearCustomImage, showBoundingBoxesForCameraView, setTexturePosition } from './texture-mapper.js';
import { generateAIImage, checkAIServerStatus } from './ai-integration.js';
import { addImage } from './3d-editor.js';

// Import THREE directly since it's needed for color manipulation
import * as THREE from 'three';

/**
 * Initialize the tabs navigation
 */
export function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            // Update active tab button
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');

            // Show the selected tab panel and hide others
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                panel.style.opacity = '0';
                panel.style.transform = 'translateY(10px)';
            });

            const activePanel = document.getElementById(`${tabName}-picker`);
            if (activePanel) {
                activePanel.classList.add('active');
                // Slight delay for smoother transition
                setTimeout(() => {
                    activePanel.classList.add('active');
                    // Trigger entrance animation
                    activePanel.style.opacity = '1';
                    activePanel.style.transform = 'translateY(0)';
                }, 50);
            }
        });
    });

    // Set up theme toggle
    setupThemeToggle();
}

// Setup camera view buttons to show appropriate bounding boxes
export function setupCameraViewButtons() {
    const viewButtons = document.querySelectorAll('.camera-view-btn');

    viewButtons.forEach(button => {
        // Store reference to original click handler

        // Add double-click handler to toggle edit mode
        button.addEventListener('dblclick', function (e) {
            e.preventDefault();
            const view = this.dataset.view;
            if (!view) return;

            const isCurrentlyEditing = this.classList.contains('editing');

            // Toggle edit mode for this view
            import('./scene.js').then(scene => {
                scene.toggleEditorMode(!isCurrentlyEditing, view);

                // If entering edit mode, make sure this view is selected first
                if (!isCurrentlyEditing) {
                    // Update active state on buttons
                    viewButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');

                    // Change to this camera view
                    scene.changeCameraView(view);

                    // Show a helpful tooltip
                    showToast(`Double-click again to exit editing ${view} area`);
                }
            });
        });
    });
}

// Enhanced file picker with texture mapping integration
export function setupFilePicker() {
    const fileInput = document.getElementById('file-upload');
    const preview = document.querySelector('#file-picker .preview');
    const uploadLabel = document.querySelector('.upload-label');

    if (!fileInput || !preview || !uploadLabel) return;

    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        handleFileUpload(e.target.files[0]);
    });

    // Function to handle file upload with proper feedback
    function handleFileUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // Get the file upload preview element
            const preview = document.querySelector('#file-picker .preview');
            if (preview) {
                // Clear out the previous preview
                preview.innerHTML = '';

                // Create an image element to show the preview
                const img = document.createElement('img');
                img.src = event.target.result;
                img.className = 'preview-image';
                img.alt = 'Uploaded design';

                // Add the image to the preview
                preview.appendChild(img);

                // Add a processing state
                preview.classList.add('processing');
            }
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Position a floating panel on the screen
 * @param {HTMLElement} panel - The panel element to position
 */
function positionFloatingPanel(panel) {
    if (!panel) return;
    
    // Get the panel dimensions
    const panelRect = panel.getBoundingClientRect();
    
    // Calculate position - 100px from left edge, centered vertically
    const left = 100; // Fixed distance from left edge
    const top = (window.innerHeight - panelRect.height) / 2;
    
    // Apply position
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

/**
 * Show the view selection modal to choose where to apply the design element
 * @param {string} imageData - The image data URL for previews
 * @param {function} callback - Function to call with the selected view
 * @param {string} modelType - The model type (tshirt, hoodie, etc.)
 * @param {string} title - Optional title for the modal
 */
export function showViewSelectionModal(imageData, callback, modelType = null, title = 'Choose Placement') {
    // Use provided model type or get from state
    const currentModelType = modelType || state.currentModel || 'tshirt';
    
    // Remove any existing view selection containers
    const existingContainers = document.querySelectorAll('.view-selection-container');
    existingContainers.forEach(container => container.remove());
    
    // Create view selection container
    const container = document.createElement('div');
    container.classList.add('view-selection-container');
    
    let previewHtml = '';
    if (imageData) {
        previewHtml = `
            <div class="image-preview">
                <img src="${imageData}" alt="Design element preview" />
            </div>
        `;
    }
    
    // Build container base HTML
    container.innerHTML = `
        <div class="panel-header">
            <h2>${title}</h2>
            <button class="panel-close" aria-label="Close Panel">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="panel-content">
            <p>Select which part of the ${currentModelType} to place your design:</p>
            ${previewHtml}
            <div class="view-options"></div>
            <button class="cancel-view-selection">Cancel</button>
        </div>
    `;
    
    // Get view options container
    const viewOptionsContainer = container.querySelector('.view-options');
    
    // Get available views from modelConfig if accessible
    if (window.modelConfig && window.modelConfig[currentModelType]) {
        const views = window.modelConfig[currentModelType].views;
        
        // Build view options based on model configuration
        Object.entries(views).forEach(([viewName, viewConfig]) => {
            const displayName = viewConfig.name || viewName.replace('_', ' ');
            
            // Select appropriate icon based on view name
            let iconClass = 'fa-tshirt';
            if (viewName === 'back') iconClass = 'fa-tshirt fa-flip-horizontal';
            else if (viewName === 'left_arm') iconClass = 'fa-hand-point-right';
            else if (viewName === 'right_arm') iconClass = 'fa-hand-point-left';
            else if (viewName === 'hood') iconClass = 'fa-hat-wizard';
            
            // Create view option element
            const viewOption = document.createElement('div');
            viewOption.className = 'view-option';
            viewOption.dataset.view = viewName;
            viewOption.innerHTML = `
                <i class="fas ${iconClass}"></i>
                <span>${displayName}</span>
            `;
            
            viewOptionsContainer.appendChild(viewOption);
        });
    } else {
        // Fallback to default views if modelConfig is not available
        const defaultViews = [
            { view: 'front', name: 'Front View', icon: 'fa-tshirt' },
            { view: 'back', name: 'Back View', icon: 'fa-tshirt fa-flip-horizontal' },
            { view: 'left_arm', name: 'Left Sleeve', icon: 'fa-hand-point-right' },
            { view: 'right_arm', name: 'Right Sleeve', icon: 'fa-hand-point-left' }
        ];
        
        defaultViews.forEach(({ view, name, icon }) => {
            const viewOption = document.createElement('div');
            viewOption.className = 'view-option';
            viewOption.dataset.view = view;
            viewOption.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${name}</span>
            `;
            
            viewOptionsContainer.appendChild(viewOption);
        });
    }
    
    // Append the container to the document body
    document.body.appendChild(container);
    
    // Position the panel
    positionFloatingPanel(container);
    
    // Force display and add active class
    container.style.display = 'flex';
    requestAnimationFrame(() => {
        container.classList.add('active');
    });
    
    // Handle Escape key to close the panel
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', handleEscape);
            container.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(container);
                callback(null); // Call with null to indicate cancellation
            }, 300);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Handle view option selection
    const viewOptions = container.querySelectorAll('.view-option');
    viewOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const selectedView = this.dataset.view;
            document.removeEventListener('keydown', handleEscape);
            container.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(container);
                callback(selectedView);
            }, 300);
        });
    });
    
    // Handle cancel button
    const cancelButton = container.querySelector('.cancel-view-selection');
    cancelButton.addEventListener('click', function(e) {
        e.stopPropagation();
        document.removeEventListener('keydown', handleEscape);
        container.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(container);
            callback(null); // Call with null to indicate cancellation
        }, 300);
    });
    
    // Handle close button
    const closeButton = container.querySelector('.panel-close');
    closeButton.addEventListener('click', function(e) {
        e.stopPropagation();
        document.removeEventListener('keydown', handleEscape);
        container.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(container);
            callback(null); // Call with null to indicate cancellation
        }, 300);
    });
    
    // Prevent panel from closing when clicking inside
    container.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Add texture info style
const styleElement = document.createElement('style');
styleElement.textContent = `
    .texture-info {
        background-color: var(--bg-tertiary);
        border-radius: var(--border-radius-sm);
        padding: 10px;
        margin-top: 10px;
        font-size: 0.9rem;
    }
    
    .texture-info p {
        margin: 5px 0;
    }
    
    .texture-info strong {
        color: var(--primary-color);
    }
    
    .texture-info small {
        color: var(--gray-400);
        font-style: italic;
    }
    
    .ai-buttons {
        display: flex;
        gap: 10px;
        margin-top: 12px;
        justify-content: center;
        flex-wrap: wrap;
    }
    
    .ai-result {
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 100%;
        margin: 0 auto;
    }
    
    .ai-result img {
        max-width: 100%;
        width: auto;
        height: auto;
        max-height: 350px;
        object-fit: contain;
        border-radius: var(--border-radius-sm);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .ai-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 350px;
        padding: 15px;
        background-color: var(--bg-secondary);
        border-radius: var(--border-radius-md);
        box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
        margin-bottom: 15px;
    }
    
    /* Loading indicator inside AI preview */
    .ai-preview .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        min-height: 200px;
    }
    
    .ai-preview .loading i {
        font-size: 2.5rem;
        margin-bottom: 15px;
        color: var(--primary-color);
    }
    
    /* Fabric editor styling */
    .fabric-canvas-wrapper {
        width: 100%;
        max-width: 500px;
        margin: 0 auto 20px;
        border-radius: var(--border-radius-md);
        overflow: hidden;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
        background-color: #f8f8f8;
        position: relative;
    }
    
    .fabric-controls {
        display: flex;
        flex-direction: column;
        gap: 15px;
        padding: 20px;
        background-color: var(--bg-secondary);
        border-radius: var(--border-radius-md);
        margin-bottom: 20px;
        max-width: 500px;
        margin-left: auto;
        margin-right: auto;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .canvas-container {
        margin: 0 auto;
        border-radius: var(--border-radius-md);
        overflow: hidden;
    }
    
    #finish-ai-edit {
        margin: 15px auto;
        display: block;
        min-width: 200px;
        font-weight: 600;
        padding: 12px 24px;
        font-size: 1.05rem;
        transition: all 0.2s ease-in-out;
    }
    
    #finish-ai-edit:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }
    
    /* Tool buttons styling */
    .tool-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 8px 12px;
        margin-right: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .tool-btn:hover {
        background-color: var(--primary-color-light);
        color: var(--primary-color);
    }
    
    .tool-btn.active {
        background-color: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
    }
    
    .tool-btn i {
        margin-right: 5px;
    }
    
    /* Control groups in fabric editor */
    .control-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color-light);
    }
    
    .control-group:last-child {
        border-bottom: none;
        margin-bottom: 0;
    }
    
    .control-group label {
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 5px;
    }
    
    .fabric-select {
        padding: 8px 12px;
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--border-color);
        background-color: var(--bg-primary);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 0.9rem;
        transition: border-color 0.2s ease;
    }
    
    .fabric-select:focus {
        outline: none;
        border-color: var(--primary-color);
    }
    
    /* Tool organization */
    .editor-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 15px;
    }
    
    .shape-menu {
        position: absolute;
        display: flex;
        flex-direction: column;
        background-color: var(--bg-primary);
        border-radius: var(--border-radius-sm);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        z-index: 10;
        overflow: hidden;
        border: 1px solid var(--border-color);
    }
    
    .shape-btn {
        padding: 8px 12px;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.2s ease;
        color: var(--text-primary);
    }
    
    .shape-btn:hover {
        background-color: var(--bg-hover);
    }
    
    /* Editor sections */
    .editor-section-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 12px 0;
        color: var(--text-primary);
        display: flex;
        align-items: center;
    }
    
    .editor-section-title i {
        margin-right: 8px;
        color: var(--primary-color);
    }
`;
document.head.appendChild(styleElement);

/**
 * Initialize the floating UI elements
 */
export function initializeFloatingUI() {
    console.log('Initializing floating UI elements');
    
    // First make sure the elements exist and are visible
    ensureFloatingElementsExist();
    
    // Setup button click handlers
    setupFloatingButtons();
    
    // Setup panel close buttons
    setupPanelCloseButtons();
    
    // Connect color functionality
    initializeColorPicker();
    
    // Connect download buttons
    setupDownloadButtons();
    
    // Setup model selector
    setupModelSelector();
    
    // Add specific panel open handlers
    setupPanelSpecificHandlers();
    
    // Return true to indicate success
    return true;
}

/**
 * Setup handlers for specific panels that need initialization when opened
 */
function setupPanelSpecificHandlers() {
    // AI panel needs to initialize the AI functionality when opened
    const aiButton = document.getElementById('ai-generator-btn');
    if (aiButton) {
        aiButton.addEventListener('click', () => {
            console.log('AI panel opened, initializing AI functionality');
            
            // Initialize AI functionality with a slight delay to make sure the panel is visible
            setTimeout(() => {
                setupAIPicker();
            }, 100);
        });
    }
    
    // Photo upload button
    const photoButton = document.getElementById('photo-upload-btn');
    if (photoButton) {
        photoButton.addEventListener('click', () => {
            console.log('Photo panel opened');
            
            // Set up tabs functionality
            setupPhotoUploadTabs();
            
            // Setup file upload functionality
            const uploadButton = document.querySelector('#photo-panel .upload-button');
            const fileInput = document.getElementById('file-upload');
            
            if (uploadButton && fileInput) {
                // Remove existing event listeners by cloning
                const newButton = uploadButton.cloneNode(true);
                uploadButton.parentNode.replaceChild(newButton, uploadButton);
                
                // Add new event listener
                newButton.addEventListener('click', () => {
                    fileInput.click();
                });
                
                // Setup the file input change event
                fileInput.onchange = (e) => {
                    handleImageUpload(e.target.files[0]);
                };
            }
            
            // Setup drag and drop area
            const dragArea = document.querySelector('#photo-panel .drag-area');
            if (dragArea && fileInput) {
                dragArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dragArea.classList.add('active');
                });
                
                dragArea.addEventListener('dragleave', () => {
                    dragArea.classList.remove('active');
                });
                
                dragArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dragArea.classList.remove('active');
                    
                    if (e.dataTransfer.files.length) {
                        handleImageUpload(e.dataTransfer.files[0]);
                    }
                });
            }
            
            // Setup URL image fetching
            setupUrlImageFetcher();
            
            // Setup camera functionality
            setupCameraFunctionality();
        });
    }
    
    // Text upload button - Updated to directly use addText from 3d-editor.js
    const textButton = document.getElementById('text-upload-btn');
    if (textButton) {
        // Remove existing event listeners
        const newTextButton = textButton.cloneNode(true);
        textButton.parentNode.replaceChild(newTextButton, textButton);
        
        // Add the new event listener
        newTextButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Text button clicked - calling addText directly');
            
            // Get the text edit panel
            const textEditPanel = document.getElementById('text-edit-panel');
            if (textEditPanel) {
                // Clear any existing text
                const textInput = textEditPanel.querySelector('.text-edit-input');
                if (textInput) {
                    textInput.value = '';
                }
                
                // Show the panel
                textEditPanel.classList.add('active');
                newTextButton.classList.add('active');
                
                // Focus the textarea after panel is visible
                setTimeout(() => {
                    if (textInput) {
                        textInput.focus();
                        
                        // Add keyboard event listeners for better UX
                        textInput.addEventListener('keydown', (e) => {
                            // Submit on Ctrl+Enter or Cmd+Enter
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                newSaveButton.click();
                            }
                            
                            // Cancel on Escape
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                textEditPanel.classList.remove('active');
                                newTextButton.classList.remove('active');
                            }
                        });
                    }
                }, 300);
                
                // Handle the save button click
                const saveButton = textEditPanel.querySelector('.text-edit-save');
                if (saveButton) {
                    // Remove existing event listeners by cloning
                    const newSaveButton = saveButton.cloneNode(true);
                    saveButton.parentNode.replaceChild(newSaveButton, saveButton);
                    
                    newSaveButton.addEventListener('click', () => {
                        const textValue = textInput.value.trim();
                        if (textValue) {
                            // Get selected color
                            const activeColor = textEditPanel.querySelector('.color-option.active');
                            const color = activeColor ? activeColor.getAttribute('data-color') : '#000000';
                            
                            // Get selected font
                            const fontSelect = textEditPanel.querySelector('#font-select');
                            const font = fontSelect ? fontSelect.value : 'Arial';
                            
                            // Get shadow settings
                            let shadowEnabled = false;
                            let shadowConfig = null;
                            
                            if (window.getShadowConfig) {
                                const config = window.getShadowConfig();
                                shadowEnabled = config.enabled;
                                shadowConfig = config.config;
                            }
                            
                            // Close the panel
                            textEditPanel.classList.remove('active');
                            newTextButton.classList.remove('active');
                            
                            // Generate a preview image of the text
                            const previewCanvas = document.createElement('canvas');
                            const previewCtx = previewCanvas.getContext('2d');
                            const fontSize = 80;
                            
                            // Set canvas size
                            previewCanvas.width = 400;
                            previewCanvas.height = 200;
                            
                            // Draw text
                            previewCtx.fillStyle = '#ffffff';
                            previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                            previewCtx.fillStyle = color;
                            previewCtx.font = `bold ${fontSize}px "${font}"`;
                            previewCtx.textAlign = 'center';
                            previewCtx.textBaseline = 'middle';
                            previewCtx.fillText(textValue, previewCanvas.width/2, previewCanvas.height/2);
                            
                            // Convert to image
                            const previewImage = previewCanvas.toDataURL('image/png');
                            
                            // Show view selection modal
                            showViewSelectionModal(previewImage, (selectedView) => {
                                if (selectedView) {
                                    import('./3d-editor.js')
                                        .then((editor) => {
                                            // Import scene module to change the camera view
                                            import('./scene.js')
                                                .then((scene) => {
                                                    // Change camera view to selected view
                                                    scene.changeCameraView(selectedView);
                                                    
                                                    // Calculate center position
                                                    const centerX = editor.canvas.width / 2;
                                                    const centerY = editor.canvas.height / 2;
                                                    
                                                    // Measure text dimensions
                                                    const tempCanvas = document.createElement('canvas');
                                                    const tempCtx = tempCanvas.getContext('2d');
                                                    tempCtx.font = `bold ${fontSize}px "${font}"`;
                                                    const textMetrics = tempCtx.measureText(textValue);
                                                    
                                                    // Calculate text width and height
                                                    const textWidth = textMetrics.width;
                                                    const textHeight = fontSize * 1.2;
                                                    
                                                    // Create text object
                                                    const textObj = {
                                                        id: 'text_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                                                        type: 'text',
                                                        text: textValue,
                                                        font: font,
                                                        fontSize: fontSize,
                                                        color: color,
                                                        left: centerX - textWidth/2,
                                                        top: centerY - textHeight/2,
                                                        width: textWidth,
                                                        height: textHeight,
                                                        angle: 0,
                                                        view: selectedView,
                                                        isDecal: true,
                                                        textAlign: 'center',
                                                        lineHeight: 1.2,
                                                        backgroundColor: 'transparent',
                                                        padding: 0,
                                                        stroke: true,
                                                        strokeWidth: 0,
                                                        shadow: shadowEnabled,
                                                        shadowConfig: shadowConfig
                                                    };
                                                    
                                                    // Add the text object to canvas
                                                    editor.addObject(textObj);
                                                    
                                                    // Add to panel items if function is available
                                                    if (typeof editor.addPanelItem === 'function') {
                                                        editor.addPanelItem('text', textObj);
                                                    }
                                                    
                                                    // Update the texture
                                                    editor.updateShirt3DTexture();
                                                    
                                                    // Show success message
                                                    showToast(`Text added to ${selectedView} view`);
                                                });
                                        })
                                        .catch((error) => {
                                            console.error('Error adding text to shirt:', error);
                                            showToast('Failed to add text');
                                        });
                                }
                            }, 'Choose Text Placement');
                        } else {
                            showToast('Please enter some text');
                        }
                    });
                }
                
                // Handle the cancel button click
                const cancelButton = textEditPanel.querySelector('.text-edit-cancel');
                if (cancelButton) {
                    // Remove existing event listeners by cloning
                    const newCancelButton = cancelButton.cloneNode(true);
                    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
                    
                    newCancelButton.addEventListener('click', () => {
                        // Close the panel
                        textEditPanel.classList.remove('active');
                        newTextButton.classList.remove('active');
                    });
                }
                
                // Handle panel close button
                const closeButton = textEditPanel.querySelector('.panel-close');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        // Close the panel
                        textEditPanel.classList.remove('active');
                        newTextButton.classList.remove('active');
                    });
                }
            } else {
                // Fall back to direct 3D editor call if panel doesn't exist
                import('./3d-editor.js')
                    .then((editor) => {
                        // Call the addText function with empty text to start a new text
                        editor.addText('', { fromButton: true });
                    })
                    .catch((error) => {
                        console.error('Error importing 3d-editor module:', error);
                        showToast('Failed to add text');
                    });
            }
        });
    }
    
    // Shape upload button
    const shapeButton = document.getElementById('shape-upload-btn');
    if (shapeButton) {
        shapeButton.addEventListener('click', () => {
            console.log('Shape panel opened');
            
            // We can skip the panel and directly use the existing 3D editor function
            // This is the same implementation that the right-side button uses
            if (typeof window.addShape === 'function') {
                window.addShape('', { fromButton: true });
                
                // Close the panel immediately since the 3D editor handles the UI
                const panel = document.getElementById('shape-panel');
                if (panel) {
                    panel.classList.remove('active');
                    shapeButton.classList.remove('active');
                }
            } else {
                console.error('addShape function not available');
                showToast('Shape functionality not available');
            }
        });
    }
    
    // AI Panel Apply and Download buttons
    const aiPanel = document.getElementById('ai-panel');
    if (aiPanel) {
        const applyButton = aiPanel.querySelector('.apply-button');
        const downloadButton = aiPanel.querySelector('.download-button');
        
        if (applyButton) {
            applyButton.addEventListener('click', () => {
                // Get the generated image
                const aiResult = aiPanel.querySelector('.ai-result img');
                if (aiResult && aiResult.src) {
                    // Apply the generated design to the t-shirt
                    console.log('Applying AI generated design to the t-shirt');
                    // Implementation would depend on your 3D model handling logic
                    applyGeneratedDesign(aiResult.src);
                    
                    // Close the panel after applying
                    aiPanel.classList.remove('active');
                } else {
                    console.log('No AI design generated yet');
                }
            });
        }
        
        if (downloadButton) {
            downloadButton.addEventListener('click', () => {
                // Get the generated image
                const aiResult = aiPanel.querySelector('.ai-result img');
                if (aiResult && aiResult.src) {
                    // Download the generated image
                    console.log('Downloading AI generated design');
                    downloadGeneratedImage(aiResult.src);
                } else {
                    console.log('No AI design generated yet');
                }
            });
        }
    }
}

// Helper function to apply the generated design to the t-shirt
function applyGeneratedDesign(imageUrl) {
    // Implementation would depend on your specific 3D model handling
    // This is a placeholder for the actual implementation
    console.log('Applying design from URL:', imageUrl);
    
    // Show success notification
    showToast('Design applied successfully!');
}

// Helper function to download the generated image
function downloadGeneratedImage(imageUrl) {
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = 'ai-generated-design.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Show success notification
    showToast('Design downloaded successfully!');
}

/**
 * Set up AI picker functionality
 */
export function setupAIPicker() {
    // Always reinitialize
    let aiPickerInitialized = false;
    
    console.log('Setting up AI Picker');
    
    const promptInput = document.getElementById('ai-prompt');
    const generateBtn = document.getElementById('ai-generate');
    const preview = document.querySelector('.ai-preview');
    const previewContainer = document.querySelector('.ai-preview-container');
    const previewActions = document.querySelector('.ai-preview-actions');
    
    // Ensure the preview container is visible
    if (previewContainer) {
        previewContainer.style.display = 'flex';
    }
    
    // Set up a more visually appealing default state for the preview
    if (preview) {
        preview.style.display = 'flex';
        preview.style.minHeight = '250px';
        preview.style.maxHeight = '300px';
        preview.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>Enter a prompt below to generate a design</p>
            </div>
        `;
    }
    
    // Hide the action buttons until an image is generated
    if (previewActions) {
        previewActions.style.display = 'none';
    }

    if (!promptInput || !generateBtn || !preview) {
        console.warn('AI Picker elements not found, will try again when panels are visible');
        // Try again after a short delay in case elements haven't been fully created yet
        setTimeout(setupAIPicker, 500);
        return;
    }

    console.log('Found AI Picker elements, initializing functionality');
    aiPickerInitialized = true;

    let isGenerating = false;
    let serverIsOnline = false;

    // Check server status right away
    checkAIServer();

    // Function to check server status
    async function checkAIServer() {
        console.log('Checking AI server status...');
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Checking AI server status...</p></div>';

        try {
            // Using the checkAIServerStatus function from ai-integration.js
            serverIsOnline = await checkAIServerStatus();

            if (serverIsOnline) {
                preview.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-robot"></i>
                        <p>Enter a prompt to generate a design</p>
                </div>`;
                preview.style.minHeight = '250px';
                preview.style.maxHeight = '300px';
                generateBtn.disabled = false;
                console.log('AI server is online');
            } else {
                preview.innerHTML = `
                <div class="error">
                    <p>AI server is not running. <button id="ai-help" class="button secondary small">Learn how to start</button></p>
                </div>
                `;

                const helpBtn = document.getElementById('ai-help');
                if (helpBtn) {
                    helpBtn.addEventListener('click', () => {
                        showAISetupInstructions();
                    });
                }

                generateBtn.disabled = true;
                console.warn('AI server is offline');
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            preview.innerHTML = '<div class="error"><p>Error connecting to AI server</p></div>';
            generateBtn.disabled = true;
        }
    }

    // Function to show AI setup instructions
    function showAISetupInstructions() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Setting up the AI Server</h3>
            <div class="modal-body">
                <p>To use the AI Design Generator, you need to set up a local server. Follow these steps:</p>
                <ol>
                    <li>Make sure you have Node.js installed</li>
                    <li>Navigate to the server directory: <code>cd server</code></li>
                    <li>Install dependencies: <code>npm install</code></li>
                    <li>Create a <code>.env</code> file with your AI API key</li>
                    <li>Start the server: <code>npm start</code></li>
                </ol>
                <p>Once the server is running, refresh this page and try again.</p>
            </div>
        </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }
    }

    // Remove any existing event listeners from generate button by cloning and replacing it
    const oldBtn = generateBtn;
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    const updatedGenerateBtn = newBtn;

    // Attach event listener to Generate button
    updatedGenerateBtn.addEventListener('click', async () => {
        console.log('Generate button clicked');
        
        // Get the prompt text
        const prompt = promptInput.value.trim();
        
        // Validate prompt
        if (!prompt) {
            console.warn('Empty prompt, not sending request');
            showToast('Please enter a prompt to generate an image');
            return;
        }
        
        // Prevent multiple simultaneous generations
        if (isGenerating) {
            console.warn('Already generating, ignoring click');
            return;
        }
        
        isGenerating = true;
        
        // Hide buttons while generating
        if (previewActions) {
            previewActions.style.display = 'none';
        }
        
        // Always show the section title when generating starts
        const sectionTitle = document.querySelector('#ai-panel .section-title');
        if (sectionTitle) {
            sectionTitle.style.display = 'block';
        }
        
        // Update button state
        updatedGenerateBtn.disabled = true;
        updatedGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // Always reset and show the loading state for each generation
        preview.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Creating your design...</p>
        </div>
        `;
        
        // Make sure the preview is visible in correct size for loading state
        preview.style.display = 'flex';
        preview.style.minHeight = '250px';
        preview.style.maxHeight = '300px';
        preview.style.overflow = 'hidden'; // Ensure loading container is visible
        preview.style.width = '100%';
        
        // Clear any previous generated content
        const previewContainer = document.querySelector('.ai-preview-container');
        if (previewContainer) {
            previewContainer.style.display = 'flex';
            previewContainer.style.width = '100%';
        }

        // Use the generateAIImage function from ai-integration.js
        generateAIImage(prompt, {
            onSuccess: (imageData) => {
                console.log('AI image generated successfully');
                
                // Create a hidden image to get dimensions
                const tempImg = new Image();
                tempImg.onload = () => {
                    // Show the generated image in the preview area
                    preview.innerHTML = `
                    <div class="ai-result">
                        <img src="${imageData}" alt="Generated design" />
                    </div>
                    `;
                    
                    // Make the preview container fit the image
                    preview.style.minHeight = 'unset';
                    preview.style.maxHeight = '90vh';
                    preview.style.width = '100%';
                    preview.style.padding = '0';
                    preview.style.background = 'transparent';
                    preview.style.border = 'none';
                    preview.style.boxShadow = 'none';
                    preview.style.overflow = 'visible';
                    
                    // Hide the section-title when image is generated to make more room for the image
                    const sectionTitle = document.querySelector('#ai-panel .section-title');
                    if (sectionTitle) {
                        sectionTitle.style.display = 'none';
                    }

                    // Set preview container to adjust to image dimensions
                    const previewContainer = document.querySelector('.ai-preview-container');
                    if (previewContainer) {
                        previewContainer.style.width = '100%';
                        previewContainer.style.display = 'flex';
                    }

                    // Get the generated image and set it to maximize height
                    const generatedImg = preview.querySelector('.ai-result img');
                    if (generatedImg) {
                        // Set fixed dimensions to 230px
                        generatedImg.style.width = '230px';
                        generatedImg.style.height = '230px';
                        generatedImg.style.maxWidth = '230px';
                        generatedImg.style.maxHeight = '230px';
                        generatedImg.style.minWidth = '230px';
                        generatedImg.style.objectFit = 'contain';
                        
                        // Wait for the image to be fully loaded
                        generatedImg.onload = function() {
                            // Ensure 230px dimensions after loading
                            this.style.width = '230px';
                            this.style.height = '230px';
                            this.style.maxWidth = '230px';
                            this.style.maxHeight = '230px';
                            this.style.minWidth = '230px';
                            this.style.objectFit = 'contain';
                            
                            // Adjust container to maximize image display
                            preview.style.overflow = 'visible';
                        };
                    }

                    // Always ensure buttons are properly displayed after successful generation
                    if (previewActions) {
                        console.log('Showing preview actions');
                        previewActions.style.display = 'flex';
                        
                        // Enable buttons
                        const buttons = previewActions.querySelectorAll('button');
                        buttons.forEach(button => {
                            button.disabled = false;
                            button.classList.remove('disabled');
                        });
                        
                        // Set up apply button
                        const applyBtn = previewActions.querySelector('.apply-button');
                        if (applyBtn) {
                            // Remove any previous event listeners by replacing the button
                            const newApplyBtn = applyBtn.cloneNode(true);
                            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
                            
                            // Add new event listener
                            newApplyBtn.addEventListener('click', () => {
                                console.log('Apply button clicked');
                                // Get current model type
                                const currentModel = state.currentModel || 'tshirt';
                                
                                // Show view selection modal for the AI image
                                showViewSelectionModal(imageData, (selectedView) => {
                                    if (selectedView) {
                                        // Apply as texture to the selected view of the current model
                                        import('./texture-mapper.js').then(textureMapper => {
                                            // Use load custom image function with the selected view and model type
                                            textureMapper.loadCustomImage(imageData, selectedView, {
                                                smartPlacement: true,
                                                autoAdjust: true,
                                                isAIGenerated: true
                                            }).then(() => {
                                                showToast(`AI design applied to ${selectedView} view on ${currentModel}`);
                                                
                                                // Change to the view where the image was placed
                                                changeCameraView(selectedView);
                                                
                                                // Close the panel after applying
                                                const panel = document.getElementById('ai-panel');
                                                if (panel) {
                                                    panel.classList.remove('active');
                                                    panel.style.display = 'none';
                                                }
                                                
                                                // Deactivate the button
                                                const button = document.getElementById('ai-generator-btn');
                                                if (button) {
                                                    button.classList.remove('active');
                                                }
                                            }).catch(error => {
                                                console.error('Error applying AI design:', error);
                                                showToast(`Error applying AI design: ${error.message}`);
                                            });
                                        });
                                    }
                                }, currentModel); // Pass the current model type as a parameter
                            });
                        }
                        
                        // Set up download button
                        const downloadBtn = previewActions.querySelector('.download-button');
                        if (downloadBtn) {
                            // Remove any previous event listeners by replacing the button
                            const newDownloadBtn = downloadBtn.cloneNode(true);
                            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
                            
                            // Add new event listener
                            newDownloadBtn.addEventListener('click', () => {
                                console.log('Download button clicked');
                                // Create a temporary link element
                                const link = document.createElement('a');
                                link.href = imageData;
                                link.download = `ai-design-${Date.now()}.png`;

                                // Append to the document, click it, and remove it
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);

                                showToast('Downloading AI design');
                            });
                        }
                    } else {
                        console.error('Preview actions not found');
                    }
                    
                    // Reset UI state
                    isGenerating = false;
                    updatedGenerateBtn.disabled = false;
                    updatedGenerateBtn.innerHTML = '<span class="sparkle-icon" style="color: white !important;">✨</span> Generate';
                };
                tempImg.src = imageData;
            },
            onError: (errorMessage) => {
                console.error('Error generating AI image:', errorMessage);
                preview.innerHTML = `<div class="error"><p>Error: ${errorMessage}</p></div>`;
                
                // Show the section-title again in case of error
                const sectionTitle = document.querySelector('#ai-panel .section-title');
                if (sectionTitle) {
                    sectionTitle.style.display = 'block';
                }
                
                // Hide preview actions if there's an error
                if (previewActions) {
                    previewActions.style.display = 'none';
                }
            },
            onEnd: () => {
                isGenerating = false;
                updatedGenerateBtn.disabled = false;
                updatedGenerateBtn.innerHTML = '<span class="sparkle-icon" style="color: white !important;">✨</span> Generate';
            }
        });
    });

    // Make sure the section-title is visible when the panel is opened/created
    const resetAIPanel = () => {
        const sectionTitle = document.querySelector('#ai-panel .section-title');
        if (sectionTitle) {
            sectionTitle.style.display = 'block';
        }
        
        // Ensure the preview container is visible
        const previewContainer = document.querySelector('.ai-preview-container');
        if (previewContainer) {
            previewContainer.style.display = 'flex';
        }
        
        // Reset the preview to an improved default state, always visible but smaller
        if (preview) {
            preview.style.display = 'flex';
            preview.style.minHeight = '250px';
            preview.style.maxHeight = '300px';
            preview.innerHTML = `
            <div class="ai-result">
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>Enter a prompt to generate a design</p>
                </div>
            </div>
            `;
        }
        
        // Hide action buttons until an image is generated
        if (previewActions) {
            previewActions.style.display = 'none';
        }
    };
    
    // Add event listener to AI panel button to reset the panel when opened
    const aiPanelButton = document.getElementById('ai-generator-btn');
    if (aiPanelButton) {
        aiPanelButton.addEventListener('click', resetAIPanel);
    }
    
    // Also reset when the panel is closed
    const closeButton = document.querySelector('#ai-panel .panel-close');
    if (closeButton) {
        closeButton.addEventListener('click', resetAIPanel);
    }
}

/**
 * Setup theme toggle button
 */
export function setupThemeToggle() {
    console.log('Setting up theme toggle...');

    // Get the theme toggle element
    const themeToggle = document.getElementById('theme-toggle');

    if (!themeToggle) {
        console.error('Theme toggle element not found in the DOM');
        return;
    }

    // Get saved theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme');
    const isDarkMode = savedTheme ? savedTheme === 'dark' : true;

    // Apply the saved theme
    document.documentElement.classList.toggle('light-theme', !isDarkMode);

    // Update the icon
    themeToggle.innerHTML = isDarkMode
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';

    // Add click event listener to toggle theme
    themeToggle.addEventListener('click', function () {
        console.log('Theme toggle clicked');

        // Toggle theme state
        const newIsDarkMode = !document.documentElement.classList.contains('light-theme');

        // Save preference
        localStorage.setItem('theme', newIsDarkMode ? 'dark' : 'light');

        // Update UI with animation
        themeToggle.classList.add('active');
        setTimeout(() => themeToggle.classList.remove('active'), 300);

        document.documentElement.classList.toggle('light-theme', !newIsDarkMode);

        // Update button icon with animation
        themeToggle.style.transition = 'transform 0.3s ease, background-color 0.3s ease';
        themeToggle.style.transform = 'rotate(180deg)';

        setTimeout(() => {
            themeToggle.innerHTML = newIsDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';

            themeToggle.style.transform = 'rotate(0deg)';
        }, 150);

        // Update the background
        if (typeof updateThemeBackground === 'function') {
            updateThemeBackground(newIsDarkMode);
        } else {
            console.warn('updateThemeBackground function not found when toggling');
        }

        // Update state if available
        if (typeof updateState === 'function') {
            updateState({ darkMode: newIsDarkMode });
        }

        // Log the change
        console.log('Theme changed to:', newIsDarkMode ? 'dark' : 'light');
    });

    console.log('Theme toggle setup completed');
}

/**
 * Setup mobile UI functions
 */
export function setupMobileUI() {
    const menuToggle = document.querySelector('.menu-toggle');
    const panelClose = document.querySelector('.panel-close');
    const customizationPanel = document.querySelector('.customization-panel');
    const mobileActionBar = document.querySelector('.mobile-action-bar');
    const mobileActionButtons = document.querySelectorAll('.mobile-action-bar .action-btn');

    // Toggle panel on menu button click - this works with left panel too
    if (menuToggle) {
        menuToggle.addEventListener('click', function () {
            console.log('Menu toggle clicked');
            customizationPanel.classList.toggle('panel-open');

            // Add visual feedback for the button
            this.classList.add('active');
            setTimeout(() => this.classList.remove('active'), 300);
        });
    } else {
        console.warn('Menu toggle button not found');
    }

    // Close panel on close button click
    if (panelClose) {
        panelClose.addEventListener('click', function () {
            console.log('Panel close clicked');
            customizationPanel.classList.remove('panel-open');
        });
    } else {
        console.warn('Panel close button not found');
    }

    // Mobile action buttons behavior
    if (mobileActionButtons.length) {
        mobileActionButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                console.log('Mobile action button clicked:', this.id);

                // Activate the clicked button
                mobileActionButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Open the panel and select corresponding tab
                customizationPanel.classList.add('panel-open');

                // Switch to appropriate tab
                const tabBtns = document.querySelectorAll('.tab-btn');
                const tabPanels = document.querySelectorAll('.tab-panel');

                if (this.id === 'mobile-color') {
                    tabBtns.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.tab === 'color');
                    });
                    tabPanels.forEach(panel => {
                        panel.classList.toggle('active', panel.id === 'color-picker');
                    });
                } else if (this.id === 'mobile-ai') {
                    tabBtns.forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.tab === 'ai');
                    });
                    tabPanels.forEach(panel => {
                        panel.classList.toggle('active', panel.id === 'ai-picker');
                    });
                } else if (this.id === 'mobile-download') {
                    // Trigger download button
                    const downloadBtn = document.getElementById('download');
                    if (downloadBtn) {
                        downloadBtn.click();
                    }
                }
            });
        });
    } else {
        console.warn('No mobile action buttons found');
    }

    // Handle window resize - automatically close panel on desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && customizationPanel && customizationPanel.classList.contains('panel-open')) {
            customizationPanel.classList.remove('panel-open');
        }
    });
}

/**
 * Trigger file upload dialog for a specific view
 * @param {string} view - The view to upload for (front, back, etc.)
 */
export function triggerFileUploadForView(view) {
    // Get the file input element
    const fileInput = document.getElementById('file-upload');

    if (fileInput) {
        // Update state camera view to the target view
        updateState({ cameraView: view });
        
        // Change to the specified view
        changeCameraView(view);
        
        // Create and display a toast message
        showToast(`Select an image to add to the ${view} view`);

        // Trigger the file input click to open the file dialog
        fileInput.click();
    }
}

// Export UI utility functions
export function showError(message) {
    if (!preview) return;

    preview.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
}

export function showToast(message) {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast-message');
    existingToasts.forEach(toast => toast.remove());

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);

    // Remove toast after a few seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/**
 * Setup the editor controls for advanced texture editing
 */
export function setupEditControls() {
    const editControlsContainer = document.getElementById('edit-controls');
    if (!editControlsContainer) {
        console.warn('Edit controls container not found');
        return;
    }

    // Clear existing controls
    editControlsContainer.innerHTML = '';

    // Create advanced editor controls container
    const advancedControlsContainer = document.createElement('div');
    advancedControlsContainer.className = 'editor-controls advanced-controls';
    advancedControlsContainer.innerHTML = `
        <div class="control-section">
            <h4>Transform</h4>
            <div class="buttons">
                <button class="control-button" data-mode="move">
                    <i class="fas fa-arrows-alt"></i> Move
                </button>
                <button class="control-button" data-mode="rotate">
                    <i class="fas fa-sync"></i> Rotate
                </button>
                <button class="control-button" data-mode="scale">
                    <i class="fas fa-expand-arrows-alt"></i> Scale
                </button>
            </div>
        </div>
        
        <div class="control-section">
            <h4>Smart Features</h4>
            <div class="buttons">
                <button class="control-button toggle-button active" data-feature="smartplacement">
                    <i class="fas fa-magic"></i> Smart Placement
                </button>
                <button class="control-button toggle-button active" data-feature="autoadjust">
                    <i class="fas fa-sliders-h"></i> Auto Adjust
                </button>
            </div>
        </div>
        
        <div class="control-section">
            <h4>Quick Actions</h4>
            <div class="buttons">
                <button class="control-button" data-action="copy">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="control-button" data-action="paste">
                    <i class="fas fa-paste"></i> Paste
                </button>
                <button class="control-button" data-action="delete">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="control-button" data-action="duplicate">
                    <i class="fas fa-clone"></i> Duplicate
                </button>
            </div>
        </div>
    `;

    // Add to container
    editControlsContainer.appendChild(advancedControlsContainer);

    // Add help tooltip for advanced features
    const helpTip = document.createElement('div');
    helpTip.className = 'help-tip';
    helpTip.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <div class="tip-content">
            <h4>Quick Tips</h4>
            <ul>
                <li><strong>Smart Placement:</strong> Automatically positions images within view boundaries</li>
                <li><strong>Auto Adjust:</strong> Optimizes image size and appearance</li>
                <li><strong>Keyboard Shortcuts:</strong> 
                    <ul>
                        <li>Delete: Del</li>
                        <li>Copy: Ctrl+C</li>
                        <li>Paste: Ctrl+V</li>
                        <li>Duplicate: Ctrl+D</li>
                    </ul>
                </li>
            </ul>
        </div>
    `;
    editControlsContainer.appendChild(helpTip);

    // Add view quick-access buttons
    setupViewQuickAccess(editControlsContainer);

    // Setup event handlers for the transform buttons
    const transformButtons = advancedControlsContainer.querySelectorAll('[data-mode]');
    transformButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.getAttribute('data-mode');
            activateTransformMode(mode);
            setActiveEditButton(button);
        });
    });

    // Setup event handlers for toggle buttons
    const toggleButtons = advancedControlsContainer.querySelectorAll('.toggle-button');
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const feature = button.getAttribute('data-feature');
            button.classList.toggle('active');
            const isActive = button.classList.contains('active');

            // Call the appropriate toggle function based on the feature
            switch (feature) {
                case 'smartplacement':
                    toggleSmartPlacement(isActive);
                    showToast(`Smart Placement ${isActive ? 'enabled' : 'disabled'}`);
                    break;
                case 'autoadjust':
                    toggleAutoAdjustment(isActive);
                    showToast(`Auto Adjust ${isActive ? 'enabled' : 'disabled'}`);
                    break;
            }
        });
    });

    // Setup event handlers for quick action buttons
    const actionButtons = advancedControlsContainer.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');

            // Handle each action
            switch (action) {
                case 'copy':
                    copySelectedObject();
                    showToast('Object copied');
                    break;
                case 'paste':
                    pasteObject();
                    showToast('Object pasted');
                    break;
                case 'delete':
                    deleteSelectedObject();
                    showToast('Object deleted');
                    break;
                case 'duplicate':
                    duplicateSelectedObject();
                    showToast('Object duplicated');
                    break;
            }
        });
    });
}

/**
 * Setup view quick access buttons for easy navigation
 * @param {HTMLElement} container - The container to add the buttons to
 */
function setupViewQuickAccess(container) {
    // Create view quick access section
    const viewQuickAccess = document.createElement('div');
    viewQuickAccess.className = 'control-section view-quick-access';
    viewQuickAccess.innerHTML = `
        <h4>Quick View Access</h4>
        <div class="view-buttons">
            <!-- View buttons will be added dynamically -->
        </div>
    `;

    container.appendChild(viewQuickAccess);

    // Dynamically add view buttons based on the current model configuration
    const buttonContainer = viewQuickAccess.querySelector('.view-buttons');

    // Get all views for the current model
    import('./texture-mapper.js').then(textureMapper => {
        const views = textureMapper.getAllViews();

        views.forEach(view => {
            // Get view config to get the display name
            const viewConfig = textureMapper.getViewConfig(view);
            const displayName = viewConfig.name || view.replace('_', ' ');

            const button = document.createElement('button');
            button.className = 'view-button';
            button.setAttribute('data-view', view);
            button.innerHTML = `
                <i class="fas fa-angle-right"></i>
                ${displayName}
            `;

            // Add click handler
            button.addEventListener('click', () => {
                // Switch to this view
                textureMapper.quickJumpToView(view);

                // Update active state
                document.querySelectorAll('.view-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });

            buttonContainer.appendChild(button);
        });

        // Set initial active button based on current view
        const currentView = textureMapper.getCurrentView();
        const activeButton = buttonContainer.querySelector(`[data-view="${currentView}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    });
}

/**
 * Set the active edit button
 * @param {HTMLElement} activeButton - The button to set as active
 */
function setActiveEditButton(activeButton) {
    // Remove active class from all transform buttons
    const allButtons = document.querySelectorAll('[data-mode]');
    allButtons.forEach(button => button.classList.remove('active'));

    // Add active class to the clicked button
    activeButton.classList.add('active');
}

/**
 * Activate a specific transform mode in the 3D editor
 * @param {string} mode - The transform mode to activate (move, rotate, scale)
 */
function activateTransformMode(mode) {
    // Import the 3D editor dynamically to avoid circular dependencies
    import('./3d-editor.js').then(editor => {
        editor.setTransformMode(mode);
    });
}

// Helper functions for quick actions
function copySelectedObject() {
    import('./3d-editor.js').then(editor => {
        editor.copySelectedObject();
    });
}

function pasteObject() {
    import('./3d-editor.js').then(editor => {
        editor.pasteObject();
    });
}

function deleteSelectedObject() {
    import('./3d-editor.js').then(editor => {
        editor.deleteSelectedObject();
    });
}

function duplicateSelectedObject() {
    import('./3d-editor.js').then(editor => {
        editor.duplicateSelectedObject();
    });
}

/**
 * Ensure floating elements exist and are visible
 */
function ensureFloatingElementsExist() {
    const canvasContainer = document.querySelector('.canvas-container');
    if (!canvasContainer) {
        console.error('Canvas container not found, cannot initialize floating UI');
        return;
    }
    
    // Check if floating controls already exist
    let floatingControls = document.querySelector('.floating-controls');
    if (!floatingControls) {
        console.log('Creating floating controls container');
        floatingControls = document.createElement('div');
        floatingControls.className = 'floating-controls';
        canvasContainer.appendChild(floatingControls);
    } else {
        console.log('Floating controls container already exists');
    }
    
    // Force visibility
    floatingControls.style.display = 'flex';
    floatingControls.style.zIndex = '100';
    
    // Define button data
    const buttonData = [
        { id: 'model-selector-btn', icon: 'fa-tshirt', text: 'Choose Model', panelId: 'model-panel', panelTitle: 'Choose Model Type' },
        { id: 'color-selector-btn', icon: 'fa-palette', text: 'Change Color', panelId: 'color-panel', panelTitle: 'Change T-Shirt Color' },
        { id: 'photo-upload-btn', icon: 'fa-image', text: 'Add Photo', panelId: 'photo-panel', panelTitle: 'Add Photo' },
        { id: 'text-upload-btn', icon: 'fa-font', text: 'Add Text', panelId: 'text-panel', panelTitle: 'Add Text' },
        { id: 'shape-upload-btn', icon: 'fa-shapes', text: 'Add Shape', panelId: 'shape-panel', panelTitle: 'Add Shape' },
        { id: 'ai-generator-btn', text: 'AI Design', panelId: 'ai-panel', panelTitle: 'AI Design Generator', useSparkleEmoji: true },
        { id: 'download-btn', icon: 'fa-download', text: 'Save', panelId: 'download-panel', panelTitle: 'Save Your Design' }
    ];
    
    // Create buttons if they don't exist
    buttonData.forEach(data => {
        if (!document.getElementById(data.id)) {
            console.log(`Creating floating button: ${data.id}`);
            const button = document.createElement('button');
            button.id = data.id;
            button.className = 'floating-btn';
            
            if (data.useSparkleEmoji) {
                button.innerHTML = `<span class="sparkle-icon" style="color: white !important; text-shadow: 0 0 8px rgba(255, 255, 255, 1), 0 0 15px rgba(255, 255, 255, 1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)) brightness(2); background: white; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: #fff0;">✨</span><span>${data.text}</span>`;
            } else {
                button.innerHTML = `<i class="fas ${data.icon}"></i><span>${data.text}</span>`;
            }
            
            floatingControls.appendChild(button);
        }
        
        // Create panel if it doesn't exist
        if (!document.getElementById(data.panelId)) {
            console.log(`Creating floating panel: ${data.panelId}`);
            createPanel(data.panelId, data.panelTitle, canvasContainer);
        }
    });
}

/**
 * Create a floating panel with basic structure
 */
function createPanel(id, title, container) {
    const panel = document.createElement('div');
    panel.id = id;
    panel.className = 'floating-panel';
    
    // Create panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = title;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'panel-close';
    closeBtn.setAttribute('aria-label', 'Close Panel');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);
    
    // Create panel content
    const content = document.createElement('div');
    content.className = 'panel-content';
    
    // Add specific content based on panel type
    if (id === 'model-panel') {
        content.innerHTML = `
            <div class="model-options">
                <label class="model-option">
                    <input type="radio" name="model-type" value="tshirt" checked />
                    <span class="model-thumbnail tshirt-thumb">
                        <i class="fas fa-tshirt"></i>
                        <span>T-Shirt</span>
                    </span>
                </label>
                <label class="model-option">
                    <input type="radio" name="model-type" value="hoodie" />
                    <span class="model-thumbnail hoodie-thumb">
                        <i class="fas fa-mitten"></i>
                        <span>Hoodie</span>
                    </span>
                </label>
            </div>
        `;
    } else if (id === 'color-panel') {
        content.innerHTML = `
            <div class="color-wheel-container">
                <div class="color-wheel-wrapper">
                    <canvas id="color-wheel" width="200" height="200"></canvas>
                </div>
                <div class="color-info">
                    <div class="color-name" id="color-name">White</div>
                    <div class="color-code" id="color-hex">#FFFFFF</div>
                </div>
            </div>
            
            <div class="preset-colors">
                <h4>Preset Colors</h4>
                <div class="colors">
                    <button class="color-btn active" data-color="#FFFFFF" style="background-color: #FFFFFF;" title="White"></button>
                    <button class="color-btn" data-color="#000000" style="background-color: #000000;" title="Black"></button>
                    <button class="color-btn" data-color="#4A4A4A" style="background-color: #4A4A4A;" title="Charcoal"></button>
                    <button class="color-btn" data-color="#162955" style="background-color: #162955;" title="Navy Blue"></button>
                    <button class="color-btn" data-color="#E1C699" style="background-color: #E1C699;" title="Beige"></button>
                    <button class="color-btn" data-color="#556B2F" style="background-color: #556B2F;" title="Olive Green"></button>
                    <button class="color-btn" data-color="#654321" style="background-color: #654321;" title="Brown"></button>
                    <button class="color-btn" data-color="#800020" style="background-color: #800020;" title="Burgundy"></button>
                </div>
            </div>
        `;
    } else if (id === 'photo-panel') {
        content.innerHTML = `
            <div class="section-title">
                <h3>Upload an Image</h3>
                <p>Add your own image to the design</p>
            </div>
            <div class="drag-area">
                <div class="icon"><i class="fas fa-cloud-upload-alt"></i></div>
                <p>Drag & Drop to Upload File</p>
                <p>OR</p>
                <button class="upload-button">Browse Files</button>
                <input type="file" id="file-upload" accept="image/*" hidden>
            </div>
        `;
    } else if (id === 'text-panel') {
        content.innerHTML = `
            <div class="section-title">
                <h3>Add Text to Design</h3>
                <p>Customize your text style</p>
            </div>
            <div class="text-edit-options">
                <textarea class="text-edit-input" placeholder="Enter your text here" rows="2"></textarea>
                <div class="font-select-container">
                    <label for="font-select">Font</label>
                    <select id="font-select" class="font-select">
                        <option value="Arial">Arial</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </div>
                <button id="shadow-btn" class="shadow-effects-btn">
                    <i class="fas fa-magic"></i>
                    <span>Text Shadow</span>
                </button>
                <div class="text-edit-colors" style="display: flex; gap: 10px; padding: 8px; align-items: center;">
                    <div class="color-option" style="background-color: #000000; width: 30px; height: 30px; border-radius: 50%; cursor: pointer;" data-color="#000000"></div>
                    <div class="color-option" style="background-color: #FFFFFF; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; border: 1px solid #ddd;" data-color="#FFFFFF"></div>
                    <div class="color-option custom-color-option" style="background: linear-gradient(135deg, #ff0000, #ff9900, #33cc33, #3399ff, #cc33ff); width: 30px; height: 30px; border-radius: 50%; cursor: pointer;" data-color="#ff0000"></div>
                    <button id="more-colors-btn" class="more-colors-button" style="padding: 6px 12px; border-radius: 4px; background-color: rgba(var(--primary-color-rgb), 0.1); border: 1px solid rgba(var(--primary-color-rgb), 0.2); color: var(--primary-color); cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-palette"></i> More Colors
                    </button>
                    <input type="color" id="custom-color-picker" class="hidden-color-picker" style="position: absolute; opacity: 0; pointer-events: none; height: 0; width: 0;">
                </div>
                <div class="text-edit-buttons">
                    <button class="text-edit-cancel">Cancel</button>
                    <button class="text-edit-save">Add Text</button>
                </div>
            </div>
        `;
    } else if (id === 'shape-panel') {
        content.innerHTML = `
            <div class="section-title">
                <h3>Add Shape to Design</h3>
                <p>Choose a shape and customize its appearance</p>
            </div>
            <div class="text-edit-options">
                <div class="shape-options">
                    <div class="shape-option active" data-shape="rectangle">
                        <i class="fas fa-square"></i>
                        <span>Rectangle</span>
                    </div>
                    <div class="shape-option" data-shape="circle">
                        <i class="fas fa-circle"></i>
                        <span>Circle</span>
                    </div>
                    <div class="shape-option" data-shape="triangle">
                        <i class="fas fa-play"></i>
                        <span>Triangle</span>
                    </div>
                    <div class="shape-option" data-shape="star">
                        <i class="fas fa-star"></i>
                        <span>Star</span>
                    </div>
                </div>
                <div class="text-edit-colors">
                    <div class="color-option active" style="background-color: #000000" data-color="#000000"></div>
                    <div class="color-option" style="background-color: #FFFFFF" data-color="#FFFFFF"></div>
                    <div class="color-option" style="background-color: #FF0000" data-color="#FF0000"></div>
                    <div class="color-option" style="background-color: #00FF00" data-color="#00FF00"></div>
                    <div class="color-option" style="background-color: #0000FF" data-color="#0000FF"></div>
                    <div class="color-option" style="background-color: #FFFF00" data-color="#FFFF00"></div>
                </div>
            </div>
            <div class="text-edit-buttons">
                <button class="text-edit-cancel">Cancel</button>
                <button class="text-edit-save">Add Shape</button>
            </div>
        `;
    } else if (id === 'ai-panel') {
        content.innerHTML = `
            <div class="section-title">
                <h3>Create unique designs with AI</h3>
                <p>Describe what you'd like to generate</p>
            </div>

            <div class="ai-preview">
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>AI generated designs will appear here</p>
                </div>
            </div>
            
            <div class="ai-preview-actions">
                <button class="button primary apply-button">
                    <i class="fas fa-check"></i>
                    Apply
                </button>
                <button class="button secondary download-button">
                    <i class="fas fa-download"></i>
                    Download
                </button>
            </div>

            <div class="ai-input-container">
                <textarea
                    id="ai-prompt"
                    placeholder="Describe your design idea... (e.g. 'A cosmic astronaut floating in space with stars and nebulae')"
                    aria-label="AI Prompt"
                ></textarea>
                <button id="ai-generate" class="button primary">
                    <span style="display: inline-flex; align-items: center; justify-content: center;">
                        Generate
                        <span class="sparkle-icon" style="color: white !important; text-shadow: 0 0 8px rgba(255, 255, 255, 1), 0 0 15px rgba(255, 255, 255, 1); filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)) brightness(2); background: white; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: #fff0; margin-left: 6px;">✨</span>
                    </span>
                </button>
            </div>
        `;
    } else if (id === 'download-panel') {
        content.innerHTML = `
            <div class="download-options">
                <button id="take-photo" class="button primary">
                    <i class="fas fa-camera"></i>
                    Take Photo
                </button>
                <button id="download-model" class="button primary">
                    <i class="fas fa-download"></i>
                    Download 3D Model
                </button>
                <button id="reset" class="button secondary">
                    <i class="fas fa-undo"></i>
                    Reset Design
                </button>
            </div>
        `;
    }
    
    // Assemble panel
    panel.appendChild(header);
    panel.appendChild(content);
    
    // Add to container
    container.appendChild(panel);
    
    return panel;
}

/**
 * Set up floating button click handlers
 */
function setupFloatingButtons() {
    console.log('Setting up floating button click handlers');
    
    const buttons = {
        model: document.getElementById('model-selector-btn'),
        color: document.getElementById('color-selector-btn'),
        photo: document.getElementById('photo-upload-btn'),
        text: document.getElementById('text-upload-btn'),
        shape: document.getElementById('shape-upload-btn'),
        ai: document.getElementById('ai-generator-btn'),
        download: document.getElementById('download-btn')
    };
    
    const panels = {
        model: document.getElementById('model-panel'),
        color: document.getElementById('color-panel'),
        photo: document.getElementById('photo-panel'),
        text: document.getElementById('text-panel'),
        shape: document.getElementById('shape-panel'),
        ai: document.getElementById('ai-panel'),
        download: document.getElementById('download-panel')
    };
    
    // Log button and panel elements for debugging
    console.log('Buttons:', buttons);
    console.log('Panels:', panels);
    
    // Helper function to close all panels
    const closeAllPanels = () => {
        Object.values(panels).forEach(panel => {
            if (panel) {
                panel.classList.remove('active');
                console.log(`Closing panel: ${panel.id}`);
            }
        });
        
        // Also close any text or shape edit panels that might be open
        const textPanel = document.getElementById('text-edit-panel');
        if (textPanel) {
            textPanel.remove();
        }
        
        const shapePanel = document.getElementById('shape-edit-panel');
        if (shapePanel) {
            shapePanel.remove();
        }
        
        Object.values(buttons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
    };
    
    // Set up each button to toggle its panel with direct DOM manipulation
    Object.entries(buttons).forEach(([key, button]) => {
        if (!button) return;
        
        const panel = panels[key];
        if (!panel) {
            console.error(`Panel for ${key} not found`);
            return;
        }
        
        console.log(`Adding click handler for ${key} button`);
        
        // Remove any existing event listeners by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        buttons[key] = newButton;
        
        // Add the click event listener
        newButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event bubbling
            
            console.log(`${key} button clicked`);
            const isActive = panel.classList.contains('active');
            
            // Close all panels first
            closeAllPanels();
            
            // If the panel wasn't active, open it
            if (!isActive) {
                console.log(`Opening panel: ${panel.id}`);
                panel.classList.add('active');
                panel.style.display = 'flex'; // Force display
                newButton.classList.add('active');
            }

        });
    });
    
    // Comment out the code that closes panels when clicking outside
    // This change makes panels only closable via their buttons, not by clicking elsewhere
    /* 
    document.addEventListener('click', (event) => {
        // Don't close if clicking on a button or inside a panel
        const isButton = Object.values(buttons).some(btn => 
            btn && (btn === event.target || btn.contains(event.target))
        );
        
        const isPanel = Object.values(panels).some(panel => 
            panel && (panel === event.target || panel.contains(event.target))
        );
        
        if (!isButton && !isPanel) {
            closeAllPanels();
        }
    });
    */
}

/**
 * Set up panel close buttons
 */
function setupPanelCloseButtons() {
    console.log('Setting up panel close buttons');
    
    const closeButtons = document.querySelectorAll('.panel-close');
    console.log(`Found ${closeButtons.length} close buttons`);
    
    closeButtons.forEach(button => {
        // Remove existing listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event bubbling
            console.log('Close button clicked');
            
            // Find the parent panel and close it
            const panel = newButton.closest('.floating-panel');
            if (panel) {
                console.log(`Closing panel: ${panel.id}`);
                
                // Only remove the panel if it's a dynamic panel; otherwise just hide it
                // Photo edit panels and crop panels should be fully removed
                if (panel.id === 'photo-edit-panel' || panel.id === 'photo-crop-panel' || 
                    panel.id === 'text-edit-panel' || panel.id === 'shape-edit-panel') {
                    panel.remove();
                } else {
                    // Standard panels should just be hidden
                    panel.classList.remove('active');
                    panel.style.display = 'none';
                }
                
                // Find and deactivate the corresponding button
                const panelId = panel.id;
                const buttonId = panelId.replace('panel', 'selector-btn');
                const button = document.getElementById(buttonId);
                if (button) {
                    button.classList.remove('active');
                }
            } else {
                console.error('Could not find parent panel for close button');
            }
        });
    });
}

/**
 * Set up download buttons in the download panel
 */
function setupDownloadButtons() {
    console.log('Setting up download buttons');
    
    // Take Photo button
    const takePhotoBtn = document.getElementById('take-photo');
    if (takePhotoBtn) {
        takePhotoBtn.addEventListener('click', () => {
            console.log('Taking screenshot of the canvas');
            
            // Take screenshot of the canvas
            const canvas = document.querySelector('.canvas-container canvas');
            if (canvas) {
                try {
                    // Create a full-resolution screenshot
                    const screenshot = canvas.toDataURL('image/png');
                    
                    // Create a download link
                    const downloadLink = document.createElement('a');
                    downloadLink.href = screenshot;
                    downloadLink.download = `3d-shirt-design-${new Date().getTime()}.png`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    showToast('Screenshot saved!');
                } catch (error) {
                    console.error('Error taking screenshot:', error);
                    showToast('Failed to take screenshot');
                }
            } else {
                console.error('Canvas element not found');
                showToast('Canvas not found');
            }
        });
    }
    
    // Download 3D Model button
    const downloadModelBtn = document.getElementById('download-model');
    if (downloadModelBtn) {
        downloadModelBtn.addEventListener('click', () => {
            console.log('Downloading 3D model');
            
            // Check if we can access the exportScene function
            if (typeof window.exportScene === 'function') {
                try {
                    window.exportScene();
                    showToast('3D model download started');
                } catch (error) {
                    console.error('Error exporting scene:', error);
                    showToast('Failed to download 3D model');
                }
            } else {
                console.warn('exportScene function not found in window scope');
                
                // Try to find the old download button as fallback
                const originalDownloadBtn = document.getElementById('download');
                if (originalDownloadBtn) {
                    console.log('Using original download button as fallback');
                    originalDownloadBtn.click();
                    showToast('Download started');
                } else {
                    console.error('No download function available');
                    showToast('Download functionality not available');
                }
            }
            
            // Close the panel
            const panel = document.getElementById('download-panel');
            if (panel) {
                panel.classList.remove('active');
                panel.style.display = 'none';
            }
            
            // Deactivate the button
            const button = document.getElementById('download-btn');
            if (button) {
                button.classList.remove('active');
            }
        });
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log('Resetting design');
            
            // Reset the shirt to default
            updateState({
                fullDecal: null,
                isFullTexture: false,
                stylish: false
            });
            
            // Try to get the shirt material and reset it
            if (window.getShirtMaterial) {
                const material = window.getShirtMaterial();
                if (material) {
                    // Reset to white
                    material.color.set(0xFFFFFF);
                    material.needsUpdate = true;
                    console.log('Reset shirt material to white');
                    
                    // Force a render update
                    if (window.renderer && window.scene && window.camera) {
                        window.renderer.render(window.scene, window.camera);
                    }
                }
            } else {
                console.warn('getShirtMaterial function not available for reset');
            }
            
            showToast('Design has been reset');
            
            // Close the panel
            const panel = document.getElementById('download-panel');
            if (panel) {
                panel.classList.remove('active');
                panel.style.display = 'none';
            }
            
            // Deactivate the button
            const button = document.getElementById('download-btn');
            if (button) {
                button.classList.remove('active');
            }
        });
    }
}

/**
 * Initialize color functionality in the color panel
 */
function initializeColorPicker() {
    console.log('Initializing color picker');
    
    // Setup color wheel
    setupColorWheel();
    
    // Setup preset colors
    setupPresetColors();
}

/**
 * Set up the color wheel functionality
 */
function setupColorWheel() {
    const colorWheel = document.getElementById('color-wheel');
    if (!colorWheel) {
        console.error('Color wheel canvas not found');
        return;
    }
    
    console.log('Setting up color wheel');
    
    const ctx = colorWheel.getContext('2d');
    const centerX = colorWheel.width / 2;
    const centerY = colorWheel.height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    
    // Draw color wheel
    drawColorWheel(ctx, centerX, centerY, radius);
    
    // Add click handler for color selection
    colorWheel.addEventListener('click', (event) => {
        const rect = colorWheel.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Calculate distance from center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If click is within color wheel radius
        if (distance <= radius) {
            // Get color from pixel
            const imageData = ctx.getImageData(x, y, 1, 1).data;
            const color = `rgb(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`;
            const hexColor = rgbToHex(imageData[0], imageData[1], imageData[2]);
            
            // Update color info display
            updateColorInfo(hexColor);
            
            // Apply color to shirt
            applyColorToShirt(hexColor);
        }
    });
}

/**
 * Draw a color wheel on the canvas
 */
function drawColorWheel(ctx, centerX, centerY, radius) {
    for (let angle = 0; angle < 360; angle++) {
        const startAngle = (angle - 0.5) * Math.PI / 180;
        const endAngle = (angle + 0.5) * Math.PI / 180;
        
        // Create gradient for this slice
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius
        );
        
        // Convert HSL to RGB for this angle (hue)
        const hue = angle;
        const rgb = hslToRgb(hue / 360, 1, 0.5);
        const rgbString = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        
        // Add color stops
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, rgbString);
        
        // Draw the slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = gradient;
        ctx.fill();
    }
}

/**
 * Set up preset color buttons
 */
function setupPresetColors() {
    const colorButtons = document.querySelectorAll('.color-btn');
    
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Get the color from the button's data attribute
            const color = button.getAttribute('data-color');
            
            // Update active state
            colorButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update color info display
            updateColorInfo(color);
            
            // Apply color to shirt
            applyColorToShirt(color);
        });
    });
}

/**
 * Update the color information display
 */
function updateColorInfo(hexColor) {
    const colorName = document.getElementById('color-name');
    const colorHex = document.getElementById('color-hex');
    
    if (colorName && colorHex) {
        // Get a simple name for the color
        const name = getColorName(hexColor);
        
        // Update the display
        colorName.textContent = name;
        colorHex.textContent = hexColor.toUpperCase();
    }
}

/**
 * Apply a color to the shirt
 */
function applyColorToShirt(hexColor) {
    try {
        console.log(`Applying color ${hexColor} to shirt`);
        
        // Convert hex to RGB for Three.js
        const color = new THREE.Color(hexColor);
        
        // Try to get the shirt material - this is exposed by scene.js
        if (typeof window.getShirtMaterial === 'function') {
            const material = window.getShirtMaterial();
            if (material) {
                // Apply the color directly to the material
                material.color.set(color);
                material.needsUpdate = true;
                
                // Show feedback
                showToast(`Color changed to ${getColorName(hexColor)}`);
                console.log(`Color applied successfully: ${hexColor}`);
                
                // Force renderer to update
                if (window.renderer && window.scene && window.camera) {
                    window.renderer.render(window.scene, window.camera);
                }
            } else {
                console.error('Could not get shirt material - material is null');
                // Fall back to the old method
                updateState({ shirtColor: hexColor });
            }
        } else {
            console.error('getShirtMaterial function not available, falling back to updateState');
            // Fall back to the old method via state update
            updateState({ shirtColor: hexColor });
        }
    } catch (error) {
        console.error('Error applying color to shirt:', error);
        // Fall back to the old method
        updateState({ shirtColor: hexColor });
    }
}

/**
 * Get a simple name for a color based on its hex value
 */
function getColorName(hexColor) {
    // Simple mapping of known colors
    const colorMap = {
        '#FFFFFF': 'White',
        '#000000': 'Black',
        '#FF0000': 'Red',
        '#00FF00': 'Green',
        '#0000FF': 'Blue',
        '#FFFF00': 'Yellow',
        '#FF00FF': 'Magenta',
        '#00FFFF': 'Cyan',
        '#FFA500': 'Orange',
        '#800080': 'Purple',
        '#008000': 'Green',
        '#A52A2A': 'Brown',
        '#4A4A4A': 'Charcoal',
        '#162955': 'Navy Blue',
        '#E1C699': 'Beige',
        '#556B2F': 'Olive Green',
        '#654321': 'Brown',
        '#800020': 'Burgundy'
    };
    
    // Check if the color is in our map
    if (colorMap[hexColor.toUpperCase()]) {
        return colorMap[hexColor.toUpperCase()];
    }
    
    // Default to Custom Color
    return 'Custom Color';
}

/**
 * Convert HSL to RGB
 * h, s, l values are 0-1
 */
function hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Setup model selector in the model panel
 */
function setupModelSelector() {
    console.log('Setting up model selector');
    const modelOptions = document.querySelectorAll('input[name="model-type"]');
    
    modelOptions.forEach(option => {
        option.addEventListener('change', (event) => {
            if (event.target.checked) {
                const modelType = event.target.value;
                console.log(`Model type selected: ${modelType}`);
                
                // Update the state first
                updateState({ currentModel: modelType });
                
                // Check if we can access the loadModel function from scene.js
                if (typeof window.loadModel === 'function') {
                    console.log(`Calling loadModel function for ${modelType}`);
                    try {
                        window.loadModel(modelType);
                    } catch (error) {
                        console.error('Error calling loadModel:', error);
                    }
                } else {
                    console.warn('loadModel function not found in window scope');
                }
                
                // Update the panel title based on selected model
                const colorPanelTitle = document.querySelector('#color-panel .panel-header h3');
                if (colorPanelTitle) {
                    colorPanelTitle.textContent = `Change ${modelType === 'tshirt' ? 'T-Shirt' : 'Hoodie'} Color`;
                }
                
                // Close the panel after selection
                const panel = document.getElementById('model-panel');
                if (panel) {
                    panel.classList.remove('active');
                    panel.style.display = 'none';
                }
                
                // Deactivate the button
                const button = document.getElementById('model-selector-btn');
                if (button) {
                    button.classList.remove('active');
                }
                
                showToast(`${modelType === 'tshirt' ? 'T-Shirt' : 'Hoodie'} model selected`);
                
                // Force re-render
                setTimeout(() => {
                    if (window.renderer && window.scene && window.camera) {
                        window.renderer.render(window.scene, window.camera);
                    }
                }, 100);
            }
        });
    });
}

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize all components
        initializeTabs();
        setupFilePicker();
        setupCameraViewButtons();
        setupThemeToggle();
        setupMobileUI();
        setupEditControls();
        initializeFloatingUI();
    } catch (error) {
        console.error('Error initializing UI components:', error);
    }
});

// Add a function to retry initialization
function retryInitialization(maxRetries = 5, delay = 1000) {
    let retries = 0;
    
    function attempt() {
        console.log(`Attempt ${retries + 1} to initialize floating UI`);
        const success = initializeFloatingUI();
        
        if (!success && retries < maxRetries) {
            retries++;
            console.log(`Initialization attempt failed, retrying in ${delay}ms...`);
            setTimeout(attempt, delay);
        } else if (!success) {
            console.error(`Failed to initialize floating UI after ${maxRetries} attempts`);
        } else {
            console.log('Floating UI successfully initialized');
        }
    }
    
    attempt();
}

// Modify the event listeners for initialization
window.addEventListener('load', () => {
    console.log('Window loaded - initializing floating UI with retry mechanism');
    setTimeout(() => {
        retryInitialization();
    }, 1000);
});

window.addEventListener('model-loaded', () => {
    console.log('Model loaded event detected - initializing floating UI with retry mechanism');
    retryInitialization();
}); 

/**
 * Show a confirmation dialog for deleting an object
 * @param {string} type - Type of object being deleted ('photo', 'text', or 'shape')
 * @param {function} onConfirm - Function to call if user confirms deletion
 */
export function showDeleteConfirmationDialog(type, onConfirm) {
    // Remove any existing confirmation dialogs
    const existingDialogs = document.querySelectorAll('.confirmation-dialog');
    existingDialogs.forEach(dialog => dialog.remove());
    
    // Create the dialog element
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    
    // Set the content based on type
    dialog.innerHTML = `
        <div class="confirmation-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this ${type}?</p>
            <div class="confirmation-buttons">
                <button class="cancel-btn">Cancel</button>
                <button class="confirm-btn">Delete</button>
            </div>
        </div>
    `;
    
    // Add the dialog to the body
    document.body.appendChild(dialog);
    
    // Add styles to make dialog appear centered
    dialog.style.position = 'fixed';
    dialog.style.left = '50%';
    dialog.style.top = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.zIndex = '2000';

    // Show the dialog with animation
    setTimeout(() => {
        dialog.classList.add('active');
    }, 10);
    
    // Add event listeners for the buttons
    const cancelBtn = dialog.querySelector('.cancel-btn');
    const confirmBtn = dialog.querySelector('.confirm-btn');
    
    cancelBtn.addEventListener('click', () => {
        dialog.classList.remove('active');
        setTimeout(() => {
            dialog.remove();
        }, 300);
    });
    
    confirmBtn.addEventListener('click', () => {
        dialog.classList.remove('active');
        setTimeout(() => {
            dialog.remove();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        }, 300);
    });
    
    // Close on escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', handleEscape);
            dialog.classList.remove('active');
            setTimeout(() => {
                dialog.remove();
            }, 300);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Sets up the tab functionality for the photo upload panel
 */
function setupPhotoUploadTabs() {
    const tabs = document.querySelectorAll('#photo-panel .method-tab');
    const tabContents = document.querySelectorAll('#photo-panel .upload-tab');
    
    if (tabs.length === 0 || tabContents.length === 0) return;
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Show the selected tab content
            const tabId = tab.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // If camera tab is selected, initialize camera
            if (tabId === 'camera') {
                initializeCamera();
            } else {
                // Stop camera when switching to other tabs
                stopCamera();
            }
        });
    });
}

/**
 * Setup URL image fetcher functionality
 */
function setupUrlImageFetcher() {
    const fetchButton = document.getElementById('fetch-url-image');
    const urlInput = document.getElementById('image-url');
    const previewPlaceholder = document.querySelector('#url-preview .preview-placeholder');
    const previewContainer = document.querySelector('#url-preview .preview-image-container');
    const previewImage = document.getElementById('url-preview-image');
    const useUrlImageButton = document.getElementById('use-url-image');
    
    if (!fetchButton || !urlInput || !previewPlaceholder || !previewContainer || !previewImage || !useUrlImageButton) return;
    
    fetchButton.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            showToast('Please enter a valid URL');
            return;
        }
        
        // Show loading state
        previewPlaceholder.innerHTML = '<div class="spinner"></div><p>Loading image...</p>';
        previewPlaceholder.style.display = 'flex';
        previewContainer.style.display = 'none';
        
        // Try to load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            // Hide placeholder and show preview
            previewPlaceholder.style.display = 'none';
            previewContainer.style.display = 'block';
            
            // Set image source
            previewImage.src = img.src;
        };
        
        img.onerror = function() {
            // Show error in placeholder
            previewPlaceholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i><p>Failed to load image. Please check the URL.</p>';
            previewPlaceholder.style.display = 'flex';
            previewContainer.style.display = 'none';
        };
        
        // Handle CORS issues by trying to proxy the image
        try {
            // First try direct loading
            img.src = url;
        } catch (error) {
            // If direct loading fails, try a CORS proxy
            img.src = `https://cors-anywhere.herokuapp.com/${url}`;
        }
    });
    
    // Handle "Use This Image" button click
    useUrlImageButton.addEventListener('click', () => {
        if (previewImage.src) {
            // Convert image to base64 to easily pass it around
            const canvas = document.createElement('canvas');
            canvas.width = previewImage.naturalWidth;
            canvas.height = previewImage.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(previewImage, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            
            // Use the same function as file upload to process the image
            showViewSelectionModal(dataUrl, (selectedView) => {
                if (selectedView) {
                    import("./3d-editor.js")
                        .then((editor) => {
                            // First change the camera view
                            import("./scene.js")
                                .then((scene) => {
                                    if (scene.changeCameraView) {
                                        scene.changeCameraView(selectedView);
                                    }
                                    
                                    // Then add the image to the selected view
                                    if (editor.addImage) {
                                        editor.addImage(dataUrl, {
                                            view: selectedView,
                                            center: true,
                                            isDecal: true
                                        }).then(() => {
                                            showToast(`Image added to ${selectedView} view`);
                                            
                                            // Close the panel
                                            const panel = document.getElementById('photo-panel');
                                            const photoButton = document.getElementById('photo-upload-btn');
                                            if (panel && photoButton) {
                                                panel.classList.remove('active');
                                                photoButton.classList.remove('active');
                                            }
                                        });
                                    }
                                });
                        })
                        .catch((error) => {
                            console.error("Error adding image:", error);
                            showToast("Error adding image");
                        });
                }
            }, 'Choose Image Placement');
        }
    });
}

/**
 * Setup camera functionality
 */
function setupCameraFunctionality() {
    const cameraTab = document.getElementById('camera-tab');
    const cameraFeed = document.getElementById('camera-feed');
    const cameraFeedContainer = document.getElementById('camera-feed-container');
    const cameraPreviewContainer = document.getElementById('camera-preview-container');
    const cameraPreview = document.getElementById('camera-preview');
    const captureButton = document.getElementById('camera-capture');
    const switchButton = document.getElementById('camera-switch');
    const flashButton = document.getElementById('camera-flash');
    const retakeButton = document.getElementById('retake-photo');
    const useCameraPhotoButton = document.getElementById('use-camera-photo');
    
    if (!cameraTab || !cameraFeed || !cameraPreview || !captureButton || !retakeButton || !useCameraPhotoButton) return;
    
    let stream = null;
    let facingMode = 'user'; // front camera by default
    let flashOn = false;
    
    // Capture photo
    captureButton.addEventListener('click', () => {
        if (!stream) return;
        
        // Create canvas for screenshot
        const canvas = document.getElementById('camera-preview');
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        
        // Show preview and hide feed
        cameraFeedContainer.style.display = 'none';
        cameraPreviewContainer.style.display = 'block';
    });
    
    // Retake photo
    retakeButton.addEventListener('click', () => {
        // Show feed and hide preview
        cameraFeedContainer.style.display = 'block';
        cameraPreviewContainer.style.display = 'none';
    });
    
    // Use photo button
    useCameraPhotoButton.addEventListener('click', () => {
        // Get the photo data URL
        const dataUrl = cameraPreview.toDataURL('image/png');
        
        // Use the photo
        showViewSelectionModal(dataUrl, (selectedView) => {
            if (selectedView) {
                import("./3d-editor.js")
                    .then((editor) => {
                        // First change the camera view
                        import("./scene.js")
                            .then((scene) => {
                                if (scene.changeCameraView) {
                                    scene.changeCameraView(selectedView);
                                }
                                
                                // Then add the image to the selected view
                                if (editor.addImage) {
                                    editor.addImage(dataUrl, {
                                        view: selectedView,
                                        center: true,
                                        isDecal: true
                                    }).then(() => {
                                        showToast(`Image added to ${selectedView} view`);
                                        
                                        // Close the panel
                                        const panel = document.getElementById('photo-panel');
                                        const photoButton = document.getElementById('photo-upload-btn');
                                        if (panel && photoButton) {
                                            panel.classList.remove('active');
                                            photoButton.classList.remove('active');
                                        }
                                        
                                        // Stop the camera
                                        stopCamera();
                                    });
                                }
                            });
                    })
                    .catch((error) => {
                        console.error("Error adding image:", error);
                        showToast("Error adding image");
                    });
            }
        }, 'Choose Image Placement');
    });
    
    // Switch camera
    if (switchButton) {
        switchButton.addEventListener('click', () => {
            facingMode = facingMode === 'user' ? 'environment' : 'user';
            stopCamera();
            initializeCamera();
        });
    }
    
    // Toggle flash
    if (flashButton) {
        flashButton.addEventListener('click', () => {
            flashOn = !flashOn;
            toggleFlash(flashOn);
            flashButton.innerHTML = flashOn ? '<i class="fas fa-bolt"></i>' : '<i class="fas fa-bolt-slash"></i>';
        });
    }
}

/**
 * Initialize the camera
 */
function initializeCamera() {
    const cameraFeed = document.getElementById('camera-feed');
    const cameraFeedContainer = document.getElementById('camera-feed-container');
    const cameraPreviewContainer = document.getElementById('camera-preview-container');
    
    if (!cameraFeed || !cameraFeedContainer || !cameraPreviewContainer) return;
    
    // Make sure preview is hidden and feed is shown
    cameraFeedContainer.style.display = 'block';
    cameraPreviewContainer.style.display = 'none';
    
    // Check if camera is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera access is not supported by your browser');
        return;
    }
    
    // Stop any existing stream
    stopCamera();
    
    // Access the camera
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: window.facingMode || 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    })
    .then(function(newStream) {
        window.cameraStream = newStream;
        cameraFeed.srcObject = newStream;
        cameraFeed.play();
    })
    .catch(function(error) {
        console.error('Error accessing camera:', error);
        showToast('Could not access camera: ' + error.message);
    });
}

/**
 * Stop the camera stream
 */
function stopCamera() {
    if (window.cameraStream) {
        const tracks = window.cameraStream.getTracks();
        tracks.forEach(track => track.stop());
        window.cameraStream = null;
    }
}

/**
 * Toggle flash (if available)
 */
function toggleFlash(on) {
    if (!window.cameraStream) return;
    
    const track = window.cameraStream.getVideoTracks()[0];
    if (track && track.getCapabilities && track.getCapabilities().torch) {
        track.applyConstraints({
            advanced: [{ torch: on }]
        })
        .catch(error => {
            console.error('Flash not supported:', error);
            showToast('Flash not supported on this device');
        });
    } else {
        showToast('Flash not supported on this device');
    }
}

/**
 * Handle an image upload from file or drag and drop
 */
function handleImageUpload(file) {
    if (!file) return;
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid image file (JPG, PNG, WEBP, SVG)');
        return;
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        showToast('Image file is too large. Maximum size is 10MB.');
        return;
    }
    
    // Read the file
    const reader = new FileReader();
    reader.onload = (event) => {
        // Show view selection modal
        showViewSelectionModal(event.target.result, (selectedView) => {
            if (selectedView) {
                import("./3d-editor.js")
                    .then((editor) => {
                        // First change the camera view
                        import("./scene.js")
                            .then((scene) => {
                                if (scene.changeCameraView) {
                                    scene.changeCameraView(selectedView);
                                }
                                
                                // Then add the image to the selected view
                                if (editor.addImage) {
                                    editor.addImage(event.target.result, {
                                        view: selectedView,
                                        center: true,
                                        isDecal: true
                                    }).then(() => {
                                        showToast(`Image added to ${selectedView} view`);
                                        
                                        // Close the panel
                                        const panel = document.getElementById('photo-panel');
                                        const photoButton = document.getElementById('photo-upload-btn');
                                        if (panel && photoButton) {
                                            panel.classList.remove('active');
                                            photoButton.classList.remove('active');
                                        }
                                    });
                                }
                            });
                    })
                    .catch((error) => {
                        console.error("Error adding image:", error);
                        showToast("Error adding image");
                    });
            }
        }, 'Choose Image Placement');
    };
    reader.readAsDataURL(file);
}

// Add this to your document ready or initialization function
function initTextPanel() {
    const shadowToggle = document.getElementById('shadow-toggle');
    
    if (shadowToggle) {
        shadowToggle.addEventListener('click', function() {
            // Show the shadow panel instead of modal
            const panel = document.getElementById('shadow-panel');
            if (panel) {
                panel.classList.add('active');
                
                // Update the shadow text based on current selection
                updateShadowButtonText();
                
                // Position near the text panel
                const textPanelRect = document.getElementById('text-panel').getBoundingClientRect();
                panel.style.top = textPanelRect.top + 'px';
                panel.style.left = (textPanelRect.right + 20) + 'px';
                
                // Update preview text
                const previewText = panel.querySelector('#shadow-preview-text');
                const activeTextInput = document.querySelector('.text-edit-input');
                if (previewText && activeTextInput) {
                    previewText.textContent = activeTextInput.value;
                    previewText.style.color = getComputedStyle(activeTextInput).color;
                }
            }
        });
    }
    
    // Custom color picker
    const customColorOption = document.querySelector('.custom-color');
    const colorPicker = document.getElementById('custom-color-picker');
    
    if (customColorOption && colorPicker) {
        customColorOption.addEventListener('click', function() {
            colorPicker.click();
        });
        
        colorPicker.addEventListener('change', function() {
            const color = this.value;
            customColorOption.setAttribute('data-color', color);
            
            // Remove active class from all color options
            document.querySelectorAll('.color-option').forEach(option => {
                option.classList.remove('active');
            });
            
            // Add active class to the custom color option
            customColorOption.classList.add('active');
        });
    }
    
    // Regular color options
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Skip if it's the custom color option (handled separately)
            if (this.classList.contains('custom-color')) return;
            
            // Remove active class from all options
            colorOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked option
            this.classList.add('active');
        });
    });

    const shadowBtn = document.getElementById('shadow-btn');
    const moreColorsBtn = document.getElementById('more-colors-btn');

    if (shadowBtn) {
        shadowBtn.addEventListener('click', () => {
            // Check if text input has focus
            const activeElement = document.activeElement;
            if (activeElement && activeElement.classList.contains('text-edit-input')) {
                // Get current shadow settings
                const currentShadow = activeElement.style.textShadow;
                
                // Store the active text input for later
                window.activeTextInput = activeElement;
                
                // Show shadow panel
                const panel = document.getElementById('shadow-panel');
                if (panel) {
                    // Position near the text panel
                    const textPanelRect = document.getElementById('text-panel').getBoundingClientRect();
                    panel.style.top = textPanelRect.top + 'px';
                    panel.style.left = (textPanelRect.right + 20) + 'px';
                    
                    // Show the panel
                    panel.classList.add('active');
                    
                    // Update preview text
                    const previewText = panel.querySelector('#shadow-preview-text');
                    if (previewText && activeElement) {
                        previewText.textContent = activeElement.value;
                        previewText.style.color = getComputedStyle(activeElement).color;
                    }
                }
            }
        });
    }

    if (moreColorsBtn) {
        moreColorsBtn.addEventListener('click', () => {
            // Check if text input has focus
            const activeElement = document.activeElement;
            if (activeElement && activeElement.classList.contains('text-edit-input')) {
                // Store the active text input for later
                window.activeTextInput = activeElement;
                
                // Show color panel
                const panel = document.getElementById('color-panel');
                if (panel) {
                    // Position near the text panel
                    const textPanelRect = document.getElementById('text-panel').getBoundingClientRect();
                    panel.style.top = textPanelRect.top + 'px';
                    panel.style.left = (textPanelRect.right + 20) + 'px';
                    
                    // Show the panel
                    panel.classList.add('active');
                    
                    // Update panel title
                    const panelTitle = panel.querySelector('.panel-header h3');
                    if (panelTitle) {
                        panelTitle.textContent = 'Text Color';
                    }
                }
            }
        });
    }
}

// Function to update the shadow button text based on current selection
function updateShadowButtonText() {
    const shadowButton = document.getElementById('shadow-toggle');
    const shadowText = shadowButton.querySelector('.shadow-text');
    
    // Get current shadow type from the modal or localStorage
    const currentShadow = localStorage.getItem('currentShadowType') || 'None';
    
    if (shadowText) {
        if (currentShadow === 'None') {
            shadowText.textContent = 'Text Shadow Effects';
        } else {
            shadowText.textContent = `Shadow: ${currentShadow}`;
        }
    }
}

// Call the init function when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    initTextPanel();
});