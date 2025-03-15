import { updateState, state } from './state.js';
import { updateShirtColor, updateShirtTexture, toggleTexture, changeCameraView, updateThemeBackground, setupEventListeners } from './scene.js';
import { loadCustomImage, clearCustomImage, showBoundingBoxesForCameraView, setTexturePosition } from './texture-mapper.js';
import { generateAIImage, checkAIServerStatus } from './ai-integration.js';
import { addImage } from './3d-editor.js';

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

                // Get target view if specified
                const fileInput = document.getElementById('file-upload');
                let targetView = fileInput && fileInput.dataset.targetView;
                if (!targetView) {
                    // Default to current camera view if not specified
                    targetView = state.cameraView || 'front';
                }

                // Use the new 3D editor's addImage function instead of loadCustomImage
                addImage(event.target.result, {
                    view: targetView,
                    center: true, // Center the image in the view
                }).then(() => {
                    showToast(`Image added to ${targetView} view`);

                    // Clear the target view data attribute
                    if (fileInput) {
                        delete fileInput.dataset.targetView;
                    }

                    // Remove processing state
                    preview.classList.remove('processing');

                    // Add success state briefly
                    preview.classList.add('success');
                    setTimeout(() => preview.classList.remove('success'), 1500);

                    // Switch to the view where the image was placed if not already there
                    changeCameraView(targetView);
                }).catch(error => {
                    console.error('Failed to add image:', error);
                    showToast('Failed to add image: ' + error);
                    preview.classList.remove('processing');
                    preview.classList.add('error');
                    setTimeout(() => preview.classList.remove('error'), 1500);
                });
            }
        };
        reader.readAsDataURL(file);
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
                    <img src="${imageData}" alt="Generated design" />
                    <div class="ai-buttons">
                        <button class="button primary apply-ai-btn">Apply to Shirt</button>
                        <button class="button secondary edit-ai-btn"><i class="fas fa-pencil-alt"></i> Edit</button>
                        <button class="button secondary download-ai-btn"><i class="fas fa-download"></i> Download</button>
                    </div>
                </div>
                `;

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

                // Add event listener to the edit button
                const editBtn = preview.querySelector('.edit-ai-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', async () => {
                        try {
                            // Import the necessary function from fabric-integration.js
                            const { openImageInEditor } = await import('./fabric-integration.js');

                            // Open the image in the fabric canvas for editing
                            openImageInEditor(imageData, editedImageData => {
                                // Update the preview with the edited image
                                const resultImg = preview.querySelector('.ai-result img');
                                if (resultImg) {
                                    resultImg.src = editedImageData;
                                }

                                // Update the apply button to use the edited image
                                const applyBtn = preview.querySelector('.apply-ai-btn');
                                if (applyBtn) {
                                    applyBtn.onclick = () => {
                                        updateShirtTexture(editedImageData, 'full');
                                        updateState({ stylish: true });
                                        showToast('Applied edited design to shirt');
                                    };
                                }

                                // Update the download button to use the edited image
                                const downloadBtn = preview.querySelector('.download-ai-btn');
                                if (downloadBtn) {
                                    downloadBtn.onclick = () => {
                                        const link = document.createElement('a');
                                        link.href = editedImageData;
                                        link.download = `ai-design-edited-${Date.now()}.png`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        showToast('Downloading edited design');
                                    };
                                }
                            });
                        } catch (error) {
                            console.error('Error opening image editor:', error);
                            showToast('Could not open editor. Please try again.');

                            // Fallback: Switch to file picker tab which has the fabric editor
                            const fileTab = document.querySelector('.tab-btn[data-tab="file"]');
                            if (fileTab) {
                                fileTab.click();
                            } else {
                                // If file tab is removed, activate the editor without tab switching
                                const fabricCanvas = document.querySelector('.fabric-canvas-wrapper');
                                if (fabricCanvas) {
                                    fabricCanvas.style.display = 'block';
                                }

                                const fabricControls = document.querySelector('.fabric-controls');
                                if (fabricControls) {
                                    fabricControls.style.display = 'block';
                                }
                            }
                        }
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

    // Toggle panel on menu button click
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
                } else if (this.id === 'mobile-edit') {
                    // Scroll to the Design Editor section
                    const designEditor = document.querySelector('.fabric-editor-container');
                    if (designEditor) {
                        setTimeout(() => {
                            designEditor.scrollIntoView({ behavior: 'smooth' });
                        }, 300);
                    }
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
        // Set data attribute to indicate which view was clicked
        fileInput.dataset.targetView = view;

        // Update state camera view
        updateState({ cameraView: view });

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

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize all components
        initializeTabs();
        setupFilePicker();
        setupCameraViewButtons();
        setupThemeToggle();
        setupMobileUI();
    } catch (error) {
        console.error('Error initializing UI components:', error);
    }
}); 