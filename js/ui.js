import { updateState, state } from './state.js';
import { updateShirtColor, updateShirtTexture, toggleTexture, changeCameraView, updateThemeBackground } from './scene.js';
import { loadCustomImage, clearCustomImage, showBoundingBoxesForCameraView, setTexturePosition } from './texture-mapper.js';
import { generateAIImage, checkAIServerStatus } from './ai-integration.js';

// Define preset colors for t-shirts
export const presetColors = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Gray': '#808080',
    'Navy Blue': '#000080',
    'Beige': '#F5F5DC',
    'Olive Green': '#556B2F',
    'Brown': '#8B4513',
    'Burgundy': '#800020'
};

// The default color
export const defaultColor = '#FFFFFF';

/**
 * Initialize color picker and preset colors
 */
export function initializeColorPicker() {
    const colorPreview = document.getElementById('color-preview');
    const colorName = document.getElementById('color-name');
    const colorHex = document.getElementById('color-hex');
    const presetsContainer = document.querySelector('.preset-colors .colors');

    if (!colorPreview || !colorName || !colorHex || !presetsContainer) {
        console.warn('Color picker elements not found');
        return;
    }

    // Set up color preview as a color picker
    colorPreview.addEventListener('click', () => {
        // Create a color input element
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = colorHex.textContent || defaultColor;

        // Trigger click on the input to open color picker
        colorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            updateColorUI(newColor, 'Custom');
            updateShirtColor(newColor);
            updateState({ color: newColor });
        });

        colorInput.addEventListener('change', (e) => {
            const newColor = e.target.value;
            updateColorUI(newColor, 'Custom');
            updateShirtColor(newColor);
            updateState({ color: newColor });
        });

        colorInput.click();
    });

    // Add preset colors to the container
    presetsContainer.innerHTML = '';
    Object.entries(presetColors).forEach(([name, hex]) => {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        colorBtn.style.backgroundColor = hex;
        colorBtn.setAttribute('data-color', hex);
        colorBtn.setAttribute('data-name', name);
        colorBtn.title = name;

        // Add name label that appears on hover
        const nameLabel = document.createElement('span');
        nameLabel.className = 'color-name-label';
        nameLabel.textContent = name;
        colorBtn.appendChild(nameLabel);

        colorBtn.addEventListener('click', () => {
            updateColorUI(hex, name);
            updateShirtColor(hex);
            updateState({ color: hex });

            // Update active state
            document.querySelectorAll('.color-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            colorBtn.classList.add('active');
        });

        presetsContainer.appendChild(colorBtn);
    });

    // Initialize with default color
    updateColorUI(defaultColor, 'White');
}

/**
 * Update the color UI with the given color and name
 */
function updateColorUI(hexColor, colorNameText) {
    const colorPreview = document.getElementById('color-preview');
    const colorName = document.getElementById('color-name');
    const colorHex = document.getElementById('color-hex');

    if (colorPreview) colorPreview.style.backgroundColor = hexColor;
    if (colorName) colorName.textContent = colorNameText;
    if (colorHex) colorHex.textContent = hexColor;
}

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

    // Initialize color picker
    initializeColorPicker();
}

// Setup camera view buttons to show appropriate bounding boxes
export function setupCameraViewButtons() {
    const viewButtons = document.querySelectorAll('.camera-view-btn');
    if (!viewButtons.length) return;

    viewButtons.forEach(button => {
        // Store reference to original click handler
        const originalClickHandler = button.onclick;

        // Replace with new handler that also updates bounding boxes
        button.onclick = function (e) {
            // Call original handler if it exists
            if (originalClickHandler) {
                originalClickHandler.call(this, e);
            }

            // Get view from data attribute
            const view = this.dataset.view;
            if (view) {
                // Update state
                updateState({ cameraView: view });

                // Show appropriate bounding boxes for this view
                showBoundingBoxesForCameraView(view);

                // Update active state on buttons
                viewButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
            }
        };
    });
}

// Enhanced file picker with texture mapping integration
export function setupFilePicker() {
    const fileInput = document.getElementById('file-upload');
    const preview = document.querySelector('#file-picker .preview');
    const uploadLabel = document.querySelector('.file-upload-label');

    // Add clear button to the file picker section
    const filePickerSection = document.getElementById('file-picker');
    if (filePickerSection) {
        // Create clear button if it doesn't exist
        if (!document.getElementById('clear-texture-btn')) {
            const clearButtonContainer = document.createElement('div');
            clearButtonContainer.className = 'clear-button-container';

            const clearButton = document.createElement('button');
            clearButton.id = 'clear-texture-btn';
            clearButton.className = 'button secondary';
            clearButton.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Current View';

            clearButton.addEventListener('click', () => {
                // Get current view
                const currentView = state.cameraView || 'front';

                // Clear the texture for this view
                clearCustomImage(currentView);

                // Clear the preview
                if (preview) {
                    preview.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-image"></i>
                            <p>Preview will appear here</p>
                        </div>
                    `;
                }

                // Show feedback
                showToast(`Texture cleared from ${currentView} view`);
            });

            clearButtonContainer.appendChild(clearButton);
            filePickerSection.appendChild(clearButtonContainer);

            // Add clear all textures button
            const clearAllButton = document.createElement('button');
            clearAllButton.id = 'clear-all-textures-btn';
            clearAllButton.className = 'button secondary';
            clearAllButton.innerHTML = '<i class="fas fa-trash"></i> Clear All Textures';
            clearAllButton.style.marginTop = '10px';

            clearAllButton.addEventListener('click', () => {
                // Clear all textures
                clearCustomImage('all');

                // Clear the preview
                if (preview) {
                    preview.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-image"></i>
                            <p>Preview will appear here</p>
                        </div>
                    `;
                }

                // Show feedback
                showToast('All textures cleared');
            });

            clearButtonContainer.appendChild(clearAllButton);
        }
    }

    if (!fileInput || !preview || !uploadLabel) return;

    // Add drag and drop support
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when file is dragged over
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
            uploadLabel.classList.add('active');
        }, false);
    });

    // Remove highlight when file is no longer over drop area
    ['dragleave', 'drop'].forEach(eventName => {
        uploadLabel.addEventListener(eventName, () => {
            uploadLabel.classList.remove('active');
        }, false);
    });

    // Handle dropped files
    uploadLabel.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            fileInput.files = files;
            handleFileUpload(files[0]);
        }
    }, false);

    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        handleFileUpload(e.target.files[0]);
    });

    // Function to handle file upload with proper feedback
    function handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file.');
            return;
        }

        // File size validation (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            showError('File is too large. Maximum allowed size is 5MB.');
            return;
        }

        try {
            // Clear empty state and show loading with better styling
            preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Processing image...</p></div>';

            const reader = new FileReader();
            reader.onload = (event) => {
                // Create image for preview
                const img = document.createElement('img');
                img.src = event.target.result;

                // When image loads, show it in preview and update shirt
                img.onload = () => {
                    // Animate preview transition
                    preview.style.opacity = '0';
                    setTimeout(() => {
                        preview.innerHTML = '';
                        preview.appendChild(img);
                        preview.style.opacity = '1';
                    }, 300);

                    // Check if a specific target view was specified (from double-click or other means)
                    const fileInput = document.getElementById('file-upload');
                    let targetView = fileInput && fileInput.dataset.targetView;

                    // If no target view was specified, use the current camera view
                    if (!targetView) {
                        targetView = state.cameraView || 'front';
                    }

                    // Show texture application info
                    const infoBox = document.createElement('div');
                    infoBox.className = 'texture-info';
                    infoBox.innerHTML = `
                        <p><strong>Applied to:</strong> ${targetView} area</p>
                        <p><small>Double-click areas to add more images</small></p>
                    `;
                    preview.appendChild(infoBox);

                    // Add a clear button to the preview
                    const clearButton = document.createElement('button');
                    clearButton.className = 'button secondary clear-texture-btn';
                    clearButton.innerHTML = '<i class="fas fa-trash-alt"></i> Remove Image';
                    clearButton.addEventListener('click', () => {
                        if (typeof clearCustomImage === 'function') {
                            clearCustomImage(targetView);
                            showToast(`Removed image from ${targetView} area`);
                            // Clear the preview
                            preview.innerHTML = '<div class="empty-state"><i class="fas fa-upload"></i><p>Upload an image to customize</p></div>';
                        }
                    });
                    preview.appendChild(clearButton);

                    // Load the image into the texture mapper for the target view
                    loadCustomImage(event.target.result, targetView)
                        .then(() => {
                            console.log(`Image applied to ${targetView} area`);

                            // Show a success message
                            showToast(`Image applied to ${targetView} area`);

                            // Clear the target view from the file input
                            if (fileInput) {
                                delete fileInput.dataset.targetView;
                            }
                        })
                        .catch(error => {
                            console.error('Error applying image:', error);
                            showError('Error applying image. Please try again.');
                        });
                };
            };

            reader.onerror = () => {
                showError('Error reading file. Please try again.');
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error('File upload error:', error);
            showError('An unexpected error occurred. Please try again.');
        }
    }

    function showError(message) {
        if (!preview) return;

        preview.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    function showToast(message, type = 'info') {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast-message');
        existingToasts.forEach(toast => toast.remove());

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        
        // Set icon based on message type
        let icon = 'fa-info-circle';
        if (type === 'success') {
            icon = 'fa-check-circle';
        } else if (type === 'warning') {
            icon = 'fa-exclamation-triangle';
        } else if (type === 'error') {
            icon = 'fa-exclamation-circle';
        }
        
        toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        if (type !== 'info') {
            toast.classList.add(type);
        }
        
        document.body.appendChild(toast);

        // Show and then hide the toast
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
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
        max-width: 650px;
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
        max-width: 650px;
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
    
    /* Reset button container styles */
    .reset-button-container {
        display: flex;
        justify-content: center;
        margin-top: 12px;
        margin-bottom: 8px;
        width: 100%;
        padding: 6px 0;
        border-top: 1px solid var(--border-color-light);
    }
    
    #reset-image-btn {
        padding: 5px 10px;
        font-size: 0.85rem;
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        width: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 80px;
        max-width: 120px;
    }
    
    #reset-image-btn:hover {
        background-color: var(--bg-hover);
        color: var(--primary-color);
        transform: translateY(-1px);
        box-shadow: 0 2px 3px rgba(0,0,0,0.1);
    }
    
    #reset-image-btn:active {
        transform: translateY(0);
        box-shadow: 0 1px 1px rgba(0,0,0,0.1);
        background-color: var(--bg-secondary);
    }
    
    #reset-image-btn i {
        margin-right: 5px;
        font-size: 0.85rem;
    }
`;
document.head.appendChild(styleElement);

// Track if AI picker has been set up
let aiPickerInitialized = false;

export function setupAIPicker() {
    // If already initialized, don't set up again
    if (aiPickerInitialized) {
        console.log('AI Picker already initialized, skipping setup');
        return;
    }

    const promptInput = document.getElementById('ai-prompt');
    const generateBtn = document.getElementById('ai-generate');
    const preview = document.querySelector('.ai-preview');

    if (!promptInput || !generateBtn || !preview) {
        console.warn('AI Picker elements not found');
        return;
    }

    console.log('Setting up AI Picker with generate button:', generateBtn.id);
    aiPickerInitialized = true;

    let isGenerating = false;
    let serverIsOnline = false;

    // Function to check server status
    const checkServerStatus = async () => {
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Checking AI server status...</p></div>';

        try {
            // Use the new checkAIServerStatus function from ai-integration.js
            serverIsOnline = await checkAIServerStatus();

            if (serverIsOnline) {
                preview.innerHTML = '<p>The design will be displayed here</p>';
                generateBtn.disabled = false;
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
            }
        } catch (error) {
            console.error('Error checking server status:', error);
            preview.innerHTML = '<div class="error"><p>Error connecting to AI server</p></div>';
            generateBtn.disabled = true;
        }
    };

    // Function to show AI setup instructions
    const showAISetupInstructions = () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Setting up the AI Server</h3>
            <div class="modal-body">
                <p>To use the AI Design Generator, you need to set up a local server. Follow these steps:</p>
                <ol>
                    <li>Clone the AI server repository: <code>git clone https://github.com/example/ai-server.git</code></li>
                    <li>Navigate to the server directory: <code>cd server</code></li>
                    <li>Install dependencies: <code>npm install</code></li>
                    <li>Create a <code>.env</code> file with your AI API key</li>
                    <li>Start the server: <code>npm start</code></li>
                </ol>
                <p>Once the server is running, refresh this page and try again.</p>
                <div class="note">
                    <p><strong>Note:</strong> The AI server is now using fal.ai for image generation.</p>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    };

    // Check server status when AI tab is clicked
    document.querySelector('.tab-btn[data-tab="ai"]')?.addEventListener('click', checkServerStatus);

    // Initial server status check
    checkServerStatus();

    // Handle generate button click
    generateBtn.addEventListener('click', async (event) => {
        console.log('Generate button clicked', new Date().toISOString());
        console.log('Event:', event.type, event.target.id);
        console.log('Is generating:', isGenerating);
        console.trace('Click handler stack trace');

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
            await checkServerStatus();
            if (!serverIsOnline) {
                return;
            }
        }

        isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Creating your design...</p></div>';

        // Use the new generateAIImage function from ai-integration.js
        generateAIImage(prompt, {
            onSuccess: (imageData) => {
                // Show the generated image with buttons for apply, edit, and download
                preview.innerHTML = `
                <div class="ai-result">
                    <div class="editor-header">
                        <div></div>
                        <button class="editor-close"><i class="fas fa-times"></i></button>
                    </div>
                    <img src="${imageData}" alt="Generated design" />
                    <div class="ai-buttons">
                        <button class="button primary apply-ai-btn">Apply to Shirt</button>
                        <button class="button secondary edit-ai-btn"><i class="fas fa-pencil-alt"></i> Edit</button>
                        <button class="button secondary download-ai-btn"><i class="fas fa-download"></i> Download</button>
                    </div>
                    <div class="editor-tools" style="display: none;">
                        <div class="tool-categories">
                            <div class="tool-category">
                                <button class="category-btn" data-category="adjust">
                                    <div class="btn-content">
                                        <i class="fas fa-sliders-h"></i>
                                        <span>Adjust</span>
                                    </div>
                                    <i class="arrow fas fa-chevron-down"></i>
                                </button>
                                <div class="category-options">
                                    <div class="adjust-tool">
                                        <label>Brightness</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Contrast</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Saturation</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Sharpness</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Exposure</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Temperature</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Shadows</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                    <div class="adjust-tool">
                                        <label>Highlights</label>
                                        <input type="range" class="slider" min="0" max="200" value="100">
                                    </div>
                                </div>
                            </div>

                            <div class="tool-category">
                                <button class="category-btn" data-category="enhance">
                                    <div class="btn-content">
                                        <i class="fas fa-magic"></i>
                                        <span>Enhance</span>
                                    </div>
                                    <i class="arrow fas fa-chevron-down"></i>
                                </button>
                                <div class="category-options">
                                    <button class="tool-button">
                                        <i class="fas fa-eraser"></i>
                                        <span>Remove Background</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-paint-brush"></i>
                                        <span>Smart Enhance</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-portrait"></i>
                                        <span>Portrait Mode</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-tint"></i>
                                        <span>Color Balance</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-border-none"></i>
                                        <span>Noise Reduction</span>
                                    </button>
                                </div>
                            </div>

                            <div class="tool-category">
                                <button class="category-btn" data-category="transform">
                                    <div class="btn-content">
                                        <i class="fas fa-crop-alt"></i>
                                        <span>Transform</span>
                                    </div>
                                    <i class="arrow fas fa-chevron-down"></i>
                                </button>
                                <div class="category-options">
                                    <button class="tool-button">
                                        <i class="fas fa-crop"></i>
                                        <span>Crop</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-rotate"></i>
                                        <span>Rotate</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-expand"></i>
                                        <span>Resize</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-sync-alt"></i>
                                        <span>Flip</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-vector-square"></i>
                                        <span>Perspective</span>
                                    </button>
                                </div>
                            </div>

                            <div class="tool-category">
                                <button class="category-btn" data-category="filter">
                                    <div class="btn-content">
                                        <i class="fas fa-filter"></i>
                                        <span>Filter</span>
                                    </div>
                                    <i class="arrow fas fa-chevron-down"></i>
                                </button>
                                <div class="category-options">
                                    <button class="tool-button">
                                        <i class="fas fa-sun"></i>
                                        <span>Vintage</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-moon"></i>
                                        <span>Noir</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-star"></i>
                                        <span>Chrome</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-rainbow"></i>
                                        <span>Sepia</span>
                                    </button>
                                    <button class="tool-button">
                                        <i class="fas fa-adjust"></i>
                                        <span>Black & White</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="reset-button-container">
                                <button id="reset-image-btn" class="button secondary">
                                    <i class="fas fa-undo"></i> Reset Image
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                `;

                // Add event listeners for the edit functionality
                const editBtn = preview.querySelector('.edit-ai-btn');
                const editorTools = preview.querySelector('.editor-tools');
                const editorClose = preview.querySelector('.editor-close');
                const aiButtons = preview.querySelector('.ai-buttons');

                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        // Show editing tools and hide normal buttons
                        editorTools.style.display = 'block';
                        aiButtons.style.display = 'none';
                        editorClose.style.display = 'block';
                        
                        // Add editing class to enable scrolling
                        const aiPreview = document.querySelector('.ai-preview');
                        if (aiPreview) {
                            aiPreview.classList.add('editing');
                        }

                        // Add expanded class to container for proper scrolling
                        const container = document.querySelector('.image-editor-container');
                        if (container) {
                            container.classList.add('expanded');
                        }

                        // Initialize the editor tools
                        setupImageEditor();
                    });
                }

                if (editorClose) {
                    editorClose.addEventListener('click', () => {
                        const saveDialog = document.querySelector('.save-dialog');
                        if (saveDialog) {
                            saveDialog.style.display = 'flex';
                            
                            const saveYes = saveDialog.querySelector('.save-yes');
                            const saveNo = saveDialog.querySelector('.save-no');
                            
                            const resetEditorState = () => {
                                // Hide the editor tools
                                const editorTools = document.querySelector('.editor-tools');
                                if (editorTools) {
                                    editorTools.style.display = 'none';
                                }
                                
                                // Show the AI buttons
                                const aiButtons = document.querySelector('.ai-buttons');
                                if (aiButtons) {
                                    aiButtons.style.display = 'flex';
                                }
                                
                                // Remove editing class from AI preview
                                const aiPreview = document.querySelector('.ai-preview');
                                if (aiPreview) {
                                    aiPreview.classList.remove('editing');
                                }
                                
                                // Remove expanded class from container
                                const container = document.querySelector('.image-editor-container');
                                if (container) {
                                    container.classList.remove('expanded');
                                }
                                
                                // Hide all category options
                                const categoryOptions = document.querySelectorAll('.category-options');
                                categoryOptions.forEach(option => {
                                    option.classList.remove('show');
                                });
                                
                                // Remove active state from category buttons
                                const categoryButtons = document.querySelectorAll('.category-btn');
                                categoryButtons.forEach(button => {
                                    button.classList.remove('active');
                                });
                                
                                // Reset editor close button
                                const editorClose = document.querySelector('.editor-close');
                                if (editorClose) {
                                    editorClose.style.display = 'none';
                                }
                            };
                            
                            // Setup save dialog button handlers
                            if (saveYes) {
                                saveYes.onclick = () => {
                                    saveDialog.style.display = 'none';
                                    
                                    // Get the image processor instance
                                    const imageElement = document.querySelector('.ai-preview img');
                                    if (imageElement && window.currentImageProcessor) {
                                        // Apply the processed image data
                                        const processedImageData = window.currentImageProcessor.getProcessedImageData();
                                        imageElement.src = processedImageData;
                                        
                                        // Show success toast
                                        showToast('Changes saved successfully');
                                    }
                                    
                                    resetEditorState();
                                };
                            }
                            
                            if (saveNo) {
                                saveNo.onclick = () => {
                                    saveDialog.style.display = 'none';
                                    
                                    // Reset the image to its original state
                                    const imageElement = document.querySelector('.ai-preview img');
                                    if (imageElement && window.currentImageProcessor) {
                                        window.currentImageProcessor.reset();
                                    }
                                    
                                    // Show toast
                                    showToast('Changes discarded');
                                    
                                    resetEditorState();
                                };
                            }
                        }
                    });
                }

                // Add event listener to the apply button
                const applyBtn = preview.querySelector('.apply-ai-btn');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        // Apply as full texture
                        updateShirtTexture(imageData, 'full');
                        updateState({ stylish: true });

                        showToast('Applied AI design to shirt');
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
                preview.innerHTML = `<div class="error"><p>Error: ${errorMessage}</p></div>`;
                console.error('Error generating AI image:', errorMessage);
            },
            onEnd: () => {
                isGenerating = false;
                generateBtn.disabled = false;
                generateBtn.innerHTML = 'Generate';
            }
        });
    });

    // Helper functions for UI feedback
    function showToast(message, type = 'info') {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast-message');
        existingToasts.forEach(toast => toast.remove());

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        
        // Set icon based on message type
        let icon = 'fa-info-circle';
        if (type === 'success') {
            icon = 'fa-check-circle';
        } else if (type === 'warning') {
            icon = 'fa-exclamation-triangle';
        } else if (type === 'error') {
            icon = 'fa-exclamation-circle';
        }
        
        toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
        if (type !== 'info') {
            toast.classList.add(type);
        }
        
        document.body.appendChild(toast);

        // Show and then hide the toast
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}

/**
 * Setup theme toggle button
 */
export function setupThemeToggle() {
    console.log('Setting up theme toggle...');

    // Get the theme toggle elements
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    if (!themeToggle || !themeIcon) {
        console.error('Theme toggle elements not found in the DOM');
        return;
    }

    // Determine initial theme from localStorage or default to light
    const savedTheme = localStorage.getItem('theme');
    let currentTheme = savedTheme || 'light';

    // Immediately apply the saved theme when the page loads
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeUI(currentTheme);

    // Update the background based on the current theme
    if (typeof updateThemeBackground === 'function') {
        updateThemeBackground(currentTheme);
    } else {
        console.warn('updateThemeBackground function not found');
    }

    // Add click event listener to toggle theme
    themeToggle.addEventListener('click', function () {
        console.log('Theme toggle clicked, current theme:', currentTheme);

        // Toggle the theme
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';

        // Update localStorage
        localStorage.setItem('theme', currentTheme);

        // Update the body attribute
        document.body.setAttribute('data-theme', currentTheme);

        // Update the icon and UI
        updateThemeUI(currentTheme);

        // Update the background
        if (typeof updateThemeBackground === 'function') {
            updateThemeBackground(currentTheme);
        } else {
            console.warn('updateThemeBackground function not found when toggling');
        }

        // Log the change
        console.log('Theme changed to:', currentTheme);
    });

    console.log('Theme toggle setup completed');
}

// Function to update theme UI elements
function updateThemeUI(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (!themeIcon) return;

    // Update the icon
    if (theme === 'dark') {
        themeIcon.classList.remove('bi-sun-fill');
        themeIcon.classList.add('bi-moon-fill');
    } else {
        themeIcon.classList.remove('bi-moon-fill');
        themeIcon.classList.add('bi-sun-fill');
    }

    // Update any other UI elements that depend on the theme
    const themeLabel = document.getElementById('themeLabel');
    if (themeLabel) {
        themeLabel.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
}

/**
 * Trigger file upload dialog for a specific view
 * @param {string} view - The view to upload for (front, back, etc.)
 */
export function triggerFileUploadForView(view) {
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        // Store the target view
        fileInput.dataset.targetView = view;

        // Create and show a toast message
        showToast(`Select an image for the ${view} area`);

        // Trigger the file input
        fileInput.click();
    }
}

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize all components
        initializeTabs();
        setupFilePicker();
        setupCameraViewButtons();
        setupThemeToggle();
        
        // Add toast styles
        const toastStyles = document.createElement('style');
        toastStyles.textContent = `
            .toast-message {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: var(--bg-primary);
                color: var(--text-primary);
                padding: 12px 20px;
                border-radius: var(--border-radius-md);
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                font-size: 0.95rem;
                display: flex;
                align-items: center;
                transition: opacity 0.3s ease;
                border-left: 4px solid var(--primary-color);
            }
            
            .toast-message i {
                margin-right: 10px;
                font-size: 1.1rem;
                color: var(--primary-color);
            }
            
            .toast-message.success {
                border-color: var(--success-color);
            }
            
            .toast-message.success i {
                color: var(--success-color);
            }
            
            .toast-message.warning {
                border-color: #f59e0b;
            }
            
            .toast-message.warning i {
                color: #f59e0b;
            }
            
            .toast-message.error {
                border-color: #ef4444;
            }
            
            .toast-message.error i {
                color: #ef4444;
            }
        `;
        document.head.appendChild(toastStyles);
    } catch (error) {
        console.error('Error initializing UI components:', error);
    }
});

// Add this after your existing AI preview HTML setup
const editorHTML = `
    <div class="edit-confirm-modal">
        <div class="edit-confirm-dialog">
            <h3>Would you like to edit this image?</h3>
            <div class="edit-confirm-buttons">
                <button class="confirm-yes">Yes, Edit Image</button>
                <button class="confirm-no">No, Cancel</button>
            </div>
        </div>
    </div>

    <div class="image-editor-modal">
        <div class="image-editor-container">
            <div class="editor-header">
                <h2>Image Editor</h2>
                <button class="editor-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="editor-main">
                <div class="editor-image-container">
                    <img src="" alt="Editing image" id="editing-image">
                </div>
                <div class="editor-tools">
                    <div class="tool-categories">
                        <div class="tool-category">
                            <button class="category-btn" data-category="adjust">
                                <div class="btn-content">
                                    <i class="fas fa-sliders-h"></i>
                                    <span>Adjust</span>
                                </div>
                                <i class="arrow fas fa-chevron-down"></i>
                            </button>
                            <div class="category-options adjust-options">
                                <div class="adjust-tool">
                                    <label>Brightness</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Contrast</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Saturation</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Sharpness</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Exposure</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Temperature</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Shadows</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                                <div class="adjust-tool">
                                    <label>Highlights</label>
                                    <input type="range" class="slider" min="0" max="200" value="100">
                                </div>
                            </div>
                        </div>

                        <div class="tool-category">
                            <button class="category-btn" data-category="enhance">
                                <div class="btn-content">
                                    <i class="fas fa-magic"></i>
                                    <span>Enhance</span>
                                </div>
                                <i class="arrow fas fa-chevron-down"></i>
                            </button>
                            <div class="category-options enhance-options">
                                <button class="tool-button">
                                    <i class="fas fa-cut"></i>
                                    <span>Remove Background</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-wand-magic-sparkles"></i>
                                    <span>Smart Enhance</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-portrait"></i>
                                    <span>Portrait Mode</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-tint"></i>
                                    <span>Color Balance</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-border-none"></i>
                                    <span>Noise Reduction</span>
                                </button>
                            </div>
                        </div>

                        <div class="tool-category">
                            <button class="category-btn" data-category="transform">
                                <div class="btn-content">
                                    <i class="fas fa-crop-alt"></i>
                                    <span>Transform</span>
                                </div>
                                <i class="arrow fas fa-chevron-down"></i>
                            </button>
                            <div class="category-options transform-options">
                                <button class="tool-button">
                                    <i class="fas fa-crop"></i>
                                    <span>Crop</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-rotate"></i>
                                    <span>Rotate</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-expand"></i>
                                    <span>Resize</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-sync-alt"></i>
                                    <span>Flip</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-vector-square"></i>
                                    <span>Perspective</span>
                                </button>
                            </div>
                        </div>

                        <div class="tool-category">
                            <button class="category-btn" data-category="filter">
                                <div class="btn-content">
                                    <i class="fas fa-filter"></i>
                                    <span>Filter</span>
                                </div>
                                <i class="arrow fas fa-chevron-down"></i>
                            </button>
                            <div class="category-options filter-options">
                                <button class="tool-button">
                                    <i class="fas fa-sun"></i>
                                    <span>Vintage</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-moon"></i>
                                    <span>Noir</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-star"></i>
                                    <span>Chrome</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-rainbow"></i>
                                    <span>Sepia</span>
                                </button>
                                <button class="tool-button">
                                    <i class="fas fa-adjust"></i>
                                    <span>Black & White</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="reset-button-container">
                            <button id="reset-image-btn" class="button secondary">
                                <i class="fas fa-undo"></i> Reset Image
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="save-dialog">
        <h3>Save Changes?</h3>
        <div class="save-dialog-buttons">
            <button class="save-yes">Save Changes</button>
            <button class="save-no">Discard</button>
        </div>
    </div>
`;

// Add this to your existing code where you handle the AI preview setup
document.body.insertAdjacentHTML('beforeend', editorHTML);

// Add event listeners for the editor functionality
const editConfirmModal = document.querySelector('.edit-confirm-modal');
const imageEditorModal = document.querySelector('.image-editor-modal');
const saveDialog = document.querySelector('.save-dialog');
const editingImage = document.getElementById('editing-image');

// Function to handle edit button click
function handleEditButtonClick(imageUrl) {
    editConfirmModal.style.display = 'flex';
    
    // Handle confirmation dialog
    const confirmYes = editConfirmModal.querySelector('.confirm-yes');
    const confirmNo = editConfirmModal.querySelector('.confirm-no');
    
    confirmYes.onclick = () => {
        editConfirmModal.style.display = 'none';
        imageEditorModal.style.display = 'flex';
        editingImage.src = imageUrl;
        setupImageEditor(); // Initialize the editor
    };
    
    confirmNo.onclick = () => {
        editConfirmModal.style.display = 'none';
    };
}

// Handle editor close button
const editorClose = document.querySelector('.editor-close');
if (editorClose) {
    editorClose.onclick = () => {
        const saveDialog = document.querySelector('.save-dialog');
        if (saveDialog) {
            saveDialog.style.display = 'flex';
            
            const saveYes = saveDialog.querySelector('.save-yes');
            const saveNo = saveDialog.querySelector('.save-no');
            
            const resetEditorState = () => {
                // Hide the editor tools
                const editorTools = document.querySelector('.editor-tools');
                if (editorTools) {
                    editorTools.style.display = 'none';
                }
                
                // Show the AI buttons
                const aiButtons = document.querySelector('.ai-buttons');
                if (aiButtons) {
                    aiButtons.style.display = 'flex';
                }
                
                // Remove editing class from AI preview
                const aiPreview = document.querySelector('.ai-preview');
                if (aiPreview) {
                    aiPreview.classList.remove('editing');
                }
                
                // Remove expanded class from container
                const container = document.querySelector('.image-editor-container');
                if (container) {
                    container.classList.remove('expanded');
                }
                
                // Hide all category options
                const categoryOptions = document.querySelectorAll('.category-options');
                categoryOptions.forEach(option => {
                    option.classList.remove('show');
                });
                
                // Remove active state from category buttons
                const categoryButtons = document.querySelectorAll('.category-btn');
                categoryButtons.forEach(button => {
                    button.classList.remove('active');
                });
                
                // Reset editor close button
                const editorClose = document.querySelector('.editor-close');
                if (editorClose) {
                    editorClose.style.display = 'none';
                }
            };
            
            // Setup save dialog button handlers
            if (saveYes) {
                saveYes.onclick = () => {
                    saveDialog.style.display = 'none';
                    
                    // Get the image processor instance
                    const imageElement = document.querySelector('.ai-preview img');
                    if (imageElement && window.currentImageProcessor) {
                        // Apply the processed image data
                        const processedImageData = window.currentImageProcessor.getProcessedImageData();
                        imageElement.src = processedImageData;
                        
                        // Show success toast
                        showToast('Changes saved successfully');
                    }
                    
                    resetEditorState();
                };
            }
            
            if (saveNo) {
                saveNo.onclick = () => {
                    saveDialog.style.display = 'none';
                    
                    // Reset the image to its original state
                    const imageElement = document.querySelector('.ai-preview img');
                    if (imageElement && window.currentImageProcessor) {
                        window.currentImageProcessor.reset();
                    }
                    
                    // Show toast
                    showToast('Changes discarded');
                    
                    resetEditorState();
                };
            }
        }
    };
}

// Add this after your existing editor functionality setup
function setupImageEditor() {
    const editorTools = document.querySelector('.editor-tools');
    if (!editorTools) return;
    
    // Get references to the image and create a canvas for editing
    const imageElement = document.querySelector('.ai-preview img') || document.getElementById('editing-image');
    if (!imageElement) {
        console.error('Image element not found');
        return;
    }

    // Initialize image processor and store it globally so it can be accessed by save dialog
    const imageProcessor = new ImageProcessor(imageElement);
    window.currentImageProcessor = imageProcessor;
    
    // Setup reset buttons
    const resetButtons = document.querySelectorAll('#reset-image-btn');
    resetButtons.forEach(resetButton => {
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                // Reset the image without confirmation
                imageProcessor.reset();
                showToast('Image reset to original', 'success');
                
                // Also reset all sliders to their default values
                const sliders = document.querySelectorAll('.slider');
                sliders.forEach(slider => {
                    slider.value = 100;
                });
                
                // Hide any open category options
                const categoryOptions = document.querySelectorAll('.category-options');
                categoryOptions.forEach(option => {
                    option.classList.remove('show');
                });
                
                // Remove active state from category buttons
                const categoryButtons = document.querySelectorAll('.category-btn');
                categoryButtons.forEach(button => {
                    button.classList.remove('active');
                });
            });
        }
    });
    
    // Add event listeners for category buttons
    const categoryButtons = editorTools.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.category;
            const options = editorTools.querySelector(`.${category}-options`) || 
                           editorTools.querySelector(`[data-category="${category}"] + .category-options`);
            
            // Close all other category options
            categoryButtons.forEach(btn => {
                if (btn !== button) {
                    const otherCategory = btn.dataset.category;
                    const otherOptions = editorTools.querySelector(`.${otherCategory}-options`) || 
                                        editorTools.querySelector(`[data-category="${otherCategory}"] + .category-options`);
                    if (otherOptions) {
                        otherOptions.classList.remove('show');
                        btn.classList.remove('active');
                    }
                }
            });
            
            // Toggle the clicked category
            if (options) {
                options.classList.toggle('show');
                button.classList.toggle('active');
                
                // Log for debugging
                console.log(`Toggled ${category} options. Active: ${button.classList.contains('active')}`);
            }
        });
    });

    // Add event listeners for tool buttons
    const toolButtons = editorTools.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Get the tool name from the button text
            const toolName = button.querySelector('span')?.textContent || 'Unknown tool';
            
            // Apply the appropriate filter based on the tool name
            switch(toolName.trim()) {
                case 'Remove Background':
                    imageProcessor.removeBackground();
                    break;
                case 'Smart Enhance':
                    imageProcessor.applyFilter('enhance');
                    break;
                case 'Portrait Mode':
                    imageProcessor.applyFilter('portrait');
                    break;
                case 'Color Balance':
                    imageProcessor.applyFilter('colorBalance');
                    break;
                case 'Noise Reduction':
                    imageProcessor.applyFilter('denoise');
                    break;
                case 'Crop':
                    imageProcessor.startCropping();
                    break;
                case 'Rotate':
                    imageProcessor.rotateImage(90); // Rotate 90 degrees clockwise
                    break;
                case 'Resize':
                    imageProcessor.showResizeDialog();
                    break;
                case 'Flip':
                    imageProcessor.flipImage('horizontal');
                    break;
                case 'Perspective':
                    imageProcessor.startPerspectiveTransform();
                    break;
                case 'Vintage':
                    imageProcessor.applyFilter('vintage');
                    break;
                case 'Noir':
                    imageProcessor.applyFilter('noir');
                    break;
                case 'Chrome':
                    imageProcessor.applyFilter('chrome');
                    break;
                case 'Sepia':
                    imageProcessor.applyFilter('sepia');
                    break;
                case 'Black & White':
                    imageProcessor.applyFilter('blackAndWhite');
                    break;
                default:
                    console.log('Tool not implemented:', toolName);
            }
            
            console.log('Tool button clicked:', toolName);
        });
    });

    // Add event listeners for sliders
    const sliders = editorTools.querySelectorAll('.slider');
    sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            const label = e.target.previousElementSibling?.textContent || 'Unknown property';
            
            // Apply adjustment based on the label
            switch(label.trim()) {
                case 'Brightness':
                    imageProcessor.adjustBrightness(value);
                    break;
                case 'Contrast':
                    imageProcessor.adjustContrast(value);
                    break;
                case 'Saturation':
                    imageProcessor.adjustSaturation(value);
                    break;
                case 'Sharpness':
                    imageProcessor.adjustSharpness(value);
                    break;
                case 'Exposure':
                    imageProcessor.adjustExposure(value);
                    break;
                case 'Temperature':
                    imageProcessor.adjustTemperature(value);
                    break;
                case 'Shadows':
                    imageProcessor.adjustShadows(value);
                    break;
                case 'Highlights':
                    imageProcessor.adjustHighlights(value);
                    break;
                default:
                    console.log('Adjustment not implemented:', label);
            }
            
            console.log(`${label}: ${value}`);
        });
    });
    
    // Make sure save/discard buttons work correctly
    const saveYesButton = document.querySelector('.save-yes');
    const saveNoButton = document.querySelector('.save-no');
    
    if (saveYesButton) {
        saveYesButton.addEventListener('click', () => {
            // Save the processed image
            const processedImageData = imageProcessor.getProcessedImageData();
            
            // Apply the processed image to the original image
            if (imageElement) {
                imageElement.src = processedImageData;
            }
            
            console.log('Changes saved');
        });
    }
    
    if (saveNoButton) {
        saveNoButton.addEventListener('click', () => {
            // Reset the image to its original state
            imageProcessor.reset();
            console.log('Changes discarded');
        });
    }
}

/**
 * Image Processing Class
 * Handles all image editing functionality
 */
class ImageProcessor {
    constructor(imageElement) {
        this.imageElement = imageElement;
        this.originalSrc = imageElement.src;
        
        // Create a canvas element for image processing
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Add a loading indicator to the parent container
        this.setupLoadingIndicator();
        
        // Load the image onto the canvas
        this.loadImage();
        
        // Store adjustment values
        this.adjustments = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sharpness: 100,
            exposure: 100,
            temperature: 100,
            shadows: 100,
            highlights: 100
        };
        
        // Store applied filters
        this.appliedFilters = [];
    }
    
    setupLoadingIndicator() {
        // Get the parent container
        const container = this.imageElement.closest('.editor-image-container') || 
                          this.imageElement.parentElement;
        
        if (container) {
            // Create loading indicator if it doesn't exist
            let loadingIndicator = container.querySelector('.edit-loading-indicator');
            
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'edit-loading-indicator';
                loadingIndicator.innerHTML = `
                    <div class="spinner"></div>
                    <p>Processing image...</p>
                `;
                loadingIndicator.style.display = 'none';
                container.appendChild(loadingIndicator);
            }
            
            this.loadingIndicator = loadingIndicator;
        }
    }
    
    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
    }
    
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    loadImage() {
        this.showLoading();
        
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = () => {
            // Set canvas dimensions to match the image
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            
            // Draw image onto canvas
            this.ctx.drawImage(img, 0, 0, img.width, img.height);
            
            // Store the original image data
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            this.hideLoading();
            console.log('Image loaded into canvas');
        };
        
        img.onerror = (err) => {
            console.error('Error loading image:', err);
            this.hideLoading();
            showToast('Error loading image');
        };
        
        img.src = this.imageElement.src;
    }
    
    // Update the canvas with current adjustments and filters
    updateCanvas() {
        this.showLoading();
        
        // Use requestAnimationFrame to avoid blocking the UI
        requestAnimationFrame(() => {
            try {
                // Start with the original image data
                if (this.originalImageData) {
                    this.ctx.putImageData(this.originalImageData, 0, 0);
                    
                    // Apply adjustments
                    this.applyAdjustments();
                    
                    // Apply filters
                    this.applyFilters();
                    
                    // Update the image element with the processed image
                    this.imageElement.src = this.canvas.toDataURL();
                }
            } catch (error) {
                console.error('Error updating canvas:', error);
                showToast('Error processing image');
            } finally {
                this.hideLoading();
            }
        });
    }
    
    // Reset the image to its original state
    reset() {
        this.showLoading();
        
        // Reset adjustment values
        this.adjustments = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            sharpness: 100,
            exposure: 100,
            temperature: 100,
            shadows: 100,
            highlights: 100
        };
        
        // Clear applied filters
        this.appliedFilters = [];
        
        // Create a visual flash effect to indicate reset
        const container = this.imageElement.closest('.editor-image-container') || 
                         this.imageElement.parentElement;
        
        if (container) {
            const flashElement = document.createElement('div');
            flashElement.className = 'reset-flash';
            flashElement.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.6);
                opacity: 0;
                z-index: 15;
                pointer-events: none;
                transition: opacity 0.2s ease-out;
                border-radius: var(--border-radius-md);
            `;
            container.appendChild(flashElement);
            
            // Show and then fade out the flash
            setTimeout(() => {
                flashElement.style.opacity = '1';
                setTimeout(() => {
                    flashElement.style.opacity = '0';
                    setTimeout(() => {
                        container.removeChild(flashElement);
                    }, 300);
                }, 100);
            }, 10);
        }
        
        // Reset image source
        this.imageElement.src = this.originalSrc;
        
        // Reload the image to the canvas
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = () => {
            // Reset canvas dimensions
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            
            // Redraw the original image
            this.ctx.drawImage(img, 0, 0, img.width, img.height);
            
            // Store the original image data again
            this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            this.hideLoading();
            console.log('Image reset to original');
        };
        
        img.onerror = (err) => {
            console.error('Error resetting image:', err);
            this.hideLoading();
            showToast('Error resetting image', 'error');
        };
        
        img.src = this.originalSrc;
    }
    
    // Apply all current adjustments to the canvas
    applyAdjustments() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Get RGB values
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply brightness
            const brightnessAdjustment = this.adjustments.brightness / 100;
            r *= brightnessAdjustment;
            g *= brightnessAdjustment;
            b *= brightnessAdjustment;
            
            // Apply contrast
            const contrastAdjustment = (this.adjustments.contrast / 100) * 2;
            const factor = (259 * (contrastAdjustment + 255)) / (255 * (259 - contrastAdjustment));
            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;
            
            // Apply saturation
            const saturationAdjustment = this.adjustments.saturation / 100;
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            r = gray + saturationAdjustment * (r - gray);
            g = gray + saturationAdjustment * (g - gray);
            b = gray + saturationAdjustment * (b - gray);
            
            // Ensure values are within valid range
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    // Apply all current filters to the canvas
    applyFilters() {
        for (const filter of this.appliedFilters) {
            switch(filter) {
                case 'sepia':
                    this.applySepia();
                    break;
                case 'blackAndWhite':
                    this.applyBlackAndWhite();
                    break;
                case 'vintage':
                    this.applyVintage();
                    break;
                case 'noir':
                    this.applyNoir();
                    break;
                case 'chrome':
                    this.applyChrome();
                    break;
                // Add more filter cases as needed
            }
        }
    }
    
    // Get the processed image data as a data URL
    getProcessedImageData() {
        return this.canvas.toDataURL();
    }
    
    // Adjustment methods
    adjustBrightness(value) {
        this.adjustments.brightness = value;
        this.updateCanvas();
    }
    
    adjustContrast(value) {
        this.adjustments.contrast = value;
        this.updateCanvas();
    }
    
    adjustSaturation(value) {
        this.adjustments.saturation = value;
        this.updateCanvas();
    }
    
    adjustSharpness(value) {
        this.adjustments.sharpness = value;
        this.updateCanvas();
    }
    
    adjustExposure(value) {
        this.adjustments.exposure = value;
        this.updateCanvas();
    }
    
    adjustTemperature(value) {
        this.adjustments.temperature = value;
        this.updateCanvas();
    }
    
    adjustShadows(value) {
        this.adjustments.shadows = value;
        this.updateCanvas();
    }
    
    adjustHighlights(value) {
        this.adjustments.highlights = value;
        this.updateCanvas();
    }
    
    // Filter methods
    applyFilter(filterName) {
        if (!this.appliedFilters.includes(filterName)) {
            this.appliedFilters.push(filterName);
        }
        
        this.updateCanvas();
        
        // Show feedback
        let filterName2 = filterName.charAt(0).toUpperCase() + filterName.slice(1);
        if (filterName === 'blackAndWhite') filterName2 = 'Black & White';
        showToast(`Applied ${filterName2} filter`);
    }
    
    applySepia() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    applyBlackAndWhite() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
            
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    applyVintage() {
        this.applySepia();
        // Add vignette effect
        this.addVignette(0.3);
    }
    
    applyNoir() {
        this.applyBlackAndWhite();
        // Increase contrast
        const oldContrast = this.adjustments.contrast;
        this.adjustments.contrast = 130;
        this.applyAdjustments();
        this.adjustments.contrast = oldContrast;
    }
    
    applyChrome() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Add chrome effect (high contrast, slight blue tint)
            data[i] = Math.min(255, data[i] * 1.2);
            data[i + 1] = Math.min(255, data[i + 1] * 1.1);
            data[i + 2] = Math.min(255, data[i + 2] * 1.3);
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    // Helper method to create vignette effect
    addVignette(intensity) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const radius = Math.max(w, h) / 2;
        
        this.ctx.globalCompositeOperation = 'source-over';
        const gradient = this.ctx.createRadialGradient(w/2, h/2, radius * 0.6, w/2, h/2, radius);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    // Transform methods
    flipImage(direction) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Create a temporary canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = w;
        tempCanvas.height = h;
        
        // Flip horizontally
        if (direction === 'horizontal') {
            tempCtx.translate(w, 0);
            tempCtx.scale(-1, 1);
        } 
        // Flip vertically
        else if (direction === 'vertical') {
            tempCtx.translate(0, h);
            tempCtx.scale(1, -1);
        }
        
        // Draw the original canvas onto the temp canvas
        tempCtx.drawImage(this.canvas, 0, 0, w, h);
        
        // Clear and redraw the main canvas
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.drawImage(tempCanvas, 0, 0);
        
        // Update the image
        this.imageElement.src = this.canvas.toDataURL();
        
        // Show feedback
        showToast(`Image flipped ${direction}ly`);
    }
    
    rotateImage(degrees) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Create a temporary canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Adjust canvas size for rotation
        if (degrees === 90 || degrees === 270) {
            tempCanvas.width = h;
            tempCanvas.height = w;
        } else {
            tempCanvas.width = w;
            tempCanvas.height = h;
        }
        
        // Translate and rotate the temp canvas
        tempCtx.save();
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        tempCtx.rotate((degrees * Math.PI) / 180);
        
        // Draw the original canvas onto the temp canvas
        if (degrees === 90 || degrees === 270) {
            tempCtx.drawImage(this.canvas, -h / 2, -w / 2, h, w);
        } else {
            tempCtx.drawImage(this.canvas, -w / 2, -h / 2, w, h);
        }
        
        tempCtx.restore();
        
        // Set new dimensions for the main canvas
        this.canvas.width = tempCanvas.width;
        this.canvas.height = tempCanvas.height;
        
        // Clear and redraw the main canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);
        
        // Update the image
        this.imageElement.src = this.canvas.toDataURL();
        
        // Show feedback
        showToast(`Image rotated ${degrees}°`);
    }
    
    // Advanced editing methods (placeholders)
    removeBackground() {
        console.log('Background removal would be implemented here');
        // This would typically use a more complex algorithm or external API
        alert('Background removal is a premium feature that would require external processing.');
        showToast('Background removal requires premium features');
    }
    
    startCropping() {
        console.log('Crop tool would be implemented here');
        alert('Crop tool activated. In a full implementation, you would be able to drag to select a crop area.');
        showToast('Crop tool activated');
    }
    
    showResizeDialog() {
        const width = prompt('Enter new width (in pixels):', this.canvas.width);
        const height = prompt('Enter new height (in pixels):', this.canvas.height);
        
        if (width && height) {
            this.resizeImage(parseInt(width), parseInt(height));
        }
    }
    
    resizeImage(width, height) {
        // Create a temporary canvas for resizing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // Draw the original image with new dimensions
        tempCtx.drawImage(this.canvas, 0, 0, width, height);
        
        // Update the main canvas
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.drawImage(tempCanvas, 0, 0);
        
        // Update the image
        this.imageElement.src = this.canvas.toDataURL();
        
        // Show feedback
        showToast(`Image resized to ${width}×${height}`);
    }
    
    startPerspectiveTransform() {
        console.log('Perspective transform would be implemented here');
        alert('Perspective transform is a premium feature that would require more complex implementation.');
        showToast('Perspective transform requires premium features');
    }
}

// Add this CSS style for the loading indicator
const editorStyleElement = document.createElement('style');
editorStyleElement.textContent = `
    .edit-loading-indicator {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: var(--border-radius-md);
    }
    
    .edit-loading-indicator .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top: 4px solid var(--primary-color);
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
    }
    
    .edit-loading-indicator p {
        color: white;
        font-size: 1rem;
        margin: 0;
    }
    
    .editor-image-container {
        position: relative;
    }
`;
document.head.appendChild(editorStyleElement); 