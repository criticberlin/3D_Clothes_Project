import { updateState, state } from './state.js';
import { updateShirtColor, updateShirtTexture, toggleTexture, changeCameraView, updateThemeBackground } from './scene.js';
import { loadCustomImage, clearCustomImage, showBoundingBoxesForCameraView, setTexturePosition } from './texture-mapper.js';
import { generateAIImage, checkAIServerStatus } from './ai-integration.js';

// Popular t-shirt colors with their hex codes
const colors = [
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Black', hex: '#000000' },
    { name: 'Gray', hex: '#606060' },      // Charcoal Gray
    { name: 'Navy Blue', hex: '#000080' },
    { name: 'Beige', hex: '#F5F5DC' },     // Khaki
    { name: 'Olive Green', hex: '#556B2F' },
    { name: 'Brown', hex: '#8B4513' },     // Saddle Brown
    { name: 'Burgundy', hex: '#800020' }
];

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

/**
 * Set up color picker functionality
 */
export function setupColorPicker() {
    // Set up color wheel
    const colorWheel = document.getElementById('color-wheel');
    const colorHexDisplay = document.getElementById('color-hex');
    const colorPreview = document.getElementById('color-preview');
    const colorNameDisplay = document.getElementById('color-name');

    // Create color name display if it doesn't exist
    if (colorHexDisplay && !colorNameDisplay) {
        const nameDisplay = document.createElement('div');
        nameDisplay.id = 'color-name';
        nameDisplay.className = 'color-name-display';
        colorHexDisplay.parentNode.insertBefore(nameDisplay, colorHexDisplay.nextSibling);
    }

    // Default color is the first in our palette
    const defaultColor = colors[0].hex;
    const defaultName = colors[0].name;

    if (colorWheel) {
        // Set initial color
        colorWheel.value = state.color || defaultColor;

        const colorName = document.getElementById('color-name');
        if (colorName) {
            // Find the color name from the hex value
            const colorObj = colors.find(c => c.hex === (state.color || defaultColor)) || colors[0];
            colorName.textContent = colorObj.name;
        }

        colorHexDisplay.textContent = (state.color || defaultColor).toUpperCase();
        colorPreview.style.backgroundColor = state.color || defaultColor;

        colorWheel.addEventListener('input', (e) => {
            const newColor = e.target.value;
            colorHexDisplay.textContent = newColor.toUpperCase();
            colorPreview.style.backgroundColor = newColor;

            // Try to find matching color name or show "Custom"
            const colorObj = colors.find(c => c.hex.toUpperCase() === newColor.toUpperCase());
            if (colorName) {
                colorName.textContent = colorObj ? colorObj.name : "Custom";
            }

            // Add subtle animation to the color preview
            colorPreview.classList.add('pulse');
            setTimeout(() => colorPreview.classList.remove('pulse'), 500);

            updateState({ color: newColor });
            updateShirtColor(newColor);

            // Remove active class from all preset color buttons
            document.querySelectorAll('.color-btn').forEach(btn =>
                btn.classList.remove('active')
            );
        });
    }

    // Set up preset colors
    const colorContainer = document.querySelector('.colors');
    if (!colorContainer) return;

    // Clear existing color buttons to avoid duplicates
    colorContainer.innerHTML = '';

    // Create color buttons
    colors.forEach((color, index) => {
        const button = document.createElement('button');
        button.className = 'color-btn';
        button.style.backgroundColor = color.hex;
        button.dataset.color = color.hex;
        button.setAttribute('aria-label', `Select color ${color.name}`);
        button.setAttribute('title', color.name);

        // Add color name label inside button
        const nameLabel = document.createElement('span');
        nameLabel.className = 'color-name-label';
        nameLabel.textContent = color.name;
        button.appendChild(nameLabel);

        // Set the first color as active by default, or match current state
        if ((state.color === undefined && index === 0) || color.hex === state.color) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            // Remove active class from all buttons
            document.querySelectorAll('.color-btn').forEach(btn =>
                btn.classList.remove('active')
            );

            // Add active class to clicked button
            button.classList.add('active');

            // Add animation to the button
            button.classList.add('pulse');
            setTimeout(() => button.classList.remove('pulse'), 500);

            // Update color wheel and preview
            if (colorWheel) {
                colorWheel.value = color.hex;
                colorHexDisplay.textContent = color.hex.toUpperCase();
                colorPreview.style.backgroundColor = color.hex;

                const colorName = document.getElementById('color-name');
                if (colorName) {
                    colorName.textContent = color.name;
                }

                // Add animation to preview
                colorPreview.classList.add('pulse');
                setTimeout(() => colorPreview.classList.remove('pulse'), 500);
            }

            // Update shirt color
            updateState({ color: color.hex });
            updateShirtColor(color.hex);
        });

        colorContainer.appendChild(button);
    });
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

    function showToast(message) {
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
`;
document.head.appendChild(styleElement);

// Improved AI Picker with better status indicators and error handling
export function setupAIPicker() {
    const promptInput = document.getElementById('ai-prompt');
    const generateBtn = document.getElementById('ai-generate');
    const preview = document.querySelector('.ai-preview');

    if (!promptInput || !generateBtn || !preview) {
        console.warn('AI Picker elements not found');
        return;
    }

    let isGenerating = false;
    let serverIsOnline = false;

    // Function to check server status
    const checkServerStatus = async () => {
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Checking AI server status...</p></div>';

        try {
            // Use the new checkAIServerStatus function from ai-integration.js
            serverIsOnline = await checkAIServerStatus();

            if (serverIsOnline) {
                preview.innerHTML = '<p>Enter a prompt below to generate a design</p>';
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
    generateBtn.addEventListener('click', async () => {
        if (isGenerating) return;

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
                // Show the generated image with an apply button
                preview.innerHTML = `
                <div class="ai-result">
                    <img src="${imageData}" alt="Generated design" />
                    <button class="button primary apply-ai-btn">Apply to Shirt</button>
                </div>
                `;

                // Add event listener to the apply button
                const applyBtn = preview.querySelector('.apply-ai-btn');
                if (applyBtn) {
                    applyBtn.addEventListener('click', () => {
                        // Get the current view/tab (logo or full texture)
                        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;

                        if (activeTab === 'logo') {
                            // Apply as logo
                            updateShirtTexture(imageData, 'logo');
                            updateState({ logo: true });
                        } else {
                            // Apply as full texture
                            updateShirtTexture(imageData, 'full');
                            updateState({ stylish: true });
                        }

                        showToast('Applied AI design to shirt');
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
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

/**
 * Setup theme toggle button
 */
function setupThemeToggle() {
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
        setupColorPicker();
        setupFilePicker();
        setupAIPicker();
        setupCameraViewButtons();
        setupThemeToggle();
    } catch (error) {
        console.error('Error initializing UI components:', error);
    }
}); 