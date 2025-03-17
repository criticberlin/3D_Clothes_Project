import { updateShirtTexture } from './scene.js';
import { Performance, Logger, debounce } from './utils.js';
import { state, updateState } from './state.js';
import { addImage, addText as add3DText, addShape as add3DShape } from './3d-editor.js';

// Global variables
let canvas;
let currentMode = 'select';
let selectedColor = '#000000';
let selectedFontFamily = 'Arial';
let selectedFontSize = 30;
let selectedLineWidth = 3;
let editorTools; // Add this variable to store the editor tools container
let use3DEditor = true; // Flag to determine if we should use the 3D editor

/**
 * Initialize the 3D editor mode (no longer initializes a Fabric.js canvas)
 * Kept for backward compatibility
 */
export function initFabricCanvas(width, height) {
    // Always use 3D editor
    use3DEditor = true;

    // Log that we're not using Fabric.js anymore
    Logger.log('2D Fabric.js editor has been removed. Using 3D editor only.');

    // Setup editor tools for 3D editor only
    setupEditorTools();

    // Enable 3D editor mode in scene.js
    updateState({ editorMode: true });

    return null;
}

/**
 * Setup drag and drop functionality for the canvas container
 * @param {HTMLElement} container - The canvas container element
 */
function setupDragAndDrop(container) {
    if (!container) return;

    // Add visual indicator for drag and drop
    const dropOverlay = document.createElement('div');
    dropOverlay.className = 'drop-overlay';
    dropOverlay.innerHTML = '<div class="drop-message"><i class="fas fa-cloud-upload-alt"></i><p>Drop image here</p></div>';
    dropOverlay.style.position = 'absolute';
    dropOverlay.style.top = '0';
    dropOverlay.style.left = '0';
    dropOverlay.style.width = '100%';
    dropOverlay.style.height = '100%';
    dropOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dropOverlay.style.color = 'white';
    dropOverlay.style.display = 'none';
    dropOverlay.style.justifyContent = 'center';
    dropOverlay.style.alignItems = 'center';
    dropOverlay.style.textAlign = 'center';
    dropOverlay.style.zIndex = '1000';

    // Style the drop message
    const messageStyle = document.createElement('style');
    messageStyle.textContent = `
        .drop-message {
            padding: 20px;
            border-radius: 10px;
            background-color: rgba(0, 0, 0, 0.7);
        }
        .drop-message i {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .drop-message p {
            margin: 0;
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(messageStyle);

    // Make sure container has position relative for overlay positioning
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    container.appendChild(dropOverlay);

    // Add event listeners for drag and drop
    container.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.style.display = 'flex';
    });

    container.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Only hide if we're leaving the container (not entering a child)
        const rect = container.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            dropOverlay.style.display = 'none';
        }
    });

    container.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropOverlay.style.display = 'none';

        // Process dropped files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]; // Get the first file

            if (file.type.match('image.*')) {
                addImageFromFile(file);
            } else {
                showNotification('Please drop an image file', 'error');
            }
        }
    });
}

/**
 * Set up event listeners for the Fabric.js canvas
 */
function setupEventListeners() {
    if (!canvas) return;

    // Create a container for the editor tools if it doesn't exist
    editorTools = document.querySelector('.editor-tools');
    if (!editorTools) {
        editorTools = document.createElement('div');
        editorTools.className = 'editor-tools';

        // Find the best container to append the editor tools to
        const fabricControls = document.querySelector('.fabric-controls');
        if (fabricControls) {
            // Add a section title
            const toolsTitle = document.createElement('h3');
            toolsTitle.className = 'editor-section-title';
            toolsTitle.innerHTML = '<i class="fas fa-paint-brush"></i> Drawing Tools';

            fabricControls.insertBefore(toolsTitle, fabricControls.firstChild);
            fabricControls.insertBefore(editorTools, fabricControls.children[1]);
        } else {
            // Fallback: append to the canvas container
            const canvasContainer = document.querySelector('.canvas-container');
            if (canvasContainer) {
                canvasContainer.parentNode.insertBefore(editorTools, canvasContainer.nextSibling);
            } else {
                // Last resort: append to body
                document.body.appendChild(editorTools);
            }
        }
    }

    // Enable direct manipulation of objects
    canvas.on('object:modified', function (e) {
        // Update state whenever object properties change (position, scale, rotation)
        console.log('Object modified, applying to shirt texture');

        // Apply changes to the shirt in real-time for better UX
        applyDesignToShirt();
    });

    // Also apply when new objects are added
    canvas.on('object:added', function (e) {
        // Skip the background rectangle which is the first object added
        if (canvas.getObjects().indexOf(e.target) === 0) return;

        console.log('New object added, applying to shirt texture');
        applyDesignToShirt();
    });

    canvas.on('selection:created', function (e) {
        // Enable controls for the selected object
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            // Set consistent controls for all object types
            activeObject.setControlsVisibility({
                mt: true, // top-center
                mb: true, // bottom-center
                ml: true, // middle-left
                mr: true, // middle-right
                bl: true, // bottom-left
                br: true, // bottom-right
                tl: true, // top-left
                tr: true, // top-right
                mtr: true // rotate
            });

            // Update UI to show the object's properties
            updateObjectPropertiesUI(activeObject);
        }
    });

    // Mode buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const mode = this.dataset.mode;
            if (mode) setMode(mode);

            // Remove active class from all buttons
            document.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.remove('active');
            });

            // Add active class to clicked button
            this.classList.add('active');
        });
    });

    // Color picker
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', function () {
            setColor(this.value);
        });
    }

    // Text button
    let textBtn = document.getElementById('add-text');
    if (!textBtn) {
        textBtn = document.createElement('button');
        textBtn.id = 'add-text';
        textBtn.className = 'tool-btn';
        textBtn.innerHTML = '<i class="fas fa-font"></i> Text';
        editorTools.appendChild(textBtn);
    }

    textBtn.addEventListener('click', () => {
        setMode('text');
        if (use3DEditor) {
            add3DText('Edit this text', {
                fontFamily: selectedFontFamily,
                fontSize: selectedFontSize,
                color: selectedColor
            });
        } else {
            addText('Edit this text');
        }
    });

    // Image upload button
    let imageBtn = document.getElementById('add-image');
    if (!imageBtn) {
        imageBtn = document.createElement('button');
        imageBtn.id = 'add-image';
        imageBtn.className = 'tool-btn primary';
        imageBtn.innerHTML = '<i class="fas fa-image"></i> Add Image';
        imageBtn.title = 'Add image (Click to browse, drop to upload, or paste from clipboard)';
        imageBtn.style.backgroundColor = 'var(--primary-color, #4a6cf7)';
        imageBtn.style.color = 'white';
        imageBtn.style.padding = '8px 12px';
        imageBtn.style.borderRadius = '4px';
        imageBtn.style.margin = '5px';
        editorTools.appendChild(imageBtn);

        // Add tooltip styles if they don't exist
        if (!document.getElementById('tooltip-styles')) {
            const tooltipStyles = document.createElement('style');
            tooltipStyles.id = 'tooltip-styles';
            tooltipStyles.textContent = `
                .tool-btn {
                    position: relative;
                }
                .tool-btn::after {
                    content: attr(title);
                    position: absolute;
                    bottom: 125%;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 6px 10px;
                    background-color: rgba(0, 0, 0, 0.8);
                    color: white;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s, visibility 0.3s;
                    z-index: 1000;
                    pointer-events: none;
                    width: max-content;
                    max-width: 250px;
                }
                .tool-btn:hover::after {
                    opacity: 1;
                    visibility: visible;
                }
            `;
            document.head.appendChild(tooltipStyles);
        }
    }

    // Create a hidden file input for image uploads
    let imageInput = document.getElementById('image-upload-input');
    if (!imageInput) {
        imageInput = document.createElement('input');
        imageInput.id = 'image-upload-input';
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.style.display = 'none';
        document.body.appendChild(imageInput);
    }

    // Connect the button to the file input
    imageBtn.addEventListener('click', () => {
        setMode('image');
        imageInput.click();
    });

    // Handle file selection
    imageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            addImageFromFile(e.target.files[0]);
            // Reset the input so the same file can be selected again
            e.target.value = '';
        }
    });

    // Shape button
    let shapeBtn = document.getElementById('add-shape');
    if (!shapeBtn) {
        shapeBtn = document.createElement('button');
        shapeBtn.id = 'add-shape';
        shapeBtn.className = 'tool-btn';
        shapeBtn.innerHTML = '<i class="fas fa-shapes"></i> Shape';
        editorTools.appendChild(shapeBtn);
    }

    shapeBtn.addEventListener('click', () => {
        setMode('shape');
        const shapeMenu = document.createElement('div');
        shapeMenu.className = 'shape-menu';
        shapeMenu.innerHTML = `
            <button class="shape-btn" data-shape="rect">Rectangle</button>
            <button class="shape-btn" data-shape="circle">Circle</button>
            <button class="shape-btn" data-shape="triangle">Triangle</button>
        `;

        // Remove any existing menu
        const existingMenu = document.querySelector('.shape-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Add and position the menu
        shapeBtn.parentNode.appendChild(shapeMenu);
        const btnRect = shapeBtn.getBoundingClientRect();
        shapeMenu.style.left = btnRect.left + 'px';
        shapeMenu.style.top = (btnRect.bottom + 5) + 'px';

        // Add event listeners for shape buttons
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shape = e.target.dataset.shape;
                if (use3DEditor) {
                    add3DShape(shape, {
                        fill: selectedColor
                    });
                } else {
                    addShape(shape);
                }
                shapeMenu.remove();
            });
        });

        // Close menu when clicking elsewhere
        document.addEventListener('click', function closeMenu(e) {
            if (!shapeMenu.contains(e.target) && e.target !== shapeBtn) {
                shapeMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    });

    // Free drawing button
    let drawBtn = document.getElementById('draw-free');
    if (!drawBtn) {
        drawBtn = document.createElement('button');
        drawBtn.id = 'draw-free';
        drawBtn.className = 'tool-btn';
        drawBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Draw';
        editorTools.appendChild(drawBtn);
    }

    drawBtn.addEventListener('click', () => {
        setMode('draw');
        canvas.isDrawingMode = true;

        // Add event listener for path creation in drawing mode
        if (!canvas._pathCreatedHandler) {
            canvas._pathCreatedHandler = function () {
                console.log('Drawing path created, applying to shirt texture');
                applyDesignToShirt();
            };
            canvas.on('path:created', canvas._pathCreatedHandler);
        }
    });

    // Selection tool button
    let selectBtn = document.getElementById('select-tool');
    if (!selectBtn) {
        selectBtn = document.createElement('button');
        selectBtn.id = 'select-tool';
        selectBtn.className = 'tool-btn';
        selectBtn.innerHTML = '<i class="fas fa-mouse-pointer"></i> Select';
        editorTools.appendChild(selectBtn);
    }

    selectBtn.addEventListener('click', () => {
        setMode('select');
        canvas.isDrawingMode = false;
    });

    // Apply to shirt button - with proper styling
    let applyBtn = document.getElementById('apply-to-shirt');
    if (!applyBtn) {
        applyBtn = document.createElement('button');
        applyBtn.id = 'apply-to-shirt';
        applyBtn.className = 'button primary';
        applyBtn.style.marginTop = '20px';
        applyBtn.style.width = '100%';
        applyBtn.style.padding = '10px';
        applyBtn.innerHTML = '<i class="fas fa-tshirt"></i> Apply to Shirt';
        const fabricControls = document.querySelector('.fabric-controls');
        if (fabricControls) {
            fabricControls.appendChild(applyBtn);
        }
    }

    applyBtn.addEventListener('click', () => {
        applyDesignToShirt();
    });
}

/**
 * Update UI to reflect the properties of the selected object
 * @param {fabric.Object} object - The selected Fabric.js object
 */
function updateObjectPropertiesUI(object) {
    // Update color picker if applicable
    const colorPicker = document.getElementById('color-picker');
    if (colorPicker && object.fill && typeof object.fill === 'string') {
        colorPicker.value = object.fill;
    }

    // Update other properties UI if needed
    // For example, font controls for text objects
    if (object.type === 'text' || object.type === 'i-text') {
        // Update font family selector
        const fontSelector = document.getElementById('font-family');
        if (fontSelector) {
            fontSelector.value = object.fontFamily;
        }

        // Update font size input
        const fontSizeInput = document.getElementById('font-size');
        if (fontSizeInput) {
            fontSizeInput.value = object.fontSize;
        }
    }
}

/**
 * Set the current editing mode
 * @param {string} mode - The mode to set
 */
function setMode(mode) {
    currentMode = mode;

    // Reset all tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate the selected tool button
    switch (mode) {
        case 'text':
            document.getElementById('add-text').classList.add('active');
            break;
        case 'shape':
            document.getElementById('add-shape').classList.add('active');
            break;
        case 'draw':
            document.getElementById('draw-free').classList.add('active');
            break;
        case 'image':
            document.getElementById('add-image').classList.add('active');
            break;
    }

    // Update canvas mode
    canvas.isDrawingMode = mode === 'draw';
}

/**
 * Add text to the canvas - now just forwards to 3D editor
 * @param {string} text - The text to add
 */
function addText(text) {
    // Forward to 3D editor
    add3DText(text, {
        fontSize: selectedFontSize,
        color: selectedColor
    });
}

/**
 * Add a shape to the canvas - now just forwards to 3D editor
 * @param {string} shapeType - The type of shape to add
 */
function addShape(shapeType) {
    // Forward to 3D editor
    add3DShape(shapeType, {
        fill: selectedColor
    });
}

/**
 * Apply the current Fabric.js canvas design to the t-shirt using the texture mapper
 */
export function applyDesignToShirt() {
    try {
        // Since we're using the 3D editor only, we don't need to get the fabric canvas
        // Just show a notification that the design is being applied
        showApplyingIndicator(true);

        // Use the 3D editor's texture update function
        import('./3d-editor.js').then(editor => {
            if (editor.updateShirt3DTexture) {
                editor.updateShirt3DTexture();
                Logger.log('Applied design to shirt using 3D editor');
            }

            // Hide the indicator after a short delay
            setTimeout(() => {
                showApplyingIndicator(false);
                showNotification('Design applied to shirt', 'success');
            }, 500);
        }).catch(error => {
            console.error('Error applying design:', error);
            showApplyingIndicator(false);
            showNotification('Error applying design', 'error');
        });
    } catch (error) {
        console.error('Error in applyDesignToShirt:', error);
        showApplyingIndicator(false);
        showNotification('Error applying design', 'error');
    }
}

/**
 * Show or hide an indicator that design is being applied to the shirt
 * @param {boolean} show - Whether to show or hide the indicator
 */
function showApplyingIndicator(show) {
    // Get or create the indicator element
    let indicator = document.getElementById('applying-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'applying-indicator';
        indicator.innerHTML = '<i class="fas fa-sync fa-spin"></i> Applying to shirt...';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.borderRadius = '4px';
        indicator.style.fontSize = '14px';
        indicator.style.zIndex = '9999';
        indicator.style.transition = 'opacity 0.3s ease';
        indicator.style.display = 'none';

        document.body.appendChild(indicator);
    }

    if (show) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 10);
    } else {
        indicator.style.opacity = '0';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 300);
    }
}

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Show notification
    notification.style.display = 'block';
    notification.style.opacity = '1';

    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 300);
    }, 3000);
}

/**
 * Simulate fabric lighting and shadows on the design
 * @param {HTMLCanvasElement} canvasEl - The canvas element to process
 * @returns {HTMLCanvasElement} Processed canvas with lighting effects
 */
function simulateFabricLighting(canvasEl) {
    const properties = FABRIC_PROPERTIES[selectedFabricType];

    // Create a temporary canvas for processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasEl.width;
    tempCanvas.height = canvasEl.height;
    const ctx = tempCanvas.getContext('2d');

    // Draw the original canvas
    ctx.drawImage(canvasEl, 0, 0);

    // Get image data for manipulation
    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Simulate fabric lighting based on thread pattern
    for (let i = 0; i < data.length; i += 4) {
        // Skip transparent pixels
        if (data[i + 3] === 0) continue;

        // Get pixel coordinates
        const x = (i / 4) % tempCanvas.width;
        const y = Math.floor((i / 4) / tempCanvas.width);

        // Calculate fabric weave pattern at this point
        let weaveValue = 1.0;

        if (selectedTextureStyle === 'plain') {
            // Plain weave pattern
            weaveValue = ((x + y) % 2 === 0) ? 1.0 : 0.95;
        } else if (selectedTextureStyle === 'twill') {
            // Twill pattern
            weaveValue = (((x + y) % 8) < 4) ? 1.0 : 0.93;
        } else if (selectedTextureStyle === 'herringbone') {
            // Herringbone pattern
            const modX = x % 16;
            const modY = y % 16;
            if (modY < 8) {
                weaveValue = (modX + modY) % 8 < 4 ? 1.0 : 0.92;
            } else {
                weaveValue = (modX - modY + 16) % 8 < 4 ? 1.0 : 0.92;
            }
        }

        // Apply the weave lighting effect
        data[i] = Math.min(255, Math.max(0, data[i] * weaveValue));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * weaveValue));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * weaveValue));
    }

    // Put the modified data back
    ctx.putImageData(imageData, 0, 0);

    return tempCanvas;
}

/**
 * Open an image in the fabric editor
 * @param {string} imageData - Base64 image data
 * @param {function} callback - Function to call with the edited image data
 */
export function openImageInEditor(imageData, callback) {
    // Since we've removed the 2D editor, we'll directly use the 3D editor to add the image
    import('./3d-editor.js').then(editor => {
        if (editor.addImage) {
            // Add the image to the current view
            editor.addImage(imageData, {
                view: state.cameraView || 'front',
                center: true
            }).then(imageObj => {
                // If a callback was provided, call it with the original image data
                // since we're not editing the image in 2D anymore
                if (typeof callback === 'function') {
                    callback(imageData);
                }

                showNotification('Image added to 3D model', 'success');
            }).catch(error => {
                console.error('Error adding image to 3D editor:', error);
                showNotification('Error adding image', 'error');
            });
        } else {
            console.error('3D editor addImage function not available');
            showNotification('Could not add image - 3D editor not available', 'error');
        }
    }).catch(error => {
        console.error('Error importing 3D editor:', error);
        showNotification('Error loading 3D editor', 'error');
    });
}

/**
 * Clear the canvas
 * @param {boolean} keepBackground - Whether to keep the background rectangle
 */
export function clearCanvas(keepBackground = false) {
    if (window.confirm('Are you sure you want to clear all elements?')) {
        // Use 3D editor's clear method
        import('./3d-editor.js').then(module => {
            if (module.clearCanvas) {
                module.clearCanvas();
                console.log('3D editor canvas cleared');
            } else {
                console.error('3D editor clearCanvas function not found');
            }
        }).catch(error => {
            console.error('Error importing 3D editor module:', error);
        });
    }
}

/**
 * Set the selected color with advanced fabric color calculation
 * @param {string} color - The color to set
 */
export function setColor(color) {
    selectedColor = color;

    // Set the color in the 3D editor
    import('./3d-editor.js').then(module => {
        if (module.setColor) {
            module.setColor(color);
        }
    }).catch(error => {
        console.error('Error setting color in 3D editor:', error);
    });
}

/**
 * Download the current design
 */
export function downloadDesign() {
    // Use the 3D renderer to capture the current view
    import('./scene.js').then(module => {
        if (module.downloadCanvas) {
            module.downloadCanvas();
            console.log('Design downloaded using 3D renderer');
        } else {
            console.error('3D downloadCanvas function not found');
        }
    }).catch(error => {
        console.error('Error downloading design:', error);
    });
}

/**
 * Set fabric type (placeholder function)
 * @param {string} fabricType - The fabric type to set (ignored in this implementation)
 */
export function setFabricType(fabricType) {
    // This is a placeholder function that does nothing
    // We keep it to avoid breaking imports in other files
    console.log('setFabricType called with:', fabricType);
    // The actual fabric type functionality has been removed
}

/**
 * Update canvas background color to match current theme
 */


/**
 * Add an image to the 3D editor from a file upload
 * @param {File} file - The image file to add
 */
function addImageFromFile(file) {
    if (!file || !file.type.match('image.*')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const imgData = e.target.result;

        // Add the image to the 3D editor
        import('./3d-editor.js').then(module => {
            if (module.addImage) {
                module.addImage(imgData, {
                    view: state.cameraView || 'front',
                    center: true
                }).then(() => {
                    showNotification('Image added to 3D model', 'success');
                }).catch(error => {
                    console.error('Error adding image:', error);
                    showNotification('Error adding image', 'error');
                });
            } else {
                console.error('3D editor addImage function not found');
                showNotification('Could not add image - 3D editor not available', 'error');
            }
        }).catch(error => {
            console.error('Error importing 3D editor module:', error);
            showNotification('Error loading 3D editor', 'error');
        });
    };

    reader.readAsDataURL(file);
}

/**
 * Setup clipboard paste support for images in the 3D editor
 */
function setupClipboardPasteSupport() {
    // Listen for paste events on the document
    document.addEventListener('paste', function (e) {
        // Check if we have clipboard items (modern browsers)
        if (e.clipboardData && e.clipboardData.items) {
            // Look for images in the clipboard items
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                // If we find an image, add it to the 3D editor
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();

                    reader.onload = function (event) {
                        // Import the 3D editor's addImage function
                        import('./3d-editor.js').then(module => {
                            if (module.addImage) {
                                module.addImage(event.target.result, {
                                    view: state.cameraView || 'front',
                                    center: true
                                }).then(() => {
                                    showNotification('Image pasted to 3D model', 'success');
                                }).catch(error => {
                                    console.error('Error adding pasted image:', error);
                                    showNotification('Error adding pasted image', 'error');
                                });
                            }
                        }).catch(error => {
                            console.error('Error importing 3D editor module:', error);
                        });
                    };

                    reader.readAsDataURL(blob);
                    break;
                }
            }
        }
    });

    // Add a visual indicator that paste is supported
    Logger.log('Clipboard paste support enabled for 3D editor');
}

/**
 * Setup editor tools for both 2D and 3D editing
 */
function setupEditorTools() {
    // Create editor tools container if it doesn't exist
    if (!document.querySelector('.editor-tools')) {
        editorTools = document.createElement('div');
        editorTools.className = 'editor-tools';
        editorTools.innerHTML = `
            <div class="tool-group">
                <button class="tool-btn" data-tool="select" title="Select"><i class="fas fa-mouse-pointer"></i></button>
                <button class="tool-btn" data-tool="text" title="Add Text"><i class="fas fa-font"></i></button>
                <button class="tool-btn" data-tool="image" title="Add Image"><i class="fas fa-image"></i></button>
                <button class="tool-btn" data-tool="shape" title="Add Shape"><i class="fas fa-shapes"></i></button>
            </div>
            <div class="tool-group">
                <input type="color" id="color-picker" value="${selectedColor}" title="Color">
                <select id="font-size" title="Size">
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="30" selected>30</option>
                    <option value="36">36</option>
                    <option value="48">48</option>
                    <option value="60">60</option>
                </select>
            </div>
            <div class="tool-group">
                <button class="tool-btn" data-tool="delete" title="Delete Selected"><i class="fas fa-trash"></i></button>
                <button class="tool-btn" data-tool="clear" title="Clear All"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        // Add to document
        document.body.appendChild(editorTools);

        // Add event listeners
        setupEditorToolListeners();
    }
}

/**
 * Setup event listeners for editor tools
 */
function setupEditorToolListeners() {
    if (!editorTools) return;

    // Tool buttons
    const toolButtons = editorTools.querySelectorAll('[data-tool]');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            toolButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');

            // Set current mode
            currentMode = button.dataset.tool;

            // Handle tool action
            handleToolAction(currentMode);
        });
    });

    // Color picker
    const colorPicker = editorTools.querySelector('#color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('change', (e) => {
            selectedColor = e.target.value;
            setColor(selectedColor);
        });
    }

    // Font size
    const fontSize = editorTools.querySelector('#font-size');
    if (fontSize) {
        fontSize.addEventListener('change', (e) => {
            selectedFontSize = parseInt(e.target.value);
            updateSelectedObjectProperty('fontSize', selectedFontSize);
        });
    }
}

/**
 * Handle tool action based on selected mode
 * @param {string} tool - The selected tool
 */
function handleToolAction(tool) {
    // Handle action in 3D editor
    switch (tool) {
        case 'select':
            // Select mode is the default, no action needed
            break;
        case 'text':
            // Add text in 3D
            const text = prompt('Enter text:', 'Your text here');
            if (text) {
                add3DText(text, {
                    fontSize: selectedFontSize,
                    color: selectedColor
                });
            }
            break;
        case 'image':
            // Trigger file input for image upload
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        addImage(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            };
            fileInput.click();
            break;
        case 'shape':
            // Show shape options
            const shape = prompt('Enter shape type (rect, circle):', 'rect');
            if (shape === 'rect' || shape === 'circle') {
                add3DShape(shape, {
                    fill: selectedColor
                });
            }
            break;
        case 'delete':
            // Handled by 3D editor's keydown event
            break;
        case 'clear':
            if (confirm('Are you sure you want to clear all elements?')) {
                // Import clearCanvas function from 3d-editor
                import('./3d-editor.js').then(module => {
                    if (module.clearCanvas) {
                        module.clearCanvas();
                    }
                });
            }
            break;
    }
}

/**
 * Toggle editor mode
 */
function toggleEditorMode() {
    // Always use 3D editor
    use3DEditor = true;

    // Enable 3D editor mode in state
    updateState({ editorMode: true });

    Logger.log('Using 3D editing mode only');
}

/**
 * Update property of selected object
 * @param {string} property - The property to update
 * @param {any} value - The new value
 */
function updateSelectedObjectProperty(property, value) {
    // This will be handled by the 3D editor internally
    import('./3d-editor.js').then(module => {
        if (module.updateSelectedObjectProperty) {
            module.updateSelectedObjectProperty(property, value);
        }
    }).catch(error => {
        console.error('Error updating property in 3D editor:', error);
    });
}

// Initialize 3D editor when the window loads
window.addEventListener('load', () => {
    console.log('Window loaded - initializing 3D editor');

    // Initialize the 3D editor
    try {
        // Call initFabricCanvas which now only sets up 3D editor
        initFabricCanvas();
        console.log('3D editor initialized successfully');
    } catch (error) {
        console.error('Error initializing 3D editor:', error);
    }

    // Apply initial design if needed
    if (window.initialDesign) {
        console.log('Applying initial design');
        setTimeout(() => {
            applyDesignToShirt();
        }, 500);
    }
}); 