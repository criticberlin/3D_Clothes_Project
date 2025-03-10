/**
 * Debug script for Texture Mapper implementation
 * Add this to your HTML to debug texture mapper issues
 */

(function () {
    console.log('%c Texture Mapper Debug Script', 'background: #4285f4; color: white; padding: 5px; border-radius: 3px;');

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
        // Check if required modules are loaded
        setTimeout(checkModules, 1000);
    });

    function checkModules() {
        console.group('Checking required modules:');

        // Check if THREE.js is loaded
        if (typeof THREE !== 'undefined') {
            console.log('✅ THREE.js is loaded:', THREE.REVISION);
        } else {
            console.error('❌ THREE.js is not loaded!');
        }

        // Check for necessary classes
        const requiredClasses = [
            { global: 'THREE.CanvasTexture', check: () => typeof THREE.CanvasTexture === 'function' },
            {
                global: 'THREE.OrbitControls', check: () => {
                    try {
                        // OrbitControls is typically loaded as a module
                        const foundInImports = document.querySelector('script[type="importmap"]')?.textContent.includes('OrbitControls');
                        return foundInImports || typeof THREE.OrbitControls === 'function';
                    } catch (e) {
                        return false;
                    }
                }
            }
        ];

        requiredClasses.forEach(cls => {
            if (cls.check()) {
                console.log(`✅ ${cls.global} is available`);
            } else {
                console.error(`❌ ${cls.global} is not available`);
            }
        });

        console.groupEnd();

        // Check modules integration
        checkFileStructure();
    }

    function checkFileStructure() {
        console.group('Checking file structure:');

        // Check for required scripts
        const requiredScripts = [
            { name: 'texture-mapper.js', src: 'js/texture-mapper.js' },
            { name: 'scene.js', src: 'js/scene.js' },
            { name: 'ui.js', src: 'js/ui.js' }
        ];

        requiredScripts.forEach(script => {
            const el = document.querySelector(`script[src*="${script.src}"]`);
            if (el) {
                console.log(`✅ ${script.name} is included in the page`);
            } else {
                console.warn(`⚠️ ${script.name} script tag not found. This might be OK if it's imported differently.`);
            }
        });

        console.groupEnd();

        // Check UI elements
        checkUIElements();
    }

    function checkUIElements() {
        console.group('Checking UI elements:');

        const requiredElements = [
            { name: 'Canvas container', selector: '.canvas-container' },
            { name: 'File upload', selector: '#file-upload' },
            { name: 'Preview element', selector: '#file-picker .preview' }
        ];

        requiredElements.forEach(el => {
            const element = document.querySelector(el.selector);
            if (element) {
                console.log(`✅ ${el.name} found:`, element);
            } else {
                console.error(`❌ ${el.name} not found (${el.selector})`);
            }
        });

        // Check if bounding boxes are created
        setTimeout(() => {
            const boundingBoxes = document.querySelectorAll('.texture-bounding-box');
            if (boundingBoxes.length > 0) {
                console.log(`✅ ${boundingBoxes.length} texture bounding boxes created`);
            } else {
                console.error('❌ No texture bounding boxes found');
                console.log('Try manually creating one for testing:');
                console.log(`
document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.canvas-container');
    if (container) {
        const box = document.createElement('div');
        box.className = 'texture-bounding-box front-view-box';
        box.dataset.view = 'front';
        box.style.display = 'block';
        box.style.left = '25%';
        box.style.top = '25%';
        box.style.width = '50%';
        box.style.height = '50%';
        container.appendChild(box);
    }
});`);
            }
        }, 2000);

        console.groupEnd();

        // Check for event listeners
        checkEventListeners();
    }

    function checkEventListeners() {
        console.group('Checking event listeners:');

        // Test if the texture-updated event is being fired
        window.addEventListener('texture-updated', (e) => {
            console.log('✅ texture-updated event fired:', e.detail);
        });

        // Test if the model-loaded event is being fired
        window.addEventListener('model-loaded', (e) => {
            console.log('✅ model-loaded event fired:', e.detail);
        });

        console.log('Event listeners registered. Will report if events are fired.');

        console.groupEnd();

        // Provide manual testing instructions
        provideInstructions();
    }

    function provideInstructions() {
        console.group('Manual testing instructions:');

        console.log(`
To test texture mapper manually:

1. Upload an image using the file upload control
2. Check if a bounding box appears around the image on the model
3. Try dragging the image to reposition it
4. Try using the rotation and scale controls
5. Switch camera views and upload another image for a different view

Debugging commands:

// Check if texture mapper was initialized
console.log(window.textureMapperInitialized); 

// Try manually creating a bounding box
(function() {
    const container = document.querySelector('.canvas-container');
    if (container) {
        const box = document.createElement('div');
        box.className = 'texture-bounding-box front-view-box active';
        box.dataset.view = 'front';
        box.style.left = '25%';
        box.style.top = '25%';
        box.style.width = '50%';
        box.style.height = '50%';
        box.style.display = 'block';
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'transform-handle rotate-handle';
        rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>';
        
        const scaleHandle = document.createElement('div');
        scaleHandle.className = 'transform-handle scale-handle';
        scaleHandle.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
        
        box.appendChild(rotateHandle);
        box.appendChild(scaleHandle);
        container.appendChild(box);
    }
})();
`);

        console.groupEnd();
    }
})(); 