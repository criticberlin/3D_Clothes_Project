# Texture Mapper Implementation Guide

This guide will help you implement the texture mapping system for the 3D Shirt Customizer. This system allows for seamless integration of images into the fabric texture of your 3D models.

## Implementation Steps

### 1. File Structure Verification

Make sure you have the following files in your project:

- `js/texture-mapper.js` - The main texture mapping module
- Updated versions of:
  - `js/scene.js` - Integration with Three.js scene
  - `js/ui.js` - UI handling for file uploads
  - `css/style.css` - Styling for bounding boxes and controls

### 2. Debugging

The project includes a debug script to help identify issues:

- `debug-texture-mapper.js` - Debug utility to trace texture mapper issues
- Make sure it's included in your HTML: `<script src="debug-texture-mapper.js"></script>`

When you load the page, open the browser console to see diagnostic information.

### 3. Implementation Verification

To verify the implementation is working:

1. **Open the console** (F12 in most browsers)
2. **Upload an image** using the file upload control
3. **Check for bounding boxes** around the 3D model
4. **Test the controls** by dragging, rotating, and scaling the image
5. **Switch camera views** and upload images for different views

### 4. Manual Testing Commands

If you don't see bounding boxes, you can try creating one manually in the console:

```javascript
;(function () {
	const container = document.querySelector('.canvas-container')
	if (container) {
		const box = document.createElement('div')
		box.className = 'texture-bounding-box front-view-box active'
		box.dataset.view = 'front'
		box.style.left = '25%'
		box.style.top = '25%'
		box.style.width = '50%'
		box.style.height = '50%'
		box.style.display = 'block'

		const rotateHandle = document.createElement('div')
		rotateHandle.className = 'transform-handle rotate-handle'
		rotateHandle.innerHTML = '<i class="fas fa-sync-alt"></i>'

		const scaleHandle = document.createElement('div')
		scaleHandle.className = 'transform-handle scale-handle'
		scaleHandle.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>'

		box.appendChild(rotateHandle)
		box.appendChild(scaleHandle)
		container.appendChild(box)
	}
})()
```

### 5. Common Issues and Solutions

#### Missing Bounding Boxes

- Check if `setupBoundingBoxes()` is being called
- Verify that the canvas container exists
- Check CSS styles are properly applied

#### Images Not Applying to Model

- Ensure that the `texture-updated` event is being dispatched
- Check if the scene is listening for and handling the event
- Verify the texture is being created properly

#### Controls Not Working

- Check if event listeners in `setupInteractions()` are active
- Ensure event propagation is not being stopped
- Try to manually trigger the events

## Extending the System

### Adding Support for New Model Types

To add support for a new model type (e.g., pants, jacket):

1. Add the model configuration to `modelConfig` in `texture-mapper.js`:

```javascript
const modelConfig = {
	// Existing configs...
	pants: {
		views: {
			front: {
				/* ... */
			},
			back: {
				/* ... */
			},
			left: {
				/* ... */
			},
			right: {
				/* ... */
			},
		},
		fabricTextureStrength: 0.6,
		bumpMapStrength: 0.05,
		materialSettings: {
			/* ... */
		},
	},
}
```

2. Update the `setModelType()` function to handle the new model type

### Customizing Appearance

You can customize the appearance of bounding boxes and controls by modifying the CSS in `style.css`.
