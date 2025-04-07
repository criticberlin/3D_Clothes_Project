import { setupScene, updateShirtTexture, toggleTexture, downloadCanvas, changeModel, updateThemeBackground, toggleAutoRotate, changeCameraView, setFabricType, toggleEditorMode, removeFullDecalLayer } from './scene.js';
import { initializeTabs, setupFilePicker, setupAIPicker, setupCameraViewButtons, setupThemeToggle, setupMobileUI } from './ui.js';
import { state, updateState, subscribe } from './state.js';
import { Logger, Performance } from './utils.js';
import { initFabricCanvas} from './fabric-integration.js';
import { initColorManager } from './color-manager.js';
import { addText, addShape } from './3d-editor.js';

// Expose essential functions to window object for UI integration
window.add3DText = addText;
window.addShape = addShape;

// Update the main container structure for our new UI layout
function updateLayoutForFloatingUI() {
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        // Remove the customization-panel class from any elements
        const oldPanel = document.querySelector('.customization-panel');
        if (oldPanel) {
            oldPanel.remove();
        }
        
        // Ensure canvas container takes full width
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.style.flex = '1';
            canvasContainer.style.width = '100%';
        }
    }
}

// Add window aliases for key objects
window.addEventListener('DOMContentLoaded', () => {
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
            document.querySelector('.canvas-container')
        ];

        // Check if all essential elements exist
        return essentialElements.every(el => el !== null);
    }

    // Main initialization function
    function initializeApp() {
        if (!checkDOMElements()) {
            return; // Exit if elements aren't available yet
        }

        // Update the layout for our new floating UI
        updateLayoutForFloatingUI();
        
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
        initializeFloatingUI();

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
        
        // Initialize color manager
        // We'll delay initializing the color manager until after a delay to ensure model is loaded
        setTimeout(() => {
            console.log("Delayed initialization of color manager to ensure model is loaded");
            initColorManager();
        }, 2000); // Wait for scene and model to be fully loaded

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

// Initialize 3D editor when the window loads
window.addEventListener('load', () => {
    console.log("Window loaded - initializing 3D editor");
    try {
        initFabricCanvas();
        console.log("3D editor initialized successfully");
    } catch (error) {
        console.error("Error initializing 3D editor:", error);
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
            // Add a utility class for animations instead of inline styles
            element.classList.add('animate-element');
            
            setTimeout(() => {
                element.classList.add('animate-visible');
            }, 100 + (index * 100));
        }
    });
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
                    loadingOverlay.querySelector('p').textContent = `Loading ${newModel} model...`;
                }

                // Update state
                updateState({ currentModel: newModel });

                // Update title based on model
                const titleElement = document.querySelector('.customizer-tabs h2');
                if (titleElement) {
                    // Get the model display name from config if available
                    let displayName = newModel === 'hoodie' ? 'Hoodie' : 'Shirt';
                    if (window.modelConfig && window.modelConfig[newModel]) {
                        displayName = window.modelConfig[newModel].name || displayName;
                    }
                    titleElement.textContent = `Customize Your ${displayName}`;
                }

                // Change the 3D model - this will handle customization preservation
                changeModel(newModel)
                    .then(() => {
                        console.log(`Successfully switched to ${newModel} model`);
                        
                        // Make sure the texture mapper is aware of the model change
                        if (window.setModelType) {
                            window.setModelType(newModel);
                        }
                        
                        // Update any model-specific UI elements
                        const modelLabel = document.querySelector('.model-label');
                        if (modelLabel) {
                            let displayName = newModel === 'hoodie' ? 'Hoodie' : 'T-Shirt';
                            if (window.modelConfig && window.modelConfig[newModel]) {
                                displayName = window.modelConfig[newModel].name || displayName;
                            }
                            modelLabel.textContent = displayName;
                        }

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
 * Initialize floating UI elements
 */
function initializeFloatingUI() {
    console.log('Initializing floating UI elements');
    
    // This function can be expanded later to initialize all floating panels
    // For now, it's just a placeholder to fix the "not defined" error
    
    // Add any floating UI initialization code here
    const floatingPanels = document.querySelectorAll('.floating-panel');
    if (floatingPanels.length > 0) {
        floatingPanels.forEach(panel => {
            // Set up close button functionality
            const closeBtn = panel.querySelector('.panel-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    panel.classList.add('hidden');
                });
            }
            
            // Initially hide all panels
            panel.classList.add('hidden');
        });
    }
}

/**
 * Set up the fabric type selector
 */
function setupFabricTypeSelector() {
    // This function has been removed as fabric type functionality is removed
    console.log('Fabric type selector functionality has been removed');
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed');

    // Define WebGL support check function if not already available
    if (typeof window.checkWebGLSupport !== 'function') {
        window.checkWebGLSupport = function() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                
                if (!gl) {
                    return {
                        supported: false,
                        limitedSupport: false,
                        message: 'WebGL is not supported in your browser.'
                    };
                }
                
                // Check for basic capabilities
                const capabilities = {
                    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                    maxCubeMapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
                    maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
                };
                
                // Check for limited support
                const isLimited = capabilities.maxTextureSize < 4096 || 
                                capabilities.maxCubeMapSize < 4096;
                
                return {
                    supported: true,
                    limitedSupport: isLimited,
                    capabilities: capabilities,
                    message: isLimited ? 
                        'Your device supports WebGL but has limited capabilities.' : 
                        'Full WebGL support detected.'
                };
            } catch (e) {
                return {
                    supported: false,
                    limitedSupport: false,
                    message: 'Error checking WebGL support: ' + e.message
                };
            }
        };
    }

    // Check WebGL support
    const webGLStatus = window.checkWebGLSupport();
    if (!webGLStatus.supported) {
        console.error('WebGL not properly supported:', webGLStatus.message);
        
        let loadingMessage = document.getElementById('loading-message');
        if (!loadingMessage) {
            loadingMessage = document.createElement('div');
            loadingMessage.id = 'loading-message';
            loadingMessage.classList.add('error-message');
            document.body.appendChild(loadingMessage);
        }
        
        loadingMessage.innerHTML = `
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
        };
    }

    // Ensure UI controls are properly initialized
    setupUIControls();

    // Load all models with proper error handling
    console.log("Model loading functionality would go here");
    /* Removing loadModels call since it's not defined
    loadModels().catch(error => {
        console.error('Error during model loading:', error);
        
        let loadingMessage = document.getElementById('loading-message');
        if (!loadingMessage) {
            loadingMessage = document.createElement('div');
            loadingMessage.id = 'loading-message';
            loadingMessage.classList.add('error-message');
            document.body.appendChild(loadingMessage);
        }
        
        loadingMessage.innerHTML = `
            <div class="alert alert-danger">
                Error loading 3D models: ${error.message}
            </div>`;
    });
    */
});

// Make sure theme background function is accessible from HTML
window.updateThemeBackground = updateThemeBackground;

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

        // Update button icon with animation
        newThemeToggle.classList.add('rotating');
        
        setTimeout(() => {
            newThemeToggle.innerHTML = newDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
            
            // Remove the rotation class after the icon has changed
            newThemeToggle.classList.remove('rotating');
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
            el.classList.toggle('hidden', isEditorMode);
        });

        editorControls.forEach(el => {
            el.classList.toggle('hidden', !isEditorMode);
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

// Landing page initialization
function initLandingPage() {
    const landingPage = document.querySelector('.landing-page');
    const landingButton = document.querySelector('.landing-button');
    const app = document.querySelector('.app');
    const landingThemeToggle = document.getElementById('landing-theme-toggle');
    
    // Initialize landing page theme toggle
    if (landingThemeToggle) {
        const savedTheme = localStorage.getItem('theme');
        let isDarkMode = savedTheme ? savedTheme === 'dark' : true;
        
        landingThemeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        landingThemeToggle.addEventListener('click', function() {
            isDarkMode = !isDarkMode;
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            document.documentElement.classList.toggle('light-theme', !isDarkMode);
            landingThemeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }

    // Handle landing page transition
    if (landingButton) {
        landingButton.addEventListener('click', function() {
            landingPage.classList.add('fade-out');
            setTimeout(() => {
                app.classList.add('visible');
                // Initialize the main application
                initializeMainApp();
            }, 500);
        });
    }
}

// Initialize main application
function initializeMainApp() {
    // Initialize all the existing functionality
    setupUIControls();
    
    // Remove loadModels call since it's not defined
    console.log("Main app initialized");
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Initialize landing page first
    initLandingPage();
    
    // Check WebGL support
    const webGLStatus = window.checkWebGLSupport();
    if (!webGLStatus.supported) {
        console.error('WebGL not properly supported:', webGLStatus.message);
        showErrorMessage(webGLStatus.message);
    } else if (webGLStatus.limitedSupport) {
        console.warn('Limited WebGL support:', webGLStatus.message);
    } else {
        console.log('WebGL support:', webGLStatus.message);
    }
});

/**
 * Example function to demonstrate how to register a new model type
 * This can be called to add new models dynamically
 */
function registerNewModelExample() {
    // Check if the model registration function is available
    if (typeof window.registerModelType !== 'function') {
        console.error('Model registration function not available');
        return false;
    }
    
    // Example configuration for an "oversized t-shirt" model
    const oversizedConfig = {
        name: "Oversized T-Shirt",
        glbPath: "./models/oversized_tshirt.glb", // Path to the 3D model file
        defaultColor: "#FFFFFF",
        defaultScale: 1.2,
        views: {
            // Define the available views and their properties
            "front": {
                name: "Front",
                bounds: { x: 0.15, y: 0.45, width: 0.7, height: 0.8 },
                defaultScale: 1,
                uvRect: { u1: 0.08, v1: 0.08, u2: 0.45, v2: 0.65 },
                transformMatrix: {
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    offset: { x: 0, y: 0 }
                }
            },
            "back": {
                name: "Back",
                bounds: { x: 0.25, y: 0.52, width: 0.45, height: 0.45 },
                defaultScale: 1,
                uvRect: { u1: 0.55, v1: 0.08, u2: 0.92, v2: 0.65 },
                transformMatrix: {
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    offset: { x: 0, y: 0 }
                }
            },
            "left_arm": {
                name: "Left Sleeve",
                bounds: { x: 0.16, y: 0.35, width: 0.16, height: 0.25 },
                defaultScale: 0.3,
                uvRect: { u1: 0.08, v1: 0.78, u2: 0.42, v2: 0.92 },
                transformMatrix: {
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    offset: { x: 0, y: 0 }
                }
            },
            "right_arm": {
                name: "Right Sleeve",
                bounds: { x: 0.76, y: 0.35, width: 0.16, height: 0.25 },
                defaultScale: 0.3,
                uvRect: { u1: 0.58, v1: 0.78, u2: 0.92, v2: 0.92 },
                transformMatrix: {
                    scale: { x: 1, y: 1 },
                    rotation: 0,
                    offset: { x: 0, y: 0 }
                }
            }
        },
        textureSettings: {
            canvasWidth: 1024,
            canvasHeight: 1024,
            baseColor: "#FFFFFF",
            acceptsFullTexture: true,
            acceptsDecals: true
        },
        viewDetection: {
            zones: [
                { x: [0.35, 0.65], y: [0.2, 0.8], view: "front" },
                { x: [0.05, 0.3], y: [0.3, 0.6], view: "left_arm" },
                { x: [0.7, 0.95], y: [0.3, 0.6], view: "right_arm" }
            ]
        }
    };
    
    // Register the new model type
    const success = window.registerModelType('oversized_tshirt', oversizedConfig);
    
    if (success) {
        console.log('Successfully registered new model: Oversized T-Shirt');
        
        // Optionally refresh the UI to show the new model
        setupModelSelector();
        
        return true;
    } else {
        console.error('Failed to register new model');
        return false;
    }
}

// Expose the function globally for demonstration purposes
window.registerNewModelExample = registerNewModelExample; 