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
 * @param {string} title - Optional title for the modal
 */
export function showViewSelectionModal(imageData, callback, title = 'Choose Placement') {
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
    
    container.innerHTML = `
        <div class="panel-header">
            <h2>${title}</h2>
            <button class="panel-close" aria-label="Close Panel">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="panel-content">
            <p>Select which part of the garment to place your design:</p>
            ${previewHtml}
            <div class="view-options">
                <div class="view-option" data-view="front">
                    <i class="fas fa-tshirt"></i>
                    <span>Front View</span>
                </div>
                <div class="view-option" data-view="back">
                    <i class="fas fa-tshirt fa-flip-horizontal"></i>
                    <span>Back View</span>
                </div>
                <div class="view-option" data-view="left_arm">
                    <i class="fas fa-hand-point-right"></i>
                    <span>Left Sleeve</span>
                </div>
                <div class="view-option" data-view="right_arm">
                    <i class="fas fa-hand-point-left"></i>
                    <span>Right Sleeve</span>
                </div>
            </div>
            <button class="cancel-view-selection">Cancel</button>
        </div>
    `;
    
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
                
                // Setup the file input change event to match the right-side button functionality
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            // Use the existing showViewSelectionModal function instead of creating a new modal
                            showViewSelectionModal(event.target.result, (selectedView) => {
                                if (selectedView) {
                                    // Import and use the 3D editor to:
                                    // 1. Change to selected view
                                    // 2. Add the image to that view
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
                                                            if (panel) {
                                                                panel.classList.remove('active');
                                                                photoButton.classList.remove('active');
                                                            }
                                                        });
                                                    }
                                                });
                                        })
                                        .catch(error => {
                                            console.error("Error adding image:", error);
                                            showToast("Error adding image");
                                        });
                                }
                            }, 'Choose Image Placement');
                        };
                        reader.readAsDataURL(file);
                    }
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
                        fileInput.files = e.dataTransfer.files;
                        const event = new Event('change');
                        fileInput.dispatchEvent(event);
                    }
                });
            }
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
            
            // Import and use the 3d-editor module directly
            import('./3d-editor.js')
                .then((editor) => {
                    // Call the addText function with empty text to start a new text
                    // The fromButton option makes it show in the right position
                    editor.addText('', { fromButton: true });
                })
                .catch((error) => {
                    console.error('Error importing 3d-editor module:', error);
                    showToast('Failed to add text');
                });
                
            // We don't need to show the panel as addText opens its own overlay
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
                preview.innerHTML = '<div class="empty-state"><i class="fas fa-robot"></i><p>Enter a prompt to generate a design</p></div>';
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

    // Handle generate button click
    updatedGenerateBtn.addEventListener('click', async () => {
        console.log('Generate button clicked');
        
        if (isGenerating) {
            console.log('Ignoring click because generation is already in progress');
            return;
        }

        const prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('Please enter a prompt first');
            return;
        }

        if (!serverIsOnline) {
            // If server is not online, try checking again
            await checkAIServer();
            if (!serverIsOnline) {
                showToast('AI server is not available');
                return;
            }
        }

        isGenerating = true;
        updatedGenerateBtn.disabled = true;
        updatedGenerateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Creating your design...</p></div>';

        // Use the generateAIImage function from ai-integration.js
        generateAIImage(prompt, {
            onSuccess: (imageData) => {
                console.log('AI image generated successfully');
                
                // Show the generated image with buttons for apply and download
                preview.innerHTML = `
                <div class="ai-result">
                    <img src="${imageData}" alt="Generated design" />
                    <div class="ai-buttons">
                        <button class="button primary apply-ai-btn">Apply to Shirt</button>
                        <button class="button secondary download-ai-btn"><i class="fas fa-download"></i> Download</button>
                    </div>
                </div>
                `;

                // Add event listener to the apply button
                const applyBtn = preview.querySelector('.apply-ai-btn');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        // Show view selection modal for the AI image
                        showViewSelectionModal(imageData, (selectedView) => {
                            if (selectedView) {
                                // Apply as texture to the selected view
                                import('./texture-mapper.js').then(textureMapper => {
                                    // Use load custom image function with the selected view
                                    textureMapper.loadCustomImage(imageData, selectedView, {
                                        smartPlacement: true,
                                        autoAdjust: true
                                    }).then(() => {
                                        showToast(`AI design applied to ${selectedView} view`);
                                        
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
                                    });
                                });
                            }
                        }, 'Choose Where to Apply AI Design');
                    });
                }

                // Add event listener to the download button
                const downloadBtn = preview.querySelector('.download-ai-btn');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => {
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
            },
            onError: (errorMessage) => {
                console.error('Error generating AI image:', errorMessage);
                preview.innerHTML = `<div class="error"><p>Error: ${errorMessage}</p></div>`;
            },
            onEnd: () => {
                isGenerating = false;
                updatedGenerateBtn.disabled = false;
                updatedGenerateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate';
            }
        });
    });
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
        { id: 'ai-generator-btn', icon: 'fa-magic', text: 'AI Design', panelId: 'ai-panel', panelTitle: 'AI Design Generator' },
        { id: 'download-btn', icon: 'fa-download', text: 'Save', panelId: 'download-panel', panelTitle: 'Save Your Design' }
    ];
    
    // Create buttons if they don't exist
    buttonData.forEach(data => {
        if (!document.getElementById(data.id)) {
            console.log(`Creating floating button: ${data.id}`);
            const button = document.createElement('button');
            button.id = data.id;
            button.className = 'floating-btn';
            button.innerHTML = `<i class="fas ${data.icon}"></i><span>${data.text}</span>`;
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
                <input type="text" class="text-edit-input" placeholder="Enter your text here" />
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
                <div class="text-edit-colors">
                    <div class="color-option active" style="background-color: #000000" data-color="#000000"></div>
                    <div class="color-option" style="background-color: #FFFFFF" data-color="#FFFFFF"></div>
                    <div class="color-option" style="background-color: #FF0000" data-color="#FF0000"></div>
                    <div class="color-option" style="background-color: #00FF00" data-color="#00FF00"></div>
                    <div class="color-option" style="background-color: #0000FF" data-color="#0000FF"></div>
                    <div class="color-option" style="background-color: #FFFF00" data-color="#FFFF00"></div>
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

            <div class="ai-input-container">
                <textarea
                    id="ai-prompt"
                    placeholder="Describe your design idea... (e.g. 'A cosmic astronaut floating in space with stars and nebulae')"
                    aria-label="AI Prompt"
                ></textarea>
                <button id="ai-generate" class="button primary">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    Generate
                </button>
            </div>

            <div class="ai-preview">
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>AI generated designs will appear here</p>
                </div>
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