# 3D Clothing Customization System

A model-agnostic 3D clothing customization system that allows users to add designs, decals, and textures to different types of clothing models.

## Features

- Support for multiple 3D clothing models (T-shirts, hoodies, and more)
- Custom texture mapping for each model type
- AI-generated designs with smart placement
- Independent customization per model type
- Dynamic view selection based on model type
- Extensible architecture for adding new model types

## Model Configuration

Each model type requires a configuration object with the following structure:

```javascript
{
    name: "Model Display Name",
    glbPath: "./path/to/model.glb",
    defaultColor: "#FFFFFF",
    defaultScale: 1.0,
    views: {
        "view_id": {
            name: "View Display Name",
            bounds: { x: 0, y: 0, width: 1, height: 1 },
            defaultScale: 1,
            uvRect: { u1: 0, v1: 0, u2: 1, v2: 1 },
            transformMatrix: {
                scale: { x: 1, y: 1 },
                rotation: 0,
                offset: { x: 0, y: 0 }
            }
        },
        // Additional views...
    },
    textureSettings: {
        canvasWidth: 1024,
        canvasHeight: 1024,
        baseColor: "#FFFFFF",
        acceptsFullTexture: true,
        acceptsDecals: true
    },
    viewDetection: {
        zones: [
            { x: [0.3, 0.7], y: [0.2, 0.8], view: "front" },
            // Additional zones...
        ]
    }
}
```

## Adding a New Model Type

To add a new model type, use the `registerModelType` function:

```javascript
const newModelConfig = {
    name: "New Model",
    glbPath: "./models/new_model.glb",
    views: {
        // View configurations
    },
    // Additional settings
};

window.registerModelType('new_model_id', newModelConfig);
```

See the `registerNewModelExample` function in `main.js` for a complete example.

## Key Components

- `scene.js`: Handles 3D scene rendering and model loading
- `texture-mapper.js`: Manages custom textures and decals for each model
- `ui.js`: Provides user interface for model customization
- `main.js`: Initializes the application and connects components

## Design Considerations

- Each model maintains its own state and customizations
- Texture coordinates (UVs) are defined per view for precise mapping
- Smart placement detection identifies appropriate views based on cursor position
- Automatic scaling adjusts designs for different view sizes

## Requirements

- Modern web browser with WebGL support
- Internet connection for AI-generated designs

## Project Overview

This application provides an advanced 3D clothing customization platform where users can:

- Visualize garments in real-time 3D with interactive viewing angles
- Change the base color of garments
- Upload custom designs to specific areas (front, back, sleeves)
- Position, scale, and rotate designs with precision
- Generate AI-powered design textures using DALL-E API
- Download their custom creations

## Core Features

### 3D Visualization and Editor (`3d-editor.js`)
- Advanced 3D model manipulation and rendering
- Real-time fabric simulation
- Camera controls and view management
- Lighting and material system
- Model transformation and animation

### Scene Management (`scene.js`)
- Three.js scene setup and configuration
- Model loading and management
- Lighting setup
- Camera controls
- Render loop management

### User Interface (`ui.js`)
- Interactive control panels
- Color picker interface
- Design upload interface
- AI generation interface
- View controls
- Responsive layout management

### Texture Mapping (`texture-mapper.js`)
- Advanced UV mapping
- Texture coordinate transformation
- Multi-area texture application
- Real-time texture preview
- Texture distortion correction

### State Management (`state.js`)
- Application state tracking
- History management
- Undo/redo functionality
- Model state persistence
- Event handling

### Color Management (`color-manager.js`)
- Color palette management
- Color transformation
- Material color updates
- Color history
- Color preset management

### Fabric Integration (`fabric-integration.js`)
- Canvas manipulation
- Image processing
- Design transformation
- Pattern creation
- Texture generation

### AI Integration (`ai-integration.js`)
- DALL-E API integration
- Prompt management
- Image generation
- Result processing
- Error handling

### Utility Functions (`utils.js`)
- Helper functions
- Math utilities
- File handling
- Data conversion
- Validation functions

## Project Structure

```
/
├── css/                        # CSS stylesheets
├── js/                         # JavaScript modules
│   ├── 3d-editor.js           # Main 3D editor functionality
│   ├── scene.js               # Three.js scene management
│   ├── ui.js                  # User interface components
│   ├── texture-mapper.js      # Texture mapping system
│   ├── state.js               # State management
│   ├── color-manager.js       # Color management system
│   ├── fabric-integration.js  # Fabric.js integration
│   ├── ai-integration.js      # AI feature integration
│   ├── utils.js               # Utility functions
│   └── main.js                # Application entry point
├── models/                     # 3D model files
├── server/                     # Backend server
│   ├── routes/                # API routes
│   ├── index.js               # Server entry point
│   ├── test-falai-key.js      # API key testing
│   └── package.json           # Dependencies
└── index.html                 # Main HTML file
```

## Getting Started

### Prerequisites

- Modern web browser with WebGL support
- Node.js (version 14 or higher)
- OpenAI API key (for AI features)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/3D_Clothes_Project.git
   cd 3D_Clothes_Project
   ```

2. Set up the server:
   ```bash
   cd server
   npm install
   ```

3. Create a `.env` file in the server directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open `index.html` in your web browser

## Usage Guide

### Basic Controls
- Rotate: Click and drag
- Zoom: Mouse wheel
- Pan: Right-click and drag
- Reset view: Double-click

### Customization Features
1. Color Change:
   - Use the color picker in the sidebar
   - Select from preset colors
   - Input custom RGB/HEX values

2. Design Upload:
   - Click "Upload Design"
   - Select image file
   - Use transform controls to position

3. AI Generation:
   - Enter prompt in AI tab
   - Click "Generate"
   - Apply generated design

4. Texture Mapping:
   - Select target area (front/back/sleeves)
   - Upload or generate texture
   - Adjust position and scale

## Technical Details

### Rendering Pipeline
- WebGL-based rendering
- PBR materials
- Real-time shadows
- Post-processing effects

### Texture System
- UV mapping
- Multi-texture support
- Real-time texture updates
- Texture compression

### State Management
- Event-driven architecture
- State persistence
- History tracking
- Real-time updates

## Troubleshooting

Common Issues:
1. Performance Issues
   - Check WebGL support
   - Update graphics drivers
   - Reduce texture sizes

2. AI Generation
   - Verify API key
   - Check server connection
   - Validate prompt format

3. Texture Mapping
   - Check image format
   - Verify UV coordinates
   - Adjust texture size

## License

[MIT License](LICENSE) 