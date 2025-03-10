import { updateState, state } from './state.js';
import { updateShirtColor, updateShirtTexture, toggleTexture, changeCameraView, updateThemeBackground } from './scene.js';
import { loadCustomImage, clearCustomImage, showBoundingBoxesForCameraView } from './texture-mapper.js';

// Rainbow colors (standard 7 rainbow colors)
const colors = [
    '#FF0000', // Red
    '#FF7F00', // Orange
    '#FFFF00', // Yellow
    '#00FF00', // Green
    '#0000FF', // Blue
    '#4B0082', // Indigo
    '#9400D3'  // Violet
];

// Initialize tab functionality
export function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');
    let lastTabClick = 0; // For debouncing

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Simple debounce to prevent rapid tab switching
            const now = Date.now();
            if (now - lastTabClick < 300) return;
            lastTabClick = now;

            // Add transition effect for tab buttons
            tab.classList.add('pulse');
            setTimeout(() => tab.classList.remove('pulse'), 600);

            // Remove active class from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => {
                p.classList.remove('active');
                // Start exit animation
                p.style.opacity = '0';
                p.style.transform = 'translateY(10px)';
            });

            // Add active class to clicked tab and corresponding panel
            tab.classList.add('active');
            const panel = document.getElementById(`${tab.dataset.tab}-picker`);

            if (panel) {
                // Delay showing new panel for smooth transition
                setTimeout(() => {
                    panel.classList.add('active');
                    // Trigger entrance animation
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateY(0)';
                }, 50);
            }
        });
    });

    // Set up logo toggle with visual feedback
    const logoToggle = document.getElementById('logo-toggle');
    if (logoToggle) {
        logoToggle.checked = state.logo !== false; // Default to true
        logoToggle.addEventListener('change', (e) => {
            const isActive = e.target.checked;

            // Add visual feedback
            const label = e.target.closest('.toggle');
            label.classList.add('pulse');
            setTimeout(() => label.classList.remove('pulse'), 500);

            updateState({
                logo: isActive,
                isLogoTexture: isActive // Keep original state key in sync
            });
            toggleTexture('logo', isActive);
        });
    }

    // Set up texture toggle with visual feedback
    const textureToggle = document.getElementById('texture-toggle');
    if (textureToggle) {
        textureToggle.checked = state.stylish === true; // Default to false
        textureToggle.addEventListener('change', (e) => {
            const isActive = e.target.checked;

            // Add visual feedback
            const label = e.target.closest('.toggle');
            label.classList.add('pulse');
            setTimeout(() => label.classList.remove('pulse'), 500);

            updateState({
                stylish: isActive,
                isFullTexture: isActive // Keep original state key in sync
            });
            toggleTexture('full', isActive);
        });
    }

    // Set up logo position buttons
    setupLogoPositionButtons();

    // Setup theme toggle
    setupThemeToggle();

    // Setup camera view buttons
    setupCameraViewButtons();
}

// Enhanced setupColorPicker with improved color selection UI
export function setupColorPicker() {
    // Set up color wheel
    const colorWheel = document.getElementById('color-wheel');
    const colorHexDisplay = document.getElementById('color-hex');
    const colorPreview = document.getElementById('color-preview');

    // Default color is the first in our rainbow palette
    const defaultColor = colors[0];

    if (colorWheel) {
        // Set initial color
        colorWheel.value = state.color || defaultColor;
        colorHexDisplay.textContent = colorWheel.value.toUpperCase();
        colorPreview.style.backgroundColor = colorWheel.value;

        colorWheel.addEventListener('input', (e) => {
            const newColor = e.target.value;
            colorHexDisplay.textContent = newColor.toUpperCase();
            colorPreview.style.backgroundColor = newColor;

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

    // Create color buttons
    colors.forEach((color, index) => {
        const button = document.createElement('button');
        button.className = 'color-btn';
        button.style.backgroundColor = color;
        button.dataset.color = color;
        button.setAttribute('aria-label', `Select color ${color}`);
        button.setAttribute('title', color);

        // Set the first color as active by default, or match current state
        if ((state.color === undefined && index === 0) || color === state.color) {
            button.classList.add('active');
        }

        button.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.color-btn').forEach(btn =>
                btn.classList.remove('active')
            );
            button.classList.add('active');

            // Update color wheel and preview
            if (colorWheel) {
                colorWheel.value = color;
                colorHexDisplay.textContent = color.toUpperCase();
                colorPreview.style.backgroundColor = color;

                // Add animation to preview
                colorPreview.classList.add('pulse');
                setTimeout(() => colorPreview.classList.remove('pulse'), 500);
            }

            // Update shirt color
            updateState({ color });
            updateShirtColor(color);
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

                    // Get the current camera view to determine which side to apply the texture to
                    const currentView = state.cameraView || 'front';

                    // Show texture application info
                    const infoBox = document.createElement('div');
                    infoBox.className = 'texture-info';
                    infoBox.innerHTML = `
                        <p><strong>Applied to:</strong> ${currentView} view</p>
                        <p><small>Use camera controls to switch views</small></p>
                    `;
                    preview.appendChild(infoBox);

                    // Load the image into the texture mapper for the current view
                    loadCustomImage(event.target.result, currentView)
                        .then(() => {
                            console.log(`Image applied to ${currentView} view`);

                            // Show a success message
                            showToast(`Image applied to ${currentView} view`);
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

    if (!promptInput || !generateBtn || !preview) return;

    // Server status tracking
    let serverCheckAttempted = false;
    let isServerOnline = false;

    // Function to check server status
    const checkServerStatus = () => {
        if (serverCheckAttempted) return;
        serverCheckAttempted = true;

        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Checking AI server status...</p></div>';

        // Try to ping the server
        fetch('http://localhost:8080/api/v1/dalle/ping', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                if (response.ok) {
                    isServerOnline = true;
                    preview.innerHTML = '<div class="empty-state"><i class="fas fa-robot"></i><p>Ready to generate designs. Enter a prompt to begin.</p></div>';
                } else {
                    throw new Error('Server responded but is not ready');
                }
            })
            .catch(() => {
                isServerOnline = false;
                preview.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>AI server is not running. <button id="ai-help" class="button secondary small">Learn how to start</button></p>
                    </div>
                `;

                // Add event listener to help button
                const helpBtn = document.getElementById('ai-help');
                if (helpBtn) {
                    helpBtn.addEventListener('click', () => {
                        showAISetupInstructions();
                    });
                }
            });
    };

    // Function to show AI setup instructions
    const showAISetupInstructions = () => {
        // Create modal with setup instructions
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Setting up the AI Server</h3>
                    <button class="modal-close"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <p>To use the AI Design Generator, you need to set up a local server. Follow these steps:</p>
                    <ol>
                        <li>Clone the AI server repository: <code>git clone https://github.com/example/ai-server.git</code></li>
                        <li>Install dependencies: <code>npm install</code></li>
                        <li>Start the server: <code>npm start</code></li>
                    </ol>
                    <p>Once the server is running on <code>http://localhost:8080</code>, refresh this page to connect.</p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add event listener to close button
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Close when clicking outside modal content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    };

    // Check server status when tab is clicked
    document.querySelector('.tab-btn[data-tab="ai"]').addEventListener('click', checkServerStatus);

    // Handle generate button click
    generateBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();

        if (!prompt) {
            // Show error if prompt is empty
            promptInput.classList.add('error');
            setTimeout(() => promptInput.classList.remove('error'), 500);
            return;
        }

        if (!isServerOnline) {
            // If server is not online, try checking again
            checkServerStatus();
            return;
        }

        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        preview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Creating your design...</p></div>';

        // Call AI server API
        fetch('http://localhost:8080/api/v1/dalle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
            }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.photo) {
                    // Create a preview image
                    preview.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = data.photo;
                    preview.appendChild(img);

                    // Add apply button
                    const applyBtn = document.createElement('button');
                    applyBtn.className = 'button primary apply-ai-btn';
                    applyBtn.innerHTML = '<i class="fas fa-check"></i> Apply to Shirt';
                    preview.appendChild(applyBtn);

                    // Handle apply button click
                    applyBtn.addEventListener('click', () => {
                        const isLogoActive = document.getElementById('logo-toggle').checked;
                        const isTextureActive = document.getElementById('texture-toggle').checked;

                        let textureType;
                        if (isLogoActive) {
                            textureType = 'logo';
                            updateState({
                                logoDecal: data.photo,
                            });
                        } else if (isTextureActive) {
                            textureType = 'full';
                            updateState({
                                fullDecal: data.photo,
                            });
                        } else {
                            textureType = 'logo';
                            document.getElementById('logo-toggle').checked = true;
                            updateState({
                                logo: true,
                                isLogoTexture: true,
                                logoDecal: data.photo,
                            });
                        }

                        // Update the 3D model with the AI-generated image
                        updateShirtTexture(data.photo, textureType);
                        toggleTexture(textureType, true);

                        // Show success feedback
                        applyBtn.innerHTML = '<i class="fas fa-check"></i> Applied!';
                        applyBtn.disabled = true;
                        setTimeout(() => {
                            applyBtn.innerHTML = '<i class="fas fa-check"></i> Apply to Shirt';
                            applyBtn.disabled = false;
                        }, 1500);
                    });
                } else {
                    throw new Error('No image data received from the server');
                }
            })
            .catch(error => {
                console.error('Error generating AI image:', error);
                preview.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error generating image: ${error.message}</p>
                    </div>
                `;
            })
            .finally(() => {
                // Reset button state
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate';
            });
    });
}

// Enhance logo position buttons with improved feedback
function setupLogoPositionButtons() {
    const positionButtons = document.querySelectorAll('.position-btn');
    let currentPosition = state.logoPosition || 'center';

    // Set initial active button
    positionButtons.forEach(btn => {
        if (btn.dataset.position === currentPosition) {
            btn.classList.add('active');
        }
    });

    // Add event listeners to position buttons
    positionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const position = btn.dataset.position;

            // Skip if already active
            if (btn.classList.contains('active')) return;

            // Update UI
            positionButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Add visual feedback animation
            btn.classList.add('pulse');
            setTimeout(() => btn.classList.remove('pulse'), 500);

            // Update state and shirt model
            updateState({ logoPosition: position });
            window.dispatchEvent(new CustomEvent('logo-position-change', {
                detail: { position }
            }));
        });
    });
}

// Improved theme toggle with smoother transition
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // Set initial theme state based on state
    const isDarkMode = state.darkMode !== false; // Default to dark
    document.documentElement.classList.toggle('light-theme', !isDarkMode);
    themeToggle.innerHTML = isDarkMode
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';

    // Update 3D background initially
    updateThemeBackground(isDarkMode);

    themeToggle.addEventListener('click', () => {
        // Toggle theme state
        const newDarkMode = !state.darkMode;
        updateState({ darkMode: newDarkMode });

        // Animate theme toggle button
        themeToggle.classList.add('pulse');
        setTimeout(() => themeToggle.classList.remove('pulse'), 500);

        // Update UI
        document.documentElement.classList.toggle('light-theme', !newDarkMode);
        themeToggle.innerHTML = newDarkMode
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';

        // Update 3D background
        updateThemeBackground(newDarkMode);

        console.log('Theme toggled:', newDarkMode ? 'dark' : 'light');
    });
} 