import { Performance, Logger, debounce } from "./utils.js";
import { state, updateState } from "./state.js";
import {
  addImage,
  addText as add3DText,
  addShape as add3DShape,
} from "./3d-editor.js";

// Global variables
let currentMode = "select";
let selectedColor = "#000000";
let selectedFontSize = 30;
let editorTools; // Add this variable to store the editor tools container
let use3DEditor = true; // Flag to determine if we should use the 3D editor

/**
 * Initialize the 3D editor mode (no longer initializes a Fabric.js canvas)
 * Kept for backward compatibility
 */
export function initFabricCanvas() {
  // Always use 3D editor
  use3DEditor = true;

  // Setup editor tools for 3D editor only
  setupEditorTools();

  // Enable 3D editor mode in scene.js
  updateState({ editorMode: true });

  return null;
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
    import("./3d-editor.js")
      .then((editor) => {
        if (editor.updateShirt3DTexture) {
          editor.updateShirt3DTexture();
          Logger.log("Applied design to shirt using 3D editor");
        }

        // Hide the indicator after a short delay
        setTimeout(() => {
          showApplyingIndicator(false);
          showNotification("Design applied to shirt", "success");
        }, 500);
      })
      .catch((error) => {
        console.error("Error applying design:", error);
        showApplyingIndicator(false);
        showNotification("Error applying design", "error");
      });
  } catch (error) {
    console.error("Error in applyDesignToShirt:", error);
    showApplyingIndicator(false);
    showNotification("Error applying design", "error");
  }
}

/**
 * Show or hide an indicator that design is being applied to the shirt
 * @param {boolean} show - Whether to show or hide the indicator
 */
function showApplyingIndicator(show) {
  // Get or create the indicator element
  let indicator = document.getElementById("applying-indicator");

  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "applying-indicator";
    indicator.innerHTML =
      '<i class="fas fa-sync fa-spin"></i> Applying to shirt...';
    indicator.style.position = "absolute";
    indicator.style.bottom = "10px";
    indicator.style.right = "10px";
    indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    indicator.style.color = "white";
    indicator.style.padding = "8px 12px";
    indicator.style.borderRadius = "4px";
    indicator.style.fontSize = "14px";
    indicator.style.zIndex = "9999";
    indicator.style.transition = "opacity 0.3s ease";
    indicator.style.display = "none";

    document.body.appendChild(indicator);
  }

  if (show) {
    indicator.style.display = "block";
    setTimeout(() => {
      indicator.style.opacity = "1";
    }, 10);
  } else {
    indicator.style.opacity = "0";
    setTimeout(() => {
      indicator.style.display = "none";
    }, 300);
  }
}

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = "info") {
  // Create notification element if it doesn't exist
  let notification = document.querySelector(".notification");
  if (!notification) {
    notification = document.createElement("div");
    notification.className = "notification";
    document.body.appendChild(notification);
  }

  // Set message and type
  notification.textContent = message;
  notification.className = `notification ${type}`;

  // Show notification
  notification.style.display = "block";
  notification.style.opacity = "1";

  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      notification.style.display = "none";
    }, 300);
  }, 3000);
}

/**
 * Open an image in the fabric editor
 * @param {string} imageData - Base64 image data
 * @param {function} callback - Function to call with the edited image data
 */
export function openImageInEditor(imageData, callback) {
  // Since we've removed the 2D editor, we'll directly use the 3D editor to add the image
  import("./3d-editor.js")
    .then((editor) => {
      if (editor.addImage) {
        // Add the image to the current view
        editor
          .addImage(imageData, {
            view: state.cameraView || "front",
            center: true,
          })
          .then((imageObj) => {
            // If a callback was provided, call it with the original image data
            // since we're not editing the image in 2D anymore
            if (typeof callback === "function") {
              callback(imageData);
            }

            showNotification("Image added to 3D model", "success");
          })
          .catch((error) => {
            console.error("Error adding image to 3D editor:", error);
            showNotification("Error adding image", "error");
          });
      } else {
        console.error("3D editor addImage function not available");
        showNotification(
          "Could not add image - 3D editor not available",
          "error"
        );
      }
    })
    .catch((error) => {
      console.error("Error importing 3D editor:", error);
      showNotification("Error loading 3D editor", "error");
    });
}

/**
 * Clear the canvas
 * @param {boolean} keepBackground - Whether to keep the background rectangle
 */
export function clearCanvas(keepBackground = false) {
  if (window.confirm("Are you sure you want to clear all elements?")) {
    // Use 3D editor's clear method
    import("./3d-editor.js")
      .then((module) => {
        if (module.clearCanvas) {
          module.clearCanvas();
          console.log("3D editor canvas cleared");
        } else {
          console.error("3D editor clearCanvas function not found");
        }
      })
      .catch((error) => {
        console.error("Error importing 3D editor module:", error);
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
  import("./3d-editor.js")
    .then((module) => {
      if (module.setColor) {
        module.setColor(color);
      }
    })
    .catch((error) => {
      console.error("Error setting color in 3D editor:", error);
    });
}

/**
 * Download the current design
 */
export function downloadDesign() {
  // Use the 3D renderer to capture the current view
  import("./scene.js")
    .then((module) => {
      if (module.downloadCanvas) {
        module.downloadCanvas();
        console.log("Design downloaded using 3D renderer");
      } else {
        console.error("3D downloadCanvas function not found");
      }
    })
    .catch((error) => {
      console.error("Error downloading design:", error);
    });
}

/**
 * Setup editor tools for 3D editing
 */
function setupEditorTools() {
  // Create editor tools container if it doesn't exist
  if (!document.querySelector(".editor-tools")) {
    editorTools = document.createElement("div");
    editorTools.className = "editor-tools";
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
  const toolButtons = editorTools.querySelectorAll("[data-tool]");
  toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons
      toolButtons.forEach((btn) => btn.classList.remove("active"));
      // Add active class to clicked button
      button.classList.add("active");

      // Set current mode
      currentMode = button.dataset.tool;

      // Handle tool action
      handleToolAction(currentMode);
    });
  });

  // Color picker
  const colorPicker = editorTools.querySelector("#color-picker");
  if (colorPicker) {
    colorPicker.addEventListener("change", (e) => {
      selectedColor = e.target.value;
      setColor(selectedColor);
    });
  }

  // Font size
  const fontSize = editorTools.querySelector("#font-size");
  if (fontSize) {
    fontSize.addEventListener("change", (e) => {
      selectedFontSize = parseInt(e.target.value);
      updateSelectedObjectProperty("fontSize", selectedFontSize);
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
    case "select":
      // Select mode is the default, no action needed
      break;
    case "text":
      // Add text in 3D
      const text = prompt("Enter text:", "Your text here");
      if (text) {
        add3DText(text, {
          fontSize: selectedFontSize,
          color: selectedColor,
        });
      }
      break;
    case "image":
      // Trigger file input for image upload
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
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
    case "shape":
      // Show shape options
      const shape = prompt("Enter shape type (rect, circle):", "rect");
      if (shape === "rect" || shape === "circle") {
        add3DShape(shape, {
          fill: selectedColor,
        });
      }
      break;
    case "delete":
      // Handled by 3D editor's keydown event
      break;
    case "clear":
      if (confirm("Are you sure you want to clear all elements?")) {
        // Import clearCanvas function from 3d-editor
        import("./3d-editor.js").then((module) => {
          if (module.clearCanvas) {
            module.clearCanvas();
          }
        });
      }
      break;
  }
}

/**
 * Update property of selected object
 * @param {string} property - The property to update
 * @param {any} value - The new value
 */
function updateSelectedObjectProperty(property, value) {
  // This will be handled by the 3D editor internally
  import("./3d-editor.js")
    .then((module) => {
      if (module.updateSelectedObjectProperty) {
        module.updateSelectedObjectProperty(property, value);
      }
    })
    .catch((error) => {
      console.error("Error updating property in 3D editor:", error);
    });
}

// Initialize 3D editor when the window loads
window.addEventListener("load", () => {
  console.log("Window loaded - initializing 3D editor");

  // Initialize the 3D editor
  try {
    // Call initFabricCanvas which now only sets up 3D editor
    initFabricCanvas();
    console.log("3D editor initialized successfully");
  } catch (error) {
    console.error("Error initializing 3D editor:", error);
  }

  // Apply initial design if needed
  if (window.initialDesign) {
    console.log("Applying initial design");
    setTimeout(() => {
      applyDesignToShirt();
    }, 500);
  }
});
