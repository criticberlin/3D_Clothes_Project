import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state, updateState } from './state.js';
import { initTextureMapper, loadCustomImage, setModelType, clearCustomImage } from './texture-mapper.js';
import { Logger, Performance } from './utils.js';
import {
    calculateFabricMaterialProperties,
    generateAdvancedFabricNormalMap,
    enhanceFabricLightInteraction,
    calculateFabricColor
} from './advanced-calculations.js';

// ============================================================================
// Global Variables
// ============================================================================
let scene, camera, renderer, controls;
let shirtMesh, shirtMaterial;
let pointer = { x: 0, y: 0 };
let targetCameraPosition = new THREE.Vector3(0, 0, 2);
let group;
let fullDecal;
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

// Add storage for original view positions at the top of the file
const originalViewPositions = {
    front: null,
    back: null,
    left: null,
    right: null
};

// ============================================================================
// Model Configuration
// ============================================================================
const modelSettings = {
    tshirt: {
        scale: 0.8,
        position: new THREE.Vector3(0, 0, 0),

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

            // Load the default model if not already loaded
            const defaultModelPath = './models/tshirt.glb';

            // Setup the scene animation
            animate();

            // Expose key objects to window for direct access
            window.camera = camera;
            window.controls = controls;
            window.scene = scene;
            window.renderer = renderer;

            // Expose shirt mesh and material for debugging
            window.getShirtMesh = () => shirtMesh;
            window.getShirtMaterial = () => shirtMaterial;

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

                        // Disable view buttons when rotation is active
                        document.querySelectorAll('.camera-view-btn').forEach(btn => {
                            btn.disabled = true;
                            btn.style.opacity = '0.5';
                            btn.style.cursor = 'not-allowed';
                        });

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

                        // Re-enable view buttons when rotation is stopped
                        document.querySelectorAll('.camera-view-btn').forEach(btn => {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                        });

                        // When stopping rotation, return to the last selected view
                        const currentView = state.cameraView || 'front';
                        changeCameraView(currentView);
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
            loadModel('./models/tshirt.glb')
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
                    // Try once more with a relative path
                    loadModel('models/tshirt.glb')
                        .then(() => {
                            console.log('Model loaded with alternative path');
                            resolve();
                        })
                        .catch(secondError => {
                            console.error('Error on second attempt:', secondError);
                            reject(error);
                        });
                });

            animate();
        } catch (error) {
            console.error('Error setting up scene:', error);
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

    // Initialize scene userData
    scene.userData = {};

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
    // Clear any existing lights
    scene.children.forEach(child => {
        if (child.isLight) {
            scene.remove(child);
        }
    });

    // Create physically-based studio lighting for fabric rendering

    // Ambient light for base illumination (reduced intensity for more dramatic shadows)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Main key light (simulating window/studio key light)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;

    // Ultra-high-quality shadows for realistic fabric appearance
    mainLight.shadow.mapSize.width = 4096;  // Increased for more detail
    mainLight.shadow.mapSize.height = 4096; // Increased for more detail
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 30;
    mainLight.shadow.bias = -0.0003;  // Adjusted to prevent shadow acne
    mainLight.shadow.normalBias = 0.005; // Added to improve fabric shadows
    mainLight.shadow.radius = 2; // Soft shadows for fabric

    // Set up shadow camera frustum
    const shadowSize = 10;
    mainLight.shadow.camera.left = -shadowSize;
    mainLight.shadow.camera.right = shadowSize;
    mainLight.shadow.camera.top = shadowSize;
    mainLight.shadow.camera.bottom = -shadowSize;

    scene.add(mainLight);

    // Fill light (simulating bounce light from environment)
    const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.5); // Slightly cool tone
    fillLight.position.set(-6, 4, -5);
    scene.add(fillLight);

    // Add rim/back light for fabric highlighting
    const rimLight = new THREE.DirectionalLight(0xfff0e6, 0.4); // Slightly warm tone
    rimLight.position.set(0, 6, -10);
    scene.add(rimLight);

    // Add a warm ground bounce light
    const groundLight = new THREE.DirectionalLight(0xfff0db, 0.25);
    groundLight.position.set(0, -5, 0);
    scene.add(groundLight);

    // Add very subtle hemisphere light for overall fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.2);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Try to create an environment map with compatibility checks
    try {
        createEnvironmentMap();
    } catch (error) {
        console.error("Failed to create environment map, using fallback:", error);
        createFallbackEnvironment();
    }
}

/**
 * Create a high-quality environment map for reflections
 */
function createEnvironmentMap() {
    // Check if renderer exists
    if (!renderer) {
        console.error("Renderer not initialized yet");
        return;
    }

    // Check WebGL capabilities
    const gl = renderer.getContext();
    const isWebGL2 = gl instanceof WebGL2RenderingContext;

    // Use HalfFloatType only if supported
    const textureType = isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;

    // Reduce size on mobile or lower-end devices
    const isLowPerfDevice = !isWebGL2 || window.innerWidth < 768 || navigator.hardwareConcurrency < 4;
    const cubeMapSize = isLowPerfDevice ? 128 : 256;

    try {
        // Create an environment map for realistic reflections
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(cubeMapSize, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            magFilter: THREE.LinearFilter
        });
        cubeRenderTarget.texture.type = textureType;

        // Create cube camera for environment map
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        scene.add(cubeCamera);

        // Create a realistic studio environment for better fabric rendering
        const envScene = new THREE.Scene();

        // Create a larger box for environment
        const envGeometry = new THREE.BoxGeometry(200, 200, 200);

        // Create distinct materials for each face to simulate a photography studio environment
        const materials = [
            // Right side - warm light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xfff0e0, // Warm white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xfff0e0, 0xe0e0e0, 'y')
            }),
            // Left side - cool light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xe0e8ff, // Cool white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xe0e8ff, 0xe0e0e0, 'y')
            }),
            // Top - bright light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Bright white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf0f0f0, 'z', true)
            }),
            // Bottom - darker floor
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xaaaaaa, // Dark gray
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xcccccc, 0x888888, 'x')
            }),
            // Back - gradient backdrop
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xf0f0f0, // Light gray
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xcccccc, 'y')
            }),
            // Front - gradient
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xf0f0f0, // Light gray
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xcccccc, 'y')
            })
        ];

        // Helper function to add gradients to materials
        function addGradientToShader(shader, topColor, bottomColor, axis, inverse = false) {
            const topColorVec = new THREE.Color(topColor);
            const bottomColorVec = new THREE.Color(bottomColor);

            const topR = topColorVec.r.toFixed(5);
            const topG = topColorVec.g.toFixed(5);
            const topB = topColorVec.b.toFixed(5);

            const bottomR = bottomColorVec.r.toFixed(5);
            const bottomG = bottomColorVec.g.toFixed(5);
            const bottomB = bottomColorVec.b.toFixed(5);

            // Replace the fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
                'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                `
                // Create a gradient based on position
                vec3 topColor = vec3(${topR}, ${topG}, ${topB});
                vec3 bottomColor = vec3(${bottomR}, ${bottomG}, ${bottomB});
                
                // Normalize position
                vec3 normalizedPos = normalize(vWorldPosition);
                
                // Get coordinate for gradient based on axis
                float gradientFactor = normalizedPos.${axis};
                
                // Adjust direction if inverse
                ${inverse ? 'gradientFactor = -gradientFactor;' : ''}
                
                // Map from [-1, 1] to [0, 1]
                gradientFactor = gradientFactor * 0.5 + 0.5;
                
                // Apply smoothstep for better falloff
                gradientFactor = smoothstep(0.0, 1.0, gradientFactor);
                
                // Mix colors
                vec3 gradientColor = mix(bottomColor, topColor, gradientFactor);
                
                gl_FragColor = vec4(gradientColor, diffuseColor.a);
                `
            );
        }

        // Create a box with different materials for each face
        const envMesh = new THREE.Mesh(envGeometry, materials);
        envScene.add(envMesh);

        // Add lighting for better reflections
        const envLight = new THREE.DirectionalLight(0xffffff, 1.5);
        envLight.position.set(0, 10, 10);
        envScene.add(envLight);

        // Update the environment map
        cubeCamera.update(renderer, envScene);

        // Add the environment map to the scene
        scene.environment = cubeRenderTarget.texture;

        console.log("Enhanced studio environment map created successfully");
    } catch (error) {
        console.error("Error creating environment map:", error);
        throw error;
    }
}

/**
 * Create a simpler fallback environment when advanced features aren't supported
 */
function createFallbackEnvironment() {
    // Load a static environment map or create a simpler one
    const fallbackEnvScene = new THREE.Scene();
    fallbackEnvScene.background = new THREE.Color(0xf0f0f0);

    // Add basic hemispheric lighting for ambient illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    console.log("Using fallback environment lighting");
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);

    // Improved camera controls for unrestricted movement
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;  // Smoother damping
    controls.rotateSpeed = 1.0;     // Standard rotation speed
    controls.zoomSpeed = 1.0;       // Standard zoom speed
    controls.panSpeed = 1.0;        // Standard pan speed
    controls.minDistance = 0.5;     // Allow closer zoom
    controls.maxDistance = 10;      // Allow further zoom
    controls.enablePan = true;      // Enable panning
    controls.screenSpacePanning = true;  // Better panning behavior
    controls.target.set(0, 0, 0);

    // Remove polar angle restrictions to allow full 360-degree rotation
    controls.minPolarAngle = 0;     // Allow viewing from any angle
    controls.maxPolarAngle = Math.PI;  // Allow full vertical rotation

    // Disable auto-rotation
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.5;

    // Enable touch controls for mobile devices
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Add a listener for control changes to ensure smooth interaction
    controls.addEventListener('change', () => {
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    });
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('pointermove', onPointerMove);

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
    });

    // Add click event listener for the canvas
    renderer.domElement.addEventListener('click', function (event) {
        // Calculate normalized device coordinates
        const rect = renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update pointer coordinates for raycasting
        pointer.x = x;
        pointer.y = y;

        // Perform raycasting
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            // The first intersection is the closest to the camera
            const intersection = intersects[0];
            const object = intersection.object;

            // Check if we clicked on the shirt
            if (object === shirtMesh) {
                window.dispatchEvent(new CustomEvent('shirt-clicked', {
                    detail: {
                        point: intersection.point,
                        normal: intersection.face.normal,
                        uv: intersection.uv
                    }
                }));
            }
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

    // Handle window resize for texture mapper
    window.addEventListener('texture-resize', () => {
        if (shirtMesh && shirtMesh.material.map) {
            shirtMesh.material.map.needsUpdate = true;
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

    // Camera view buttons
    const viewButtons = document.querySelectorAll('.camera-view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Only handle click if rotation is not active
            if (!window.GLOBAL_ROTATION_ENABLED) {
                // Update active status
                viewButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Get the view and dispatch event
                const view = button.dataset.view;
                if (view) {
                    window.dispatchEvent(new CustomEvent('camera-view-change', { detail: { view } }));
                }
            }
        });
    });
}

// Set initial defaults
function initializeDefaultState() {
    // Fixed white color - color changing has been disabled
    const fixedColor = '#FFFFFF';

    console.log(`Initializing shirt with fixed color: ${fixedColor}`);

    // Apply the color directly to the shirt
    if (shirtMaterial) {
        // Create a Three.js color object from the hex string
        const newColor = new THREE.Color(fixedColor);
        shirtMaterial.color.copy(newColor);
        shirtMaterial.needsUpdate = true;

        // Make sure any fullDecal is properly aligned with visibility state
        if (fullDecal) {
            fullDecal.visible = state.isFullTexture;
            console.log(`Setting fullDecal visibility to: ${state.isFullTexture}`);
        }

        console.log(`Initialized shirt with fixed white color`);
    } else {
        console.warn('Cannot initialize shirt color: shirtMaterial not found');
    }
}

// ============================================================================
// Model Loading and Management
// ============================================================================

// Load a 3D model
function loadModel(modelPath) {
    return new Promise((resolve, reject) => {
        if (!modelPath) {
            console.error('Model path is required');
            reject(new Error('Model path is required'));
            return;
        }

        if (modelPath === currentModelPath && shirtMesh) {
            // Model already loaded
            console.log('Model already loaded:', modelPath);
            resolve();
            return;
        }

        // Show loading indicator
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.innerHTML = `
                <div class="spinner"></div>
                <p>Loading model...</p>
            `;
        }

        // Determine model type from path
        currentModelType = modelPath.includes('hoodie') ? 'hoodie' : 'tshirt';
        console.log(`Loading model type: ${currentModelType}, path: ${modelPath}`);

        // Get model settings based on current type
        const settings = modelSettings[currentModelType] || modelSettings.tshirt;

        // Get current color from state
        const currentColor = state.color || '#FFFFFF';
        const modelColor = new THREE.Color(currentColor);

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
        fullDecal = null;
        shirtMesh = null;
        shirtMaterial = null;

        // Update the currentModelPath to prevent reloading
        currentModelPath = modelPath;

        // Check if file exists before loading
        fetch(modelPath, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Model file not found: ${modelPath}`);
                }
                return true;
            })
            .then(() => {
                console.log(`Model file exists: ${modelPath}`);

                const gltfLoader = new GLTFLoader();

                console.log(`Starting to load 3D model: ${modelPath}`);

                gltfLoader.load(
                    modelPath,
                    (gltf) => {
                        try {
                            console.log(`Model loaded successfully: ${modelPath}`);
                            // Process the loaded model
                            processLoadedModel(gltf, settings, modelColor);

                            // Initialize the texture mapper if not already done
                            if (!textureMapperInitialized) {
                                // Set up texture mapper with procedural textures (no file paths)
                                initTextureMapper(null, null, currentModelType)
                                    .then(({ baseTexture, bumpMap }) => {
                                        console.log('Texture mapper initialized with procedural textures');
                                        textureMapperInitialized = true;

                                        // Update model type in the texture mapper
                                        setModelType(currentModelType);

                                        // Let the app know the model is loaded
                                        window.dispatchEvent(new CustomEvent('model-loaded'));

                                        // Hide loading overlay
                                        if (loadingOverlay) loadingOverlay.style.display = 'none';

                                        resolve();
                                    })
                                    .catch(error => {
                                        console.error('Error initializing texture mapper:', error);

                                        // Continue even if texture mapper fails
                                        setModelType(currentModelType);
                                        window.dispatchEvent(new CustomEvent('model-loaded'));
                                        if (loadingOverlay) loadingOverlay.style.display = 'none';
                                        resolve();
                                    });
                            } else {
                                // Just update the model type
                                setModelType(currentModelType);

                                // Let the app know the model is loaded
                                window.dispatchEvent(new CustomEvent('model-loaded'));

                                // Hide loading overlay
                                if (loadingOverlay) loadingOverlay.style.display = 'none';

                                resolve();
                            }
                        } catch (error) {
                            console.error('Error processing model:', error);
                            if (loadingOverlay) {
                                loadingOverlay.innerHTML = `
                                    <div class="error">
                                        <i class="fas fa-exclamation-triangle"></i>
                                        <p>Error processing model. Please try again.</p>
                                        <p class="error-details">${error.message}</p>
                                    </div>
                                `;
                            }
                            reject(error);
                        }
                    },
                    (progress) => {
                        // Show loading progress
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        console.log(`Loading model: ${percent}%`);

                        // Update loading overlay with progress
                        if (loadingOverlay && loadingOverlay.querySelector('p')) {
                            loadingOverlay.querySelector('p').textContent =
                                `Loading ${currentModelType} model... ${percent}%`;
                        }
                    },
                    (error) => {
                        console.error('Error loading model:', error);
                        if (loadingOverlay) {
                            loadingOverlay.innerHTML = `
                                <div class="error">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <p>Error loading model. Please try again.</p>
                                    <p class="error-details">${error.message}</p>
                                </div>
                            `;
                        }
                        reject(error);
                    }
                );
            })
            .catch(error => {
                console.error('Error checking model file:', error);
                if (loadingOverlay) {
                    loadingOverlay.innerHTML = `
                        <div class="error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Error loading model: File not found</p>
                            <p class="error-details">${error.message}</p>
                        </div>
                    `;
                }
                reject(error);
            });
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

    // Track all meshes in the model
    const meshes = [];

    // Find all meshes in the model
    model.traverse((obj) => {
        if (obj.isMesh) {
            meshes.push(obj);

            // Set first mesh as our reference shirt mesh if not already set
            if (!shirtMesh) {
                shirtMesh = obj;
            }
        }
    });

    if (shirtMesh) {
        // Clone and store the original material
        shirtMaterial = shirtMesh.material.clone();

        // Get color from state or use default white
        const currentColor = state.color || '#FFFFFF';
        shirtMaterial.color.copy(new THREE.Color(currentColor));
        console.log(`Applied color to shirt material: ${currentColor}`);

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

        // Apply the material to all meshes in the model
        meshes.forEach(mesh => {
            mesh.material = shirtMaterial;
        });

        shirtMaterial.needsUpdate = true;
    }

    // Set up proper shadowing
    if (shirtMesh) {
        shirtMesh.castShadow = true;
        shirtMesh.receiveShadow = true;
    }

    // If there was a fullDecal previously, make sure it's removed from the old shirt mesh
    if (fullDecal) {
        if (fullDecal.parent) {
            fullDecal.parent.remove(fullDecal);
        }
        fullDecal = null;
    }

    // Restore full texture if it was active before
    if (state.isFullTexture && state.fullDecal) {
        updateShirtTexture(state.fullDecal, 'full');
    }

    console.log('Model processed successfully with enhanced material');

    // Store original camera positions for all views
    if (settings && settings.cameraPositions) {
        Object.keys(settings.cameraPositions).forEach(view => {
            originalViewPositions[view] = {
                position: settings.cameraPositions[view].position.clone(),
                target: settings.cameraPositions[view].target ? settings.cameraPositions[view].target.clone() : new THREE.Vector3(0, 0, 0),
                fov: settings.cameraPositions[view].fov
            };
        });
    }
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

    if (type === 'full') {
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

/**
 * Update the shirt color with the specified hex color
 * @param {string} color - Hex color code (e.g. '#FF0000')
 */
export function updateShirtColor(color) {
    if (!shirtMaterial) {
        console.warn('Cannot update shirt color: shirtMaterial not found');
        return;
    }

    console.log(`Updating shirt color: ${color}`);

    // Create a Three.js color object from the hex string
    const newColor = new THREE.Color(color);

    // Apply the color directly to the shirt material
    shirtMaterial.color.copy(newColor);

    // Ensure the material updates visually
    shirtMaterial.needsUpdate = true;

    // Force a render update to ensure changes are visible
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

    // Make sure the color is visible if there's a fullDecal
    if (fullDecal && fullDecal.visible) {
        fullDecal.visible = false;

        // Force another render
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }
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
        loadedTexture.flipY = false;

        callback(loadedTexture);
    });
}

// Update shirt texture with proper UV mapping
export function updateShirtTexture(imageUrl, type) {
    if (!shirtMesh) return;

    createDecal(imageUrl, type, (texture) => {
        // Get model settings based on current type
        const settings = modelSettings[currentModelType] || modelSettings.tshirt;

        if (type === 'full') {
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

            // Only show fullDecal if isFullTexture is true
            fullDecal.visible = isFullTexture;
            fullDecal.name = 'full-decal';

            if (isFullTexture) {
                shirtMesh.add(fullDecal);
                console.log("Added full texture decal to shirt, texture is now visible");
            } else {
                // If we're creating a decal but textures are disabled, still add it but hide it
                shirtMesh.add(fullDecal);
                fullDecal.visible = false;
                console.log("Added full texture decal to shirt, but keeping it hidden (isFullTexture=false)");
            }
        }
    });
}

// Toggle texture visibility
export function toggleTexture(type, active) {
    if (!shirtMesh) return;

    if (type === 'full') {
        isFullTexture = active;

        if (fullDecal) {
            fullDecal.visible = active;

            // When disabling the texture, make sure the shirt color is visible
            if (!active && shirtMaterial) {
                // Force a material update to ensure color is refreshed
                shirtMaterial.needsUpdate = true;
                console.log("Texture disabled, showing base shirt color:", shirtMaterial.color);

                // Force a render update
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }
            }
        } else if (active) {
            // Only create full texture if user has selected one, no default texture
            if (state.fullDecal) {
                updateShirtTexture(state.fullDecal, 'full');
            }
        }
    }
}

// Change the current 3D model
export function changeModel(modelType) {
    console.log(`Changing model to: ${modelType}`);

    // First check if the modelType is valid
    if (modelType !== 'tshirt' && modelType !== 'hoodie') {
        console.error(`Invalid model type: ${modelType}`);
        return Promise.reject(new Error(`Invalid model type: ${modelType}`));
    }

    // Get the model path from state
    let modelPath;
    if (modelType === 'tshirt') {
        modelPath = './models/tshirt.glb'; // Fixed path to match actual file location
    } else if (modelType === 'hoodie') {
        modelPath = './models/hoodie.glb'; // Fixed path to match actual file location
    }

    if (!modelPath) {
        console.error('Model path not found for type:', modelType);
        return Promise.reject(new Error('Model path not found'));
    }

    console.log(`Model path resolved to: ${modelPath}`);

    // Show loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.querySelector('p').textContent = `Loading ${modelType} model...`;
    }

    // Already on this model, no need to change
    if (modelType === currentModelType && shirtMesh) {
        console.log(`Already on ${modelType} model, no need to change`);
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        return Promise.resolve();
    }

    // Save the current model state
    const savedColor = shirtMaterial ? shirtMaterial.color.clone() : null;
    const savedFullDecal = fullDecal && fullDecal.material && fullDecal.material.map ?
        fullDecal.material.map.clone() : null;
    const isFullVisible = fullDecal && fullDecal.parent === shirtMesh;

    // Update current model type before loading
    currentModelType = modelType;

    // Preserve current textures when changing models
    const currentFullDecal = state.fullDecal;
    const fullTextureVisible = state.isFullTexture;

    // Save the current model path
    const oldModelPath = currentModelPath;

    // Try loading the new model
    return loadModel(modelPath)
        .then(() => {
            console.log(`Model changed to ${modelType}`);

            // Restore saved color if available
            if (savedColor && shirtMaterial) {
                shirtMaterial.color.copy(savedColor);
                shirtMaterial.needsUpdate = true;
                console.log('Restored color after model change');
            } else if (state.color && shirtMaterial) {
                // Use color from state
                shirtMaterial.color.copy(new THREE.Color(state.color));
                shirtMaterial.needsUpdate = true;
                console.log('Applied state color after model change');
            }

            // Restore textures
            if (isFullVisible && savedFullDecal) {
                const currentFullDecal = state.fullDecal || 'assets/threejs.png';
                updateShirtTexture(currentFullDecal, 'full');
            }

            // Reset camera
            resetCameraPosition();

            // Notify that model has changed
            window.dispatchEvent(new CustomEvent('model-changed', {
                detail: { modelType }
            }));

            return true;
        })
        .catch(error => {
            console.error(`Error loading model ${modelType}:`, error);

            // Show error in loading overlay
            if (loadingOverlay) {
                loadingOverlay.innerHTML = `
                                        <div class="error">
                                            <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading ${modelType} model</p>
                        <p class="error-details">${error.message}</p>
                                        </div>
                                    `;
            }

            // Revert to previous model type
            currentModelType = modelType === 'tshirt' ? 'hoodie' : 'tshirt';

            // Reject the promise
            return Promise.reject(error);
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

        // Reset group rotation when changing views
        if (group) {
            group.rotation.set(0, 0, 0);
        }

        // Calculate a smooth path based on the current and target view
        const animationDuration = 1.0; // seconds
        const startTime = Date.now();

        // Set transition state
        isViewTransitioning = true;
        viewTransitionEndTime = startTime + (animationDuration * 1000);

        function animateViewTransition() {
            const elapsedTime = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsedTime / animationDuration, 1.0);

            // Easing function for smooth acceleration/deceleration
            const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            const easedProgress = easeInOutCubic(progress);

            // Animate position with a slight arc for more visual interest
            const arcHeight = startPosition.distanceTo(targetCameraPosition) * 0.2;
            const arcOffset = new THREE.Vector3(0, arcHeight, 0).multiplyScalar(
                Math.sin(easedProgress * Math.PI)
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
                isViewTransitioning = false;
                lastRotationView = view;

                // Update state to reflect current view
                updateState({ cameraView: view });

                // Update the active camera view button in the UI
                document.querySelectorAll('.camera-view-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.view === view) {
                        btn.classList.add('active');
                    }
                });

                console.log(`Camera view transition to ${view} complete`);
            }
        }

        // Start the animation
        animateViewTransition();
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
            // Only handle click if rotation is not active
            if (!window.GLOBAL_ROTATION_ENABLED) {
                // Update active status
                viewButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Get the view and dispatch event
                const view = button.dataset.view;
                if (view) {
                    window.dispatchEvent(new CustomEvent('camera-view-change', { detail: { view } }));
                }
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

    // Only update camera position if auto-rotation is enabled
    if (window.GLOBAL_ROTATION_ENABLED === true && group) {
        group.rotateOnAxis(rotationAxis, rotationSpeed);
    }

    // Update controls for damping
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

        console.log(`Resizing canvas to ${width}x${height}`);

        // Update camera aspect ratio
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        // Update renderer size
        renderer.setSize(width, height, false); // false to avoid setting style
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance

        // Force a render to update the display immediately
        if (scene) {
            renderer.render(scene, camera);
        }
    }
}

// Handle pointer movement
function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Update theme background color for dark/light mode
export function updateThemeBackground(isDarkMode) {
    console.log(`Updating theme background: ${isDarkMode ? 'dark' : 'light'} mode`);

    if (!renderer) {
        console.warn('Renderer not available for theme update');
        return;
    }

    // Set THREE.js renderer background color based on theme
    if (isDarkMode) {
        // Dark mode colors
        renderer.setClearColor(0x111827); // Match CSS dark bg
    } else {
        // Light mode colors
        renderer.setClearColor(0xf8fafc); // Match CSS light bg
    }

    // Force a render to immediately show the change
    if (scene && camera) {
        renderer.render(scene, camera);
    }

    // Update canvas container background to match renderer
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        if (isDarkMode) {
            canvasContainer.style.backgroundColor = '#111827';
            // Remove any light theme classes
            canvasContainer.classList.remove('light-theme-canvas');
            canvasContainer.classList.add('dark-theme-canvas');
        } else {
            canvasContainer.style.backgroundColor = '#f8fafc';
            // Remove any dark theme classes
            canvasContainer.classList.remove('dark-theme-canvas');
            canvasContainer.classList.add('light-theme-canvas');
        }
    }

    // Update fabric editor canvas if it exists
    const fabricCanvas = document.getElementById('fabric-canvas');
    if (fabricCanvas) {
        const fabricInstance = window.fabricCanvas; // Get the Fabric.js instance if available
        if (fabricInstance) {
            // If we have access to the Fabric.js instance, update its background
            fabricInstance.setBackgroundColor(
                '#ffffff', // Always use white background regardless of theme
                fabricInstance.renderAll.bind(fabricInstance)
            );
        } else {
            // Otherwise update the canvas element directly
            fabricCanvas.style.backgroundColor = '#ffffff'; // Always use white background
        }
    }

    // Dispatch an event for theme change that other components can listen to
    window.dispatchEvent(new CustomEvent('theme-changed', {
        detail: { darkMode: isDarkMode }
    }));
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




// Add reset camera position function
function resetCameraPosition() {
    console.log('Resetting camera position');

    // Reset cumulative zoom factor
    cumulativeZoomFactor = 1.0;

    if (!camera || !controls) return;

    const settings = modelSettings[currentModelType] || modelSettings.tshirt;
    if (!settings || !settings.cameraPositions) return;

    const cameraPosition = settings.cameraPositions['front'];

    if (cameraPosition) {
        // Reset group rotation
        if (group) {
            group.rotation.set(0, 0, 0);
        }

        // Cancel any ongoing view transitions
        isViewTransitioning = false;

        // Set target position for smooth animation
        targetCameraPosition.copy(cameraPosition.position);

        // Reset controls target immediately for responsiveness
        controls.target.copy(cameraPosition.target || new THREE.Vector3(0, 0, 0));

        const startPosition = camera.position.clone();
        const startTime = Date.now();
        const resetDuration = 0.4;

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
                lastRotationView = 'front';

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

        // Start the reset animation
        animateReset();
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
    // Generate realistic fabric textures
    const textureSize = 1024;

    // Generate normal map for fabric weave
    try {
        // Try to load the advanced normal map generator
        if (typeof generateAdvancedFabricNormalMap === 'function') {
            const fabricType = state.fabricType || 'cotton';
            material.normalMap = generateAdvancedFabricNormalMap(textureSize, textureSize, fabricType);
            material.normalScale.set(0.8, 0.8);
        } else {
            // Fallback to basic normal map
            material.normalMap = createAdvancedNormalMap(textureSize, textureSize);
            material.normalScale.set(0.5, 0.5);
        }
    } catch (error) {
        console.warn("Failed to generate advanced normal map:", error);
        material.normalMap = createAdvancedNormalMap(textureSize, textureSize);
        material.normalScale.set(0.5, 0.5);
    }

    // Create roughness map with fabric detail
    material.roughnessMap = createAdvancedRoughnessMap(textureSize, textureSize);

    // Add ambient occlusion for depth
    material.aoMap = createAmbientOcclusionMap(textureSize, textureSize);
    material.aoMapIntensity = 0.5;

    // Add subtle displacement for fabric depth
    material.displacementMap = createDisplacementMap(textureSize, textureSize);
    material.displacementScale = 0.002; // Very subtle displacement

    // Make sure textures are properly wrapped and repeated
    [material.normalMap, material.roughnessMap, material.aoMap, material.displacementMap].forEach(texture => {
        if (texture) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(5, 5); // Scale the texture appropriately
            texture.needsUpdate = true;
        }
    });

    material.needsUpdate = true;
}

// Create a more detailed normal map for fabric
function createAdvancedNormalMap(width, height) {
    // Create a simple flat normal map (no details) for basic appearance
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with flat normal data (pointing straight up)
    for (let i = 0; i < size; i++) {
        const stride = i * 4;
        data[stride] = 128;     // R: X component (flat)
        data[stride + 1] = 128; // G: Y component (flat) 
        data[stride + 2] = 255; // B: Z component (pointing outward)
        data[stride + 3] = 255; // A: fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

// Create an enhanced roughness map for fabric
function createAdvancedRoughnessMap(width, height) {
    // Create a detailed roughness map with fabric texture
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fabric properties - get from state or use defaults
    const fabricType = state.fabricType || 'cotton';
    const baseFabricRoughness = fabricType === 'silk' ? 150 :
        fabricType === 'wool' ? 220 :
            fabricType === 'polyester' ? 170 : 180; // cotton default

    // Generate noise frequencies for fabric texture
    const scale1 = 0.03;
    const scale2 = 0.1;
    const scale3 = 0.3;

    // Use a simple pseudo-random number generator for consistency
    const seed = 12345;
    const random = (x, y) => {
        const dot = x * 12.9898 + y * 78.233 + seed;
        return Math.abs(Math.sin(dot) * 43758.5453) % 1;
    };

    // Generate Perlin-like noise for natural fabric appearance
    const noise = (x, y, scale) => {
        const x0 = Math.floor(x * scale);
        const y0 = Math.floor(y * scale);
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const sx = (x * scale) - x0;
        const sy = (y * scale) - y0;

        const n00 = random(x0, y0);
        const n10 = random(x1, y0);
        const n01 = random(x0, y1);
        const n11 = random(x1, y1);

        const nx0 = n00 * (1 - sx) + n10 * sx;
        const nx1 = n01 * (1 - sx) + n11 * sx;

        return nx0 * (1 - sy) + nx1 * sy;
    };

    // Fill with varying roughness values based on noise functions
    for (let i = 0; i < size; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const stride = i * 4;

        // Multi-scale noise for fabric detail
        const noiseValue1 = noise(x, y, scale1);
        const noiseValue2 = noise(x, y, scale2) * 0.5;
        const noiseValue3 = noise(x, y, scale3) * 0.25;

        // Combine noise layers with different frequencies
        const combinedNoise = (noiseValue1 + noiseValue2 + noiseValue3) / 1.75;

        // Calculate final roughness value with variation
        const roughnessValue = Math.min(255, Math.max(0,
            baseFabricRoughness + (combinedNoise * 70 - 35)
        ));

        // Apply to all RGB channels (grayscale texture)
        data[stride] = roughnessValue;
        data[stride + 1] = roughnessValue;
        data[stride + 2] = roughnessValue;
        data[stride + 3] = 255; // Fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

// Create an ambient occlusion map for the fabric
function createAmbientOcclusionMap(width, height) {
    // Create a flat white AO map (no occlusion) for basic appearance
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with white (no occlusion)
    for (let i = 0; i < size; i++) {
        const stride = i * 4;
        data[stride] = 255;     // White
        data[stride + 1] = 255; // White
        data[stride + 2] = 255; // White
        data[stride + 3] = 255; // Fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

// Create a displacement map for subtle fabric detail
function createDisplacementMap(width, height) {
    // Create a flat displacement map (no displacement) for basic appearance
    const size = width * height;
    const data = new Uint8Array(4 * size);

    // Fill with middle gray (no displacement)
    for (let i = 0; i < size; i++) {
        const stride = i * 4;
        data[stride] = 128;     // Middle value (no displacement)
        data[stride + 1] = 128; // Middle value
        data[stride + 2] = 128; // Middle value
        data[stride + 3] = 255; // Fully opaque
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
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
            // Get current fabric type from state or default to cotton
            const fabricType = state.fabricType || 'cotton';

            // Calculate physically-based material properties with error handling
            let physicsMaterialProperties;
            try {
                physicsMaterialProperties = calculateFabricMaterialProperties(
                    fabricType,
                    new THREE.Color(color)
                );
            } catch (error) {
                console.error("Failed to calculate fabric properties:", error);
                // Use enhanced default properties for realism
                physicsMaterialProperties = {
                    roughness: 0.65,
                    metalness: 0.05,
                    clearcoat: 0.15,
                    clearcoatRoughness: 0.4,
                    sheen: 0.25,
                    sheenRoughness: 0.8,
                    sheenColor: new THREE.Color(color).offsetHSL(0, 0, 0.1)
                };
            }

            // Merge with any provided settings
            const finalSettings = {
                ...physicsMaterialProperties,
                ...materialSettings,
                color: color,
                side: THREE.DoubleSide,
                transparent: false,
                opacity: 1.0
            };

            // Create physical material with advanced properties
            const physicalMaterial = new THREE.MeshPhysicalMaterial(finalSettings);

            // Enhanced shadows and lighting interaction
            physicalMaterial.shadowSide = THREE.DoubleSide;
            physicalMaterial.envMapIntensity = 0.8;  // Subtle environment reflections

            // Generate advanced fabric normal map with error handling
            try {
                // Try to use dynamic normal map
                if (typeof generateAdvancedFabricNormalMap === 'function') {
                    const normalMap = generateAdvancedFabricNormalMap(2048, 2048, fabricType);
                    physicalMaterial.normalMap = normalMap;
                    physicalMaterial.normalScale.set(0.9, 0.9); // Increased normal scale for more detail
                } else {
                    // Fallback to more basic normal map with enhanced settings
                    const normalMap = createAdvancedNormalMap(1024, 1024);
                    physicalMaterial.normalMap = normalMap;
                    physicalMaterial.normalScale.set(0.6, 0.6);
                }
            } catch (error) {
                console.error("Failed to generate normal map:", error);
                // Continue without normal map
            }

            // Copy other maps from standard material if available
            if (standardMaterial.roughnessMap) {
                physicalMaterial.roughnessMap = standardMaterial.roughnessMap;
                // Enhanced texture settings
                physicalMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
                physicalMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
                physicalMaterial.roughnessMap.repeat.set(5, 5);  // Increased repeats for more detailed texture
            } else {
                // Create a new roughness map if none exists
                try {
                    const roughnessMap = createAdvancedRoughnessMap(2048, 2048);
                    physicalMaterial.roughnessMap = roughnessMap;
                    physicalMaterial.roughnessMap.wrapS = THREE.RepeatWrapping;
                    physicalMaterial.roughnessMap.wrapT = THREE.RepeatWrapping;
                    physicalMaterial.roughnessMap.repeat.set(5, 5);
                } catch (error) {
                    console.error("Failed to create roughness map:", error);
                }
            }

            if (standardMaterial.aoMap) {
                physicalMaterial.aoMap = standardMaterial.aoMap;
                physicalMaterial.aoMapIntensity = 0.8;  // Enhanced AO intensity
                // Enhanced texture settings
                physicalMaterial.aoMap.wrapS = THREE.RepeatWrapping;
                physicalMaterial.aoMap.wrapT = THREE.RepeatWrapping;
                physicalMaterial.aoMap.repeat.set(5, 5);  // Matched with other textures
            } else {
                // Create a new AO map if none exists
                try {
                    const aoMap = createAmbientOcclusionMap(2048, 2048);
                    physicalMaterial.aoMap = aoMap;
                    physicalMaterial.aoMapIntensity = 0.8;
                    physicalMaterial.aoMap.wrapS = THREE.RepeatWrapping;
                    physicalMaterial.aoMap.wrapT = THREE.RepeatWrapping;
                    physicalMaterial.aoMap.repeat.set(5, 5);
                } catch (error) {
                    console.error("Failed to create AO map:", error);
                }
            }

            // Add subtle displacement map if available
            if (standardMaterial.displacementMap) {
                physicalMaterial.displacementMap = standardMaterial.displacementMap;
                physicalMaterial.displacementScale = 0.002;  // Very subtle effect
                physicalMaterial.displacementBias = 0;
                // Enhanced texture settings
                physicalMaterial.displacementMap.wrapS = THREE.RepeatWrapping;
                physicalMaterial.displacementMap.wrapT = THREE.RepeatWrapping;
                physicalMaterial.displacementMap.repeat.set(5, 5);
            }

            // Add subtle bump map to enhance detail even without normal map
            try {
                const bumpMap = createAdvancedRoughnessMap(2048, 2048);
                physicalMaterial.bumpMap = bumpMap;
                physicalMaterial.bumpScale = 0.008; // Increased for better detail
                // Enhanced texture settings
                physicalMaterial.bumpMap.wrapS = THREE.RepeatWrapping;
                physicalMaterial.bumpMap.wrapT = THREE.RepeatWrapping;
                physicalMaterial.bumpMap.repeat.set(8, 8);  // Higher frequency for bump
            } catch (error) {
                console.error("Failed to create bump map:", error);
            }

            // Apply advanced light interaction calculations with error handling
            try {
                enhanceFabricLightInteraction(physicalMaterial, fabricType, new THREE.Color(color));
            } catch (error) {
                console.error("Failed to enhance light interaction:", error);
                // Continue without enhancement
            }

            // Replace the material
            shirtMaterial = physicalMaterial;
            if (shirtMesh) {
                shirtMesh.material = shirtMaterial;

                // Ensure proper material on all parts of the shirt (including inside)
                shirtMesh.traverse(child => {
                    if (child.isMesh) {
                        child.material = shirtMaterial;
                    }
                });
            }

            console.log(`Advanced physical material applied with ${fabricType} properties`);
        } catch (e) {
            console.error("Failed to upgrade to advanced material", e);
            // Fallback to standard material
            useFallbackMaterial(standardMaterial, color);
        }
    } else {
        // THREE.MeshPhysicalMaterial not available, use fallback
        useFallbackMaterial(standardMaterial, color);
    }
}

/**
 * Fallback to simpler material when advanced features aren't available
 */
function useFallbackMaterial(standardMaterial, color) {
    // Create a simpler material as fallback but still with improved settings
    const fallbackMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.65,
        metalness: 0.1,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
        envMapIntensity: 0.6
    });

    // Try to add basic textures for better realism even in fallback mode
    try {
        // Add a simple normal map
        fallbackMaterial.normalMap = createAdvancedNormalMap(512, 512);
        fallbackMaterial.normalScale.set(0.4, 0.4);

        // Add a roughness map for texture variation
        fallbackMaterial.roughnessMap = createAdvancedRoughnessMap(512, 512);

        // Make sure textures are properly wrapped
        [fallbackMaterial.normalMap, fallbackMaterial.roughnessMap].forEach(texture => {
            if (texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(3, 3); // Lower repeat count for performance
                texture.needsUpdate = true;
            }
        });
    } catch (error) {
        console.warn("Failed to create textures for fallback material:", error);
        // Continue without textures
    }

    // Replace the material
    shirtMaterial = fallbackMaterial;
    if (shirtMesh) {
        shirtMesh.material = shirtMaterial;

        // Ensure shadows are properly set
        shirtMesh.castShadow = true;
        shirtMesh.receiveShadow = true;
    }

    console.log("Using enhanced fallback material for compatibility");
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

            // Disable view buttons when rotation is active
            document.querySelectorAll('.camera-view-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            });

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

            // Re-enable view buttons when rotation is stopped
            document.querySelectorAll('.camera-view-btn').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            });

            // When stopping rotation, return to the last selected view
            const currentView = state.cameraView || 'front';
            changeCameraView(currentView);
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

// Add a new function to set fabric type and update material
export function setFabricType(fabricType) {
    // Update state
    updateState({ fabricType });

    // Update material if it exists
    if (shirtMaterial && shirtMesh) {
        // Get current color
        const color = shirtMaterial.color;

        // Recalculate material with new fabric type
        const materialSettings = calculateFabricMaterialProperties(
            fabricType,
            color
        );

        // Apply new material settings
        for (const [property, value] of Object.entries(materialSettings)) {
            if (property in shirtMaterial) {
                shirtMaterial[property] = value;
            }
        }

        // Regenerate normal map for the new fabric type
        const normalMap = generateAdvancedFabricNormalMap(1024, 1024, fabricType);
        shirtMaterial.normalMap = normalMap;

        // Enhance light interaction for the specific fabric
        enhanceFabricLightInteraction(shirtMaterial, fabricType, color);

        // Update material
        shirtMaterial.needsUpdate = true;

        console.log(`Fabric type updated to ${fabricType}`);
    }
}

// Expose updateThemeBackground to window for direct access from HTML
window.updateThemeBackground = updateThemeBackground;

// Check if WebGL is properly supported before loading the models
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            return { supported: false, message: 'WebGL is not supported in your browser.' };
        }

        // Check if we have enough memory (at least 128MB recommended for 3D models)
        if (gl.getExtension('WEBGL_debug_renderer_info')) {
            const renderer = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
            console.log('Graphics hardware:', renderer);

            // Check for mobile/integrated GPU that might struggle with complex models
            const isMobileGPU = /(mali|adreno|powervr|intel)/i.test(renderer);
            if (isMobileGPU) {
                console.warn('Mobile or integrated GPU detected, performance may be limited');
            }
        }

        // Check for necessary extensions
        const hasRequiredExtensions = [
            'OES_texture_float',
            'OES_element_index_uint',
            'WEBGL_depth_texture'
        ].every(ext => gl.getExtension(ext));

        if (!hasRequiredExtensions) {
            return {
                supported: true,
                limitedSupport: true,
                message: 'WebGL is supported but some features may not work correctly.'
            };
        }

        return { supported: true, message: 'WebGL is fully supported.' };
    } catch (e) {
        console.error('Error checking WebGL support:', e);
        return { supported: false, message: 'Error checking WebGL support: ' + e.message };
    }
}

// Call this function before attempting to load any models
window.checkWebGLSupport = checkWebGLSupport;