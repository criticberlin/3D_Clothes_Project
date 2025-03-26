import { Performance, Logger, debounce } from "./utils.js";
import { state, updateState } from "./state.js";
import {
  addImage,
  addText as add3DText,
  addShape as add3DShape,
} from "./3d-editor.js";

// Global variable to track editor mode
let use3DEditor = false;

/**
 * Initialize the 3D editor mode
 */
export function initFabricCanvas() {
  use3DEditor = true;
  // Remove the call to setupNewUI since we've moved the functionality to the floating panels
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

// Initialize 3D editor when the window loads
window.addEventListener("load", () => {
  console.log("Window loaded - initializing 3D editor");

  try {
    initFabricCanvas();
    console.log("3D editor initialized successfully");
  } catch (error) {
    console.error("Error initializing 3D editor:", error);
  }

  if (window.initialDesign) {
    console.log("Applying initial design");
    setTimeout(() => {
      applyDesignToShirt();
    }, 500);
  }
});
