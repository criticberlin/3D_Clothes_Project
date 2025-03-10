import { setupScene, updateShirtColor, updateShirtTexture, toggleTexture, downloadCanvas, changeModel, updateThemeBackground, toggleAutoRotate, changeCameraView } from './scene.js';
import { initializeTabs, setupColorPicker, setupFilePicker, setupAIPicker, setupCameraViewButtons } from './ui.js';
import { state, updateState, subscribe } from './state.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing 3D Shirt Studio...');

    // Detect and handle mobile devices
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        document.body.classList.add('mobile');
    }

    // Add direct event listeners for zoom buttons as a fail-safe
    setTimeout(() => {
        console.log('Setting up fail-safe zoom button handlers');

        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function () {
                console.log('Zoom in clicked from fail-safe handler');
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
                console.log('Zoom out clicked from fail-safe handler');
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
            console.warn(`Some DOM elements are not yet available: ${missingElements.join(', ')}`);
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
        });

        // Initialize the 3D scene
        setupScene().then(() => {
            console.log('Scene loaded successfully');

            // Add a slight delay for a smoother transition
            setTimeout(() => {
                // Explicitly hide loading overlay with a fade effect
                const loadingOverlay = document.querySelector('.loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                        loadingOverlay.style.opacity = '1';
                    }, 300);
                }
            }, 200);
        }).catch(error => {
            console.error('Error initializing scene:', error);
            const loadingOverlay = document.querySelector('.loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading 3D model. Please refresh the page.</p>
                    </div>
                `;
            }
        });

        // Initialize UI components
        initializeTabs();
        setupColorPicker();
        setupFilePicker();
        setupAIPicker();
        setupCameraViewButtons();
        setupModelSelector();
        setupMobileNavigation();

        // Initialize theme 
        const themeToggle = document.getElementById('theme-toggle');
        const isDarkMode = state.darkMode !== false;

        // Ensure theme is applied to document
        document.documentElement.classList.toggle('light-theme', !isDarkMode);

        // Apply theme to scene background
        updateThemeBackground(isDarkMode);

        // Make sure correct icon is displayed
        if (themeToggle) {
            themeToggle.innerHTML = isDarkMode
                ? '<i class="fas fa-sun"></i>'
                : '<i class="fas fa-moon"></i>';
        } else {
            console.warn("Theme toggle button not found in the DOM");
        }

        // Make sure toggle states match the state object
        const logoToggle = document.getElementById('logo-toggle');
        const textureToggle = document.getElementById('texture-toggle');

        if (logoToggle) {
            logoToggle.checked = state.logo !== false;
        }

        if (textureToggle) {
            textureToggle.checked = state.stylish === true;
        }

        // Setup download button
        const downloadBtn = document.getElementById('download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                console.log('Downloading design...');

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
            console.warn("Download button not found in the DOM");
        }

        // Setup reset button
        const resetBtn = document.getElementById('reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                console.log('Resetting design...');

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

                // Reset UI elements
                if (logoToggle) {
                    logoToggle.checked = true;
                }

                if (textureToggle) {
                    textureToggle.checked = false;
                }

                // Reset logo position buttons
                const positionButtons = document.querySelectorAll('.position-btn');
                if (positionButtons.length > 0) {
                    positionButtons.forEach(btn => {
                        if (btn.dataset.position === 'center') {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                }

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
            console.warn("Reset button not found in the DOM");
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
            console.warn("Auto-rotate button not found in the DOM");
        }

        // Set default color preview
        const colorPreview = document.getElementById('color-preview');
        if (colorPreview) {
            colorPreview.style.backgroundColor = state.color || defaultColor;
        }

        // Add welcome animation to tabs
        animateWelcome();

        console.log('Initialization complete!');
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
                        console.log(`Changed model to ${newModel}`);

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
                        console.error(`Error changing to ${newModel}:`, error);

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
    // Update toggle switches to match state
    const logoToggle = document.getElementById('logo-toggle');
    const textureToggle = document.getElementById('texture-toggle');

    if (newState.logo !== undefined && logoToggle) {
        logoToggle.checked = newState.logo;
        toggleTexture('logo', newState.logo);
    }

    if (newState.stylish !== undefined && textureToggle) {
        textureToggle.checked = newState.stylish;
        toggleTexture('full', newState.stylish);
    }

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