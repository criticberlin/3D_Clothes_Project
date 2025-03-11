import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state, updateState } from './state.js';
import { initTextureMapper, loadCustomImage, setModelType, clearCustomImage } from './texture-mapper.js';
import { Logger, Performance } from './utils.js';

// ============================================================================
// Global Variables
// ============================================================================
let scene, camera, renderer, controls;
let shirtMesh, shirtMaterial;
let pointer = { x: 0, y: 0 };
let targetCameraPosition = new THREE.Vector3(0, 0, 2);
let group;
let logoDecal, fullDecal;
let isLogoTexture = true;
let isFullTexture = false;
let currentModelPath = '';
let currentModelType = 'tshirt';
let isAutoRotating = false;
let isViewTransitioning = false;
let viewTransitionEndTime = 0;
let lastRotationView = null; // Track last view for rotation adjustments
let textureMapperInitialized = false; // Flag to track texture mapper initialization
let cumulativeZoomFactor = 1.0;

// Add standalone rotation animation variables
let manualRotationActive = false;
let rotationSpeed = 0.02; // Increased for better visibility
let rotationAxis = new THREE.Vector3(0, 1, 0); // Y-axis rotation by default

// Create a dedicated rotation control variable
let rotationEnabled = false;

// Set a GLOBAL rotation variable on the window object to ensure it's accessible everywhere
window.GLOBAL_ROTATION_ENABLED = false;

// ============================================================================
// Model Configuration
// ============================================================================
const modelSettings = {
    tshirt: {
        scale: 0.8,
        position: new THREE.Vector3(0, 0, 0),
        logoPositions: {
            // Center logo
            center: {
                position: new THREE.Vector3(0, 0.04, 0.135),
                rotation: new THREE.Euler(-0.1, 0, 0),
                scale: new THREE.Vector3(0.15, 0.15, 0.15)
            },
            // Left chest logo
            left: {
                position: new THREE.Vector3(0.077, 0.09, 0.1299),
                rotation: new THREE.Euler(-0.1, 0.2, 0),
                scale: new THREE.Vector3(0.08, 0.08, 0.08)
            },
            // Right chest logo
            right: {
                position: new THREE.Vector3(-0.077, 0.09, 0.1299),
                rotation: new THREE.Euler(-0.1, -0.2, 0),
                scale: new THREE.Vector3(0.08, 0.08, 0.08)
            },
            // Center back logo
            back: {
                position: new THREE.Vector3(0, 0.04, -0.134),
                rotation: new THREE.Euler(0, Math.PI, 0),
                scale: new THREE.Vector3(0.15, 0.15, 0.15)
            },
            // Left sleeve - center
            leftSleeveCenter: {
                position: new THREE.Vector3(0.25, 0.04, -0.022),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Left sleeve - upper
            leftSleeveUpper: {
                position: new THREE.Vector3(0.25, 0.1, -0.022),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Left sleeve - lower
            leftSleeveLower: {
                position: new THREE.Vector3(0.25, -0.02, -0.022),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - center
            rightSleeveCenter: {
                position: new THREE.Vector3(-0.25, 0.04, 0.022),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - upper
            rightSleeveUpper: {
                position: new THREE.Vector3(-0.25, 0.1, 0.022),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - lower
            rightSleeveLower: {
                position: new THREE.Vector3(-0.25, -0.02, 0.022),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            }
        },
        // Legacy properties for backward compatibility
        logoPosition: new THREE.Vector3(0, 0.04, 0.135),
        logoRotation: new THREE.Euler(-0.1, 0, 0),
        logoScale: new THREE.Vector3(0.15, 0.15, 0.15),
        camera: {
            position: new THREE.Vector3(0, 0, 2.5),
            target: new THREE.Vector3(0, 0, 0),
            fov: 25
        },
        // New camera positions for different views
        cameraPositions: {
            front: {
                position: new THREE.Vector3(0, 0, 2.5),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            back: {
                position: new THREE.Vector3(0, 0, -2.5),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            left: {
                position: new THREE.Vector3(-2.5, 0, 0),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            right: {
                position: new THREE.Vector3(2.5, 0, 0),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            }
        }
    },
    hoodie: {
        scale: 0.65,
        position: new THREE.Vector3(0, -0.9, 0),
        logoPositions: {
            // Center logo
            center: {
                position: new THREE.Vector3(0, 0.2, 0.15),
                rotation: new THREE.Euler(-0.15, 0, 0),
                scale: new THREE.Vector3(0.13, 0.13, 0.13)
            },
            // Left chest logo
            left: {
                position: new THREE.Vector3(0.08, 0.25, 0.13),
                rotation: new THREE.Euler(-0.15, 0.2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right chest logo
            right: {
                position: new THREE.Vector3(-0.08, 0.25, 0.13),
                rotation: new THREE.Euler(-0.15, -0.2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Center back logo
            back: {
                position: new THREE.Vector3(0, 0.2, -0.15),
                rotation: new THREE.Euler(0.15, Math.PI, 0),
                scale: new THREE.Vector3(0.13, 0.13, 0.13)
            },
            // Left sleeve - center
            leftSleeveCenter: {
                position: new THREE.Vector3(0.2, 0.15, 0.08),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Left sleeve - upper
            leftSleeveUpper: {
                position: new THREE.Vector3(0.2, 0.25, 0.08),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Left sleeve - lower
            leftSleeveLower: {
                position: new THREE.Vector3(0.2, 0.05, 0.08),
                rotation: new THREE.Euler(0, Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - center
            rightSleeveCenter: {
                position: new THREE.Vector3(-0.2, 0.15, 0.08),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - upper
            rightSleeveUpper: {
                position: new THREE.Vector3(-0.2, 0.25, 0.08),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            },
            // Right sleeve - lower
            rightSleeveLower: {
                position: new THREE.Vector3(-0.2, 0.05, 0.08),
                rotation: new THREE.Euler(0, -Math.PI / 2, 0),
                scale: new THREE.Vector3(0.07, 0.07, 0.07)
            }
        },
        // Legacy properties for backward compatibility
        logoPosition: new THREE.Vector3(0, 0.2, 0.15),
        logoRotation: new THREE.Euler(-0.15, 0, 0),
        logoScale: new THREE.Vector3(0.13, 0.13, 0.13),
        camera: {
            position: new THREE.Vector3(0, 0.05, 2.8),
            target: new THREE.Vector3(0, 0, 0),
            fov: 25
        },
        // New camera positions for different views
        cameraPositions: {
            front: {
                position: new THREE.Vector3(0, 0.05, 2.8),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            back: {
                position: new THREE.Vector3(0, 0.05, -2.8),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            left: {
                position: new THREE.Vector3(-2.8, 0.05, 0),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            },
            right: {
                position: new THREE.Vector3(2.8, 0.05, 0),
                target: new THREE.Vector3(0, 0, 0),
                fov: 25
            }
        }
    }
};

// ============================================================================
// Scene Setup and Initialization
// ============================================================================
export function setupScene() {
    return new Promise((resolve, reject) => {
        try {
            // Make sure loading overlay exists
            ensureLoadingOverlayExists();

            initializeScene();
            setupLighting();
            setupControls();

            // Add debug verification for controls
            console.log('Controls initialized:', controls ? 'Yes' : 'No');

            // Expose key objects to window for direct access
            window.camera = camera;
            window.controls = controls;
            window.scene = scene;
            window.renderer = renderer;

            // Add direct reset camera function
            window.directResetCamera = function () {
                console.log('Direct reset camera called');
                resetCameraPosition();

                // Provide visual feedback
                const resetButton = document.getElementById('reset-camera');
                if (resetButton) {
                    resetButton.classList.add('active');
                    setTimeout(() => resetButton.classList.remove('active'), 300);
                }
            };

            // Add direct toggle rotation function to window
            window.directToggleRotation = function () {
                console.log('=== ROTATION BUTTON CLICKED ===');

                // Toggle the rotation state
                rotationEnabled = !rotationEnabled;
                console.log('Rotation is now:', rotationEnabled ? 'ENABLED' : 'DISABLED');

                // Update the manualRotationActive flag to match
                manualRotationActive = rotationEnabled;
                isAutoRotating = rotationEnabled;

                // Update button visual state
                const rotateButton = document.getElementById('rotate-view');
                if (rotateButton) {
                    if (rotationEnabled) {
                        rotateButton.classList.add('active');
                        rotateButton.title = 'Stop Rotation';

                        // Change icon to stop when rotating
                        const icon = rotateButton.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-redo');
                            icon.classList.add('fa-stop');
                        }

                        // Set the appropriate rotation axis
                        updateRotationAxisForCurrentView();
                    } else {
                        rotateButton.classList.remove('active');
                        rotateButton.title = 'Start Rotation';

                        // Change icon back to rotate when stopped
                        const icon = rotateButton.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-stop');
                            icon.classList.add('fa-redo');
                        }
                    }
                }

                // Make sure controls auto-rotation is off
                if (controls) {
                    controls.autoRotate = false;
                    controls.update();
                }

                // Force a render to show immediate feedback
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }
            };

            // Direct function to stop rotation
            window.directStopRotation = function () {
                console.log('Directly stopping rotation');

                // Set all rotation flags to false
                rotationEnabled = false;
                manualRotationActive = false;
                isAutoRotating = false;

                // Update button visual state
                const rotateButton = document.getElementById('rotate-view');
                if (rotateButton) {
                    rotateButton.classList.remove('active');
                    rotateButton.title = 'Start Rotation';

                    // Change icon back to rotate
                    const icon = rotateButton.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-stop');
                        icon.classList.add('fa-redo');
                    }
                }

                // Ensure controls auto-rotation is off
                if (controls) {
                    controls.autoRotate = false;
                    controls.update();
                }

                // Force a render
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }

                console.log('Rotation has been stopped');
            };

            // Add direct zoom camera function to window
            window.directZoomCamera = function (direction) {
                console.log('Direct window zoom camera:', direction);

                const zoomAmount = direction === 'in' ? 0.3 : -0.3;

                // Get direction vector from camera to target
                const target = controls ? controls.target : new THREE.Vector3(0, 0, 0);
                const zoomDirection = new THREE.Vector3();
                zoomDirection.subVectors(target, camera.position).normalize();

                // Apply zoom by moving camera position
                camera.position.addScaledVector(zoomDirection, zoomAmount);

                // Update camera matrix
                camera.updateMatrixWorld();
                camera.updateProjectionMatrix();

                // Update controls
                if (controls) controls.update();

                // Force render update
                if (renderer) renderer.render(scene, camera);

                console.log('Camera position after zoom:', camera.position.toArray());
            };

            setupEventListeners();
            setupCameraControls();

            // Load initial model
            loadModel(state.modelPaths[state.currentModel] || './shirt_baked.glb')
                .then(() => {
                    initializeDefaultState();
                    // Remove loading overlay after scene is fully set up
                    const loadingOverlay = document.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    } else {
                        console.warn("Loading overlay element not found in the DOM");
                    }
                    resolve();
                })
                .catch(error => {
                    console.error('Error loading model:', error);
                    reject(error);
                });

            animate();
        } catch (error) {
            console.error('Error in scene setup:', error);
            reject(error);
        }
    });
}

// Helper to ensure loading overlay exists
function ensureLoadingOverlayExists() {
    if (!document.querySelector('.loading-overlay')) {
        console.log('Creating missing loading overlay element');
        const container = document.querySelector('.canvas-container');
        if (container) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';

            // Create spinner
            const spinner = document.createElement('div');
            spinner.className = 'spinner';
            loadingOverlay.appendChild(spinner);

            // Create loading text
            const loadingText = document.createElement('p');
            loadingText.textContent = 'Loading 3D model...';
            loadingOverlay.appendChild(loadingText);

            container.appendChild(loadingOverlay);
        } else {
            console.error('Canvas container not found, cannot create loading overlay');
        }
    }
}

function initializeScene() {
    scene = new THREE.Scene();

    // Create a canvas container if it doesn't exist
    ensureCanvasContainerExists();

    // Create camera with responsive FOV
    const container = document.querySelector('.canvas-container');

    // Make sure the container exists
    if (!container) {
        console.error("Canvas container element not found. Please check your HTML.");
        throw new Error("Canvas container element not found");
    }

    const isMobile = window.innerWidth < 768;
    const fov = isMobile ? 35 : 25; // Wider FOV on mobile

    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    camera.position.set(0, 0, 2.5);

    // Create renderer with improved quality
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Fix deprecated properties warnings by using recommended new properties
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear previous canvas if exists
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    container.appendChild(renderer.domElement);

    // Create a group to hold all objects
    group = new THREE.Group();
    scene.add(group);

    // Set theme based on current state
    updateThemeBackground(state.darkMode !== false);
}

// Helper to ensure the canvas container exists
function ensureCanvasContainerExists() {
    if (!document.querySelector('.canvas-container')) {
        console.log('Creating missing canvas container');
        const appContainer = document.querySelector('.app') || document.querySelector('.container');

        if (!appContainer) {
            // If no app container exists, create one in the body
            const mainContainer = document.createElement('div');
            mainContainer.className = 'app';

            // Create container structure
            const container = document.createElement('div');
            container.className = 'container';

            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'canvas-container';

            container.appendChild(canvasContainer);
            mainContainer.appendChild(container);
            document.body.appendChild(mainContainer);
        } else {
            // If app container exists but canvas container doesn't
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'canvas-container';
            appContainer.appendChild(canvasContainer);
        }
    }
}

function setupLighting() {
    // Soft ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light (simulating sunlight)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;

    // Improve shadow quality
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.bias = -0.0001;

    // For a room-sized scene
    const shadowSize = 10;
    mainLight.shadow.camera.left = -shadowSize;
    mainLight.shadow.camera.right = shadowSize;
    mainLight.shadow.camera.top = shadowSize;
    mainLight.shadow.camera.bottom = -shadowSize;

    scene.add(mainLight);

    // Add fill light (from opposite side)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-5, 5, -3);
    scene.add(fillLight);

    // Add rim light for edge highlights
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, -5, -5);
    scene.add(rimLight);

    // Add a subtle blue-tinted light from below (soft bounce light)
    const bounceLight = new THREE.DirectionalLight(0xe6f0ff, 0.2);
    bounceLight.position.set(0, -3, 0);
    scene.add(bounceLight);

    // Add hemisphere light for subtle color variation from sky/ground
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x202030, 0.3);
    scene.add(hemiLight);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);

    // Improved camera controls for better user experience
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.5;  // Increased zoom speed for better responsiveness
    controls.panSpeed = 0.8;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controls.maxPolarAngle = Math.PI / 1.6; // Prevent going below the model
    controls.minPolarAngle = Math.PI / 6;   // Prevent viewing too far from above
    controls.enablePan = true;              // Allow panning
    controls.screenSpacePanning = true;     // Better panning behavior
    controls.target.set(0, 0, 0);

    // Setup auto-rotation capability (but don't enable by default)
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.5;

    // Enable touch controls for mobile devices
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Ensure the dollyIn and dollyOut methods are available and working correctly
    if (!controls.dollyIn || !controls.dollyOut) {
        console.warn('OrbitControls missing dolly methods, implementing alternatives');

        // Add backup implementations if they're not available
        controls.dollyIn = function (dollyScale) {
            const zoomScale = Math.pow(0.95, dollyScale);
            controls.zoom *= zoomScale;
            controls.update();
        };

        controls.dollyOut = function (dollyScale) {
            const zoomScale = Math.pow(0.95, dollyScale);
            controls.zoom /= zoomScale;
            controls.update();
        };
    }

    // Add a listener for control changes to ensure smooth interaction
    controls.addEventListener('change', () => {
        // When user manually controls the camera, ensure consistent behavior
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    });
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('pointermove', onPointerMove);

    // Add keyboard controls for zooming
    window.addEventListener('keydown', (event) => {
        // + key (with or without shift) for zoom in
        if (event.key === '+' || event.key === '=') {
            console.log('Zoom in via keyboard');
            zoomCamera('in');
        }
        // - key for zoom out
        else if (event.key === '-' || event.key === '_') {
            console.log('Zoom out via keyboard');
            zoomCamera('out');
        }
        // 'R' key to toggle rotation
        else if (event.key === 'r' || event.key === 'R') {
            console.log('Toggle rotation via keyboard');
            window.TOGGLE_ROTATION(); // Use our new global function
        }
    });

    // Handle camera zoom events with improved responsiveness
    window.addEventListener('camera-zoom', (e) => {
        const direction = e.detail.direction;
        console.log('Camera zoom event received:', direction);

        // Use direct camera zoom
        zoomCamera(direction);
    });

    // Handle camera reset event with visual feedback
    window.addEventListener('camera-reset', () => {
        console.log('Resetting camera position...');
        // Add visual feedback for reset
        const resetBtn = document.getElementById('reset-camera');
        if (resetBtn) {
            resetBtn.classList.add('active');
            setTimeout(() => resetBtn.classList.remove('active'), 300);
        }
        // Reset camera to default position for current model type
        resetCameraPosition();
    });

    // Handle camera view change event
    window.addEventListener('camera-view-change', (e) => {
        const view = e.detail.view;
        changeCameraView(view);

        // Update rotation axis if rotation is active
        if (manualRotationActive) {
            updateRotationAxisForCurrentView();
        }
    });

    // Handle logo position change event
    window.addEventListener('logo-position-change', (e) => {
        const position = e.detail.position;
        if (position && logoDecal) {
            updateLogoPosition(position);
        }
    });

    // Update camera when the 3D model changes
    window.addEventListener('model-loaded', () => {
        resetCameraPosition();
    });

    // Handle texture updates from texture-mapper
    window.addEventListener('texture-updated', (e) => {
        if (!shirtMaterial) return;

        const { baseTexture, bumpMap } = e.detail;

        // Apply the updated texture to the shirt material
        if (baseTexture) {
            // Add a class to the canvas-container for animation
            const container = document.querySelector('.canvas-container');
            if (container) {
                container.classList.add('texture-updating');
                setTimeout(() => container.classList.remove('texture-updating'), 500);
            }

            // Update the material
            shirtMaterial.map = baseTexture;

            if (bumpMap) {
                shirtMaterial.normalMap = bumpMap;
                shirtMaterial.normalScale.set(0.1, 0.1);
            }

            shirtMaterial.needsUpdate = true;
            console.log('Texture updated from texture-mapper');
        }
    });

    // Add wheel event for direct camera zooming
    renderer.domElement.addEventListener('wheel', (event) => {
        event.preventDefault();
        if (controls) {
            if (event.deltaY < 0) {
                controls.dollyIn(1.1);
            } else {
                controls.dollyOut(1.1);
            }
            controls.update();
        }
    });
}

function initializeDefaultState() {
    updateShirtColor(state.color || '#FF0000');
    updateShirtTexture('assets/threejs.png', 'logo');
}

// ============================================================================
// Model Loading and Management
// ============================================================================

// Load a 3D model
function loadModel(modelPath) {
    return new Promise((resolve, reject) => {
        if (modelPath === currentModelPath && shirtMesh) {
            // Model already loaded
            resolve();
            return;
        }

        // Show loading indicator
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        // Determine model type from path
        currentModelType = modelPath.includes('hoodie') ? 'hoodie' : 'tshirt';
        console.log(`Loading model type: ${currentModelType}`);

        // Get model settings based on current type
        const settings = modelSettings[currentModelType] || modelSettings.tshirt;

        // Save the texture state if we're switching models
        const currentColor = shirtMaterial ? shirtMaterial.color.clone() : new THREE.Color(state.color || '#FF0000');

        // Clear the existing model and decals
        if (group && group.children.length > 0) {
            // Remove all children from the group
            while (group.children.length) {
                const child = group.children[0];

                // Properly dispose of materials and geometries
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => {
                            if (mat.map) mat.map.dispose();
                            mat.dispose();
                        });
                    } else {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }

                if (child.geometry) {
                    child.geometry.dispose();
                }

                group.remove(child);
            }
        }

        // Reset references
        logoDecal = null;
        fullDecal = null;
        shirtMesh = null;
        shirtMaterial = null;

        // Update the currentModelPath to prevent reloading
        currentModelPath = modelPath;

        const gltfLoader = new GLTFLoader();
        gltfLoader.load(
            modelPath,
            (gltf) => {
                // Process the loaded model
                processLoadedModel(gltf, settings, currentColor);

                // Initialize the texture mapper if not already done
                if (!textureMapperInitialized) {
                    // Set up texture mapper with procedural textures (no file paths)
                    initTextureMapper(null, null, currentModelType)
                        .then(({ baseTexture, bumpMap }) => {
                            console.log('Texture mapper initialized with procedural textures');
                            textureMapperInitialized = true;

                            // Apply the base texture if available
                            if (baseTexture && shirtMaterial) {
                                shirtMaterial.map = baseTexture;
                                if (bumpMap) {
                                    shirtMaterial.normalMap = bumpMap;
                                    shirtMaterial.normalScale.set(0.1, 0.1);
                                }
                                shirtMaterial.needsUpdate = true;
                            }

                            // Notify that model is ready
                            window.dispatchEvent(new CustomEvent('model-loaded', {
                                detail: { model: currentModelType }
                            }));

                            resolve();

                            // Hide loading overlay
                            if (loadingOverlay) loadingOverlay.style.display = 'none';
                        })
                        .catch(error => {
                            console.error('Error initializing texture mapper:', error);
                            resolve(); // Still resolve to not block the app

                            // Hide loading overlay
                            if (loadingOverlay) loadingOverlay.style.display = 'none';
                        });
                } else {
                    // Just update the model type in texture mapper
                    setModelType(currentModelType);

                    // Notify that model is ready
                    window.dispatchEvent(new CustomEvent('model-loaded', {
                        detail: { model: currentModelType }
                    }));

                    resolve();

                    // Hide loading overlay
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                }
            },
            (progress) => {
                // Update loading progress if needed
                const percentComplete = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Model loading: ${percentComplete}%`);
            },
            (error) => {
                console.error('Error loading model:', error);
                reject(error);

                // Hide loading overlay
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
        );
    });
}

// Process a loaded GLTF model
function processLoadedModel(gltf, settings, color) {
    const model = gltf.scene;

    // Apply model settings
    model.scale.set(
        settings.scale,
        settings.scale,
        settings.scale
    );

    model.position.copy(settings.position);
    model.rotation.copy(settings.rotation || new THREE.Euler(0, 0, 0));

    // Clear existing content
    if (!group) {
        group = new THREE.Group();
        scene.add(group);
    }

    // Add model to the group
    group.add(model);

    // Find the shirt mesh
    model.traverse((obj) => {
        if (obj.isMesh && !shirtMesh) {
            shirtMesh = obj;

            // Clone and store the original material
            shirtMaterial = obj.material.clone();

            // Apply the color
            shirtMaterial.color.copy(color);

            // Set material properties from settings if available
            if (settings.materialSettings) {
                for (const [property, value] of Object.entries(settings.materialSettings)) {
                    if (property in shirtMaterial) {
                        shirtMaterial[property] = value;
                    }
                }
            } else {
                // Fallback to basic properties
                shirtMaterial.roughness = 0.65;
                shirtMaterial.metalness = 0.02;
            }

            // Add fabric textures for realism
            createAdvancedFabricTextures(shirtMaterial);

            // Try to upgrade to physical material for better realism
            tryUpgradeToPhysicalMaterial(shirtMaterial, color, settings.materialSettings);

            // Apply the material
            obj.material = shirtMaterial;
        }
    });

    // Set up proper shadowing
    if (shirtMesh) {
        shirtMesh.castShadow = true;
        shirtMesh.receiveShadow = true;
    }

    console.log('Model processed successfully with enhanced material');
}

// Apply camera settings for the current model type
function applyModelCameraSettings(settings) {
    if (!settings || !settings.camera) return;

    // Update camera FOV if specified
    if (settings.camera.fov) {
        camera.fov = settings.camera.fov;
        camera.updateProjectionMatrix();
    }

    // Update camera target position (what the camera looks at)
    if (settings.camera.target && controls) {
        controls.target.copy(settings.camera.target);
    }

    // Update camera position with smooth transition
    if (settings.camera.position) {
        targetCameraPosition.copy(settings.camera.position);
    }
}

// Create a decal from an existing texture
function createDecalFromTexture(texture, type) {
    if (!shirtMesh) return;

    // Get model settings based on current type
    const settings = modelSettings[currentModelType] || modelSettings.tshirt;

    if (type === 'logo') {
        // Get logo position settings based on state.logoPosition
        const logoPos = state.logoPosition || 'center';
        const positionSettings = settings.logoPositions?.[logoPos] || {
            position: settings.logoPosition,
            rotation: settings.logoRotation,
            scale: settings.logoScale
        };

        // Create new logo material
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: true,
            depthTest: true,
            side: THREE.DoubleSide,
            alphaTest: 0.01
        });

        // Create plane geometry for the logo
        const geometry = new THREE.PlaneGeometry(1, 1);
        logoDecal = new THREE.Mesh(geometry, material);

        // Position based on the selected logo position
        logoDecal.position.copy(positionSettings.position);
        logoDecal.rotation.copy(positionSettings.rotation);
        logoDecal.scale.copy(positionSettings.scale);
        logoDecal.name = 'logo-decal';

        if (isLogoTexture) {
            shirtMesh.add(logoDecal);
        }
    } else if (type === 'full') {
        // Create material with the texture
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide,
            envMapIntensity: 0.5
        });

        // Clone the shirt geometry for our full texture overlay
        const geometry = shirtMesh.geometry.clone();
        fullDecal = new THREE.Mesh(geometry, material);

        // Make it fit perfectly on the shirt
        fullDecal.scale.set(1.01, 1.01, 1.01); // Slightly larger to prevent z-fighting
        fullDecal.visible = isFullTexture;
        fullDecal.name = 'full-decal';

        if (isFullTexture) {
            shirtMesh.add(fullDecal);
        }
    }
}

// ============================================================================
// Texture and Material Management
// ============================================================================

// Update shirt color with realistic fabric material settings
export function updateShirtColor(color) {
    if (!shirtMaterial) return;

    const targetColor = new THREE.Color(color);

    // Color-specific material settings for more realism
    let materialSettings = {
        roughness: 0.65,
        metalness: 0.02,
        clearcoat: 0.08,
        clearcoatRoughness: 0.4
    };

    // Adjust material properties based on color for more realism
    switch (color.toUpperCase()) {
        case '#FFFFFF': // White
            materialSettings = {
                roughness: 0.6,
                metalness: 0.01,
                clearcoat: 0.1,
                clearcoatRoughness: 0.45,
                sheen: 0.1,
                sheenRoughness: 0.8
            };
            break;

        case '#000000': // Black
            materialSettings = {
                roughness: 0.7,
                metalness: 0.03,
                clearcoat: 0.12,
                clearcoatRoughness: 0.35,
                sheen: 0.15,
                sheenRoughness: 0.7
            };
            break;

        case '#606060': // Gray/Charcoal
            materialSettings = {
                roughness: 0.68,
                metalness: 0.03,
                clearcoat: 0.09,
                clearcoatRoughness: 0.4,
                sheen: 0.08,
                sheenRoughness: 0.75
            };
            break;

        case '#000080': // Navy Blue
            materialSettings = {
                roughness: 0.72,
                metalness: 0.025,
                clearcoat: 0.07,
                clearcoatRoughness: 0.5,
                sheen: 0.06,
                sheenRoughness: 0.8
            };
            break;

        case '#F5F5DC': // Beige/Khaki
            materialSettings = {
                roughness: 0.65,
                metalness: 0.015,
                clearcoat: 0.06,
                clearcoatRoughness: 0.42,
                sheen: 0.07,
                sheenRoughness: 0.85
            };
            break;

        case '#556B2F': // Olive Green
            materialSettings = {
                roughness: 0.73,
                metalness: 0.02,
                clearcoat: 0.06,
                clearcoatRoughness: 0.45,
                sheen: 0.05,
                sheenRoughness: 0.85
            };
            break;

        case '#8B4513': // Brown
            materialSettings = {
                roughness: 0.75,
                metalness: 0.025,
                clearcoat: 0.05,
                clearcoatRoughness: 0.5,
                sheen: 0.04,
                sheenRoughness: 0.9
            };
            break;

        case '#800020': // Burgundy
            materialSettings = {
                roughness: 0.71,
                metalness: 0.03,
                clearcoat: 0.08,
                clearcoatRoughness: 0.4,
                sheen: 0.1,
                sheenRoughness: 0.8
            };
            break;
    }

    // Smooth transition for color change
    function updateColor() {
        // Smoothly transition color
        shirtMaterial.color.lerp(targetColor, 0.1);

        // Update material properties based on color settings
        for (const [property, value] of Object.entries(materialSettings)) {
            if (property in shirtMaterial) {
                // Smoothly transition property values
                shirtMaterial[property] += (value - shirtMaterial[property]) * 0.1;
            }
        }

        // Update material
        shirtMaterial.needsUpdate = true;

        // Continue animation until color is close enough
        if (!shirtMaterial.color.equals(targetColor)) {
            requestAnimationFrame(updateColor);
        } else {
            // Apply advanced fabric textures with color-specific adjustments
            createColorAdjustedFabricTextures(shirtMaterial, color);

            // Attempt to upgrade to physical material
            tryUpgradeToPhysicalMaterial(shirtMaterial, targetColor, materialSettings);

            console.log("Color update complete with fabric-specific properties");
        }
    }

    updateColor();
}

// New function to create fabric textures adjusted for specific colors
function createColorAdjustedFabricTextures(material, color) {
    // Higher resolution for more detail
    const resolution = 1024;

    // Create normal map adjusted for the fabric type of this color
    const normalMap = createColorAdjustedNormalMap(resolution, resolution, color);
    material.normalMap = normalMap;

    // Create roughness map adjusted for this color's fabric properties
    const roughnessMap = createColorAdjustedRoughnessMap(resolution, resolution, color);
    material.roughnessMap = roughnessMap;

    // Create AO map
    const aoMap = createAmbientOcclusionMap(resolution, resolution);
    material.aoMap = aoMap;

    // Only apply slight displacement for fabric texture
    const displacementMap = createDisplacementMap(resolution, resolution);
    material.displacementMap = displacementMap;
    material.displacementScale = 0.02;

    material.needsUpdate = true;
}

// Create a normal map adjusted for specific fabric types based on color
function createColorAdjustedNormalMap(width, height, color) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Different fabric weave patterns based on color
    let weaveFrequency = 0.2;
    let weaveDepth = 8;
    let noiseScale = 0.3;

    // Adjust fabric pattern based on color
    switch (color.toUpperCase()) {
        case '#FFFFFF': // White - smoother cotton
            weaveFrequency = 0.25;
            weaveDepth = 7;
            noiseScale = 0.25;
            break;
        case '#000000': // Black - slightly rougher
            weaveFrequency = 0.2;
            weaveDepth = 9;
            noiseScale = 0.35;
            break;
        case '#556B2F': // Olive Green - canvas-like
            weaveFrequency = 0.18;
            weaveDepth = 10;
            noiseScale = 0.4;
            break;
        case '#8B4513': // Brown - thick cotton
            weaveFrequency = 0.16;
            weaveDepth = 11;
            noiseScale = 0.45;
            break;
    }

    // Fill with fabric-like normal pattern
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Multi-frequency noise for realistic fabric weave
        const weaveX = Math.sin(x * weaveFrequency) * weaveDepth +
            Math.sin(x * (weaveFrequency / 2)) * (weaveDepth / 2);
        const weaveY = Math.sin(y * weaveFrequency) * weaveDepth +
            Math.sin(y * (weaveFrequency / 2)) * (weaveDepth / 2);

        // Diagonal pattern for fabric threads
        const diagonalNoise = Math.sin((x + y) * (weaveFrequency / 2)) * (weaveDepth / 2);

        // Combine for fabric weave pattern
        const noise = (weaveX + weaveY + diagonalNoise) * noiseScale;

        // Create more variation in the normal map
        data[stride] = Math.min(255, Math.max(0, 128 + noise + (Math.random() * 4 - 2)));
        data[stride + 1] = Math.min(255, Math.max(0, 128 + noise + (Math.random() * 4 - 2)));
        data[stride + 2] = 255;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8); // More repeats for finer detail
    texture.needsUpdate = true;

    return texture;
}

// Create a roughness map adjusted for specific fabric types based on color
function createColorAdjustedRoughnessMap(width, height, color) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Base roughness differs per fabric type/color
    let baseRoughness = 170;
    let patternIntensity = 0.2;
    let weaveFrequency = 0.4;

    // Adjust based on color
    switch (color.toUpperCase()) {
        case '#FFFFFF': // White - smoother cotton
            baseRoughness = 160;
            patternIntensity = 0.18;
            break;
        case '#000000': // Black - slightly rougher
            baseRoughness = 180;
            patternIntensity = 0.22;
            break;
        case '#606060': // Gray/Charcoal - medium texture
            baseRoughness = 175;
            patternIntensity = 0.2;
            break;
        case '#000080': // Navy Blue - smoother finish
            baseRoughness = 165;
            patternIntensity = 0.19;
            break;
        case '#F5F5DC': // Beige/Khaki - rougher natural fiber
            baseRoughness = 185;
            patternIntensity = 0.25;
            break;
        case '#556B2F': // Olive Green - canvas-like
            baseRoughness = 190;
            patternIntensity = 0.28;
            break;
        case '#8B4513': // Brown - rough texture
            baseRoughness = 195;
            patternIntensity = 0.3;
            break;
        case '#800020': // Burgundy - medium-smooth
            baseRoughness = 175;
            patternIntensity = 0.2;
            break;
    }

    // Create fabric-like roughness
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Fine weave pattern
        const weaveX = Math.sin(x * weaveFrequency) * 15 + Math.cos(x * (weaveFrequency / 2)) * 8;
        const weaveY = Math.sin(y * weaveFrequency) * 15 + Math.cos(y * (weaveFrequency / 2)) * 8;

        // Diagonal pattern
        const diagonal = Math.sin((x + y) * (weaveFrequency / 2)) * 10;

        // Combined pattern with intensity factor
        const noise = (weaveX + weaveY + diagonal) * patternIntensity;

        // Random fabric fuzz
        const fuzz = Math.random() * 10;

        // Final roughness value
        const value = Math.min(255, Math.max(0, baseRoughness + noise + fuzz));

        // Grayscale
        data[stride] = value;
        data[stride + 1] = value;
        data[stride + 2] = value;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.needsUpdate = true;

    return texture;
}

// Apply texture to a geometry with proper UV mapping
function createDecal(imageUrl, type, callback) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (loadedTexture) => {
        // Proper texture settings
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.wrapS = THREE.RepeatWrapping;
        loadedTexture.wrapT = THREE.RepeatWrapping;
        loadedTexture.anisotropy = 16; // Better texture quality

        // Same flip setting for both models for consistency
        loadedTexture.flipY = type === 'logo'; // Only flip logos

        callback(loadedTexture);
    });
}

// Update shirt texture with proper UV mapping
export function updateShirtTexture(imageUrl, type) {
    if (!shirtMesh) return;

    createDecal(imageUrl, type, (texture) => {
        // Get model settings based on current type
        const settings = modelSettings[currentModelType] || modelSettings.tshirt;

        if (type === 'logo') {
            // Remove existing logo if any
            if (logoDecal) {
                shirtMesh.remove(logoDecal);
                if (logoDecal.material.map) {
                    logoDecal.material.map.dispose();
                }
                logoDecal.material.dispose();
                logoDecal.geometry.dispose();
            }

            // Get logo position settings based on state.logoPosition
            const logoPos = state.logoPosition || 'center';
            const positionSettings = settings.logoPositions?.[logoPos] || {
                position: settings.logoPosition,
                rotation: settings.logoRotation,
                scale: settings.logoScale
            };

            // Create new logo material
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: true,
                depthTest: true,
                side: THREE.DoubleSide,
                alphaTest: 0.01
            });

            // Create plane geometry for the logo
            const geometry = new THREE.PlaneGeometry(1, 1);
            logoDecal = new THREE.Mesh(geometry, material);

            // Position based on the selected logo position
            logoDecal.position.copy(positionSettings.position);
            logoDecal.rotation.copy(positionSettings.rotation);
            logoDecal.scale.copy(positionSettings.scale);
            logoDecal.name = 'logo-decal';

            if (isLogoTexture) {
                shirtMesh.add(logoDecal);
            }
        } else if (type === 'full') {
            // For full texture, we need to create a material that wraps the entire shirt
            if (fullDecal) {
                shirtMesh.remove(fullDecal);
                if (fullDecal.material.map) {
                    fullDecal.material.map.dispose();
                }
                fullDecal.material.dispose();
                fullDecal.geometry.dispose();
            }

            // Create material with the texture
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.8,
                metalness: 0.0,
                side: THREE.DoubleSide,
                envMapIntensity: 0.5
            });

            // Clone the shirt geometry for our full texture overlay
            const geometry = shirtMesh.geometry.clone();
            fullDecal = new THREE.Mesh(geometry, material);

            // Make it fit perfectly on the shirt
            fullDecal.scale.set(1.01, 1.01, 1.01); // Slightly larger to prevent z-fighting
            fullDecal.visible = isFullTexture;
            fullDecal.name = 'full-decal';

            if (isFullTexture) {
                shirtMesh.add(fullDecal);
            }
        }
    });
}

// Toggle texture visibility
export function toggleTexture(type, active) {
    if (!shirtMesh) return;

    if (type === 'logo') {
        isLogoTexture = active;
        if (logoDecal) {
            logoDecal.visible = active;
        } else if (active) {
            // If logo is enabled but doesn't exist yet, create it with default texture
            updateShirtTexture('assets/threejs.png', 'logo');
        }
    } else if (type === 'full') {
        isFullTexture = active;
        if (fullDecal) {
            fullDecal.visible = active;
        } else if (active) {
            // If full texture is enabled but doesn't exist yet, create it with default texture
            updateShirtTexture('assets/threejs.png', 'full');
        }
    }
}

// Change the current 3D model
export function changeModel(modelType) {
    const modelPath = state.modelPaths[modelType];
    if (!modelPath) {
        console.error('Model path not found for type:', modelType);
        return Promise.reject(new Error('Model path not found'));
    }

    // Show loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.querySelector('p').textContent = 'Loading model...';
    }

    // Already on this model, no need to change
    if (modelType === currentModelType) {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        return Promise.resolve();
    }

    // Save the current model state
    const savedColor = shirtMaterial ? shirtMaterial.color.clone() : null;
    const savedLogoDecal = logoDecal && logoDecal.material && logoDecal.material.map ?
        logoDecal.material.map.clone() : null;
    const savedFullDecal = fullDecal && fullDecal.material && fullDecal.material.map ?
        fullDecal.material.map.clone() : null;
    const isLogoVisible = logoDecal && logoDecal.parent === shirtMesh;
    const isFullVisible = fullDecal && fullDecal.parent === shirtMesh;

    // Update current model type before loading
    currentModelType = modelType;

    return loadModel(modelPath)
        .then(() => {
            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }

            // Restore color
            if (savedColor && shirtMaterial) {
                shirtMaterial.color.copy(savedColor);
            }

            // Get current logo position from state
            const logoPosition = state.logoPosition || 'center';

            // Restore textures with correct positions
            if (savedLogoDecal && isLogoVisible) {
                createDecalFromTexture(savedLogoDecal, 'logo');
            }

            if (savedFullDecal && isFullVisible) {
                createDecalFromTexture(savedFullDecal, 'full');
            }
        })
        .catch(error => {
            console.error('Error changing model:', error);
            if (loadingOverlay) {
                // Show helpful error message with instructions
                loadingOverlay.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Missing 3D model: ${modelPath}</p>
                        <div class="error-instructions">
                            <p>To add a hoodie model:</p>
                            <ol>
                                <li>Download a free hoodie 3D model in GLB format from 
                                    <a href="https://sketchfab.com/3d-models/hoodie-low-poly-a56b93562d3a42c5989eaa40098c802b" target="_blank">Sketchfab</a>
                                    or <a href="https://free3d.com/3d-models/hoodie" target="_blank">Free3D</a></li>
                                <li>Name it "hoodie_baked.glb"</li>
                                <li>Place it in the root directory of your project</li>
                                <li>Refresh the page</li>
                            </ol>
                            <button id="model-error-close" class="button secondary">
                                <i class="fas fa-arrow-left"></i> Go Back
                            </button>
                        </div>
                    </div>
                `;

                // Add listener for close button
                const closeButton = document.getElementById('model-error-close');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        // Revert to t-shirt model
                        updateState({ currentModel: 'tshirt' });
                        document.querySelector('input[name="model-type"][value="tshirt"]').checked = true;

                        // Hide error and show loading again
                        if (loadingOverlay) {
                            loadingOverlay.innerHTML = `
                                <div class="spinner"></div>
                                <p>Loading original model...</p>
                            `;
                        }

                        // Load t-shirt model
                        return loadModel(state.modelPaths.tshirt)
                            .then(() => {
                                // Hide loading overlay
                                if (loadingOverlay) {
                                    loadingOverlay.classList.add('hidden');
                                }
                            })
                            .catch(err => {
                                console.error('Error loading fallback model:', err);
                                if (loadingOverlay) {
                                    loadingOverlay.innerHTML = `
                                        <div class="error">
                                            <i class="fas fa-exclamation-triangle"></i>
                                            <p>Unable to load any models. Please refresh the page.</p>
                                        </div>
                                    `;
                                }
                            });
                    });
                }
            }
            throw error;
        });
}

// Download canvas as image
export function downloadCanvas() {
    const link = document.createElement('a');
    link.download = state.currentModel === 'hoodie' ? 'hoodie-design.png' : 'shirt-design.png';
    link.href = renderer.domElement.toDataURL();
    link.click();
}

// ============================================================================
// Camera and Controls Management
// ============================================================================

// Apply camera settings for a specific view
export function changeCameraView(view) {
    // Get model-specific camera settings
    const settings = modelSettings[currentModelType] || modelSettings.tshirt;

    if (settings && settings.cameraPositions && settings.cameraPositions[view]) {
        const cameraSettings = settings.cameraPositions[view];

        // Store current camera position for animation
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();

        // Setup target positions for the animation
        targetCameraPosition.copy(cameraSettings.position);
        const targetControlsTarget = cameraSettings.target || new THREE.Vector3(0, 0, 0);

        // Calculate a smooth path based on the current and target view
        // We'll use this to create a nice arc during transition
        const animationDuration = 1.0; // seconds
        const startTime = Date.now();

        // Set transition state
        isViewTransitioning = true;
        viewTransitionEndTime = startTime + (animationDuration * 1000);

        // Store previous auto-rotate state and disable during transition
        const wasAutoRotating = isAutoRotating;
        if (isAutoRotating) {
            isAutoRotating = false;
        }

        // Create animation function
        function animateViewTransition() {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / animationDuration, 1.0);

            // Easing function for smooth acceleration/deceleration
            const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            const easedProgress = easeInOutCubic(progress);

            // Animate position with a slight arc for more visual interest
            const arcHeight = startPosition.distanceTo(targetCameraPosition) * 0.2;
            const arcOffset = new THREE.Vector3(0, arcHeight, 0).multiplyScalar(
                Math.sin(easedProgress * Math.PI) // Peak at middle of animation
            );

            // Apply the interpolated position with arc
            camera.position.lerpVectors(startPosition, targetCameraPosition, easedProgress)
                .add(arcOffset);

            // Smooth interpolation of the camera target
            controls.target.lerpVectors(startTarget, targetControlsTarget, easedProgress);

            // Update camera FOV if needed
            if (cameraSettings.fov && camera.fov !== cameraSettings.fov) {
                camera.fov = THREE.MathUtils.lerp(
                    camera.fov,
                    cameraSettings.fov,
                    easedProgress
                );
                camera.updateProjectionMatrix();
            }

            // Update controls
            controls.update();

            // Force a render
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }

            // Continue animation until complete
            if (progress < 1.0) {
                requestAnimationFrame(animateViewTransition);
            } else {
                // Animation complete
                // Clear transition state
                isViewTransitioning = false;

                // Update last rotation view to match the new view
                lastRotationView = view;

                // Restore auto-rotation if it was enabled
                if (wasAutoRotating) {
                    isAutoRotating = true;

                    // Apply correct rotation for the new view
                    adjustRotationForView(view);
                }

                // Log completion
                console.log(`Camera view transition to ${view} complete`);
            }
        }

        // Start the animation
        animateViewTransition();

        // Log for debugging
        console.log(`Starting camera view transition to ${view}:`, cameraSettings);
    } else {
        console.warn(`Camera view ${view} not found for model ${currentModelType}`);
    }
}

// Setup camera controls
function setupCameraControls() {
    // Ensure controls exist before setting up handlers
    ensureCameraControlsExist();

    // Add visual feedback and click handlers for UI buttons
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const resetCamera = document.getElementById('reset-camera');
    const rotateView = document.getElementById('rotate-view');

    // Add visual feedback to control buttons
    [zoomIn, zoomOut, resetCamera, rotateView].forEach(button => {
        if (button) {
            button.addEventListener('mousedown', () => {
                button.classList.add('active');
            });

            button.addEventListener('mouseup', () => {
                button.classList.remove('active');
            });

            button.addEventListener('mouseleave', () => {
                button.classList.remove('active');
            });
        }
    });

    if (zoomIn) {
        zoomIn.addEventListener('click', () => {
            console.log('Zoom in button clicked');
            // Use direct camera zoom instead of controls.dollyIn
            zoomCamera('in');
            // Also dispatch the event for other handlers
            window.dispatchEvent(new CustomEvent('camera-zoom', { detail: { direction: 'in' } }));
        });
    }

    if (zoomOut) {
        zoomOut.addEventListener('click', () => {
            console.log('Zoom out button clicked');
            // Use direct camera zoom instead of controls.dollyOut
            zoomCamera('out');
            // Also dispatch the event for other handlers
            window.dispatchEvent(new CustomEvent('camera-zoom', { detail: { direction: 'out' } }));
        });
    }

    if (resetCamera) {
        resetCamera.addEventListener('click', () => {
            console.log('Reset camera button clicked');
            resetCameraPosition();
            // Also dispatch the event for other handlers
            window.dispatchEvent(new CustomEvent('camera-reset'));
        });
    }

    // Add auto-rotate toggle functionality
    if (rotateView) {
        // Removed redundant event listener since the button already has an onclick attribute in HTML
        // that calls window.directToggleRotation()

        // Set initial state based on manualRotationActive
        rotateView.classList.toggle('active', manualRotationActive);
    }

    // Camera view buttons
    const viewButtons = document.querySelectorAll('.camera-view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active status
            viewButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Get the view and dispatch event
            const view = button.dataset.view;
            if (view) {
                window.dispatchEvent(new CustomEvent('camera-view-change', { detail: { view } }));
            }
        });
    });
}

// Helper to create camera controls if they don't exist
function ensureCameraControlsExist() {
    // Ensure camera controls container exists
    let container = document.querySelector('.camera-controls');
    if (!container) {
        console.log('Creating missing camera controls container');
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            container = document.createElement('div');
            container.className = 'camera-controls';
            canvasContainer.appendChild(container);
        } else {
            console.error('Canvas container not found, cannot create camera controls');
            return;
        }
    }

    // Check if zoom-in button exists, create it if not
    if (!document.getElementById('zoom-in')) {
        console.log('Creating missing zoom-in button');
        const zoomInBtn = document.createElement('button');
        zoomInBtn.id = 'zoom-in';
        zoomInBtn.className = 'control-btn';
        zoomInBtn.setAttribute('aria-label', 'Zoom In');
        zoomInBtn.setAttribute('title', 'Zoom In');

        const icon = document.createElement('i');
        icon.className = 'fas fa-plus';
        zoomInBtn.appendChild(icon);

        container.appendChild(zoomInBtn);
    }

    // Check if zoom-out button exists, create it if not
    if (!document.getElementById('zoom-out')) {
        console.log('Creating missing zoom-out button');
        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.id = 'zoom-out';
        zoomOutBtn.className = 'control-btn';
        zoomOutBtn.setAttribute('aria-label', 'Zoom Out');
        zoomOutBtn.setAttribute('title', 'Zoom Out');

        const icon = document.createElement('i');
        icon.className = 'fas fa-minus';
        zoomOutBtn.appendChild(icon);

        container.appendChild(zoomOutBtn);
    }

    // Check if reset-camera button exists, create it if not
    if (!document.getElementById('reset-camera')) {
        console.log('Creating missing reset-camera button');
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-camera';
        resetBtn.className = 'control-btn';
        resetBtn.setAttribute('aria-label', 'Reset Camera');
        resetBtn.setAttribute('title', 'Reset Camera');

        const icon = document.createElement('i');
        icon.className = 'fas fa-sync-alt';
        resetBtn.appendChild(icon);

        container.appendChild(resetBtn);
    }

    // Check if rotate-view button exists, create it if not
    if (!document.getElementById('rotate-view')) {
        console.log('Creating missing rotate-view button');
        const rotateBtn = document.createElement('button');
        rotateBtn.id = 'rotate-view';
        rotateBtn.className = 'control-btn';
        rotateBtn.setAttribute('aria-label', 'Auto Rotate');
        rotateBtn.setAttribute('title', 'Auto Rotate');

        const icon = document.createElement('i');
        icon.className = 'fas fa-redo';
        rotateBtn.appendChild(icon);

        container.appendChild(rotateBtn);
    }

    // Ensure camera view controls container exists
    let viewContainer = document.querySelector('.camera-view-controls');
    if (!viewContainer) {
        console.log('Creating missing camera view controls container');
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            viewContainer = document.createElement('div');
            viewContainer.className = 'camera-view-controls';
            canvasContainer.appendChild(viewContainer);
        } else {
            return;
        }
    }

    // Check for view buttons and create if missing
    const views = ['front', 'back', 'left', 'right'];
    views.forEach(view => {
        const id = `${view}-view`;
        if (!document.getElementById(id)) {
            console.log(`Creating missing ${view} view button`);
            const viewBtn = document.createElement('button');
            viewBtn.id = id;
            viewBtn.className = view === 'front' ? 'camera-view-btn active' : 'camera-view-btn';
            viewBtn.setAttribute('data-view', view);
            viewBtn.setAttribute('aria-label', `${view.charAt(0).toUpperCase() + view.slice(1)} View`);

            const icon = document.createElement('i');
            icon.className = 'fas fa-eye';
            viewBtn.appendChild(icon);

            const span = document.createElement('span');
            span.textContent = view.charAt(0).toUpperCase() + view.slice(1);
            viewBtn.appendChild(span);

            viewContainer.appendChild(viewBtn);
        }
    });
}

// ============================================================================
// Animation and Rendering
// ============================================================================

// Variables for FPS control
let lastFrameTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

// Animation loop
function animate(currentTime) {
    requestAnimationFrame(animate);
    
    // Limit frame rate for better performance
    const elapsed = currentTime - lastFrameTime;
    if (elapsed < frameInterval) return;
    
    // Calculate actual FPS
    const actualFPS = 1000 / elapsed;
    lastFrameTime = currentTime - (elapsed % frameInterval);
    
    // Start performance measurement
    Performance.start('render-frame');

    // Smooth camera position movements
    if (camera.position.distanceTo(targetCameraPosition) > 0.01) {
        camera.position.lerp(targetCameraPosition, 0.1);
    }

    // Check for rotation
    if (window.GLOBAL_ROTATION_ENABLED === true && group) {
        group.rotateOnAxis(rotationAxis, rotationSpeed);
    }

    // Update controls for damping even when not auto-rotating
    if (controls && controls.enableDamping) {
        controls.update();
    }

    // Render the scene
    if (scene && camera) {
        renderer.render(scene, camera);
    }
    
    // End performance measurement
    Performance.end('render-frame');
}

// Helper to determine if we're currently in a view transition
function isInViewTransition() {
    // Check if current time is before the transition end time
    return isViewTransitioning || (Date.now() < viewTransitionEndTime);
}

// Handle window resize
function onWindowResize() {
    if (!camera || !renderer) return;

    // Update camera aspect ratio
    const container = document.querySelector('.canvas-container');
    if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        // Update renderer size
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    }
}

// Handle pointer movement
function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Update scene background color based on theme
export function updateThemeBackground(isDarkMode) {
    if (!scene) return;

    // Update background based on theme
    if (isDarkMode) {
        scene.background = new THREE.Color(0x111827); // Dark background

        // Also update any environment lighting if needed
        if (renderer) {
            renderer.setClearColor(0x111827);
        }
    } else {
        scene.background = new THREE.Color(0xf8f9fa); // Light background

        // Update renderer clear color as well
        if (renderer) {
            renderer.setClearColor(0xf8f9fa);
        }
    }

    // Force a render update to show the change immediately
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Add the toggleAutoRotate function to toggle auto-rotation
export function toggleAutoRotate(active) {
    console.log('toggleAutoRotate called with active =', active);

    // Use our new global rotation control
    if (active !== undefined) {
        // Set to the specified state
        rotationEnabled = active;
    } else {
        // Toggle the current state
        rotationEnabled = !rotationEnabled;
    }

    // Synchronize other rotation state variables
    manualRotationActive = rotationEnabled;
    isAutoRotating = rotationEnabled;

    console.log('Rotation is now:', rotationEnabled ? 'ENABLED' : 'DISABLED');

    // If turning on rotation, set the appropriate rotation axis
    if (rotationEnabled) {
        updateRotationAxisForCurrentView();
    }

    // Update button visual state
    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        if (rotationEnabled) {
            rotateButton.classList.add('active');
            rotateButton.title = 'Stop Rotation';
            // Change icon to stop when rotating
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-redo');
                icon.classList.add('fa-stop');
            }
        } else {
            rotateButton.classList.remove('active');
            rotateButton.title = 'Start Rotation';
            // Change icon back to rotate when stopped
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-stop');
                icon.classList.add('fa-redo');
            }
        }
    }

    // Disable OrbitControls auto-rotation to avoid conflicts
    if (controls) {
        controls.autoRotate = false;
    }

    // Also update the old state variable for compatibility
    isAutoRotating = rotationEnabled;

    // Force a render for immediate visual feedback
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    return rotationEnabled;
}

// Helper function to determine current view based on camera position
function determineCurrentView() {
    if (!camera) return 'front';

    const settings = modelSettings[currentModelType] || modelSettings.tshirt;
    if (!settings || !settings.cameraPositions) return 'front';

    // Get normalized direction from target to camera
    const direction = new THREE.Vector3().subVectors(
        camera.position,
        controls.target
    ).normalize();

    // Check which view direction matches closest
    const dotProducts = {
        front: direction.dot(new THREE.Vector3(0, 0, 1)),
        back: direction.dot(new THREE.Vector3(0, 0, -1)),
        left: direction.dot(new THREE.Vector3(-1, 0, 0)),
        right: direction.dot(new THREE.Vector3(1, 0, 0))
    };

    // Find view with highest dot product (closest match)
    const currentView = Object.entries(dotProducts).reduce(
        (max, [view, dot]) => (dot > max.dot ? { view, dot } : max),
        { view: 'front', dot: -Infinity }
    ).view;

    return currentView;
}

// Adjust rotation parameters based on current view
function adjustRotationForView(view) {
    if (!controls) return;

    // Set up rotation axis and behavior based on view
    switch (view) {
        case 'front':
        case 'back':
            // For front/back views, rotate around Y axis (up/down)
            controls.autoRotateSpeed = view === 'front' ? 2.5 : -2.5;
            break;

        case 'left':
        case 'right':
            // For side views, adjust rotation to showcase front and back
            controls.autoRotateSpeed = view === 'left' ? -2.5 : 2.5;
            break;

        default:
            // Default rotation
            controls.autoRotateSpeed = 2.5;
    }
}

// Add function to update logo position correctly
function updateLogoPosition(position) {
    if (!logoDecal || !group) return;

    const settings = modelSettings[currentModelType] || modelSettings.tshirt;
    if (!settings || !settings.logoPositions) return;

    const positionData = settings.logoPositions[position];
    if (!positionData) return;

    console.log(`Updating logo position to: ${position}`);

    // Update logo position, rotation, and scale
    logoDecal.position.copy(positionData.position);
    logoDecal.rotation.copy(positionData.rotation);
    logoDecal.scale.copy(positionData.scale);

    // Force a render to show the change immediately
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Add reset camera position function
function resetCameraPosition() {
    console.log('Resetting camera position');

    // Reset cumulative zoom factor
    cumulativeZoomFactor = 1.0;

    if (!camera || !controls) return;

    const settings = modelSettings[currentModelType] || modelSettings.tshirt;
    if (!settings || !settings.cameraPositions) return;

    // Always reset to front view
    const cameraPosition = settings.cameraPositions['front'];

    if (cameraPosition) {
        // Cancel any ongoing view transitions
        isViewTransitioning = false;

        // Set target position for smooth animation
        targetCameraPosition.copy(cameraPosition.position);

        // Reset controls target immediately for responsiveness
        controls.target.copy(cameraPosition.target || new THREE.Vector3(0, 0, 0));

        // Update camera FOV immediately
        if (cameraPosition.fov && camera.fov !== cameraPosition.fov) {
            camera.fov = cameraPosition.fov;
            camera.updateProjectionMatrix();
        }

        // Reset camera position with a fast transition
        // We'll use a shorter, more direct animation for reset
        const startPosition = camera.position.clone();
        const startTime = Date.now();
        const resetDuration = 0.4; // Faster than view transitions

        function animateReset() {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / resetDuration, 1.0);

            // Quadratic ease-out for quick start, smooth finish
            const easedProgress = 1 - (1 - progress) * (1 - progress);

            // Direct lerp without arc for faster movement
            camera.position.lerpVectors(startPosition, cameraPosition.position, easedProgress);

            // Update controls
            controls.update();

            // Force a render
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }

            // Continue animation until complete
            if (progress < 1.0) {
                requestAnimationFrame(animateReset);
            } else {
                console.log('Camera reset complete');

                // Update the last rotation view
                lastRotationView = 'front';

                // If auto-rotating, apply front view rotation settings
                if (isAutoRotating) {
                    adjustRotationForView('front');
                }
            }
        }

        // Start the reset animation
        animateReset();

        // Update the active camera view button in the UI
        document.querySelectorAll('.camera-view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === 'front') {
                btn.classList.add('active');
            }
        });

        // Update state to reflect front view
        updateState({ cameraView: 'front' });
    }
}

// Add this function to create procedural textures after animate() function
function createProceduralFabricTextures(material) {
    // Create normal map
    const normalMap = createNormalMap(512, 512);
    material.normalMap = normalMap;

    // Create roughness map
    const roughnessMap = createRoughnessMap(512, 512);
    material.roughnessMap = roughnessMap;

    material.needsUpdate = true;
}

// New enhanced fabric textures function
function createAdvancedFabricTextures(material) {
    // Higher resolution for more detail
    const resolution = 1024;

    // Create detailed normal map for fabric weave
    const normalMap = createAdvancedNormalMap(resolution, resolution);
    material.normalMap = normalMap;
    material.normalScale = new THREE.Vector2(0.7, 0.7);

    // Create detailed roughness map for fabric
    const roughnessMap = createAdvancedRoughnessMap(resolution, resolution);
    material.roughnessMap = roughnessMap;

    // Create ambient occlusion map
    const aoMap = createAmbientOcclusionMap(resolution, resolution);
    material.aoMap = aoMap;
    material.aoMapIntensity = 0.8;

    // Create displacement map for subtle fabric detail
    const displacementMap = createDisplacementMap(resolution, resolution);
    material.displacementMap = displacementMap;
    material.displacementScale = 0.02;

    material.needsUpdate = true;
}

// Create a more detailed normal map for fabric
function createAdvancedNormalMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with a detailed fabric-like normal pattern
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Multi-frequency noise for more realistic fabric weave
        const weaveX = Math.sin(x * 0.2) * 8 + Math.sin(x * 0.1) * 4 + Math.sin(x * 0.05) * 2;
        const weaveY = Math.sin(y * 0.2) * 8 + Math.sin(y * 0.1) * 4 + Math.sin(y * 0.05) * 2;

        // Add a subtle diagonal pattern for fabric threads
        const diagonalNoise = Math.sin((x + y) * 0.1) * 4 + Math.sin((x - y) * 0.1) * 4;

        // Combine for more complex fabric weave pattern
        const noise = (weaveX + weaveY + diagonalNoise) * 0.3;

        // Create more variation in the normal map
        data[stride] = Math.min(255, Math.max(0, 128 + noise + (Math.random() * 5 - 2.5)));
        data[stride + 1] = Math.min(255, Math.max(0, 128 + noise + (Math.random() * 5 - 2.5)));
        data[stride + 2] = 255;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8); // More repeats for finer detail
    texture.needsUpdate = true;

    return texture;
}

// Create an enhanced roughness map for fabric
function createAdvancedRoughnessMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Create a more detailed fabric-like roughness
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Multi-scale noise for fabric fibers
        const baseRoughness = 170; // Base fabric roughness

        // Create a fine weave pattern
        const weaveX = Math.sin(x * 0.4) * 15 + Math.cos(x * 0.2) * 8;
        const weaveY = Math.sin(y * 0.4) * 15 + Math.cos(y * 0.2) * 8;

        // Add diagonal patterns
        const diagonal = Math.sin((x + y) * 0.2) * 10 + Math.sin((x - y) * 0.2) * 10;

        // Combine different patterns for more realism
        const noise = (weaveX + weaveY + diagonal) * 0.2;

        // Add some randomness for fabric fuzz
        const fuzz = Math.random() * 10;

        // Calculate final roughness value
        const value = Math.min(255, Math.max(0, baseRoughness + noise + fuzz));

        // Use same value for R, G, B (grayscale)
        data[stride] = value;
        data[stride + 1] = value;
        data[stride + 2] = value;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.needsUpdate = true;

    return texture;
}

// Create an ambient occlusion map for fabric folds and details
function createAmbientOcclusionMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with fabric-like AO pattern with subtle folds
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Base brightness (higher values = less occlusion)
        const baseValue = 220;

        // Create subtle folds
        const fold1 = Math.sin(y * 0.01) * 25;
        const fold2 = Math.sin(x * 0.01 + y * 0.01) * 15;

        // Subtle random variation
        const variation = Math.random() * 5;

        // Calculate final AO value - lower values = more occlusion
        const value = Math.min(255, Math.max(0, baseValue + fold1 + fold2 + variation));

        data[stride] = value;
        data[stride + 1] = value;
        data[stride + 2] = value;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2); // Larger scale for folds
    texture.needsUpdate = true;

    return texture;
}

// Create a displacement map for subtle fabric detail
function createDisplacementMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with subtle displacement pattern for fabric texture
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Base displacement value (middle gray = no displacement)
        const baseValue = 128;

        // Create fabric weave pattern with very subtle displacement
        const weaveX = Math.sin(x * 0.3) * 2 + Math.sin(x * 0.6) * 1;
        const weaveY = Math.sin(y * 0.3) * 2 + Math.sin(y * 0.6) * 1;

        // Add very subtle random noise
        const noise = (Math.random() - 0.5) * 2;

        // Calculate final displacement value
        const value = Math.min(255, Math.max(0, baseValue + weaveX + weaveY + noise));

        // Use same value for R, G, B
        data[stride] = value;
        data[stride + 1] = value;
        data[stride + 2] = value;
        data[stride + 3] = 255;
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.needsUpdate = true;

    return texture;
}

// Create a procedural normal map using noise
function createNormalMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with a fabric-like normal pattern
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        // Basic noise function to mimic fabric weave
        const x = i % width;
        const y = Math.floor(i / width);

        // Create fabric weave pattern
        const noiseX = Math.sin(x * 0.1) * 10 + Math.sin(x * 0.05) * 5;
        const noiseY = Math.sin(y * 0.1) * 10 + Math.sin(y * 0.05) * 5;

        // Combine noises to create a fabric texture
        const noise = (noiseX + noiseY) * 0.5;

        // RGB corresponds to XYZ normal directions
        data[stride] = 128 + noise; // R: X normal (128 is neutral)
        data[stride + 1] = 128 + noise; // G: Y normal
        data[stride + 2] = 255; // B: Z normal (mostly facing outward)
        data[stride + 3] = 255; // Alpha: fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5); // Repeat texture
    texture.needsUpdate = true;

    return texture;
}

// Create a procedural roughness map
function createRoughnessMap(width, height) {
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with a fabric-like roughness pattern
    for (let i = 0; i < size; i++) {
        const stride = i * 4;

        const x = i % width;
        const y = Math.floor(i / width);

        // Create variation in roughness for more realistic fabric
        const noiseX = Math.sin(x * 0.2) * 20 + Math.cos(x * 0.1) * 10;
        const noiseY = Math.sin(y * 0.2) * 20 + Math.cos(y * 0.1) * 10;

        // Combine for a fabric-like pattern
        const noise = (noiseX + noiseY) * 0.25;

        // Grayscale value determines roughness
        const value = Math.min(255, Math.max(0, 180 + noise));

        // Use same value for R, G, B (grayscale)
        data[stride] = value;
        data[stride + 1] = value;
        data[stride + 2] = value;
        data[stride + 3] = 255; // Alpha: fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5); // Repeat texture
    texture.needsUpdate = true;

    return texture;
}

// Try to upgrade to physical material for better realism
function tryUpgradeToPhysicalMaterial(standardMaterial, color, materialSettings) {
    // Only try if MeshPhysicalMaterial is available
    if (THREE.MeshPhysicalMaterial) {
        try {
            const physicalMaterial = new THREE.MeshPhysicalMaterial({
                color: color,
                roughness: materialSettings?.roughness || 0.65,
                metalness: materialSettings?.metalness || 0.02,
                clearcoat: materialSettings?.clearcoat || 0.08,
                clearcoatRoughness: materialSettings?.clearcoatRoughness || 0.4,
                side: THREE.DoubleSide,
                transmission: materialSettings?.transmission || 0.01,
                thickness: materialSettings?.thickness || 0.3,
                envMapIntensity: materialSettings?.envMapIntensity || 0.6,
                sheen: 0.05,  // Subtle sheen for fabric
                sheenRoughness: 0.8,
                sheenColor: new THREE.Color(color).multiplyScalar(1.2), // Slightly brighter sheen
                anisotropy: materialSettings?.anisotropy || 0.3,
                anisotropyRotation: Math.PI / 4 // 45 degrees
            });

            // Copy all maps from the standard material
            if (standardMaterial.normalMap) {
                physicalMaterial.normalMap = standardMaterial.normalMap;
                physicalMaterial.normalScale = new THREE.Vector2(
                    materialSettings?.normalScale || 0.7,
                    materialSettings?.normalScale || 0.7
                );
            }
            if (standardMaterial.roughnessMap) {
                physicalMaterial.roughnessMap = standardMaterial.roughnessMap;
            }
            if (standardMaterial.aoMap) {
                physicalMaterial.aoMap = standardMaterial.aoMap;
                physicalMaterial.aoMapIntensity = materialSettings?.aoMapIntensity || 0.8;
            }
            if (standardMaterial.displacementMap) {
                physicalMaterial.displacementMap = standardMaterial.displacementMap;
                physicalMaterial.displacementScale = materialSettings?.displacementScale || 0.02;
            }

            // Replace the material
            shirtMaterial = physicalMaterial;
            shirtMesh.material = shirtMaterial;
            console.log("Upgraded to enhanced physical material for better fabric realism");
        } catch (e) {
            console.log("Advanced material not supported, using standard material instead", e);
        }
    }
}

// Add this new function for direct camera zooming
function zoomCamera(direction) {
    if (!camera) {
        console.warn('Camera not available for zoom operation');
        return;
    }

    console.log('Direct camera zoom:', direction);

    // Update the cumulative zoom factor (smaller steps for more precision)
    if (direction === 'in') {
        cumulativeZoomFactor *= 0.9; // Zoom in (factor gets smaller)
    } else {
        cumulativeZoomFactor *= 1.1; // Zoom out (factor gets larger)
    }

    // Clamp the zoom factor to reasonable limits
    cumulativeZoomFactor = Math.max(0.3, Math.min(cumulativeZoomFactor, 2.0));

    console.log('Cumulative zoom factor:', cumulativeZoomFactor);

    // Get the current view settings for the model type
    const modelSettings = getModelSettingsForCurrentView();
    if (!modelSettings) return;

    // Get the base camera position for this view
    const view = state.cameraView || 'front';
    const viewSettings = modelSettings.cameraPositions[view];

    if (viewSettings) {
        // Calculate new camera position based on the base position and the zoom factor
        const basePosition = viewSettings.position.clone();
        const zoomDirection = basePosition.clone().normalize();

        // Apply the cumulative zoom factor to the base position
        const zoomedPosition = zoomDirection.multiplyScalar(basePosition.length() * cumulativeZoomFactor);

        // Update target camera position (this will be applied smoothly in the animation loop)
        targetCameraPosition.copy(zoomedPosition);

        // Force immediate update for responsive feedback
        camera.position.copy(zoomedPosition);
        camera.updateProjectionMatrix();

        // Update controls if available
        if (controls) {
            controls.update();
        }

        // Force a render
        if (renderer && scene) {
            renderer.render(scene, camera);
        }

        console.log('Camera zoomed to position:', zoomedPosition.toArray());
    }
}

// Helper function to get the current model settings
function getModelSettingsForCurrentView() {
    const modelType = currentModelType || 'tshirt';
    return modelSettings[modelType];
}

// Helper function to update rotation axis based on current camera view
function updateRotationAxisForCurrentView() {
    const currentView = state.cameraView || determineCurrentView();

    // Set rotation axis based on view
    switch (currentView) {
        case 'front':
        case 'back':
            // For front/back views, rotate around Y axis (up/down)
            rotationAxis.set(0, 1, 0);
            break;

        case 'left':
        case 'right':
            // For side views, rotate around Y axis still, but could use Z if preferred
            rotationAxis.set(0, 1, 0);
            break;

        default:
            // Default to Y axis rotation
            rotationAxis.set(0, 1, 0);
    }

    console.log('Rotation axis set for view:', currentView);
}

// Add a function to reset rotation when stopped
function resetRotation() {
    // Reset any ongoing rotation effects
    if (group) {
        console.log('Reset rotation called for group');

        // Ensure the manualRotationActive flag is set to false
        manualRotationActive = false;
        isAutoRotating = false;

        // Ensure OrbitControls auto-rotation is off
        if (controls) {
            controls.autoRotate = false;
            controls.update();
        }

        // Force an immediate render to ensure the model stops exactly where it is
        if (renderer && scene && camera) {
            console.log('Forcing render to stop rotation');
            renderer.render(scene, camera);
        }

        console.log('Rotation has been completely stopped');
    } else {
        console.warn('Cannot reset rotation: model group not found');
    }
}

// Add a dedicated function to stop rotation
function stopRotation() {
    console.log('stopRotation function called');

    // First set the flags
    manualRotationActive = false;
    isAutoRotating = false;

    // Update the button visual state
    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        rotateButton.classList.remove('active');
        rotateButton.title = 'Start Rotation';

        // Change icon back to rotate
        const icon = rotateButton.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-stop');
            icon.classList.add('fa-redo');
        }
    }

    // Disable OrbitControls auto-rotation
    if (controls) {
        controls.autoRotate = false;
        controls.update();
    }

    // Render one final frame
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    console.log('Rotation has been stopped');
    return false; // Return false to indicate rotation is now off
}

// Add a debug wrapper function for the rotate button
window.debugRotateToggle = function () {
    console.log('=====================================');
    console.log('DEBUG: Rotate button clicked directly');
    console.log('Before toggle - rotationEnabled:', rotationEnabled);
    console.log('Before toggle - manualRotationActive:', manualRotationActive);
    console.log('Before toggle - isAutoRotating:', isAutoRotating);

    // Set rotation state directly
    rotationEnabled = !rotationEnabled;

    // Force update of all related variables
    manualRotationActive = rotationEnabled;
    isAutoRotating = rotationEnabled;

    console.log('After toggle - rotationEnabled:', rotationEnabled);

    // Update button visual state
    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        if (rotationEnabled) {
            console.log('Setting button to ACTIVE state');
            rotateButton.classList.add('active');
            rotateButton.title = 'Stop Rotation';

            // Change icon to stop when rotating
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-redo');
                icon.classList.add('fa-stop');
            }

            // Set the appropriate rotation axis
            updateRotationAxisForCurrentView();
        } else {
            console.log('Setting button to INACTIVE state');
            rotateButton.classList.remove('active');
            rotateButton.title = 'Start Rotation';

            // Change icon back to rotate when stopped
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-stop');
                icon.classList.add('fa-redo');
            }
        }
    }

    // Ensure controls auto-rotation is off (we handle rotation ourselves)
    if (controls) {
        controls.autoRotate = false;
        controls.update();
        console.log('Controls updated');
    }

    // Prove rotation has been set correctly by checking what will happen in animation loop
    if (rotationEnabled && group) {
        console.log('Rotation WILL be applied in the next animation frame');
    } else {
        console.log('Rotation will NOT be applied in the next animation frame');
    }

    // Force a render to show immediate feedback
    if (renderer && scene && camera) {
        console.log('Forcing immediate render');
        renderer.render(scene, camera);
    }

    console.log('DEBUG: Rotation toggle complete');
    console.log('=====================================');
};

// Add a function to debug the rotation state from the console
window.debugRotationState = function () {
    console.log('===== ROTATION STATE DEBUG =====');
    console.log('rotationEnabled:', rotationEnabled);
    console.log('manualRotationActive:', manualRotationActive);
    console.log('isAutoRotating:', isAutoRotating);

    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        console.log('Button class list:', rotateButton.classList.toString());
        console.log('Button title:', rotateButton.title);

        const icon = rotateButton.querySelector('i');
        if (icon) {
            console.log('Icon class list:', icon.classList.toString());
        }
    }

    console.log('Will rotation happen in animation loop?', (rotationEnabled === true && group) ? 'YES' : 'NO');
    console.log('============================');

    // Return the state for further inspection
    return {
        rotationEnabled,
        manualRotationActive,
        isAutoRotating,
        buttonActive: rotateButton ? rotateButton.classList.contains('active') : 'button-not-found',
    };
};

// Create a COMPLETELY new function to toggle rotation
window.TOGGLE_ROTATION = function () {
    // Toggle the global rotation flag
    window.GLOBAL_ROTATION_ENABLED = !window.GLOBAL_ROTATION_ENABLED;

    console.log("GLOBAL ROTATION TOGGLED TO:", window.GLOBAL_ROTATION_ENABLED ? "ON" : "OFF");

    // Update the button appearance
    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        if (window.GLOBAL_ROTATION_ENABLED) {
            rotateButton.classList.add('active');
            rotateButton.title = 'Stop Rotation';

            // Change icon to stop
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-redo');
                icon.classList.add('fa-stop');
            }

            // Set rotation axis
            updateRotationAxisForCurrentView();
        } else {
            rotateButton.classList.remove('active');
            rotateButton.title = 'Start Rotation';

            // Change icon back to rotate
            const icon = rotateButton.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-stop');
                icon.classList.add('fa-redo');
            }
        }
    }

    // Also update the other flags for consistency
    rotationEnabled = window.GLOBAL_ROTATION_ENABLED;
    manualRotationActive = window.GLOBAL_ROTATION_ENABLED;
    isAutoRotating = window.GLOBAL_ROTATION_ENABLED;

    // Force a render for immediate feedback
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
};

// Add a direct event listener to the rotation button when DOM content is loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, attaching rotation button event listener');

    const rotateButton = document.getElementById('rotate-view');
    if (rotateButton) {
        console.log('Found rotation button, attaching click handler');

        // Remove any existing click handlers by cloning the button
        const newButton = rotateButton.cloneNode(true);
        rotateButton.parentNode.replaceChild(newButton, rotateButton);

        // Add our event listener to the new button
        newButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            console.log('DIRECT CLICK EVENT DETECTED');
            window.TOGGLE_ROTATION();

            return false;
        });

        console.log('Event listener attached successfully');
    } else {
        console.warn('Could not find rotation button');
    }
});

function toggleRotation() {
    rotationEnabled = !rotationEnabled;
    
    // Update the global window variable
    window.GLOBAL_ROTATION_ENABLED = rotationEnabled;
    
    // Update the button state
    const rotateButton = document.getElementById('rotate-view');
    const icon = rotateButton?.querySelector('i');
    
    if (rotateButton) {
        if (rotationEnabled) {
            rotateButton.classList.add('active');
            rotateButton.title = 'Stop Rotation';
            if (icon) icon.className = 'fas fa-pause';
        } else {
            rotateButton.classList.remove('active');
            rotateButton.title = 'Start Rotation';
            if (icon) icon.className = 'fas fa-sync-alt';
        }
    }

    // Force an immediate render to apply or stop rotation
    if (scene && camera) {
        renderer.render(scene, camera);
    }
}