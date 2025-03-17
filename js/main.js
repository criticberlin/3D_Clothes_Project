import * as THREE from 'three';
import { setupScene, updateShirtTexture, toggleTexture, downloadCanvas, changeModel, updateThemeBackground, toggleAutoRotate, changeCameraView, setFabricType, toggleEditorMode } from './scene.js';
import { initializeTabs, setupFilePicker, setupAIPicker, setupCameraViewButtons, setupThemeToggle, setupMobileUI } from './ui.js';
import { state, updateState, subscribe } from './state.js';
import { Logger, Performance } from './utils.js';
import { initFabricCanvas, applyDesignToShirt } from './fabric-integration.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Start measuring initialization time
    Performance.start('app-initialization');

    Logger.info('Initializing 3D Shirt Studio...');

    // Detect and handle mobile devices
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        document.body.classList.add('mobile');
    }

    // Add direct event listeners for zoom buttons as a fail-safe
    setTimeout(() => {
        Logger.info('Setting up fail-safe zoom button handlers');

        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function () {
                Logger.info('Zoom in clicked from fail-safe handler');
                // Try the window method first
                if (window.directZoomCamera) {
                    window.directZoomCamera('in');
                }
                // If that fails, try to dispatch the event manually
                else {
                    window.dispatchEvent(new CustomEvent('camera-zoom', {
                        detail: { direction: 'in' }
                    }));
                }
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function () {
                Logger.info('Zoom out clicked from fail-safe handler');
                // Try the window method first
                if (window.directZoomCamera) {
                    window.directZoomCamera('out');
                }
                // If that fails, try to dispatch the event manually
                else {
                    window.dispatchEvent(new CustomEvent('camera-zoom', {
                        detail: { direction: 'out' }
                    }));
                }
            });
        }
    }, 500);

    // Function to check if DOM elements are ready
    function checkDOMElements() {
        // List essential elements
        const essentialElements = [
            document.querySelector('.app'),
            document.querySelector('.canvas-container'),
            document.querySelector('.customization-panel')
        ];

        // Check if all essential elements exist
        return essentialElements.every(el => el !== null);
    }

    // Main initialization function
    function initializeApp() {
        if (!checkDOMElements()) {
            return; // Exit if elements aren't available yet
        }

        // Set default state (match original project)
        updateState({
            intro: true,
            isFullTexture: false,
            fullDecal: null,
            stylish: false, // For the toggle button
            currentModel: 'tshirt', // Default model is t-shirt
            cameraView: 'front', // Default camera view
            autoRotate: false, // Auto-rotation disabled by default
            darkMode: true, // Default to dark mode
            fabricType: 'cotton', // Default fabric type
            textureStyle: 'plain', // Default texture style
            autoApplyDesign: true, // Automatically apply design changes to the shirt
            editorMode: true // Default to editor mode
        });

        // Set up theme toggle directly here instead of relying on other functions
        setupDirectThemeToggle();

        // Set up the 3D editor mode toggle
        setupEditorModeToggle();

        // Initialize the 3D scene
        setupScene().then(() => {
            Logger.info('Scene loaded successfully');

            // Try to load the default model explicitly
            if (!window.shirtMesh) {
                Logger.info('Shirt mesh not found, trying to load default model');
                changeModel('tshirt')
                    .then(() => {
                        Logger.info('Default model loaded');
                    })
                    .catch(error => {
                        Logger.error('Error loading default model:', error);
                    });
            }

            // Initialize 3D editor (previously Fabric.js integration)
            window.addEventListener('load', () => {
                // Initialize 3D editor
                initFabricCanvas();

                Logger.log('3D editor initialized');
            });

            // Connect fabric type selection
            subscribe('fabricType', (fabricType) => {
                // Update the 3D model material only
                setFabricType(fabricType);
            });

            // Set up fabric type selector
            setupFabricTypeSelector();
        }).catch(error => {
            Logger.error('Error setting up scene:', error);
        });

        // Initialize tabs, file picker, and camera buttons
        initializeTabs();
        setupFilePicker();
        setupCameraViewButtons();
        setupAIPicker();
        setupMobileUI();

        // Set up download button
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadCanvas);
        }

        // Set up auto-rotate toggle
        const autoRotateToggle = document.getElementById('auto-rotate-toggle');
        if (autoRotateToggle) {
            autoRotateToggle.addEventListener('change', (e) => {
                toggleAutoRotate(e.target.checked);
                updateState({ autoRotate: e.target.checked });
            });
        }

        // Connect rotation control based on state
        subscribe('autoRotate', (autoRotate) => {
            toggleAutoRotate(autoRotate);
            // Update checkbox if it exists
            const checkbox = document.getElementById('auto-rotate-toggle');
            if (checkbox) checkbox.checked = autoRotate;
        });

        // Set up model selector
        setupModelSelector();

        // Welcome animation
        setTimeout(animateWelcome, 500);

        // End performance measurement
        Performance.end('app-initialization');
        console.log('Initialization time:', Performance.getTime('app-initialization') + 'ms');
    }

    // Try to initialize, or wait for DOM to be more ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initializeApp();
    } else {
        // Fallback if DOMContentLoaded might have already fired
        window.addEventListener('load', initializeApp);
    }
});

// Welcome animation for tabs and sections
function animateWelcome() {
    const elements = [
        '.model-selector',
        '.tab-navigation',
        '#color-picker',
        '.action-buttons'
    ];

    elements.forEach((selector, index) => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        }
    });
}

// Setup mobile navigation
function setupMobileNavigation() {
    // This function is now replaced by setupMobileUI in ui.js
    setupMobileUI();
}

// Setup model selector
function setupModelSelector() {
    const modelOptions = document.querySelectorAll('input[name="model-type"]');

    modelOptions.forEach(option => {
        // Set initial state
        if (option.value === state.currentModel) {
            option.checked = true;
        }

        // Handle model change
        option.addEventListener('change', (e) => {
            if (e.target.checked) {
                const newModel = e.target.value;
                const oldModel = state.currentModel;

                // Show loading overlay
                const loadingOverlay = document.querySelector('.loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'flex';
                    loadingOverlay.querySelector('p').textContent = `Loading ${newModel === 'hoodie' ? 'hoodie' : 't-shirt'} model...`;
                }

                // Preserve current textures when changing models
                const currentColor = state.color;
                const currentFullDecal = state.fullDecal;
                const fullTextureVisible = state.stylish;

                // Update state
                updateState({ currentModel: newModel });

                // Update title based on model
                const titleElement = document.querySelector('.customizer-tabs h2');
                if (titleElement) {
                    titleElement.textContent = `Customize Your ${newModel === 'hoodie' ? 'Hoodie' : 'Shirt'}`;
                }

                // Change the 3D model
                changeModel(newModel)
                    .then(() => {
                        Logger.info(`Changed model to ${newModel}`);

                        // Restore textures if needed
                        if (fullTextureVisible && currentFullDecal) updateShirtTexture(currentFullDecal, 'full');

                        toggleTexture('full', fullTextureVisible);

                        // Reset camera to default position for this model type
                        window.dispatchEvent(new CustomEvent('camera-reset'));

                        // Hide loading overlay with a fade effect
                        setTimeout(() => {
                            if (loadingOverlay) {
                                loadingOverlay.style.opacity = '0';
                                setTimeout(() => {
                                    loadingOverlay.style.display = 'none';
                                    loadingOverlay.style.opacity = '1';
                                }, 300);
                            }
                        }, 200);
                    })
                    .catch(error => {
                        Logger.error(`Error changing to ${newModel}:`, error);

                        // Show error in the loading overlay
                        if (loadingOverlay) {
                            loadingOverlay.innerHTML = `
                                <div class="error">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <p>Error loading model. Please try again.</p>
                                </div>
                            `;
                        }

                        // Revert to previous model in the UI
                        updateState({ currentModel: oldModel });
                        document.querySelector(`input[name="model-type"][value="${oldModel}"]`).checked = true;
                    });
            }
        });
    });
}

// Reset preview areas
function resetPreviews() {
    // Reset file upload preview
    const filePreview = document.querySelector('#file-picker .preview');
    if (filePreview) {
        filePreview.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-image"></i>
                <p>Preview will appear here</p>
            </div>
        `;
    }

    // Reset AI preview
    const aiPreview = document.querySelector('.ai-preview');
    if (aiPreview) {
        aiPreview.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-robot"></i>
                <p>AI generated designs will appear here</p>
            </div>
        `;
    }

    // Reset AI prompt
    const aiPrompt = document.getElementById('ai-prompt');
    if (aiPrompt) {
        aiPrompt.value = '';
    }
}

// Set initial tab based on URL hash (for deep linking)
function setInitialTabFromHash() {
    const hash = window.location.hash;
    if (hash) {
        const tabName = hash.substring(1); // Remove the # character
        const tab = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (tab) {
            tab.click();
        }
    }
}

// Setup filter buttons
const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        btn.classList.toggle('active');
        state[filter] = btn.classList.contains('active');
    });
});

/**
 * Set up the fabric type selector
 */
function setupFabricTypeSelector() {
    // Find fabric type select element added by fabric-integration.js
    const fabricTypeSelect = document.getElementById('fabric-type-select');
    if (fabricTypeSelect) {
        fabricTypeSelect.addEventListener('change', (e) => {
            const fabricType = e.target.value;
            updateState({ fabricType });
        });
    }

    // Listen for texture style changes
    const textureStyleSelect = document.getElementById('texture-style-select');
    if (textureStyleSelect) {
        textureStyleSelect.addEventListener('change', (e) => {
            const textureStyle = e.target.value;
            updateState({ textureStyle });
        });
    }

    // Set initial values from state
    if (fabricTypeSelect && state.fabricType) {
        fabricTypeSelect.value = state.fabricType;
    }

    if (textureStyleSelect && state.textureStyle) {
        textureStyleSelect.value = state.textureStyle;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed');

    // Check WebGL support first
    const webGLStatus = window.checkWebGLSupport();
    if (!webGLStatus.supported) {
        console.error('WebGL not properly supported:', webGLStatus.message);
        document.getElementById('loading-message').innerHTML = `
            <div class="alert alert-danger">
                ${webGLStatus.message} 3D models may not display correctly on your device.
            </div>`;
    } else if (webGLStatus.limitedSupport) {
        console.warn('Limited WebGL support:', webGLStatus.message);
    } else {
        console.log('WebGL support:', webGLStatus.message);
    }

    // Use the imported setupThemeToggle function from ui.js
    if (typeof setupThemeToggle === 'function') {
        setupThemeToggle();
    } else {
        console.warn('setupThemeToggle function not available, using default theme');
    }

    // Ensure the clothesOptions contains all the required keys
    if (typeof clothesOptions === 'undefined' || !clothesOptions) {
        console.error('clothesOptions not defined, creating default object');
        window.clothesOptions = {
            tshirt: true,
            hoodie: true,
            pants: false,
            shorts: false
        };
    }

    // Ensure UI controls are properly initialized
    setupUIControls();

    // Load all models with proper error handling
    loadModels().catch(error => {
        console.error('Error during model loading:', error);
        document.getElementById('loading-message').innerHTML = `
            <div class="alert alert-danger">
                Error loading 3D models: ${error.message}
            </div>`;
    });
});

// Improved model loading function with better error handling
async function loadModels() {
    try {
        // Safely update loading message
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = 'Loading models...';
        }

        // Import the GLTFLoader
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');

        // Create a loader with specific timeout
        const loader = new GLTFLoader();

        // Function to load a single model with timeout and retry
        const loadModelWithRetry = async (path, maxRetries = 2, timeout = 15000) => {
            let retries = 0;

            while (retries <= maxRetries) {
                try {
                    // Create a promise that rejects after timeout
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Loading ${path} timed out after ${timeout}ms`)), timeout)
                    );

                    // Update loading message
                    if (loadingMessage) {
                        loadingMessage.textContent =
                            `Loading model ${path}... (Attempt ${retries + 1}/${maxRetries + 1})`;
                    }

                    // Race between the load and timeout
                    const model = await Promise.race([
                        new Promise((resolve, reject) => {
                            loader.load(
                                path,
                                resolve,
                                (xhr) => {
                                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                                    // Update loading message with progress
                                    if (loadingMessage) {
                                        loadingMessage.textContent =
                                            `Loading model ${path}... ${percent}%`;
                                    }
                                },
                                reject
                            );
                        }),
                        timeoutPromise
                    ]);

                    return model;
                } catch (error) {
                    console.warn(`Attempt ${retries + 1} failed to load ${path}:`, error);
                    retries++;

                    if (retries > maxRetries) {
                        throw new Error(`Failed to load ${path} after ${maxRetries + 1} attempts: ${error.message}`);
                    }
                }
            }
        };

        // Import required scene components
        const { setupScene, changeModel } = await import('./scene.js');

        // Initialize 3D scene
        await setupScene();

        // Set final success message
        if (loadingMessage) {
            loadingMessage.textContent = 'Models loaded successfully!';

            // Hide loading message after a brief delay
            setTimeout(() => {
                if (loadingMessage) {
                    loadingMessage.style.display = 'none';
                }
            }, 1000);
        }

        // Initialize animation for welcome message
        animateWelcome();

    } catch (error) {
        console.error('Error loading models:', error);

        // Show error message to user
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.innerHTML = `
                <div style="color: #e74c3c; font-weight: bold;">
                    Error loading 3D models: ${error.message}
                </div>
                <div style="margin-top: 10px;">
                    Please check your internet connection and refresh the page.
                </div>
            `;
        }

        throw error; // Re-throw to be caught by the caller
    }
}

// Make sure theme background function is accessible from HTML
window.updateThemeBackground = updateThemeBackground;

// Define clothesOptions globally to fix the "not defined" error
window.clothesOptions = {
    tshirt: true,
    hoodie: true,
    pants: false,
    shorts: false
};

// Add a setupUIControls function to fix the "not defined" error
function setupUIControls() {
    console.log('Setting up UI controls');

    // Add any UI controls setup code here if needed
    // This is a minimal implementation to fix the error

    // Setup model type selectors
    const modelOptions = document.querySelectorAll('input[name="model-type"]');
    if (modelOptions.length === 0) {
        console.warn('No model type selectors found');
    } else {
        modelOptions.forEach(option => {
            if (option.value && clothesOptions[option.value] === false) {
                option.disabled = true;
            }
        });
    }
}

// Direct implementation of theme toggle without external dependencies
function setupDirectThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        console.error("Theme toggle button not found in the DOM");
        return;
    }

    console.log("Setting up direct theme toggle from main.js");

    // Set initial theme
    const isDarkMode = state.darkMode !== false;

    // Apply theme to document
    document.documentElement.classList.toggle('light-theme', !isDarkMode);

    // Set correct icon
    themeToggle.innerHTML = isDarkMode
        ? '<i class="fas fa-sun"></i>' // Sun icon for dark mode (indicates switch to light)
        : '<i class="fas fa-moon"></i>'; // Moon icon for light mode (indicates switch to dark)

    // Apply theme to scene immediately
    updateThemeBackground(isDarkMode);

    // Remove any existing event listeners by cloning the button
    const newThemeToggle = themeToggle.cloneNode(true);
    if (themeToggle.parentNode) {
        themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
    }

    // Add click handler with visual feedback
    newThemeToggle.addEventListener('click', () => {
        console.log("Theme toggle clicked");

        // Add clicking animation
        newThemeToggle.classList.add('active');
        setTimeout(() => newThemeToggle.classList.remove('active'), 300);

        // Toggle theme state
        const newDarkMode = !state.darkMode;
        console.log(`Switching to ${newDarkMode ? 'dark' : 'light'} mode`);

        // Update state
        updateState({ darkMode: newDarkMode });

        // Update UI with a smooth transition
        document.documentElement.classList.toggle('light-theme', !newDarkMode);

        // Update button icon with a smooth transition
        newThemeToggle.style.transition = 'transform 0.3s ease, background-color 0.3s ease';
        newThemeToggle.style.transform = 'rotate(180deg)';

        setTimeout(() => {
            newThemeToggle.innerHTML = newDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';

            newThemeToggle.style.transform = 'rotate(0deg)';
        }, 150);

        // Update 3D scene background
        updateThemeBackground(newDarkMode);

        // Save preference in localStorage
        localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
    });
}

// Add a new function to set up the editor mode toggle
function setupEditorModeToggle() {
    // Listen for state changes to editorMode
    subscribe('editorMode', (isEditorMode) => {
        // Update UI to reflect editor mode
        const editorModeIndicator = document.getElementById('editor-mode-indicator');
        if (editorModeIndicator) {
            editorModeIndicator.textContent = isEditorMode ? '3D Edit Mode' : 'Standard Mode';
            editorModeIndicator.classList.toggle('active', isEditorMode);
        }

        // Update controls visibility based on editor mode
        const standardControls = document.querySelectorAll('.standard-controls');
        const editorControls = document.querySelectorAll('.editor-controls');

        standardControls.forEach(el => {
            el.style.display = isEditorMode ? 'none' : 'flex';
        });

        editorControls.forEach(el => {
            el.style.display = isEditorMode ? 'flex' : 'none';
        });

        // Toggle editor mode in scene.js
        toggleEditorMode(isEditorMode);
    });

    // Add editor mode toggle button if it doesn't exist
    if (!document.getElementById('editor-mode-toggle')) {
        const controlsContainer = document.querySelector('.controls-container');

        if (controlsContainer) {
            // Create the toggle button
            const editorModeToggle = document.createElement('button');
            editorModeToggle.id = 'editor-mode-toggle';
            editorModeToggle.className = 'control-btn';
            editorModeToggle.innerHTML = '<i class="fas fa-edit"></i>';
            editorModeToggle.title = 'Toggle 3D Editor Mode';

            // Create the indicator
            const editorModeIndicator = document.createElement('span');
            editorModeIndicator.id = 'editor-mode-indicator';
            editorModeIndicator.className = 'mode-indicator';
            editorModeIndicator.textContent = 'Standard Mode';

            // Add click event
            editorModeToggle.addEventListener('click', () => {
                const newMode = !(state.editorMode || false);
                updateState({ editorMode: newMode });
                Logger.log(`Editor mode set to: ${newMode}`);
            });

            // Add to the DOM
            controlsContainer.appendChild(editorModeToggle);
            controlsContainer.appendChild(editorModeIndicator);
        }
    }

    // Initialize with current state
    updateState({ editorMode: state.editorMode || true });
} 