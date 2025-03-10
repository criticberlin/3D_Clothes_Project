# 3D Shirt Customizer (Vanilla JS)

A 3D shirt customization application built with pure HTML, CSS, and JavaScript (no frameworks).

## Features

- Interactive 3D shirt model
- Color picker for changing shirt color
- Logo and full-texture customization
- AI-powered texture generation (requires backend server)
- Image download functionality

## Prerequisites

- Modern web browser with WebGL support
- For AI features: Node.js backend server running on localhost:8080

## Project Structure

```
/
├── assets/             # Images and other static assets
├── css/                # CSS stylesheets
│   └── style.css       # Main stylesheet
├── js/                 # JavaScript modules
│   ├── main.js         # Main application entry point
│   ├── scene.js        # Three.js scene setup
│   ├── state.js        # State management
│   └── ui.js           # UI components and interactions
├── index.html          # Main HTML file
├── shirt_baked.glb     # 3D shirt model
└── README.md           # This file
```

## Getting Started

1. Make sure all asset files are in place:

   - Copy all PNG files from the original project's assets to the `assets` folder
   - Ensure the 3D model file `shirt_baked.glb` is in the root directory

2. Open `index.html` in a modern web browser with WebGL support.

3. For AI features, start the backend server:
   ```
   cd ../server
   npm install
   npm start
   ```

## How It Works

- The application uses Three.js for 3D rendering
- Custom state management handles application state
- Modular JavaScript architecture for clean code organization
- CSS animations provide smooth transitions between pages
- WebGL shaders create realistic materials and lighting

## Credits

This project is a vanilla JavaScript port of the original React-based 3D shirt customizer. It maintains all the key features while using only pure HTML, CSS, and JavaScript.


<!-- best of luck -->