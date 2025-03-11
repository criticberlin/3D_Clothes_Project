import { setupScene, updateShirtColor, updateShirtTexture, toggleTexture, downloadCanvas, changeModel, updateThemeBackground, toggleAutoRotate, changeCameraView, setFabricType } from './scene.js';
import { initializeTabs, setupColorPicker, setupFilePicker, setupAIPicker, setupCameraViewButtons } from './ui.js';
import { state, updateState, subscribe } from './state.js';
import { Logger, Performance } from './utils.js';
import { initFabricCanvas, clearCanvas, downloadDesign, setColor, setFabricType as setFabricEditorType } from './fabric-integration.js';

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
    }, 1000); // Wait 1 second to ensure the scene is loaded

    // Function to check if all required DOM elements are loaded
    function checkDOMElements() {
        const requiredElements = {
            'rotate-view': document.getElementById('rotate-view'),
            'loadingOverlay': document.querySelector('.loading-overlay'),
            'download': document.getElementById('download'),
            'reset': document.getElementById('reset'),
            'theme-toggle': document.getElementById('theme-toggle')
        };

        const missingElements = Object.entries(requiredElements)
            .filter(([_, element]) => !element)
            .map(([name]) => name);

        if (missingElements.length > 0) {
            Logger.warn(`Some DOM elements are not yet available: ${missingElements.join(', ')}`);
            // Wait and try again if elements are missing
            setTimeout(initializeApp, 100);
            return false;
        }

        return true;
    }

    // Main initialization function
    function initializeApp() {
        if (!checkDOMElements()) {
            return; // Exit if elements aren't available yet
        }

        // Default color (first color in the rainbow palette)
        const defaultColor = '#FF0000';

        // Set default state (match original project)
        updateState({
            intro: true,
            color: defaultColor,
            isLogoTexture: true,
            isFullTexture: false,
            logoDecal: 'assets/threejs.png',
            fullDecal: 'assets/threejs.png',
            logo: true,  // For the toggle button
            stylish: false, // For the toggle button
            currentModel: 'tshirt', // Default model is t-shirt
            logoPosition: 'center', // Reset logo position to center
            cameraView: 'front', // Default camera view
            autoRotate: false, // Auto-rotation disabled by default
            darkMode: true, // Default to dark mode
            fabricType: 'cotton', // Default fabric type
            textureStyle: 'plain' // Default texture style
        });

        // Set up theme toggle directly here instead of relying on other functions
        setupDirectThemeToggle();

        // Initialize the 3D scene
        setupScene().then(() => {
            Logger.info('Scene loaded successfully');

            // Initialize Fabric.js integration
            // This will be called after DOM is fully loaded in the window load event

            // Connect the color picker with Fabric.js
            // When the shirt color changes, we'll update the fabric editor color selector
            subscribe('color', (color) => {
                // You could add a UI element to toggle this sync behavior
                // setColor(color); // Uncomment to sync shirt color with fabric drawing color
            });

            // Connect fabric type selection
            subscribe('fabricType', (fabricType) => {
                // Update the Fabric.js editor with the new fabric type
                setFabricEditorType(fabricType);

                // Update the 3D model material
                setFabricType(fabricType);
            });

            // Set up fabric type selector
            setupFabricTypeSelector();

            // Add a slight delay for a smoother transition
            setTimeout(() => {
                // Explicitly hide loading overlay with a fade effect
                const loadingOverlay = document.querySelector('.loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        animateWelcome();
                    }, 500);
                } else {
                    animateWelcome();
                }
            }, 300);
        }).catch(error => {
            console.error('Failed to initialize scene:', error);
            Logger.error('Failed to initialize scene:', error);
        });

        // Initialize UI components
        initializeTabs();
        setupColorPicker();
        setupFilePicker();
        setupAIPicker();
        setupCameraViewButtons();
        setupModelSelector();
        setupMobileNavigation();

        // Setup download button
        const downloadBtn = document.getElementById('download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                Logger.info('Downloading design...');

                // Add visual feedback
                const originalText = downloadBtn.innerHTML;

                downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
                downloadBtn.disabled = true;

                setTimeout(() => {
                    downloadCanvas();

                    // Restore button after download
                    setTimeout(() => {
                        downloadBtn.innerHTML = originalText;
                        downloadBtn.disabled = false;
                    }, 500);
                }, 300);
            });
        } else {
            Logger.warn("Download button not found in the DOM");
        }

        // Setup reset button
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                Logger.info('Resetting design...');

                // Visual feedback
                const originalText = resetBtn.innerHTML;
                resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
                resetBtn.disabled = true;

                // Reset to default state - match original project defaults
                updateState({
                    color: defaultColor,
                    isLogoTexture: true,
                    isFullTexture: false,
                    logoDecal: 'assets/threejs.png',
                    fullDecal: 'assets/threejs.png',
                    logo: true,
                    stylish: false,
                    logoPosition: 'center' // Reset logo position to center
                });

                // Reset color picker
                const colorWheel = document.getElementById('color-wheel');
                const colorHex = document.getElementById('color-hex');
                const colorPreview = document.getElementById('color-preview');

                if (colorWheel) {
                    colorWheel.value = defaultColor;
                }

                if (colorHex) {
                    colorHex.textContent = defaultColor;
                }

                if (colorPreview) {
                    colorPreview.style.backgroundColor = defaultColor;
                }

                // Update active color button
                const colorButtons = document.querySelectorAll('.color-btn');
                if (colorButtons.length > 0) {
                    colorButtons.forEach(btn => {
                        if (btn.dataset.color === defaultColor) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                }

                // Update shirt model
                updateShirtColor(defaultColor);
                updateShirtTexture('assets/threejs.png', 'logo');
                toggleTexture('logo', true);
                toggleTexture('full', false);

                // Reset preview areas
                resetPreviews();

                // Restore button state after reset
                setTimeout(() => {
                    resetBtn.innerHTML = originalText;
                    resetBtn.disabled = false;
                }, 500);
            });
        } else {
            Logger.warn("Reset button not found in the DOM");
        }

        // Setup auto-rotate button
        const rotateViewBtn = document.getElementById('rotate-view');
        if (rotateViewBtn) {
            // Ensure initial state is off
            toggleAutoRotate(false);

            rotateViewBtn.addEventListener('click', () => {
                const isCurrentlyActive = rotateViewBtn.classList.contains('active-toggle');
                toggleAutoRotate(!isCurrentlyActive);
            });
        } else {
            Logger.warn("Auto-rotate button not found in the DOM");
        }

        // Set default color preview
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = state.color || defaultColor;
        }

        // Add welcome animation to tabs
        animateWelcome();

        Logger.info('Initialization complete!');
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
        document.documentElement.classList.toggle('light-theme', !isDarkMode);

        // Set correct icon
        themeToggle.innerHTML = isDarkMode
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';

        // Apply theme to scene
        updateThemeBackground(isDarkMode);

        // Remove any existing event listeners by cloning the button
        const newThemeToggle = themeToggle.cloneNode(true);
        if (themeToggle.parentNode) {
            themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
        }

        // Add click handler
        newThemeToggle.addEventListener('click', () => {
            console.log("Theme toggle clicked");

            // Toggle theme state
            const newDarkMode = !state.darkMode;
            console.log(`Switching to ${newDarkMode ? 'dark' : 'light'} mode`);

            // Update state
            updateState({ darkMode: newDarkMode });

            // Update UI
            document.documentElement.classList.toggle('light-theme', !newDarkMode);

            // Update button icon
            newThemeToggle.innerHTML = newDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';

            // Update 3D scene background
            updateThemeBackground(newDarkMode);
        });
    }

    initializeApp();
});

// Welcome animation for tabs and sections
function animateWelcome() {
    const elements = [
        '.model-selector',
        '.tab-navigation',
        '#color-picker',
        '.logo-position-options',
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
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (sidebarToggle && sidebar && backdrop) {
        // Open sidebar
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.add('sidebar-open');
            backdrop.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        // Close when clicking backdrop
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('sidebar-open');
            backdrop.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        });

        // Close on window resize if it transitions to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && sidebar.classList.contains('sidebar-open')) {
                sidebar.classList.remove('sidebar-open');
                backdrop.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
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
                const currentLogoDecal = state.logoDecal;
                const currentFullDecal = state.fullDecal;
                const logoVisible = state.logo;
                const fullTextureVisible = state.stylish;
                const logoPosition = state.logoPosition; // Preserve logo position

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

                        // Restore settings from previous model
                        if (currentColor) updateShirtColor(currentColor);

                        // Make sure logo position is applied before updating textures
                        if (logoPosition) updateState({ logoPosition });

                        if (logoVisible && currentLogoDecal) updateShirtTexture(currentLogoDecal, 'logo');
                        if (fullTextureVisible && currentFullDecal) updateShirtTexture(currentFullDecal, 'full');

                        toggleTexture('logo', logoVisible);
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

// Subscribe to state changes
subscribe((newState) => {
    // Update color preview if color changed
    if (newState.color) {
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = newState.color;
        }
    }

    // Update model selector if model changed
    if (newState.currentModel) {
        const modelOption = document.querySelector(`input[name="model-type"][value="${newState.currentModel}"]`);
        if (modelOption && !modelOption.checked) {
            modelOption.checked = true;
        }
    }
});

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

    // Setup initial theme
    setupThemeToggle();

    // Ensure the clothesOptions contains all the required keys
    if (typeof clothesOptions === 'undefined' || !clothesOptions) {
        console.error('clothesOptions not defined, creating default object');
        window.clothesOptions = {
            tshirt: true,
            hoodie: true,
            pants: true,
            shorts: true
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
        document.getElementById('loading-message').textContent = 'Loading models...';

        // Create a loader with specific timeout
        const loader = new THREE.GLTFLoader();

        // Function to load a single model with timeout and retry
        const loadModelWithRetry = async (path, maxRetries = 2, timeout = 15000) => {
            let retries = 0;

            while (retries <= maxRetries) {
                try {
                    // Create a promise that rejects after timeout
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Loading ${path} timed out after ${timeout}ms`)), timeout)
                    );

                    // Create loading promise
                    const loadingPromise = new Promise((resolve, reject) => {
                        console.log(`Loading model: ${path} (attempt ${retries + 1})`);
                        loader.load(
                            path,
                            (gltf) => resolve(gltf),
                            (xhr) => {
                                const percentComplete = (xhr.loaded / xhr.total) * 100;
                                document.getElementById('loading-message').textContent =
                                    `Loading ${path.split('/').pop()}: ${Math.round(percentComplete)}%`;
                            },
                            (error) => reject(new Error(`Error loading ${path}: ${error.message}`))
                        );
                    });

                    // Race between loading and timeout
                    return await Promise.race([loadingPromise, timeoutPromise]);
                } catch (error) {
                    retries++;
                    console.warn(`Attempt ${retries} failed for ${path}: ${error.message}`);

                    if (retries > maxRetries) {
                        throw error;
                    }

                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                }
            }
        };

        // Check which models to load based on clothesOptions
        const modelsToLoad = [];

        if (clothesOptions.tshirt) {
            modelsToLoad.push({ type: 'tshirt', path: 'models/tshirt.glb' });
        }

        if (clothesOptions.hoodie) {
            modelsToLoad.push({ type: 'hoodie', path: 'models/hoodie.glb' });
        }

        if (clothesOptions.pants) {
            modelsToLoad.push({ type: 'pants', path: 'models/pants.glb' });
        }

        if (clothesOptions.shorts) {
            modelsToLoad.push({ type: 'shorts', path: 'models/shorts.glb' });
        }

        // Load all models in parallel for efficiency
        const results = await Promise.allSettled(
            modelsToLoad.map(model => loadModelWithRetry(model.path)
                .then(gltf => ({ type: model.type, gltf }))
            )
        );

        // Process results
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const { type, gltf } = result.value;
                console.log(`Successfully loaded ${type} model`);

                // Store model and update UI
                switch (type) {
                    case 'tshirt':
                        window.tshirtModel = gltf.scene;
                        break;
                    case 'hoodie':
                        window.hoodieModel = gltf.scene;
                        break;
                    case 'pants':
                        window.pantsModel = gltf.scene;
                        break;
                    case 'shorts':
                        window.shortsModel = gltf.scene;
                        break;
                }
            } else {
                console.error(`Failed to load ${modelsToLoad[index].type} model:`, result.reason);
                // Disable the option in UI if model failed to load
                const checkbox = document.getElementById(modelsToLoad[index].type + 'Checkbox');
                if (checkbox) {
                    checkbox.disabled = true;
                    checkbox.checked = false;
                    checkbox.parentNode.classList.add('text-muted');
                    checkbox.parentNode.title = `Could not load ${modelsToLoad[index].type} model`;
                }
            }
        });

        // Update the scene with loaded models
        updateScene();
        document.getElementById('loading-message').textContent = 'Models loaded successfully!';
        setTimeout(() => {
            document.getElementById('loading-message').style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error in loadModels:', error);
        throw error;
    }
}

// Make sure theme background function is accessible from HTML
window.updateThemeBackground = updateThemeBackground; 