import { Performance, Logger, debounce } from "./utils.js";
import { state, updateState } from "./state.js";
import {
  addImage,
  addText as add3DText,
  addShape as add3DShape,
} from "./3d-editor.js";



/**
 * Initialize the 3D editor mode
 */
export function initFabricCanvas() {
  use3DEditor = true;
  setupNewUI();
  updateState({ editorMode: true });
  return null;
}

/**
 * Setup new simplified UI elements
 */
function setupNewUI() {
  // Create right-side buttons container
  const rightButtons = document.createElement('div');
  rightButtons.className = 'right-side-buttons';
  rightButtons.style.cssText = `
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 1000;
  `;

  // Add right-side buttons
  const addPhotoBtn = createButton('Add Photo', 'fa-image', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          // Create a view selection modal
          const viewSelectionModal = document.createElement('div');
          viewSelectionModal.className = 'view-selection-modal';
          viewSelectionModal.innerHTML = `
            <div class="view-selection-container">
              <h3>Choose where to add the photo</h3>
              <div class="view-options">
                <button class="view-option" data-view="front">
                  <i class="fas fa-tshirt"></i>
                  <span>Front</span>
                </button>
                <button class="view-option" data-view="back">
                  <i class="fas fa-tshirt"></i>
                  <span>Back</span>
                </button>
                <button class="view-option" data-view="left">
                  <i class="fas fa-tshirt"></i>
                  <span>Left</span>
                </button>
                <button class="view-option" data-view="right">
                  <i class="fas fa-tshirt"></i>
                  <span>Right</span>
                </button>
              </div>
              <button class="cancel-view-selection">Cancel</button>
            </div>
          `;
          
          // Style the modal
          viewSelectionModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          `;
          
          // Add the modal to the document
          document.body.appendChild(viewSelectionModal);
          
          // Style the container and buttons
          const styleSheet = document.createElement('style');
          styleSheet.textContent = `
            .view-selection-container {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              max-width: 90%;
              width: 400px;
              text-align: center;
            }
            .view-options {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin: 20px 0;
            }
            .view-option {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 15px;
              border: 2px solid #ddd;
              border-radius: 8px;
              background-color: #f8f8f8;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .view-option:hover {
              border-color: #007bff;
              background-color: #e6f2ff;
            }
            .view-option i {
              font-size: 36px;
              margin-bottom: 8px;
            }
            .cancel-view-selection {
              background-color: #f44336;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 10px;
            }
          `;
          document.head.appendChild(styleSheet);
          
          // Handle view option selection
          const viewOptions = viewSelectionModal.querySelectorAll('.view-option');
          viewOptions.forEach(option => {
            option.addEventListener('click', function() {
              const selectedView = this.dataset.view;
              
              // Import and use the 3D editor to:
              // 1. Change to selected view
              // 2. Add the image to that view
              import("./3d-editor.js")
                .then((editor) => {
                  // First change the camera view
                  import("./scene.js")
                    .then((scene) => {
                      if (scene.changeCameraView) {
                        scene.changeCameraView(selectedView);
                      }
                      
                      // Then add the image to the selected view
                      if (editor.addImage) {
                        editor.addImage(event.target.result, {
                          view: selectedView,
                          center: true
                        }).then(() => {
                          showNotification(`Image added to ${selectedView} view`, "success");
                        });
                      }
                    });
                })
                .catch(error => {
                  console.error("Error adding image:", error);
                  showNotification("Error adding image", "error");
                });
              
              // Remove the modal
              document.body.removeChild(viewSelectionModal);
              document.head.removeChild(styleSheet);
            });
          });
          
          // Handle cancel button
          const cancelButton = viewSelectionModal.querySelector('.cancel-view-selection');
          cancelButton.addEventListener('click', function() {
            document.body.removeChild(viewSelectionModal);
            document.head.removeChild(styleSheet);
          });
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  });

  const addTextBtn = createButton('Add Text', 'fa-font', () => {
    add3DText();
  });

  const addShapeBtn = createButton('Add Shape', 'fa-shapes', () => {
    add3DShape();
  });

  rightButtons.appendChild(addPhotoBtn);
  rightButtons.appendChild(addTextBtn);
  rightButtons.appendChild(addShapeBtn);

  // Add container to document
  document.body.appendChild(rightButtons);
}

/**
 * Create a styled button element
 */
function createButton(text, icon, onClick) {
  const button = document.createElement('button');
  button.className = 'model-control-btn';
  button.innerHTML = `<i class="fas ${icon}"></i>`;
  button.title = text; // Add tooltip
  button.style.cssText = `
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: background 0.3s ease;
  `;
  button.onmouseover = () => button.style.background = 'rgba(0, 0, 0, 0.9)';
  button.onmouseout = () => button.style.background = 'rgba(0, 0, 0, 0.7)';
  button.onclick = onClick;
  return button;
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
