import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state, updateState } from './state.js';
import { initTextureMapper, loadCustomImage, setModelType, clearCustomImage } from './texture-mapper.js';
import { Logger, Performance } from './utils.js';
import { init3DEditor } from './3d-editor.js';

// ============================================================================
// Global Variables
// ============================================================================
let scene, camera, renderer, controls;
let shirtMesh, shirtMaterial;
let pointer = { x: 0, y: 0 };
let targetCameraPosition = new THREE.Vector3(0, 0, 2);
let group;
let fullDecal;
let isFullTexture = false; // Initially set to false to prevent texture overlay
let currentModelPath = '';
let currentModelType = 'tshirt';
let isAutoRotating = false;
let isViewTransitioning = false;
let viewTransitionEndTime = 0;
let lastRotationView = null; // Track last view for rotation adjustments
let textureMapperInitialized = false; // Flag to track texture mapper initialization
let gltfLoader = null; // GLTF loader for loading 3D models
let cumulativeZoomFactor = 1.0;
let initialized = false; // Initialization flag for camera locking
let manualRotationActive = false; // Flag for manual rotation
let textureState = {  // Add missing textureState object
    baseTexture: null,
    normalMap: null,
    roughnessMap: null
};
let controlsStateBackup = null; // Backup of controls state for camera locking
let rotationEnabled = false; // Flag for rotation

// Add standalone rotation animation variables
let rotationSpeed = 0.02; // Increased for better visibility
let rotationAxis = new THREE.Vector3(0, 1, 0); // Y-axis rotation by default

// Set a GLOBAL rotation variable on the window object to ensure it's accessible everywhere
window.GLOBAL_ROTATION_ENABLED = false;

// Add storage for original view positions at the top of the file
const originalViewPositions = {
    front: null,
    back: null,
    left: null,
    right: null
};

// Add a new variable to track editor mode
let editorMode = false;

// Initialize with reduced quality for better performance
let textureQuality = 'medium'; // 'high', 'medium', or 'low'

// Function to reduce quality settings when performance issues are detected
function reduceQualityForPerformance() {
    // Check if we already detected performance issues during this session
    if (sessionStorage.getItem('reducedQuality') === 'true') {
        textureQuality = 'low';
        return true;
    }

    // Initialize performance tracking if not already set
    if (!window.performanceMetrics) {
        window.performanceMetrics = {
            frameRates: [],
            slowFrames: 0,
            lastReduction: Date.now()
        };
    }

    // Add current frame rate to the tracking array
    const now = Date.now();
    const metrics = window.performanceMetrics;

    // Only check every 5 seconds to avoid premature quality reduction
    if (now - metrics.lastReduction < 5000) {
        return false;
    }

    // Check for performance issues
    const hasMemoryIssue = window.performance && window.performance.memory &&
        window.performance.memory.jsHeapSizeLimit > 0 &&
        window.performance.memory.usedJSHeapSize / window.performance.memory.jsHeapSizeLimit > 0.7;

    const hasFrameRateIssue = metrics.slowFrames > 50; // If we've had 50+ slow frames, reduce quality

    // Reset tracking after checking
    metrics.slowFrames = 0;
    metrics.lastReduction = now;

    // If we detect issues, reduce quality
    if (hasMemoryIssue || hasFrameRateIssue) {
        textureQuality = 'low';
        console.warn('Performance issues detected - reducing quality settings');
        console.warn(`Memory issue: ${hasMemoryIssue}, Frame rate issue: ${hasFrameRateIssue}`);
        sessionStorage.setItem('reducedQuality', 'true');

        // Apply reduced quality settings
        if (renderer) {
            renderer.setPixelRatio(window.devicePixelRatio > 1 ? 1 : window.devicePixelRatio);
            renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

            // Turn off some expensive features
            renderer.shadowMap.enabled = false;
        }

        // Reduce target FPS further
        targetFPS = 20;

        // Force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
            } catch (e) {
                // Garbage collection not available
            }
        }

        return true;
    }

    return false;
}

// Call this function periodically to check performance
let performanceCheckCounter = 0;
function checkPerformance() {
    performanceCheckCounter++;

    // Only check every 100 frames to reduce overhead
    if (performanceCheckCounter % 100 === 0) {
        // Check if we need to reduce quality
        const qualityReduced = reduceQualityForPerformance();

        // If we've already reduced quality, check if we need to optimize textures
        if (qualityReduced && textureState && textureState.baseTexture) {
            // Reduce texture resolution for better performance
            optimizeTextures();
        }
    }
}

// Function to optimize textures for better performance
function optimizeTextures() {
    // Only run this once per session
    if (sessionStorage.getItem('texturesOptimized') === 'true') {
        return;
    }

    console.log('Optimizing textures for better performance');

    // Mark as optimized to avoid repeated optimization
    sessionStorage.setItem('texturesOptimized', 'true');

    // Reduce anisotropy level
    if (textureState && textureState.baseTexture) {
        textureState.baseTexture.anisotropy = 1; // Minimum anisotropy
        textureState.baseTexture.needsUpdate = true;
    }

    // Reduce mipmapping quality
    if (renderer) {
        renderer.setPixelRatio(Math.min(1.0, window.devicePixelRatio));
    }

    // Force a texture update with lower quality
    if (typeof updateCombinedTexture === 'function') {
        updateCombinedTexture();
    }
}

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
            ensureLoadingOverlayExists();

            // Initialize the scene (creates scene, camera, renderer)
            initializeScene();

            // Set up lighting
            setupLighting();

            // Create environment map for material reflections
            createEnvironmentMap();

            // Set up interactive controls
            setupControls();

            // Handle window resize event
            window.addEventListener('resize', onWindowResize);

            // Handle pointer/mouse move event for interactive elements
            document.addEventListener('pointermove', onPointerMove);

            // Track mouse position for interactive highlights
            pointer = {
                x: 0,
                y: 0
            };

            setupEventListeners();
            setupCameraControls();

            // Debug log before model loading
            console.log('Scene initialization complete, preparing to load initial model');
            console.log('Current scene children count:', scene ? scene.children.length : 0);
            console.log('Group exists:', !!group);
            if (group) {
                console.log('Group children count:', group.children.length);
            }
            
            // Start the animation loop for continuous rendering
            animate();

            // Expose key objects to window for direct access
            window.camera = camera;
            window.controls = controls;
            window.scene = scene;
            window.renderer = renderer;

            // Expose shirt mesh and material for debugging
            window.getShirtMesh = () => shirtMesh;
            window.getShirtMaterial = () => shirtMaterial;
            
            // IMPORTANT: Remove any shadow effects by ensuring no full-decal is present at startup
            setTimeout(() => {
                if (shirtMesh) {
                    // Force remove any full-decal layer that might be causing shadow effects
                    const fullDecalLayer = shirtMesh.children.find(child => child.name === 'full-decal');
                    if (fullDecalLayer) {
                        console.log('Force removing shadow effects layer at initialization');
                        shirtMesh.remove(fullDecalLayer);
                        if (fullDecalLayer.material) {
                            if (fullDecalLayer.material.map) {
                                fullDecalLayer.material.map.dispose();
                            }
                            fullDecalLayer.material.dispose();
                        }
                        
                        // Update state
                        isFullTexture = false;
                        updateState({ isFullTexture: false, fullDecal: null });
                        
                        // Force a render
                        if (renderer && scene && camera) {
                            renderer.render(scene, camera);
                        }
                    }
                }
            }, 100); // Run shortly after initialization

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
                toggleRotation();
            };

            // Add direct zoom camera function to window
            window.directZoomCamera = function (direction) {
                zoomCamera(direction);
            };

            // Load initial model
            loadModel('./models/tshirt.glb')
                .then(() => {
                    // Debug log after model loading
                    console.log('Model loading complete');
                    console.log('Current scene children count:', scene ? scene.children.length : 0);
                    console.log('Group exists:', !!group);
                    if (group) {
                        console.log('Group children count:', group.children.length);
                        // Check if we have exactly one model
                        if (group.children.length !== 1) {
                            console.warn('Unexpected number of models in the scene:', group.children.length);
                        }
                    }
                    
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
    
    // Disable shadow mapping completely to fix dark shadow issues
    renderer.shadowMap.enabled = false;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Apply saved theme preference if available
    if (window.currentThemeIsDark !== undefined) {
        const isDarkMode = window.currentThemeIsDark;
        if (isDarkMode) {
            renderer.setClearColor(0x111827); // Match CSS dark bg
        } else {
            renderer.setClearColor(0xf8fafc); // Match CSS light bg
        }
    } else {
        // Default to dark theme
        renderer.setClearColor(0x111827);
    }

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

    // Ambient light for base illumination (increased intensity to compensate for disabled shadows)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Main key light (simulating window/studio key light)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 7);
    // Disable shadow casting completely to fix dark shadow issues
    mainLight.castShadow = false;

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

        // Create distinct materials for each face to simulate a photography studio environment - using brighter colors
        const materials = [
            // Right side - bright light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Brighter white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf0f0f0, 'y')
            }),
            // Left side - bright light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Brighter white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf0f0f0, 'y')
            }),
            // Top - bright light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Bright white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf8f8f8, 'z', true)
            }),
            // Bottom - lighter floor
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xeeeeee, // Light gray
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xdddddd, 'x')
            }),
            // Back - bright backdrop
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Bright white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf0f0f0, 'y')
            }),
            // Front - bright
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Bright white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf0f0f0, 'y')
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

    // Configure mouse buttons - disable right mouse button panning
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: null // Disable right mouse button functionality
    };

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

// Modify the function definition to export it
export function setupEventListeners() {
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
                // Use proper zoom in method for newer versions of OrbitControls
                if (typeof controls.zoomIn === 'function') {
                    controls.zoomIn(1.1);
                } else if (typeof controls.dollyIn === 'function') {
                    controls.dollyIn(1.1);
                } else {
                    // Fallback to manually adjusting zoom
                    zoomCamera('in');
                }
            } else {
                // Use proper zoom out method for newer versions of OrbitControls
                if (typeof controls.zoomOut === 'function') {
                    controls.zoomOut(1.1);
                } else if (typeof controls.dollyOut === 'function') {
                    controls.dollyOut(1.1);
                } else {
                    // Fallback to manually adjusting zoom
                    zoomCamera('out');
                }
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

    // Add editor mode handling for event propagation
    renderer.domElement.addEventListener('mousedown', function (event) {
        // Only allow orbit controls when not in editor mode
        if (editorMode) {
            // Let the 3D editor handle the events
            // No need to call preventDefault as the editor will manage interactions
            return;
        }

        // Original event handling code for non-editor mode
        // ... existing code ...
    });
}

// Set initial defaults
function initializeDefaultState() {
    // Initialize the state with values that match with the visual state
    if (!state.color) {
        updateState({ color: '#FFFFFF' }); // White
    }

    // Always ensure full texture is disabled by default
    updateState({ 
        isFullTexture: false,
        fullDecal: null,
        currentModel: currentModelType
    });

    console.log('Default state initialized:', state);
    
    // Apply the current color from state or default to white
    if (shirtMaterial && state.color) {
        updateShirtColor(state.color);
    }

        // Make sure any fullDecal is properly aligned with visibility state
        if (fullDecal) {
            fullDecal.visible = state.isFullTexture;
            console.log(`Setting fullDecal visibility to: ${state.isFullTexture}`);
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
            
            // Even if the model is already loaded, ensure the canvas layer has the optimized settings
            const canvasLayer = shirtMesh.children.find(child => child.name === 'canvas-layer');
            if (canvasLayer) {
                // Apply optimized material properties if the existing material doesn't have them
                if (canvasLayer.material) {
                    if (!canvasLayer.material.depthTest) {
                        console.log('Updating canvas layer with improved material settings');
                        canvasLayer.material.depthTest = true;
                        canvasLayer.material.depthWrite = false;
                        canvasLayer.material.blending = THREE.NormalBlending;
                        canvasLayer.material.needsUpdate = true;
                        canvasLayer.renderOrder = 1;
                        
                        // Position adjustments
                        canvasLayer.position.z = 0.002;
                        canvasLayer.scale.set(1.0003, 1.0003, 1.0003);
                    }
                }
            }
            
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

        // Reset references to avoid duplicates
        fullDecal = null;
        shirtMesh = null;
        shirtMaterial = null;
        
        // Perform a complete cleanup of the scene
        // This is crucial to prevent double-loading of models
        if (group) {
            console.log('Cleaning up existing scene objects');
            
            // Traverse the entire group to find and dispose all resources
            const cleanupObject = (obj) => {
                if (obj.children && obj.children.length > 0) {
                    // Create a copy of the children array since we'll be modifying it
                    const children = [...obj.children];
                    children.forEach(child => {
                        cleanupObject(child);
                    });
                }
                
                // Dispose of geometry and materials
                if (obj.geometry) {
                    obj.geometry.dispose();
                }
                
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (obj.material.map) obj.material.map.dispose();
                        obj.material.dispose();
                    }
                }
                
                // Remove from parent
                if (obj.parent) {
                    obj.parent.remove(obj);
                }
            };
            
            // Create a copy of the children array to avoid modification issues during iteration
            const groupChildren = [...group.children];
            groupChildren.forEach(child => {
                cleanupObject(child);
            });
            
            // Ensure the group is actually empty
            if (group.children.length > 0) {
                console.warn('Some children remained in the group after cleanup');
                while (group.children.length > 0) {
                    group.remove(group.children[0]);
                }
            }
        }
        
        // Ensure the loader exists
        if (!gltfLoader) {
            try {
                // Try to import GLTFLoader if it hasn't been already
                if (typeof GLTFLoader === 'undefined' && typeof THREE !== 'undefined') {
                    console.warn('GLTFLoader not available directly, trying to access through THREE');
                    // Check if THREE.GLTFLoader exists
                    if (THREE.GLTFLoader) {
                        gltfLoader = new THREE.GLTFLoader();
                    } else {
                        console.error('THREE.GLTFLoader not available');
                        reject(new Error('GLTFLoader not available'));
                        return;
                    }
                } else {
                    // Regular import was successful
                    gltfLoader = new GLTFLoader();
                }
                console.log('Created new GLTF loader');
            } catch (error) {
                console.error('Failed to create GLTF loader:', error);
                reject(error);
                return;
            }
        }

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

    // Debug the model
    console.log('Loaded model structure:', gltf);
    
    // Clear existing shirt mesh references before setting new ones
    shirtMesh = null;
    shirtMaterial = null;
    
    // Check if any meshes have existing materials and identify the shirt mesh
    model.traverse((obj) => {
        if (obj.isMesh && obj.material) {
            console.log('Original mesh material found:', {
                name: obj.name,
                type: obj.material.type,
                color: obj.material.color ? '#' + obj.material.color.getHexString() : 'No color',
                map: obj.material.map ? 'Has texture map' : 'No texture map'
            });
            
            // Explicitly disable shadows on all meshes
            obj.castShadow = false;
            obj.receiveShadow = false;
            
            // Set the shirt mesh if we haven't found one yet
            if (!shirtMesh) {
                console.log(`Setting shirt mesh to first found mesh: ${obj.name}`);
                shirtMesh = obj;
                
                // Initially set the shirt visible - changed from invisible
                obj.visible = true;
                
                // Use a simple standard material with optimized properties for a base layer
                const simpleMaterial = new THREE.MeshStandardMaterial({
                    color: color || 0xffffff,
                    roughness: 0.7,
                    metalness: 0.1,
                    side: THREE.DoubleSide,
                    // Set this to render first with proper depth writing
                    depthWrite: true,
                    depthTest: true,
                    // Set base render order
                    renderOrder: 0
                });
                
                // Apply the simple material
                shirtMaterial = simpleMaterial;
                shirtMesh.material = simpleMaterial;
                // Set render order for base shirt
                shirtMesh.renderOrder = 0;
                
                // Ensure clean geometry for proper decal rendering
                if (shirtMesh.geometry) {
                    // Make sure normals are computed for proper lighting
                    shirtMesh.geometry.computeVertexNormals();
                    
                    // Make sure UVs are clean
                    if (!shirtMesh.geometry.attributes.uv) {
                        console.warn('Shirt mesh has no UV coordinates - this may cause decal issues');
                    }
                }
                
                // Store a reference to this simplified material
                window.originalShirtMaterial = simpleMaterial.clone();
            }
        }
    });

    // Apply model settings
    model.scale.set(
        settings.scale,
        settings.scale,
        settings.scale
    );

    model.position.copy(settings.position);
    model.rotation.copy(settings.rotation || new THREE.Euler(0, 0, 0));

    // Ensure group exists
    if (!group) {
        group = new THREE.Group();
        scene.add(group);
    }
    
    // Make sure group is empty before adding new model
    while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
    }

    // Add model to the group
    console.log('Adding new model to the scene group');
    group.add(model);
    
    // Log children count after addition
    console.log(`Scene group now has ${group.children.length} children`);

    // Track all meshes in the model
    const meshes = [];

    // Find all meshes in the model
    model.traverse((obj) => {
        if (obj.isMesh) {
            meshes.push(obj);

            // Clear any existing children to prevent duplicate layers
            if (obj.children && obj.children.length > 0) {
                const childrenToRemove = [...obj.children];
                childrenToRemove.forEach((child) => {
                    obj.remove(child);
                    // Dispose resources
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                });
            }
        }
    });

    if (shirtMesh) {
        // Clone and store the original material
        shirtMaterial = shirtMesh.material.clone();
        
        // Mark the shirt mesh with a name for identification
        shirtMesh.name = 'base-shirt';
    }

    // If there was a fullDecal previously, make sure it's removed from the old shirt mesh
    if (fullDecal) {
        if (fullDecal.parent) {
            fullDecal.parent.remove(fullDecal);
        }
        if (fullDecal.material && fullDecal.material.map) {
            fullDecal.material.map.dispose();
        }
        if (fullDecal.material) {
            fullDecal.material.dispose();
        }
        if (fullDecal.geometry) {
            fullDecal.geometry.dispose();
        }
        fullDecal = null;
    }

    // Reset the full texture state to false
    isFullTexture = false;
    updateState({ isFullTexture: false, fullDecal: null });

    console.log('Model processed successfully with simplified materials');

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

    // Initialize the 3D editor with the shirt mesh
    // Add after model is loaded and all mesh processing is complete
    if (shirtMesh) {
        // Remove all children from the shirt mesh to prevent any issues
        while (shirtMesh.children.length > 0) {
            const child = shirtMesh.children[0];
            if (child.material) {
                if (child.material.map) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }
            if (child.geometry) {
                child.geometry.dispose();
            }
            shirtMesh.remove(child);
        }
        
        init3DEditor(scene, camera, renderer, shirtMesh);
        Logger.log('3D editor initialized with shirt mesh');

        // Set a clean initial color with a slight delay to ensure proper initialization
        setTimeout(() => {
            // Get the stored color from state or use default
            const initialColor = state.color || '#FFFFFF';
            console.log('Applying delayed initial color:', initialColor);
            updateShirtColor(initialColor);
        }, 100);
    }
}


/**
 * Update the shirt color with the specified hex color
 * Simplified to prevent material rendering issues
 * @param {string} color - Hex color code (e.g. '#FF0000')
 */
export function updateShirtColor(color) {
    console.log(`Updating shirt color to ${color}`);

    // Validate color to prevent issues
    if (!color || color === 'undefined' || color === 'null') {
        console.error('Invalid color value:', color);
        color = '#FFFFFF'; // Default to white if invalid
    }

    if (!shirtMesh) {
        console.error('Shirt mesh not available - cannot update color');
        return;
    }

    // Convert to THREE color
    const threeColor = new THREE.Color(color);
    
    // Create a new simple material for the shirt
    const newMaterial = new THREE.MeshStandardMaterial({
        color: threeColor,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    // Apply the material to the shirt
    shirtMesh.material = newMaterial;
    shirtMaterial = newMaterial;
    
    // Update state to remember the color
    updateState({ color: color });
    
    // Refresh the canvas texture to ensure decals are properly displayed
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    console.log(`Shirt color updated to: ${color}`);
}

/**
 * Ensures a specific layer of the shirt exists
 * Completely redesigned for perfect decal rendering
 * @param {string} layerName - Name of the layer to ensure
 * @param {THREE.Material} material - Optional material to apply
 * @returns {THREE.Mesh} The layer mesh
 */
function ensureShirtLayer(layerName, material = null) {
    if (!shirtMesh) return null;
    
    // For the base shirt, we simply update the material of the main shirt mesh
    if (layerName === 'base-shirt') {
        // Apply material if provided
        if (material) {
            shirtMesh.material = material;
            shirtMesh.material.needsUpdate = true;
        }
        
        // Always ensure visibility
        shirtMesh.visible = true;
        
        // Apply a name to the shirt mesh for identification
        shirtMesh.name = 'base-shirt';
        
        return shirtMesh;
    }
    
    // For other layers, check if they already exist as children of shirt mesh
    let layerMesh = shirtMesh.children.find(child => child.name === layerName);
    
    if (!layerMesh) {
        // Completely new approach to layer creation:
        // Instead of creating a separate mesh with its own geometry, we'll use
        // the original mesh geometry but with a custom shader material that renders
        // the decals directly on the same surface using multipass rendering

        // Clone the original geometry but ensure it shares vertices with the original
        const geometry = shirtMesh.geometry;
        
        // Create a special material for decal rendering
        const layerMaterial = material || new THREE.MeshBasicMaterial({
            transparent: true, 
            opacity: 1.0,
            side: THREE.DoubleSide,
            // Use custom blending for better integration
            blending: THREE.CustomBlending,
            blendSrc: THREE.SrcAlphaFactor,
            blendDst: THREE.OneMinusSrcAlphaFactor,
            blendEquation: THREE.AddEquation,
            // No depth testing or writing to avoid any z-fighting
            depthTest: false,
            depthWrite: false,
            // Use a very slight alphaTest to avoid rendering fully transparent pixels
            alphaTest: 0.001
        });
        
        // Create the layer mesh
        layerMesh = new THREE.Mesh(geometry, layerMaterial);
        layerMesh.name = layerName;
        
        // CRITICAL: Don't move the mesh at all - keep it exactly aligned with the base shirt
        // and rely on render order and blending to handle the layering
        
        // Force a specific render order so it's always drawn after the base shirt
        layerMesh.renderOrder = 10;
        
        // Add to shirt mesh
        shirtMesh.add(layerMesh);
        console.log(`Created new layer: ${layerName} with perfect alignment`);
    } 
    else if (material) {
        // Update material if provided
        layerMesh.material = material;
        layerMesh.material.needsUpdate = true;
    }
    
    // Always ensure layers are visible
    layerMesh.visible = true;
    
    return layerMesh;
}

/**
 * Update the 3D editor canvas texture on the shirt
 * Completely redesigned for perfect decal rendering
 */
export function updateEditorCanvasTexture(texture) {
    if (!shirtMesh) return;
    
    console.log('Applying enhanced canvas texture to shirt');
    
    // Create or get the canvas layer
    const canvasLayer = ensureShirtLayer('canvas-layer');
    
    if (!canvasLayer) {
        console.error('Failed to create canvas layer');
        return;
    }
    
    // Optimize the texture for best quality and performance
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.premultiplyAlpha = false; // Changed from true for better alpha blending
    texture.needsUpdate = true;
    
    // Create a specialized material for the canvas layer with perfect blending
    const canvasMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0, 
        side: THREE.DoubleSide,
        // Use custom blending mode that perfectly overlays the decals
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendEquation: THREE.AddEquation,
        // Turn off depth testing/writing to avoid z-fighting completely
        depthTest: false,
        depthWrite: false,
        // Small alphaTest to avoid rendering fully transparent pixels
        alphaTest: 0.001
    });
    
    // Apply the new material
    canvasLayer.material = canvasMaterial;
    canvasLayer.material.needsUpdate = true;
    
    // Set a high render order to ensure it's rendered after the base shirt
    canvasLayer.renderOrder = 10;
    
    // Ensure visibility
    canvasLayer.visible = true;
    
    // Render the updated scene with transparent background
    if (renderer && scene && camera) {
        renderer.setClearAlpha(0);
        renderer.render(scene, camera);
    }
    
    console.log('Canvas texture applied with perfect alignment material settings');
}

// Update shirt texture with proper UV mapping
export function updateShirtTexture(imageUrl, type) {
    if (!shirtMesh) {
        console.error('Shirt mesh not available');
        return null;
    }

    if (!imageUrl) {
        console.error('Image URL is required');
        return null;
    }
    
    console.log(`Updating shirt texture with: ${imageUrl}, type: ${type}`);
    
    // Full texture mode has been completely disabled due to rendering issues
    if (type === 'full') {
        console.log('Full texture mode has been disabled due to material rendering issues');
        return null;
    }
}

// Toggle texture visibility - completely disabled
export function toggleTexture(type, active) {
    if (!shirtMesh) return;

    if (type === 'full') {
        // This functionality has been completely disabled
        console.log('Full texture overlay functionality has been completely disabled due to rendering issues');
        return;
    }
}

// Completely remove the full-decal layer
export function removeFullDecalLayer() {
    if (!shirtMesh) return false;
    
    // Find and remove any layers that might be causing issues
    const layersToRemove = [];
    
    shirtMesh.children.forEach(child => {
        if (child.name === 'full-decal' || child.name.includes('decal')) {
            layersToRemove.push(child);
        }
    });
    
    // Remove all problematic layers
    for (const layer of layersToRemove) {
        // Dispose of material resources to prevent memory leaks
        if (layer.material) {
            if (layer.material.map) {
                layer.material.map.dispose();
            }
            layer.material.dispose();
        }
        
        // Remove from parent (the shirt mesh)
        shirtMesh.remove(layer);
    }
    
    // Update state
    isFullTexture = false;
    updateState({ isFullTexture: false, fullDecal: null });
        
    // Render to show changes
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    console.log('All problematic decal layers completely removed');
    return true;
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

    // Update current model type before loading
    currentModelType = modelType;

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
const targetFPS = 90; // Reduced from 60 to 30 for better performance
const frameInterval = 1000 / targetFPS;
let animationFrameId = null; // Track the animation frame for possible cancellation
let isRendering = true; // Flag to control rendering

// Animation loop with optimizations
function animate(currentTime) {
    // Only request animation frame if rendering is active
    if (isRendering) {
        animationFrameId = requestAnimationFrame(animate);
    }

    // Limit frame rate for better performance
    const elapsed = currentTime - lastFrameTime;
    if (elapsed < frameInterval) return;

    // Calculate actual FPS
    const actualFPS = 1000 / elapsed;
    lastFrameTime = currentTime - (elapsed % frameInterval);

    // Track performance metrics
    if (window.performanceMetrics) {
        // Track slow frames (frames taking longer than 50ms, which is 20fps)
        if (elapsed > 50) {
            window.performanceMetrics.slowFrames++;
        }

        // Keep a rolling average of recent frame rates
        window.performanceMetrics.frameRates.push(actualFPS);
        if (window.performanceMetrics.frameRates.length > 60) {
            window.performanceMetrics.frameRates.shift();
        }
    }

    // Increment performance check counter
    performanceCheckCounter++;

    // Check for performance issues periodically
    checkPerformance();

    // Start performance measurement
    Performance.start('render-frame');

    // Check if we're in editing mode (use editorMode flag directly)
    const isInEditingMode = editorMode;

    // Only update camera if needed (rotation active or during transitions)
    // AND not in editing mode (unless it's a view transition)
    const needsCameraUpdate = (window.GLOBAL_ROTATION_ENABLED === true ||
        isInViewTransition() ||
        (controls && controls.autoRotate)) &&
        (!isInEditingMode || isInViewTransition());

    // Only update and render if something has changed
    if (needsCameraUpdate && group) {
        // Only update camera position if auto-rotation is enabled
        if (window.GLOBAL_ROTATION_ENABLED === true && group && !isInEditingMode) {
            // Update rotation based on elapsed time (for smooth animation)
            const rotationSpeed = 0.005 * (elapsed / 16); // Normalized for ~60fps
            group.rotateOnWorldAxis(rotationAxis, rotationSpeed);
        }

        // Update controls
        if (controls) {
            controls.update();
        }
    }

    // Always render the scene if it exists
    if (scene && camera && renderer) {
        renderer.render(scene, camera);
    }

    // End performance measurement
    Performance.end('render-frame');

    // Force garbage collection on some browsers (Chrome)
    if (performanceCheckCounter % 300 === 0 && window.gc) {
        try {
            window.gc();
        } catch (e) {
            // Garbage collection not available
        }
    }
}

// Add a page visibility listener to pause rendering when tab is not visible
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        // Pause rendering when tab is not visible
        isRendering = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    } else {
        // Resume rendering when tab becomes visible
        isRendering = true;
        if (!animationFrameId) {
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(animate);
        }
    }
});

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

/**
 * Update theme background color for dark/light mode
 * @param {boolean} isDarkMode - Whether to use dark mode theme
 */
export function updateThemeBackground(isDarkMode) {
    console.log(`Updating theme background: ${isDarkMode ? 'dark' : 'light'} mode`);

    // Store the current theme preference for later use
    window.currentThemeIsDark = isDarkMode;

    if (!renderer) {
        console.log('Renderer not available yet, theme will be applied when renderer is initialized');
        // Store the preference for later when the renderer is available
        window.pendingThemeUpdate = isDarkMode;
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

// Add this new function for direct camera zooming
function zoomCamera(direction) {
    if (!camera) {
        console.warn('Camera not available for zoom operation');
        return;
    }

    console.log('Direct camera zoom:', direction);

    // Calculate the zoom factor based on direction
    const zoomFactor = direction === 'in' ? 0.8 : 1.25;

    // Get the current camera position
    const currentPosition = camera.position.clone();

    // Calculate target position (closer or farther in the same direction)
    const targetPosition = currentPosition.clone().multiplyScalar(zoomFactor);

    // Store target for animation
    targetCameraPosition.copy(targetPosition);

    // Setup animation parameters
    const startTime = performance.now();
    const duration = 600; // animation duration in milliseconds
    const startPosition = currentPosition.clone();

    // Animate the zoom
    function animateZoom() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Use easing function for smooth animation
        const eased = easeOutCubic(progress);

        // Interpolate between start and target positions
        const newPosition = startPosition.clone().lerp(targetPosition, eased);
        camera.position.copy(newPosition);

        // Update camera and controls
        camera.updateProjectionMatrix();
        if (controls) controls.update();

        // Render the scene
        if (renderer && scene) {
            renderer.render(scene, camera);
        }

        // Continue animation if not finished
        if (progress < 1) {
            requestAnimationFrame(animateZoom);
        } else {
            console.log('Zoom animation complete');
        }
    }

    // Start the animation
    animateZoom();
}

// Easing function for smooth animation
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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

    return rotationEnabled;
}

// Add a new function to set fabric type and update material
export function setFabricType(fabricType) {
    // Function has been removed - this is a placeholder for compatibility
    console.log(`Fabric type functionality has been removed.`);
    // The default cotton fabric is used
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

        // Check renderer info using the recommended approach
        let rendererInfo = 'Unknown';
        try {
            // Use the standard RENDERER property which is now properly exposed
            rendererInfo = gl.getParameter(gl.RENDERER);
            console.log('Graphics hardware:', rendererInfo);
        } catch (e) {
            console.warn('Could not get renderer info:', e);
        }

        // Check for mobile/integrated GPU that might struggle with complex models
        const isMobileGPU = /(mali|adreno|powervr|intel)/i.test(rendererInfo);
        if (isMobileGPU) {
            console.warn('Mobile or integrated GPU detected, performance may be limited');
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

/**
 * Toggle 3D editor mode on/off
 * @param {boolean} active - Whether editor mode should be active
 */
export function toggleEditorMode(active, view = null) {
    const currentView = view || state.cameraView || 'front';
    editorMode = active;

    // If we have the 3d-editor module available, use its enhanced edit mode
    // Use the previously imported 3D editor module instead of dynamic import
    if (typeof init3DEditor !== 'undefined') {
        // Convert camera view to edit area view name (convert 'front' format to 'front')
        const editAreaName = currentView.replace('-', '_');
        // Check if toggleEditMode exists in the global scope
        if (window.editor3D && window.editor3D.toggleEditMode) {
            window.editor3D.toggleEditMode(editAreaName, active);
        }
    } else {
        console.warn('3D editor module not available');
    }

    // If editor mode is enabled, we need to disable orbit controls temporarily
    if (controls) {
        controls.enabled = !active;
    }

    // Notify the system of editor mode change
    updateState({ editorMode: active });

    // Additional UI feedback
    const viewArea = document.querySelector(`.camera-view-btn[data-view="${currentView}"]`);
    if (viewArea) {
        if (active) {
            viewArea.classList.add('editing');
        } else {
            viewArea.classList.remove('editing');
        }
    }

    // Dispatch event for UI components to respond to editor mode change
    window.dispatchEvent(new CustomEvent('editor-mode-changed', {
        detail: { active, view: currentView }
    }));

    // Use global console to log (to avoid any issues with intermediates)
    try {
        window.console.log('Editor mode ' + (active ? 'enabled' : 'disabled') + ' for view: ' + currentView);
    } catch (e) {
        // Silently fail if logging doesn't work
    }
}

/**
 * Lock camera to a specific view and disable controls
 * @param {string} view - The view to lock to (front, back, left, right)
 * @param {boolean} lock - Whether to lock (true) or unlock (false)
 */
export function lockCameraToView(view, lock = true) {
    if (!controls || !camera || !initialized) {
        console.warn('Cannot lock camera: scene not fully initialized');
        return false;
    }

    // First change to the desired view
    changeCameraView(view);

    // Wait for any view transition to complete
    const checkTransition = () => {
        if (isViewTransitioning) {
            // If still in transition, wait a bit and check again
            setTimeout(checkTransition, 100);
            return;
        }

        // Apply lock after transition is complete
        if (lock) {
            // Save current control settings
            if (!controlsStateBackup) {
                controlsStateBackup = {
                    enableRotate: controls.enableRotate,
                    enableZoom: controls.enableZoom,
                    enablePan: controls.enablePan,
                    autoRotate: controls.autoRotate
                };
            }

            // Disable controls
            controls.enableRotate = false;
            controls.enableZoom = false;
            controls.enablePan = false;

            // Ensure auto-rotate is off
            if (controls.autoRotate) {
                controls.autoRotate = false;
            }

            // Update state
            cameraLocked = true;
            lockedCameraView = view;

            console.log(`Camera locked to ${view} view`);
        } else {
            // Unlock - restore previous settings
            if (controlsStateBackup) {
                controls.enableRotate = controlsStateBackup.enableRotate;
                controls.enableZoom = controlsStateBackup.enableZoom;
                controls.enablePan = controlsStateBackup.enablePan;
                controls.autoRotate = controlsStateBackup.autoRotate;

                // Clear backup
                controlsStateBackup = null;
            } else {
                // If no backup, use defaults
                controls.enableRotate = true;
                controls.enableZoom = true;
                controls.enablePan = true;
            }

            // Update state
            cameraLocked = false;
            lockedCameraView = null;

            console.log('Camera unlocked');
        }

        // Force a render update
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    };

    // Start the transition check
    checkTransition();

    return true;
}

// Add state variables to track camera lock
let cameraLocked = false;
let lockedCameraView = null;
controlsStateBackup = null;

/**
 * Check if camera is currently locked
 * @returns {boolean} True if camera is locked
 */
export function isCameraLocked() {
    return cameraLocked;
}

/**
 * Get the currently locked view (if any)
 * @returns {string|null} The locked view or null if not locked
 */
export function getLockedCameraView() {
    return lockedCameraView;
}