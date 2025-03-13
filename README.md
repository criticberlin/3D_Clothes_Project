# 3D Clothes Customizer

A powerful 3D clothing customization application built with pure HTML, CSS, and JavaScript (no frameworks). Customize T-shirts and hoodies with your own designs or AI-generated textures.

## Features

- Interactive 3D models with multiple views (front, back, left, right)
- Support for multiple garment types (T-shirt, hoodie)
- Color picker for changing base color
- Advanced texture mapping system with complex mathematical transformations
- Physically-based fabric simulation with tension and elasticity calculations
- Real-time UV coordinate transformation with bilinear interpolation
- Predefined position presets for perfect image placement
- Drag, rotate, and scale controls for precise design positioning
- AI-powered texture generation using DALL-E API
- Image download functionality
- Modern responsive UI with intuitive controls
- Real-time fabric simulations with realistic lighting and materials

## Texture Mapper Features

The enhanced texture mapper offers a sophisticated customization experience with advanced calculations:

- **Multi-Area Customization**: Apply different designs to specific areas (front, back, sleeves)
- **Advanced UV Mapping**: Complex coordinate transformation algorithms for accurate texture placement
- **Non-Uniform Rational B-Spline (NURBS) Surface Representation**: Precise surface parametrization
- **Bilinear Interpolation**: Smooth texture transitions across curved surfaces
- **Barycentric Coordinate System**: Accurate texture placement on triangulated meshes
- **Perspective-Correct Texture Mapping**: Maintains visual integrity at all viewing angles
- **3D Interactive Bounding Boxes**: Intuitive 3D interface that adjusts with your view
- **Position Presets**: One-click positioning with mathematically optimized presets
- **Smart Snap Points**: Intelligently calculated anchor points based on geometry analysis
- **Tensor-Based Transformation**: Sophisticated matrix calculations for precise rotations
- **Non-Linear Scaling Algorithms**: Preserve texture details when scaling across curved surfaces
- **Camera-Aware Interface**: Boxes automatically adjust based on quaternion-based camera transformations
- **Real-Time Normal Map Recalculation**: Ensures realistic lighting on customized areas

## Texture Calculation System

The application employs a sophisticated mathematical framework for texture manipulation:

- **Matrix Transformation Pipeline**: Series of 4×4 matrices handling translation, rotation, and scaling
- **Quaternion-Based Rotation**: Smooth, gimbal-lock free rotation of textures
- **UV Distortion Correction**: Adjusts for fabric stretching using elasticity coefficients
- **Homogeneous Coordinate System**: Enables perspective-correct texture mapping
- **Texture Space Partitioning**: Optimized rendering through spatial subdivision
- **Anti-Aliasing Algorithms**: Bicubic filtering for crisp texture edges
- **Dynamic Level-of-Detail**: Adjusts texture resolution based on viewing distance
- **Automatic Seam Handling**: Intelligently manages texture continuation across UV seams

## Prerequisites

- Modern web browser with WebGL support
- Node.js (version 14 or higher) for AI features
- OpenAI API key (for AI design generation)

## Project Structure

```
/
├── assets/                     # Images and static assets
│   ├── swatch.png              # Color picker icon
│   ├── logo-tshirt.png         # Logo design preset
│   ├── stylish-tshirt.png      # Style design preset
│   ├── ai.png                  # AI feature icon
│   ├── download.png            # Download icon
│   ├── file.png                # File upload icon
│   └── threejs.png             # Logo image
├── css/                        # CSS stylesheets
│   └── style.css               # Main stylesheet
├── models/                     # 3D model files
│   ├── tshirt.glb              # 3D T-shirt model
│   └── hoodie.glb              # 3D hoodie model
├── js/                         # JavaScript modules
│   ├── main.js                 # Main application entry point
│   ├── scene.js                # Three.js scene setup
│   ├── state.js                # State management
│   ├── ui.js                   # UI components and interactions
│   ├── texture-mapper.js       # Advanced texture mapping system
│   ├── fabric-integration.js   # Fabric.js integration
│   ├── advanced-calculations.js # Advanced mathematical calculations
│   ├── utils.js                # Utility functions
│   └── ai-integration.js       # AI integration
├── server/                     # Backend for AI features
│   ├── index.js                # Express server setup
│   └── package.json            # Node.js dependencies
├── index.html                  # Main HTML file
├── TEXTURE-MAPPER-IMPLEMENTATION.md # Implementation guide
├── AI-FEATURE-SETUP.md         # AI setup instructions
└── README.md                   # This file
```

## Getting Started

1. **Clone the repository**:

   ```
   git clone https://github.com/yourusername/3D_Clothes_Project.git
   cd 3D_Clothes_Project
   ```

2. **Set up the project**:

   Make sure all asset files are in place according to the project structure above.

3. **Launch the application**:

   Open `index.html` in a modern web browser with WebGL support.

4. **For AI features** (optional):

   a. Navigate to the server directory:

   ```
   cd server
   ```

   b. Install dependencies:

   ```
   npm install
   ```

   c. Create a `.env` file in the server directory with your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   d. Start the server:

   ```
   npm start
   ```

## How to Use

### Basic Controls

- **Rotate the model**: Click and drag on the 3D view
- **Zoom**: Use the mouse wheel or pinch gestures
- **Change color**: Use the color picker in the sidebar
- **Switch models**: Select between T-shirt and hoodie in the sidebar

### Adding Designs

1. **Upload an image**:

   - Click the "Upload" tab in the sidebar
   - Select an image file from your device
   - The image will appear on the current view of the model

2. **Generate AI designs** (requires server setup):
   - Click the "AI Design" tab in the sidebar
   - Enter a descriptive prompt (e.g., "Abstract watercolor pattern with blue tones")
   - Click "Generate" and wait for the AI to create your design
   - Click "Apply to Shirt" to use the generated image

### Using the Texture Mapper

1. **Positioning your design**:

   - Drag: Click and drag inside the bounding box
   - Rotate: Use the rotate handle (top-right corner)
   - Scale: Use the scale handle (bottom-right corner)

2. **Using position presets**:

   - Click the "Position & Alignment" panel
   - Select preset positions (center, top, bottom, left, right, corners)

3. **Managing multiple areas**:

   - Double-click on any area to upload an image specifically to that area
   - Each area can have its own unique image and positioning

4. **Removing designs**:
   - Use the remove button in the bounding box
   - Or use the "Remove Image" button in the Position panel

### Downloading Your Creation

- Click the "Download" button in the sidebar
- The current view of your customized garment will be saved as an image

## AI Design Examples

Try these example prompts for great results:

- "A watercolor painting of mountain landscapes"
- "Minimalist line art of faces in a continuous line style"
- "Japanese-inspired wave pattern with koi fish"
- "Retro 80s geometric pattern with bright colors"
- "Abstract color gradient with flowing shapes"

## Troubleshooting

- **Performance issues**: Lower the quality setting in the settings menu
- **WebGL errors**: Make sure your browser supports WebGL and has it enabled
- **AI generation errors**: Verify your OpenAI API key and server connection
- **Texture mapping issues**: Check the console for debug information

## Credits

This project is a vanilla JavaScript implementation of a 3D clothes customization platform. It uses Three.js for 3D rendering and WebGL for realistic materials and lighting.

## License

[MIT License](LICENSE)
