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
        scale: 1.2, // Consistent scale for t-shirt across all devices
        position: new THREE.Vector3(0, 0, 0),
        mobilePosition: new THREE.Vector3(0, 0.08, 0), // Increased Y value to position model higher on mobile
        mobileScale: 1.4, // Same scale as desktop for consistent sizing

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
        scale: 1.1,
        position: new THREE.Vector3(0, -1.5, 0),
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
                        loadingOverlay.classList.add('hidden');
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
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (!loadingOverlay) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';

        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        overlay.appendChild(spinner);

        const message = document.createElement('p');
        message.id = 'loading-message';
        message.className = 'error-message';
        message.textContent = 'Loading 3D model...';
        overlay.appendChild(message);

        document.body.appendChild(overlay);
    }
}

function initializeScene() {
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.classList.add('full-width');
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.classList.add('rotating');
    }

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
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enable shadow mapping with high quality settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    
    // Fix deprecated properties warnings by using recommended new properties
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; // Increased for better color vibrancy

    // Enable physically correct lighting for more realistic appearance
    renderer.physicallyCorrectLights = true;

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

    // Initialize decal lighting state
    if (window.decalsAffectedByLighting === undefined) {
        window.decalsAffectedByLighting = false;
    }

    // Make sure controls reflect the current state
    if (window.updateDecalLightingToggle) {
        window.updateDecalLightingToggle(window.decalsAffectedByLighting);
    }
    
    // Ensure controls are locked/unlocked based on lighting state
    // Use force=true to ensure it runs regardless of state
    if (typeof toggleDecalControlsLock === 'function') {
        console.log('Initializing decal controls lock state');
        toggleDecalControlsLock(window.decalsAffectedByLighting || false, true);
    }

    // Also ensure the button is visible
    const decalToggleBtn = document.getElementById('decal-lighting-toggle');
    if (decalToggleBtn) {
        decalToggleBtn.style.display = 'flex';
        decalToggleBtn.style.visibility = 'visible';
        decalToggleBtn.style.opacity = '1';
        console.log('Ensuring decal lighting toggle button is visible');
    }
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
    console.log('Setting up tailored fabric-friendly lighting');
    
    // Clear existing lights first to prevent stacking
    scene.children.forEach(child => {
        if (child.isLight) {
            scene.remove(child);
        }
    });
    
    // Studio-style lighting setup optimized for fabric rendering
    
    // Main key light - slightly warmer white for natural look
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
    keyLight.position.set(2, 2, 2);
    keyLight.castShadow = true;
    
    // Configure high-quality shadows
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -2;
    keyLight.shadow.camera.right = 2;
    keyLight.shadow.camera.top = 2;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.normalBias = 0.02; // Prevents shadow acne on fabric
    scene.add(keyLight);
    
    // Fill light - cooler tint from opposite side
    const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.6);
    fillLight.position.set(-2, 0, -2);
    fillLight.castShadow = false;
    scene.add(fillLight);
    
    // Rim light - for fabric edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 3, -3);
    rimLight.castShadow = false;
    scene.add(rimLight);
    
    // Bottom fill light - subtle uplight to prevent total shadows underneath
    const bottomLight = new THREE.DirectionalLight(0xffffee, 0.2);
    bottomLight.position.set(0, -3, 0);
    bottomLight.castShadow = false;
    scene.add(bottomLight);
    
    // Very subtle ambient light - allows shadows to be more defined
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    // Add hemisphere light for natural environment simulation
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xc4c4c4, 0.3);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);
    
    // Enable shadows globally with high quality
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    console.log('Fabric-optimized lighting setup complete');
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

    // Higher resolution environment maps for better fabric reflections
    const cubeMapSize = isWebGL2 ? 512 : 256;

    try {
        // Create an environment map optimized for fabric materials
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(cubeMapSize, {
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            magFilter: THREE.LinearFilter,
            type: textureType,
            encoding: THREE.sRGBEncoding
        });

        // Create cube camera for environment map
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        scene.add(cubeCamera);

        // Create a realistic studio environment for fabric rendering
        const envScene = new THREE.Scene();

        // Create a larger box for environment
        const envGeometry = new THREE.BoxGeometry(200, 200, 200);

        // Create materials that simulate a soft photo studio with gentle gradients
        const materials = [
            // Right side - soft warm light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xfff8f0, // Very slight warm tone
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xfff8f0, 0xffeedd, 'y')
            }),
            // Left side - soft cool light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xf0f8ff, // Very slight cool tone
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xf0f8ff, 0xe6f0ff, 'y')
            }),
            // Top - bright but diffused light
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xffffff, // Pure white for top light
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xffffff, 0xf8f8f8, 'z', true)
            }),
            // Bottom - soft gradient floor for subtle reflections
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xeeeeee, // Light gray
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xf5f5f5, 0xe0e0e0, 'x')
            }),
            // Back - clean backdrop
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xf7f7f7, // Off-white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xf7f7f7, 0xeeeeee, 'y')
            }),
            // Front - clean gradient
            new THREE.MeshBasicMaterial({
                side: THREE.BackSide,
                color: 0xf7f7f7, // Off-white
                onBeforeCompile: (shader) => addGradientToShader(shader, 0xf7f7f7, 0xeeeeee, 'y')
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

            // Replace the fragment shader with a smooth gradient
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
                
                // Apply smoothstep for softer gradient transitions
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

        // Add soft lighting to the environment scene
        // Main overhead light for soft fabric-friendly light
        const envLight = new THREE.DirectionalLight(0xffffff, 1.5);
        envLight.position.set(0, 10, 0);
        envScene.add(envLight);
        
        // Secondary light for fill
        const envLight2 = new THREE.DirectionalLight(0xfff5e6, 0.8);
        envLight2.position.set(5, 3, 5);
        envScene.add(envLight2);
        
        // Tertiary light from opposite side
        const envLight3 = new THREE.DirectionalLight(0xf0f8ff, 0.6);
        envLight3.position.set(-5, 3, -5);
        envScene.add(envLight3);
        
        // Ambient light to prevent completely dark areas
        const envAmbient = new THREE.AmbientLight(0xffffff, 0.4);
        envScene.add(envAmbient);

        // Update the environment map
        cubeCamera.update(renderer, envScene);

        // Add the environment map to the scene with adjusted intensity for fabric
        scene.environment = cubeRenderTarget.texture;
        // Reduce intensity for minimal reflections in fabric
        scene.environmentIntensity = 0.5; 
        
        // Apply environment map to all materials in the scene
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material) {
                // For physical materials, configure for fabric
                if (obj.material.isMeshPhysicalMaterial) {
                    obj.material.envMap = cubeRenderTarget.texture;
                    obj.material.envMapIntensity = 0.15; // Very subtle reflections for fabric
                    obj.material.needsUpdate = true;
                }
                // For standard materials
                else if (obj.material.isMeshStandardMaterial) {
                    obj.material.envMap = cubeRenderTarget.texture;
                    obj.material.envMapIntensity = 0.15; // Very subtle reflections
                    obj.material.needsUpdate = true;
                }
            }
        });

        console.log("Fabric-optimized environment map created successfully");
    } catch (error) {
        console.error("Error creating environment map:", error);
        createFallbackEnvironment();
    }
}

/**
 * Create a fabric-friendly fallback environment when advanced features aren't supported
 */
function createFallbackEnvironment() {
    // Create a simpler but still effective environment for fabric
    console.log("Creating fabric-friendly fallback environment lighting");
    
    // Add hemisphere light with sky/ground colors for natural fabric lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf0f0f0, 1.0);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Add directional lights to simulate soft studio lighting
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 0.8); // Warm main light
    mainLight.position.set(1, 1, 1);
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xf0f8ff, 0.4); // Cool fill light
    fillLight.position.set(-1, 0.5, -1);
    scene.add(fillLight);
    
    // Add subtle ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    console.log("Fallback fabric lighting configured");
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

        // Show loading overlay
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

        // Store current customization state before switching models
        const currentCustomState = {
            objects: [],
            fullDecal: fullDecal,
            isFullTexture: isFullTexture,
        };

        // If 3D editor is initialized, save its current objects
        if (window.getEditorState) {
            currentCustomState.objects = window.getEditorState();
        }

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

        // Always use white as base color
        const modelColor = new THREE.Color(0xffffff);

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

        // Special preprocessing for hoodie model
        const isHoodie = currentModelType === 'hoodie';
        if (isHoodie) {
            console.log('Special preprocessing for hoodie model to ensure clean materials');
        }

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
                
                // For hoodie model, modify the onLoad function to ensure clean materials
                if (isHoodie) {
                    console.log('Using hoodie-specific loader settings');
                    
                    // Add a preprocessing step for the hoodie model
                    const originalOnLoad = gltfLoader.onLoad;
                    gltfLoader.onLoad = function(gltf) {
                        console.log('Preprocessing hoodie model before finalizing load');
                        
                        // Important: Just remove textures, don't replace materials
                        gltf.scene.traverse((obj) => {
                            if (obj.isMesh && obj.material) {
                                console.log(`Preprocessing hoodie mesh: ${obj.name}`);
                                
                                // Keep the original material but remove textures
                                if (obj.material.map) {
                                    obj.material.map.dispose();
                                    obj.material.map = null;
                                }
                                
                                if (obj.material.normalMap) {
                                    obj.material.normalMap.dispose();
                                    obj.material.normalMap = null;
                                }
                                
                                if (obj.material.roughnessMap) {
                                    obj.material.roughnessMap.dispose();
                                    obj.material.roughnessMap = null;
                                }
                                
                                if (obj.material.bumpMap) {
                                    obj.material.bumpMap.dispose();
                                    obj.material.bumpMap = null;
                                }
                                
                                // Force material to update
                                obj.material.needsUpdate = true;
                            }
                        });
                        
                        // Call the original onLoad function
                        if (originalOnLoad) {
                            originalOnLoad(gltf);
                        }
                    };
                }

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
    
    // Get current model type
    const currentModelType = state.currentModel || 'tshirt';
    console.log(`Processing model type: ${currentModelType}`);
    
    // Create a standard cloth material for all models
    const clothMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,  // Base white color
        roughness: 0.65,  // Lower roughness for smoother appearance
        metalness: 0.0,   // No metallic properties for fabric
        side: THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
        transparent: false,
        
        // Cloth-specific properties
        sheen: 0.4,                // Slight sheen for fabric microfibers
        sheenRoughness: 0.8,       // How rough the sheen is (higher = more diffuse)
        sheenColor: new THREE.Color(0xffffff), // Color of the sheen highlight
        
        // Reduced clearcoat for less reflective surface
        clearcoat: 0.03,           // Very minimal clearcoat
        clearcoatRoughness: 0.9,   // Very rough clearcoat for minimal specular reflections
        
        // Reduced reflections
        reflectivity: 0.08,        // Minimal reflections
        envMapIntensity: 0.2,      // Very subtle environment reflections
        
        // Additional properties
        flatShading: false,        // Smooth shading
        wireframe: false,
        
        // Turn off any emissive properties
        emissive: 0x000000,
        emissiveIntensity: 0,
        
        // No maps initially
            map: null,
            normalMap: null,
            roughnessMap: null,
            metalnessMap: null,
            bumpMap: null
        });
        
    console.log(`Created standard cloth material for ${currentModelType} model`);
        
        // Track all meshes we find
        const allMeshes = [];
        
        // Apply material to ALL meshes in the model
        model.traverse((obj) => {
            if (obj.isMesh) {
                console.log(`Found mesh in model: ${obj.name}`);
                allMeshes.push(obj);
                
                // Make the mesh visible
                obj.visible = true;
                
            // Enable shadows for all meshes (consistent across all models)
            obj.castShadow = true;
            obj.receiveShadow = true;
                
                // Dispose of existing material and textures
                if (obj.material) {
                    // Log the original material
                    console.log(`Original material on ${obj.name}:`, {
                        type: obj.material.type,
                        color: obj.material.color ? '#' + obj.material.color.getHexString() : 'No color',
                        hasMap: !!obj.material.map,
                        hasNormalMap: !!obj.material.normalMap,
                        hasRoughnessMap: !!obj.material.roughnessMap
                    });
                    
                    // Dispose all textures
                    if (obj.material.map) obj.material.map.dispose();
                    if (obj.material.normalMap) obj.material.normalMap.dispose();
                    if (obj.material.roughnessMap) obj.material.roughnessMap.dispose();
                    if (obj.material.metalnessMap) obj.material.metalnessMap.dispose();
                    if (obj.material.bumpMap) obj.material.bumpMap.dispose();
                    if (obj.material.emissiveMap) obj.material.emissiveMap.dispose();
                    if (obj.material.aoMap) obj.material.aoMap.dispose();
                    if (obj.material.specularMap) obj.material.specularMap.dispose();
                    if (obj.material.envMap) obj.material.envMap.dispose();
                    
                    // Dispose the material itself
                    obj.material.dispose();
                }
                
            // Apply a clone of our standard cloth material to each mesh
            obj.material = clothMaterial.clone();
                obj.material.needsUpdate = true;
                
                // Set the first mesh as our main reference
                if (!shirtMesh) {
                    shirtMesh = obj;
                    shirtMaterial = obj.material;
                obj.name = 'base-model';
                    
                    // Store a reference to this material
                    window.originalShirtMaterial = obj.material.clone();
                }
                
                // Ensure clean geometry
                if (obj.geometry) {
                    obj.geometry.computeVertexNormals();
                }
            }
        });
        
    console.log(`Applied standard cloth material to ${allMeshes.length} meshes in the ${currentModelType} model`);

    // Check if we're on mobile
    const isMobile = window.innerWidth < 768;
    
    // Apply appropriate scale and position based on device type
    if (isMobile && settings.mobileScale && settings.mobilePosition) {
        console.log(`Applying mobile-specific settings for ${currentModelType}`);
        model.scale.set(
            settings.mobileScale,
            settings.mobileScale,
            settings.mobileScale
        );
        model.position.copy(settings.mobilePosition);
    } else {
        // Apply standard desktop scale and position
        model.scale.set(
            settings.scale,
            settings.scale,
            settings.scale
        );
        model.position.copy(settings.position);
    }

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

    // Clear any existing children to prevent duplicate layers
    if (shirtMesh) {
        if (shirtMesh.children && shirtMesh.children.length > 0) {
            const childrenToRemove = [...shirtMesh.children];
            childrenToRemove.forEach((child) => {
                shirtMesh.remove(child);
                // Dispose resources
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
    }

    // If there was a fullDecal previously, make sure it's removed
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
    
    // Force a render update
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }

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
        
        // Initialize 3D editor with the current model mesh
        init3DEditor(scene, camera, renderer, shirtMesh);
        Logger.log(`3D editor initialized with ${currentModelType} mesh`);

        // Set a clean initial color with a slight delay to ensure proper initialization
        setTimeout(() => {
            // Get the stored color from state or use default
            const initialColor = state.color || '#FFFFFF';
            console.log('Applying initial color:', initialColor);
            updateShirtColor(initialColor);
        }, 100);
    }
    
    // Apply lighting state to any existing decals after a short delay
    if (window.decalsAffectedByLighting !== undefined) {
        setTimeout(() => {
            updateExistingDecalsMaterial(window.decalsAffectedByLighting);
        }, 300);
    }
}

/**
 * Update the shirt color with the specified hex color
 * Simplified to prevent material rendering issues
 * @param {string} color - Hex color code (e.g. '#FF0000')
 */
export function updateShirtColor(color) {
    if (!shirtMesh || !shirtMaterial) {
        console.error('Model mesh not available, cannot update color');
        return;
    }
    
    // Get current model type
    const currentModelType = state.currentModel || 'tshirt';
    
    // Convert color to Three.js color if needed
    if (typeof color === 'string') {
        color = new THREE.Color(color);
    }
    
    // Special handling for hoodie model
    if (currentModelType === 'hoodie') {
        console.log('Updating hoodie colors while preserving original materials');
        
        if (group) {
            // For the hoodie, we need to update colors for all parts
            group.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                    // Only update the color of the main body parts (non-white parts)
                    const lowerName = obj.name.toLowerCase();
                    const isTrim = lowerName.includes('cuff') || 
                                   lowerName.includes('hood') || 
                                   lowerName.includes('pocket') ||
                                   lowerName.includes('white');
                    
                    // Don't change white trim parts
                    if (!isTrim) {
                        // Set color but keep everything else
                        obj.material.color = color.clone();
                        obj.material.needsUpdate = true;
                    }
                }
            });
        }
    } else {
        // Normal behavior for t-shirt
        if (shirtMaterial) {
            // Update color
            shirtMaterial.color = color;
            shirtMaterial.needsUpdate = true;
        }
    }
    
    // Update state
    updateState({ color: '#' + color.getHexString() });
    
    // Force a render update
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * Ensures a specific layer of the shirt exists
 * Completely redesigned for perfect decal rendering
 * @param {string} layerName - Name of the layer to ensure
 * @param {THREE.Material} material - Optional material to apply
 * @returns {THREE.Mesh} The layer mesh
 */
function ensureShirtLayer(layerName, material = null) {
    if (!shirtMesh) {
        console.error('Shirt mesh not available');
        return null;
    }
    
    console.log(`Ensuring shirt layer exists: ${layerName}`);
    
    // Find existing layer
    let layerMesh = shirtMesh.children.find(child => child.name === layerName);
    
    if (!layerMesh) {
        // Create a new layer if it doesn't exist
        const shirtGeometry = shirtMesh.geometry.clone();
        
        // Create a temporary material if one isn't provided
        const tempMaterial = material || new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1.0,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending
        });
        
        // Create new mesh with the same geometry
        layerMesh = new THREE.Mesh(shirtGeometry, tempMaterial);
        layerMesh.name = layerName;
        
        // Copy the shirt's world transform
        layerMesh.matrix.copy(shirtMesh.matrix);
        layerMesh.matrixAutoUpdate = false;
        
        // Copy UV mapping from the original mesh
        if (shirtMesh.geometry.attributes.uv) {
            layerMesh.geometry.attributes.uv = shirtMesh.geometry.attributes.uv.clone();
        }
        
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
 * Update the 3D editor canvas texture on the current model
 * Works with any model type, not just t-shirt
 */
export function updateEditorCanvasTexture(texture) {
    if (!shirtMesh) return;
    
    // Get current model type for logging
    const modelType = state.currentModel || 'tshirt';
    console.log(`Applying canvas texture to ${modelType} model`);
    
    // Remove all existing canvas layers first
    const layersToRemove = shirtMesh.children.filter(child => 
        child.name === 'canvas-layer' || 
        child.name === 'canvas-layer-front' || 
        child.name === 'canvas-layer-back'
    );
    
    for (const layer of layersToRemove) {
        if (layer.material && layer.material.map) {
            layer.material.map.dispose();
        }
        if (layer.material) {
            layer.material.dispose();
        }
        shirtMesh.remove(layer);
    }
    
    // Standardized texture settings for all clothing models
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.premultiplyAlpha = false;
    texture.needsUpdate = true;
    texture.flipY = false;
    texture.matrixAutoUpdate = false;
    texture.matrix.identity();
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Determine which material to use based on lighting toggle
    let material;
    
    if (decalsAffectedByLighting) {
        // Generate a normal map for lighting effects
        const normalMap = generateNormalMapFromTexture(texture);
        
        // Create a physical material that responds to lighting
        material = new THREE.MeshPhysicalMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0,
        side: THREE.FrontSide,
            
            // Normal map for depth and light interaction
            normalMap: normalMap,
            normalScale: new THREE.Vector2(0.3, 0.3),
            
            // Physical properties for the decal
            roughness: 0.6,
            metalness: 0.0,
            clearcoat: 0.1,
            clearcoatRoughness: 0.8,
            
            // Shadows
            shadowSide: THREE.FrontSide,
            
            // Depth settings
            alphaTest: 0.01,
            depthTest: true,
            depthWrite: true,
            
            // Additional settings
            envMapIntensity: 0.2,
            sheen: 0.1,
            sheenRoughness: 0.8,
            sheenColor: new THREE.Color(0xffffff)
        });
    } else {
        // Create a basic material that ignores lighting
        material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1.0,
            side: THREE.FrontSide,
            
            // Blending settings
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendEquation: THREE.AddEquation,
            
            // Depth settings
        depthTest: true,
        depthWrite: false,
        alphaTest: 0.001,
            
            // Color settings
        colorSpace: THREE.SRGBColorSpace,
        toneMapped: false,
        dithering: true
    });
    }
    
    material.needsUpdate = true;
    
    // Create new layer with standardized settings
    const frontLayer = ensureModelLayer('canvas-layer-front', material);
    frontLayer.renderOrder = 15;
    frontLayer.userData.modelType = modelType;
    
    // Set shadow properties based on lighting toggle
    frontLayer.castShadow = decalsAffectedByLighting;
    frontLayer.receiveShadow = decalsAffectedByLighting;
    
    // Render the updated scene
    if (renderer && scene && camera) {
        renderer.setClearAlpha(0);
        renderer.render(scene, camera);
    }
    
    console.log(`Applied texture to ${modelType} model with lighting: ${decalsAffectedByLighting}`);
}

// Helper function to generate normal maps from textures
function generateNormalMapFromTexture(texture) {
    // Create a canvas to process the texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Make sure texture has an image
    if (!texture.image) {
        console.warn('Cannot generate normal map: texture has no image');
        return null;
    }
    
    // Set canvas size to match texture
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    
    // Draw the texture to the canvas
    ctx.drawImage(texture.image, 0, 0);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Create new image data for the normal map
    const normalData = ctx.createImageData(canvas.width, canvas.height);
    const normalPixels = normalData.data;
    
    // Simple sobel operator for edge detection - basis of normal map
    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
            // Get pixel indices
            const idx = (y * canvas.width + x) * 4;
            const idxLeft = (y * canvas.width + (x - 1)) * 4;
            const idxRight = (y * canvas.width + (x + 1)) * 4;
            const idxUp = ((y - 1) * canvas.width + x) * 4;
            const idxDown = ((y + 1) * canvas.width + x) * 4;
            
            // Calculate alpha gradients for the sobel operator
            const alphaLeft = data[idxLeft + 3];
            const alphaRight = data[idxRight + 3];
            const alphaUp = data[idxUp + 3];
            const alphaDown = data[idxDown + 3];
            
            // Calculate X and Y gradients
            const gradX = ((alphaRight - alphaLeft) / 255) * 0.5 + 0.5;
            const gradY = ((alphaDown - alphaUp) / 255) * 0.5 + 0.5;
            
            // Store normal map values (RGB format)
            normalPixels[idx] = Math.floor(gradX * 255);     // R (X+)
            normalPixels[idx + 1] = Math.floor(gradY * 255); // G (Y+)
            normalPixels[idx + 2] = 255;                     // B (Z+) fully blue for minimal depth
            normalPixels[idx + 3] = data[idx + 3];           // Keep original alpha
        }
    }
    
    // Put the normal data back to the canvas
    ctx.putImageData(normalData, 0, 0);
    
    // Create a new texture from the canvas
    const normalTexture = new THREE.CanvasTexture(canvas);
    normalTexture.needsUpdate = true;
    
    // Use same settings as the original texture
    normalTexture.anisotropy = texture.anisotropy;
    normalTexture.minFilter = texture.minFilter;
    normalTexture.magFilter = texture.magFilter;
    normalTexture.wrapS = texture.wrapS;
    normalTexture.wrapT = texture.wrapT;
    normalTexture.flipY = texture.flipY;
    normalTexture.colorSpace = THREE.LinearSRGBColorSpace; // Normal maps should be linear
    
    return normalTexture;
}

// Update model texture with proper UV mapping
export function updateShirtTexture(imageUrl, type) {
    if (!shirtMesh) {
        console.error('Model mesh not available');
        return null;
    }

    if (!imageUrl) {
        console.error('Image URL is required');
        return null;
    }
    
    // Get current model type for logging
    const modelType = state.currentModel || 'tshirt';
    console.log(`Updating ${modelType} texture with: ${imageUrl}, type: ${type}`);
    
    // Check model config to see if this model accepts full textures
    const modelConfig = window.getModelConfig ? window.getModelConfig(modelType) : null;
    const acceptsFullTexture = modelConfig?.textureSettings?.acceptsFullTexture !== false;
    
    if (type === 'full') {
        if (!acceptsFullTexture) {
            console.warn(`Full texture mode not supported for ${modelType}`);
            return null;
        }
        
        // Create a texture loader
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            imageUrl,
            function(texture) {
                console.log(`Full texture loaded for ${modelType}`);
                
                // Process texture
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                
                // Determine which material to use based on lighting toggle
                let fullMaterial;
                
                if (decalsAffectedByLighting) {
                    // Generate normal map for texture
                    const normalMap = generateNormalMapFromTexture(texture);
                    
                    // Create a light-responsive material
                    fullMaterial = new THREE.MeshPhysicalMaterial({
                        map: texture,
                        transparent: true,
                        opacity: 1.0,
                        side: THREE.FrontSide,
                        
                        // Depth settings
                        alphaTest: 0.01,
                        depthTest: true,
                        depthWrite: true,
                        
                        // Light interaction properties
                        normalMap: normalMap,
                        normalScale: new THREE.Vector2(0.3, 0.3),
                        roughness: 0.6,
                        metalness: 0.0,
                        
                        // Physical properties
                        clearcoat: 0.1,
                        clearcoatRoughness: 0.8,
                        
                        // Environment map interaction
                        envMapIntensity: 0.2,
                        
                        // Fabric-like properties
                        sheen: 0.1,
                        sheenRoughness: 0.8,
                        sheenColor: new THREE.Color(0xffffff)
                    });
                } else {
                    // Create a basic material that ignores lighting
                    fullMaterial = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 1.0,
                    side: THREE.FrontSide,
                    depthTest: true,
                    depthWrite: false
                });
                }
                
                // Find and remove any existing full texture layer
                const existingFullLayer = shirtMesh.children.find(child => child.name === 'full-texture-layer');
                if (existingFullLayer) {
                    if (existingFullLayer.material.map) {
                        existingFullLayer.material.map.dispose();
                    }
                    if (existingFullLayer.material.normalMap) {
                        existingFullLayer.material.normalMap.dispose();
                    }
                    if (existingFullLayer.material) {
                        existingFullLayer.material.dispose();
                    }
                    shirtMesh.remove(existingFullLayer);
                }
                
                // Create the full texture layer
                const fullTextureLayer = new THREE.Mesh(
                    shirtMesh.geometry,
                    fullMaterial
                );
                
                fullTextureLayer.name = 'full-texture-layer';
                fullTextureLayer.renderOrder = 10;
                
                // Set shadow properties based on lighting toggle
                fullTextureLayer.castShadow = decalsAffectedByLighting;
                fullTextureLayer.receiveShadow = decalsAffectedByLighting;
                
                // Record this in fullDecal for later reference
                fullDecal = fullTextureLayer;
                
                // Add the layer to the model
                shirtMesh.add(fullTextureLayer);
                
                // Update the state
                updateState({
                    fullDecal: imageUrl,
                    isFullTexture: true,
                    stylish: true
                });
                
                // Render the scene
                if (renderer && scene && camera) {
                    renderer.render(scene, camera);
                }
                
                return fullTextureLayer;
            },
            undefined,
            function(error) {
                console.error('Error loading full texture:', error);
                return null;
            }
        );
    } else {
        console.log(`Unsupported texture type: ${type}`);
        return null;
    }
}

// Toggle texture visibility
export function toggleTexture(type, active) {
    if (!shirtMesh) return;

    const modelType = state.currentModel || 'tshirt';
    
    if (type === 'full') {
        // Check model config to see if this model accepts full textures
        const modelConfig = window.getModelConfig ? window.getModelConfig(modelType) : null;
        const acceptsFullTexture = modelConfig?.textureSettings?.acceptsFullTexture !== false;
        
        if (!acceptsFullTexture) {
            console.warn(`Full texture mode not supported for ${modelType}`);
            return;
        }
        
        console.log(`Toggling full texture visibility on ${modelType} to ${active}`);
        
        if (fullDecal && fullDecal.parent === shirtMesh) {
            fullDecal.visible = active;
            
            // Update state to reflect texture visibility
            updateState({ 
                isFullTexture: active,
                stylish: active 
            });
            
            // Re-render to show changes
            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        } else if (active && state.fullDecal) {
            // If trying to enable but fullDecal is not attached, try to reapply the texture
            updateShirtTexture(state.fullDecal, 'full');
        }
    }
}

// Completely remove the full-decal layer
export function removeFullDecalLayer() {
    if (!shirtMesh) {
        console.warn('No model mesh available, cannot remove texture layers');
        return false;
    }

    console.log(`Removing texture layers from current ${state.currentModel || 'tshirt'} model`);
    
    // Find any existing full texture layers by name
    const layersToRemove = shirtMesh.children.filter(child => 
        child.name === 'full-decal' || 
        child.name === 'full-texture-layer'
    );
    
    console.log(`Found ${layersToRemove.length} texture layers to remove`);
    
    // Remove each layer with proper cleanup
    for (const layer of layersToRemove) {
        // Dispose of material resources to prevent memory leaks
        if (layer.material) {
            if (layer.material.map) {
                layer.material.map.dispose();
            }
            layer.material.dispose();
        }
        
        // Remove from parent mesh
        shirtMesh.remove(layer);
    }
    
    // Update state
    isFullTexture = false;
    updateState({ isFullTexture: false, fullDecal: null });
        
    // Render to show changes
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    console.log('All texture layers completely removed');
    return true;
}

// Change the current 3D model
export function changeModel(modelType) {
    console.log(`Changing model to: ${modelType}`);

    // First check if the modelType is valid
    // We should make this more extensible for future models
    const validModels = ['tshirt', 'hoodie']; // Add more models here as they are created
    if (!validModels.includes(modelType)) {
        console.error(`Invalid model type: ${modelType}`);
        return Promise.reject(new Error(`Invalid model type: ${modelType}`));
    }

    // Get the model path based on the model type
    const modelPath = `./models/${modelType}.glb`;

    console.log(`Model path resolved to: ${modelPath}`);

    // Show loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.querySelector('p').textContent = `Loading ${modelType} model...`;
    }

    // Already on this model, no need to change
    if (modelType === currentModelType && shirtMesh) {
        console.log(`Already on ${modelType} model`);
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        return Promise.resolve();
    }

    // Store current state for transfer to new model
    let currentObjects = [];
    let currentColor = null;
    
    // Save the current model color for transferring to the new model
    if (shirtMaterial) {
        currentColor = shirtMaterial.color.clone();
    }
    
    // Save customization state (if available)
    if (window.getEditorState) {
        try {
            currentObjects = window.getEditorState();
            console.log(`Preserved ${currentObjects.length} customizations for transfer to new model`);
        } catch (e) {
            console.warn('Could not preserve customization state:', e);
        }
    }

    // Save current lighting state
    const currentLightingState = window.decalsAffectedByLighting;

    // Update current model type before loading
    currentModelType = modelType;
    
    // Update state with the new model type
    updateState({ currentModel: modelType });
    
    // Update texture mapper to use the new model type
    if (window.setModelType) {
        window.setModelType(modelType);
    }

    // Load the new model with standardized settings
    return loadModel(modelPath)
        .then(() => {
            console.log(`Model changed to ${modelType}`);

            // Apply the saved color to ensure consistent appearance
            if (currentColor && shirtMaterial) {
                shirtMaterial.color.copy(currentColor);
                shirtMaterial.needsUpdate = true;
                console.log('Applied preserved color to new model');
            } else if (state.color && shirtMaterial) {
                // Use color from state
                shirtMaterial.color.copy(new THREE.Color(state.color));
                shirtMaterial.needsUpdate = true;
                console.log('Applied state color to new model');
            }
            
            // Transfer customizations after a short delay to ensure model is fully loaded
            setTimeout(() => {
                if (currentObjects && currentObjects.length > 0 && window.restoreEditorState) {
                    try {
                        window.restoreEditorState(currentObjects);
                        console.log(`Transferred ${currentObjects.length} customizations to new model`);
                    } catch (e) {
                        console.warn('Error transferring customizations to new model:', e);
                    }
                }
                
                // Ensure lighting effects are properly applied
                if (currentLightingState !== undefined) {
                    window.decalsAffectedByLighting = currentLightingState;
                    updateExistingDecalsMaterial(currentLightingState);
                    
                    // Update UI if necessary
                    if (window.updateDecalLightingToggle) {
                        window.updateDecalLightingToggle(currentLightingState);
                    }
                }
            }, 300);

            // Reset camera to standard position for the new model
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

    // Check for zoom and reset buttons and create if missing
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
    requestAnimationFrame(animate);
    
    // Performance optimization - Don't render if not visible
    if (!renderer.domElement.offsetParent) {
        return;
    }
    
    // Update controls
    if (controls) {
        controls.update();
    }
    
    // Check if we're in a view transition
    if (isInViewTransition()) {
        animateViewTransition();
    }
    
    // Handle auto-rotation if enabled
    if (isAutoRotating && group && !isViewTransitioning && !manualRotationActive && !editorMode) {
        // Rotate around the updated axis
        const rotationAxis = updateRotationAxisForCurrentView();
        group.rotateOnAxis(rotationAxis, rotationSpeed);
    }
    
    // Performance monitoring
    checkPerformance();

    // Improved render quality settings
    if (renderer && scene && camera) {
        // Check if shadows need updating
        if (renderer.shadowMap.enabled && renderer.shadowMap.needsUpdate) {
            renderer.shadowMap.needsUpdate = false;
        }
        
        // Apply any pending material updates
        scene.traverse((obj) => {
            if (obj.isMesh && obj.material && obj.material.needsUpdate) {
                obj.material.needsUpdate = false;
            }
        });
        
        // Render with better quality
        renderer.render(scene, camera);
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

        // Store previous mobile state for comparison
        const wasMobile = camera.userData.isMobile || false;
        
        // Determine if we're in mobile mode but use a continuous scale factor
        const isMobile = width < 768;
        camera.userData.isMobile = isMobile;
        
        // Calculate a responsive scale factor between 0 (mobile) and 1 (desktop)
        // This creates a smooth transition zone between 480px and 768px
        const mobileBreakpoint = 768;
        const smallMobileBreakpoint = 480;
        let responsiveFactor = 1; // Default to desktop (1)
        
        if (width <= smallMobileBreakpoint) {
            // Full mobile mode
            responsiveFactor = 0;
        } else if (width < mobileBreakpoint) {
            // Transition zone - calculate a factor between 0 and 1
            responsiveFactor = (width - smallMobileBreakpoint) / (mobileBreakpoint - smallMobileBreakpoint);
        }
        
        // Update camera aspect ratio
        camera.aspect = width / height;
        
        // Smoothly adjust FOV based on responsive factor
        const mobileFOV = 35;
        const desktopFOV = 25;
        camera.fov = desktopFOV + (mobileFOV - desktopFOV) * (1 - responsiveFactor);
        
        // Apply responsive scaling to models if we have a current model
        if (currentModelType && group) {
            const settings = modelSettings[currentModelType];
            if (settings) {
                // Only attempt to adjust if we have both desktop and mobile settings
                if (settings.scale && (settings.mobileScale !== undefined) && 
                    settings.position && (settings.mobilePosition !== undefined)) {
                    
                    // Calculate interpolated scale based on responsive factor
                    const interpolatedScale = settings.mobileScale + 
                        (settings.scale - settings.mobileScale) * responsiveFactor;
                    
                    // Calculate interpolated position
                    const interpolatedPosition = new THREE.Vector3();
                    interpolatedPosition.lerpVectors(
                        settings.mobilePosition,
                        settings.position,
                        responsiveFactor
                    );
                    
                    console.log(`Responsive sizing: factor=${responsiveFactor.toFixed(2)}, scale=${interpolatedScale.toFixed(2)}`);
                    
                    // Apply to each model in the group
                    group.children.forEach(model => {
                        // Apply interpolated scale
                        model.scale.set(
                            interpolatedScale,
                            interpolatedScale,
                            interpolatedScale
                        );
                        
                        // Apply interpolated position
                        model.position.copy(interpolatedPosition);
                    });
                } else if (isMobile !== wasMobile) {
                    // Fallback to binary switch if we don't have both values defined
                    group.children.forEach(model => {
                        if (isMobile && settings.mobileScale && settings.mobilePosition) {
                            console.log(`Switching to mobile layout for ${currentModelType}`);
                            model.scale.set(
                                settings.mobileScale,
                                settings.mobileScale,
                                settings.mobileScale
                            );
                            model.position.copy(settings.mobilePosition);
                        } else {
                            console.log(`Switching to desktop layout for ${currentModelType}`);
                            model.scale.set(
                                settings.scale,
                                settings.scale,
                                settings.scale
                            );
                            model.position.copy(settings.position);
                        }
                    });
                }
            }
        }
        
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
    console.log(`Setting fabric type: ${fabricType}`);
    
    // Ensure we have a shirt mesh to work with
    if (!shirtMesh || !shirtMaterial) {
        console.warn('Cannot set fabric type: model not loaded');
        return;
    }
    
    // Get current model type
    const currentModelType = state.currentModel || 'tshirt';
    
    // Accurate material properties for different fabric types
    // Based on real-world material properties
    const fabricProperties = {
        cotton: {
            roughness: 0.7,
            metalness: 0.0,
            sheen: 0.3,
            sheenRoughness: 0.9,
            sheenColor: new THREE.Color(0xffffff),
            clearcoat: 0.02,           // Reduced
            clearcoatRoughness: 0.9,
            reflectivity: 0.05,        // Reduced
            envMapIntensity: 0.12,     // Reduced
            normalScale: 0.6
        },
        silk: {
            roughness: 0.3,
            metalness: 0.0,
            sheen: 0.7,
            sheenRoughness: 0.5,
            sheenColor: new THREE.Color(0xffffff),
            clearcoat: 0.1,            // Reduced
            clearcoatRoughness: 0.4,
            reflectivity: 0.15,        // Reduced
            envMapIntensity: 0.2,      // Reduced
            normalScale: 0.3
        },
        polyester: {
            roughness: 0.5,
            metalness: 0.0,
            sheen: 0.4,
            sheenRoughness: 0.7,
            sheenColor: new THREE.Color(0xffffff),
            clearcoat: 0.05,           // Reduced
            clearcoatRoughness: 0.6,
            reflectivity: 0.1,         // Reduced
            envMapIntensity: 0.15,     // Reduced
            normalScale: 0.5
        },
        wool: {
            roughness: 0.8,
            metalness: 0.0,
            sheen: 0.2,
            sheenRoughness: 1.0,
            sheenColor: new THREE.Color(0xefefef),
            clearcoat: 0.01,           // Reduced
            clearcoatRoughness: 1.0,
            reflectivity: 0.02,        // Reduced
            envMapIntensity: 0.05,     // Reduced
            normalScale: 0.8
        },
        denim: {
            roughness: 0.75,
            metalness: 0.0,
            sheen: 0.1,
            sheenRoughness: 0.9,
            sheenColor: new THREE.Color(0xe0e0e0),
            clearcoat: 0.02,           // Reduced
            clearcoatRoughness: 0.9,
            reflectivity: 0.05,        // Reduced
            envMapIntensity: 0.08,     // Reduced
            normalScale: 1.2
        },
        leather: {
            roughness: 0.6,
            metalness: 0.0,
            sheen: 0.5,
            sheenRoughness: 0.7,
            sheenColor: new THREE.Color(0xd0d0d0),
            clearcoat: 0.15,           // Reduced
            clearcoatRoughness: 0.6,
            reflectivity: 0.1,         // Reduced
            envMapIntensity: 0.15,     // Reduced
            normalScale: 0.7
        },
        linen: {
            roughness: 0.75,
            metalness: 0.0,
            sheen: 0.25,
            sheenRoughness: 0.9,
            sheenColor: new THREE.Color(0xfafafa),
            clearcoat: 0.01,           // Reduced
            clearcoatRoughness: 1.0,
            reflectivity: 0.05,        // Reduced
            envMapIntensity: 0.08,     // Reduced
            normalScale: 0.7
        }
    };
    
    // Default to cotton if fabric type not found
    const properties = fabricProperties[fabricType] || fabricProperties.cotton;
    
    // Apply material properties based on model type
    if (currentModelType === 'hoodie') {
        console.log(`Applying realistic ${fabricType} material to hoodie model`);
        
        // Process all hoodie meshes
        if (group) {
            group.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                    try {
                        // Create new MeshPhysicalMaterial for each mesh
                        const physicalMaterial = new THREE.MeshPhysicalMaterial({
                            color: obj.material.color ? obj.material.color.clone() : new THREE.Color(0xffffff),
                            map: obj.material.map,
                            normalMap: obj.material.normalMap,
                            roughnessMap: obj.material.roughnessMap,
                            metalnessMap: obj.material.metalnessMap,
                            
                            // Apply fabric-specific properties
                            roughness: properties.roughness,
                            metalness: properties.metalness,
                            sheen: properties.sheen,
                            sheenRoughness: properties.sheenRoughness,
                            sheenColor: properties.sheenColor.clone(),
                            clearcoat: properties.clearcoat,
                            clearcoatRoughness: properties.clearcoatRoughness,
                            reflectivity: properties.reflectivity,
                            envMapIntensity: properties.envMapIntensity,
                            
                            // Keep original material properties
                            transparent: obj.material.transparent,
                            opacity: obj.material.opacity,
                            side: THREE.DoubleSide
                        });
                        
                        // Set normal scale if normalMap exists
                        if (obj.material.normalMap && physicalMaterial.normalScale) {
                            physicalMaterial.normalScale.set(properties.normalScale, properties.normalScale);
                        }
                        
                        // Replace material
                        obj.material.dispose();
                        obj.material = physicalMaterial;
                        obj.material.needsUpdate = true;
                        
                        // Enable shadows
                        obj.castShadow = true;
                        obj.receiveShadow = true;
                        
                        // If this is the main shirt mesh, update reference
                        if (obj === shirtMesh) {
                            shirtMaterial = physicalMaterial;
                        }
                    } catch (e) {
                        console.warn(`Couldn't create physical material for mesh: ${e.message}`);
                        // Apply basic properties to existing material as fallback
                        obj.material.roughness = properties.roughness;
                        obj.material.metalness = properties.metalness;
                        obj.material.envMapIntensity = properties.envMapIntensity;
                        obj.material.needsUpdate = true;
                    }
                }
            });
        }
    } else {
        // For t-shirts and other models
        console.log(`Applying realistic ${fabricType} material to ${currentModelType} model`);
        
        if (shirtMaterial) {
            try {
                // Create new MeshPhysicalMaterial
                const physicalMaterial = new THREE.MeshPhysicalMaterial({
                    color: shirtMaterial.color ? shirtMaterial.color.clone() : new THREE.Color(0xffffff),
                    map: shirtMaterial.map,
                    normalMap: shirtMaterial.normalMap,
                    roughnessMap: shirtMaterial.roughnessMap,
                    metalnessMap: shirtMaterial.metalnessMap,
                    
                    // Apply fabric-specific properties
                    roughness: properties.roughness,
                    metalness: properties.metalness,
                    sheen: properties.sheen,
                    sheenRoughness: properties.sheenRoughness,
                    sheenColor: properties.sheenColor.clone(),
                    clearcoat: properties.clearcoat,
                    clearcoatRoughness: properties.clearcoatRoughness,
                    reflectivity: properties.reflectivity,
                    envMapIntensity: properties.envMapIntensity,
                    
                    // Keep original material properties
                    transparent: shirtMaterial.transparent,
                    opacity: shirtMaterial.opacity,
                    side: THREE.DoubleSide
                });
                
                // Set normal scale if normalMap exists
                if (shirtMaterial.normalMap && physicalMaterial.normalScale) {
                    physicalMaterial.normalScale.set(properties.normalScale, properties.normalScale);
                }
                
                // Apply to all meshes in the model
                if (group) {
                    group.traverse((obj) => {
                        if (obj.isMesh) {
                            // Dispose old material
                            if (obj.material) obj.material.dispose();
                            
                            // Apply new material (clone to avoid sharing)
                            obj.material = physicalMaterial.clone();
                    obj.material.needsUpdate = true;
                            
                            // Enable shadows
                            obj.castShadow = true;
                            obj.receiveShadow = true;
                        }
                    });
                }
                
                // Update main reference
                shirtMaterial = physicalMaterial;
                if (shirtMesh) {
                    shirtMesh.material = physicalMaterial;
                }
                
                console.log(`Successfully applied ${fabricType} physical material`);
            } catch (e) {
                console.warn(`Couldn't create physical material: ${e.message}`);
                // Apply basic properties to existing material as fallback
                shirtMaterial.roughness = properties.roughness;
                shirtMaterial.metalness = properties.metalness;
                shirtMaterial.envMapIntensity = properties.envMapIntensity;
                shirtMaterial.needsUpdate = true;
            }
        }
        }
        
        // Force render update
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
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

// Expose loadModel function to window
window.loadModel = function (modelType) {
    console.log(`Loading model via window.loadModel: ${modelType}`);
    const modelPath = modelType === 'hoodie' ? './models/hoodie.glb' : './models/tshirt.glb';
    return loadModel(modelPath);
};

// Expose downloadCanvas function to window
window.exportScene = function() {
    console.log('Exporting scene via window.exportScene');
    downloadCanvas();
};

/**
 * Ensure a layer exists on the current model
 * @param {string} layerName - Name of the layer to ensure
 * @param {THREE.Material} material - Material to use for the layer
 * @returns {THREE.Mesh} The layer mesh
 */
function ensureModelLayer(layerName, material = null) {
    // Implementation similar to ensureShirtLayer but model-agnostic
    if (!shirtMesh) {
        console.error('Model mesh not available');
        return null;
    }
    
    console.log(`Ensuring model layer exists: ${layerName}`);
    
    // Find existing layer
    let layer = shirtMesh.children.find(child => child.name === layerName);
    
    if (!layer) {
        // Create a new layer if it doesn't exist
        const modelGeometry = shirtMesh.geometry.clone();
        
        // Create a temporary material if one isn't provided
        const tempMaterial = material || new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1.0,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending
        });
        
        // Create new mesh with the same geometry
        layer = new THREE.Mesh(modelGeometry, tempMaterial);
        layer.name = layerName;
        
        // Copy the shirt's world transform
        layer.matrix.copy(shirtMesh.matrix);
        layer.matrixAutoUpdate = false;
        
        // Copy UV mapping from the original mesh
        if (shirtMesh.geometry.attributes.uv) {
            layer.geometry.attributes.uv = shirtMesh.geometry.attributes.uv.clone();
        }
        
        // Force a specific render order
        layer.renderOrder = 10;
        
        // Add to model mesh
        shirtMesh.add(layer);
        console.log(`Created new layer: ${layerName} with perfect alignment`);
    } 
    else if (material) {
        // Update material if provided
        layer.material = material;
        layer.material.needsUpdate = true;
    }
    
    // Always ensure layers are visible
    layer.visible = true;
    
    return layer;
}

// Add a temp variable to use the new function name but keep backward compatibility 
// Redeclaring ensureShirtLayer here causes an error - we're keeping the original from line 1608
// Just adding a warning when it's used
const originalEnsureShirtLayer = ensureShirtLayer;
ensureShirtLayer = function(name, material) {
    console.warn('ensureShirtLayer is deprecated. Use ensureModelLayer instead');
    return ensureModelLayer(name, material);
};

/**
 * Register a new model type with the system
 * @param {string} modelType - The identifier for the model (e.g., 'tshirt', 'hoodie')
 * @param {object} modelConfig - Configuration object with model properties and view settings
 * @return {boolean} - Success status of registration
 */
function registerModelType(modelType, modelConfig) {
    if (!modelType || typeof modelType !== 'string') {
        console.error('Invalid model type provided');
        return false;
    }
    
    if (!modelConfig || typeof modelConfig !== 'object') {
        console.error('Invalid model configuration provided');
        return false;
    }
    
    // Check for required configuration properties
    const requiredProps = ['name', 'glbPath', 'views'];
    const missingProps = requiredProps.filter(prop => !modelConfig.hasOwnProperty(prop));
    
    if (missingProps.length > 0) {
        console.error(`Missing required properties in model config: ${missingProps.join(', ')}`);
        return false;
    }
    
    // Check if model type already exists
    if (modelConfigs.hasOwnProperty(modelType)) {
        console.warn(`Model type '${modelType}' already exists and will be overwritten`);
    }
    
    // Register the model configuration
    modelConfigs[modelType] = modelConfig;
    
    // Add to model options if it has a name
    if (modelConfig.name) {
        const modelOption = document.createElement('option');
        modelOption.value = modelType;
        modelOption.textContent = modelConfig.name;
        
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector) {
            modelSelector.appendChild(modelOption);
        }
    }
    
    console.log(`Registered model type: ${modelType}`);
    return true;
}

// Expose function globally
window.registerModelType = registerModelType;

// Add a new state variable to track whether decals should be affected by lighting
let decalsAffectedByLighting = false;

/**
 * Toggles preview mode with enhanced lighting, shadows, and reflections on decals
 * When enabled, editing is disabled and all objects are in view-only mode
 * @param {boolean} enabled - Whether preview mode should be enabled
 * @returns {boolean} - The new state
 */
export function toggleDecalLighting(enabled) {
    // If no parameter is passed, toggle the current state
    if (enabled === undefined) {
        decalsAffectedByLighting = !decalsAffectedByLighting;
    } else {
        decalsAffectedByLighting = enabled;
    }
    
    const previewMode = decalsAffectedByLighting;
    console.log(`Preview mode with lighting effects ${previewMode ? 'enabled' : 'disabled'}`);
    
    // Update any existing decals with the new material type
    // This function now handles all models, not just the t-shirt
    updateExistingDecalsMaterial(previewMode);
    
    // Immediately lock/unlock decal controls based on preview mode
    // Force = true to ensure it runs even if the state didn't change
    toggleDecalControlsLock(previewMode, true);
    
    // Update state
    updateState({ decalsAffectedByLighting: previewMode });
    
    // Expose the state to the window for the toggle button to access
    window.decalsAffectedByLighting = previewMode;
    
    // Update the button UI if the update function exists
    if (window.updateDecalLightingToggle) {
        window.updateDecalLightingToggle(previewMode);
    }
    
    // Show a toast notification
    if (window.showToast) {
        if (previewMode) {
            window.showToast('Preview mode enabled. Editing is disabled.');
        } else {
            window.showToast('Preview mode disabled. You can edit again.');
        }
    }
    
    // Update all model materials to ensure consistent lighting behavior
    // This ensures any future models will also respond to lighting correctly
    if (scene) {
        scene.traverse(object => {
            if (object.isMesh && object.material) {
                // For base model materials, adjust lighting-related properties
                if (object !== shirtMesh && 
                    !object.name.includes('canvas-layer') && 
                    !object.name.includes('decal') &&
                    !object.name.includes('texture-layer')) {
                    
                    // Ensure shadows are enabled/consistent
                    object.castShadow = true;
                    object.receiveShadow = true;
                    
                    // Adjust material properties for lighting consistency
                    if (object.material.type.includes('Physical') || 
                        object.material.type.includes('Standard') ||
                        object.material.type.includes('Lambert') ||
                        object.material.type.includes('Phong')) {
                        
                        // Ensure reflectivity is appropriate
                        if (previewMode) {
                            // Enhanced reflectivity when preview mode is on
                            object.material.envMapIntensity = 0.3;
                            if ('reflectivity' in object.material) 
                                object.material.reflectivity = 0.1;
                        } else {
                            // Reduced reflectivity when preview mode is off
                            object.material.envMapIntensity = 0.1;
                            if ('reflectivity' in object.material) 
                                object.material.reflectivity = 0.05;
                        }
                        
                        // Force material update
                        object.material.needsUpdate = true;
                    }
                }
            }
        });
    }
    
    // Re-render to show changes
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    return previewMode;
}

/**
 * Updates the material type of existing decals based on the lighting toggle
 * @param {boolean} useLighting - Whether to use lighting-responsive materials
 */
function updateExistingDecalsMaterial(useLighting) {
    if (!scene) return;
    
    console.log(`Updating existing decals to ${useLighting ? 'use' : 'not use'} lighting effects`);
    
    // Get all decal layers from all model meshes, not just shirtMesh
    let decalLayers = [];
    
    // First check if there's a main shirt mesh
    if (shirtMesh) {
        // Get layers from the main shirt mesh
        const mainLayers = shirtMesh.children.filter(child => 
            child.name === 'canvas-layer' || 
            child.name === 'canvas-layer-front' || 
            child.name === 'canvas-layer-back' ||
            child.name === 'full-texture-layer'
        );
        decalLayers = decalLayers.concat(mainLayers);
    }
    
    // Also search the entire scene for decal layers on any model
    scene.traverse(object => {
        // Check if this is a mesh and has a name indicating it's a decal layer
        if (object.isMesh && (
            object.name.includes('canvas-layer') || 
            object.name.includes('decal') ||
            object.name.includes('texture-layer')
        )) {
            // Don't add duplicates
            if (!decalLayers.includes(object)) {
                decalLayers.push(object);
            }
        }
    });
    
    if (decalLayers.length === 0) {
        console.log("No decal layers found to update");
        return;
    }
    
    console.log(`Found ${decalLayers.length} decal layers to update across all models`);
    
    // Process each decal layer
    decalLayers.forEach(layer => {
        if (!layer.material || !layer.material.map) {
            console.log(`Layer ${layer.name} has no material or texture, skipping`);
            return;
        }
        
        // Save the original texture
        const texture = layer.material.map;
        
        // Create the appropriate material type based on the toggle
        if (useLighting) {
            // Generate normal map for texture for lighting effects
            const normalMap = generateNormalMapFromTexture(texture);
            
            // Create a physical material that responds to lighting
            const physicalMaterial = new THREE.MeshPhysicalMaterial({
                map: texture,
                transparent: true,
                opacity: layer.material.opacity || 1.0,
                side: THREE.FrontSide,
                
                // Normal map for depth and light interaction
                normalMap: normalMap,
                normalScale: new THREE.Vector2(0.3, 0.3),
                
                // Physical properties for the decal
                roughness: 0.6,
                metalness: 0.0,
                clearcoat: 0.1,
                clearcoatRoughness: 0.8,
                
                // Shadows
                shadowSide: THREE.FrontSide,
                
                // Depth settings
                alphaTest: 0.01,
                depthTest: true,
                depthWrite: true,
                
                // Additional settings
                envMapIntensity: 0.2,
                sheen: 0.1,
                sheenRoughness: 0.8,
                sheenColor: new THREE.Color(0xffffff)
            });
            
            // Dispose of old material
            if (layer.material) {
                // Don't dispose texture as we're reusing it
                layer.material.dispose();
            }
            
            // Apply new material
            layer.material = physicalMaterial;
            
            // Enable shadows
            layer.castShadow = true;
            layer.receiveShadow = true;
            
        } else {
            // Create a basic material that ignores lighting
            const basicMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: layer.material.opacity || 1.0,
                side: THREE.FrontSide,
                
                // Basic material settings
                depthTest: true,
                depthWrite: false,
                alphaTest: 0.01,
                
                // Color space
                colorSpace: THREE.SRGBColorSpace
            });
            
            // Dispose of old material
            if (layer.material) {
                // Don't dispose the texture as we're reusing it
                if (layer.material.normalMap) {
                    layer.material.normalMap.dispose();
                }
                layer.material.dispose();
            }
            
            // Apply new material
            layer.material = basicMaterial;
            
            // Disable shadows
            layer.castShadow = false;
            layer.receiveShadow = false;
        }
        
        // Update material
        layer.material.needsUpdate = true;
    });
    
    // Render to show changes
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

/**
 * Locks or unlocks decal control buttons based on lighting state
 * @param {boolean} lock - Whether to lock the controls
 * @param {boolean} force - Whether to force update regardless of previous state
 */
function toggleDecalControlsLock(lock, force = false) {
    // Initialize current state if not set
    if (toggleDecalControlsLock.currentLockState === undefined) {
        toggleDecalControlsLock.currentLockState = null;
    }
    
    // Only proceed if state is changing or forced
    if (toggleDecalControlsLock.currentLockState === lock && !force) {
        return;
    }
    
    // Update current state
    toggleDecalControlsLock.currentLockState = lock;
    
    console.log(`Locking decal controls: ${lock ? 'YES' : 'NO'}`);
    
    // 1. Get all decal-related control buttons
    const decalControls = [
        document.getElementById('photo-upload-btn'),
        document.getElementById('text-upload-btn'),
        document.getElementById('shape-upload-btn'),
        document.getElementById('ai-generator-btn')
    ].filter(el => el); // Filter out any null elements
    
    // 2. Get the editor container/workspace
    const editorContainer = document.querySelector('.editor-container');
    const canvasContainer = document.querySelector('.canvas-container');
    const editorControls = document.querySelector('.editor-controls');
    
    if (decalControls.length === 0) {
        console.log("No decal controls found to lock/unlock");
    } else {
        console.log(`Found ${decalControls.length} decal controls to ${lock ? 'lock' : 'unlock'}`);
    }
    
    // 3. Make existing decals non-interactive when locked
    if (shirtMesh) {
        shirtMesh.children.forEach(child => {
            if (child.name && (
                child.name.includes('canvas-layer') || 
                child.name.includes('decal') ||
                child.name.includes('texture-layer')
            )) {
                // Make decals non-interactive when locked
                child.userData.isSelectable = !lock;
            }
        });
    }
    
    // 4. Disable/enable editor mode only for decal editing
    // If editor mode is enabled, temporarily disable it during preview
    if (window.toggleEditorInteraction) {
        window.toggleEditorInteraction(!lock);
    }
    
    // Remove preview overlay code - we don't want to show this anymore
    let previewOverlay = document.getElementById('preview-mode-overlay');
    if (previewOverlay) {
        previewOverlay.style.display = 'none';
        // Optionally remove it entirely
        previewOverlay.remove();
    }
    
    // 5. Update decal control states
    decalControls.forEach(control => {
        if (lock) {
            // Add disabled class
            control.classList.add('disabled');
            // Add a title attribute to explain why it's disabled
            control.setAttribute('title', 'Disable lighting effects to edit decals');
            // Also set the button as not interactive
            control.style.pointerEvents = 'none';
            control.setAttribute('data-locked', 'true');
        } else {
            // Remove disabled class
            control.classList.remove('disabled');
            // Restore original title if needed
            if (control.getAttribute('title') === 'Disable lighting effects to edit decals') {
                // Set appropriate title for each button type
                if (control.id === 'photo-upload-btn') {
                    control.setAttribute('title', 'Add photo to design');
                } else if (control.id === 'text-upload-btn') {
                    control.setAttribute('title', 'Add text to design');
                } else if (control.id === 'shape-upload-btn') {
                    control.setAttribute('title', 'Add shape to design');
                } else if (control.id === 'ai-generator-btn') {
                    control.setAttribute('title', 'Generate design with AI');
                }
            }
            // Re-enable interaction
            control.style.pointerEvents = 'auto';
            control.removeAttribute('data-locked');
        }
    });
    
    // 6. Only lock the editable areas, not the whole canvas container
    if (canvasContainer) {
        if (lock) {
            // Don't add preview-mode class to the whole container
            // Instead, we'll just ensure the decal-specific interactions are disabled
            // canvasContainer.classList.add('preview-mode');
            // Don't disable all pointer events on the canvas
            // canvasContainer.style.pointerEvents = 'none';
        } else {
            canvasContainer.classList.remove('preview-mode');
            canvasContainer.style.pointerEvents = 'auto';
        }
    }
    
    // 7. Only lock editor controls for decal editing, not everything
    if (editorControls) {
        const decalEditorButtons = editorControls.querySelectorAll('.decal-editor button, .decal-editor input, .decal-editor select');
        decalEditorButtons.forEach(button => {
            button.disabled = lock;
            if (lock) {
                button.setAttribute('data-locked-by-preview', 'true');
            } else {
                button.removeAttribute('data-locked-by-preview');
            }
        });
        
        // Make sure camera, color, and download controls remain active
        const cameraControls = editorControls.querySelectorAll('.camera-controls button, .color-controls button, .download-btn');
        cameraControls.forEach(control => {
            control.disabled = false;
            control.removeAttribute('data-locked-by-preview');
        });
    }
    
    console.log(`Decal controls ${lock ? 'locked' : 'unlocked'}`);
}

// Expose the toggle function globally for the button to use
window.toggleDecalLighting = toggleDecalLighting;