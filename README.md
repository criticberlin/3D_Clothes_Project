# 3D Clothes Customizer

A powerful 3D clothing customization web application built with pure HTML, CSS, and JavaScript (no frameworks). This project allows users to customize T-shirts and hoodies with their own designs or AI-generated textures through an intuitive and interactive 3D interface.

## Project Overview

This application provides an advanced 3D clothing customization platform where users can:

- Visualize garments in real-time 3D with interactive viewing angles
- Change the base color of garments
- Upload custom designs to specific areas (front, back, sleeves)
- Position, scale, and rotate designs with precision
- Generate AI-powered design textures using DALL-E API
- Download their custom creations

The system uses sophisticated texture mapping algorithms to accurately display designs on 3D garment models with realistic fabric simulation and lighting effects.

## Core Features

### 3D Visualization

- Interactive 3D models with multiple views (front, back, left, right)
- Support for multiple garment types (T-shirt, hoodie)
- Real-time fabric simulations with physically-based rendering
- Realistic lighting and materials with bump mapping

### Basic Customization

- Color picker for changing base garment color
- Multiple garment type selection
- Image upload for custom designs
- Zoom and rotate model controls

### Advanced Texture Mapping

- Multi-area customization (front, back, sleeves)
- Drag, rotate, and scale controls for precise design positioning
- Position presets for perfect image placement
- Real-time UV coordinate transformation with bilinear interpolation
- Complex mathematical algorithms for accurate texture placement on curved surfaces
- Perspective-correct texture mapping at all viewing angles
- Camera-aware interface with quaternion-based transformations

### AI-Powered Design Generation

- Integration with OpenAI's DALL-E API
- Custom design generation from text prompts
- One-click application of AI-generated designs
- Example prompts for optimal results

### User Interface

- Modern, intuitive UI with responsive design
- Light/dark theme support
- Specialized control panels for different functions
- Real-time preview of all customizations

## Technical Implementation

The application uses the following technologies and techniques:

- **Three.js** for 3D rendering and WebGL integration
- **Fabric.js** for 2D image manipulation
- **Matrix Transformation Pipeline** for texture placement
- **Quaternion-Based Rotation** for smooth, gimbal-lock free rotation
- **UV Distortion Correction** using elasticity coefficients
- **Advanced Barycentric Coordinate System** for precise texture mapping
- **Node.js backend** for AI feature integration
- **OpenAI API** for generating design textures

## Project Structure

```
/
├── assets/                     # Images and static assets
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
└── index.html                  # Main HTML file
```

## Getting Started

### Prerequisites

- Modern web browser with WebGL support
- Node.js (version 14 or higher) for AI features
- OpenAI API key (for AI design generation)

### Basic Setup

1. **Clone the repository**:

   ```
   git clone https://github.com/yourusername/3D_Clothes_Project.git
   cd 3D_Clothes_Project
   ```

2. **Launch the application**:
   Open `index.html` in a modern web browser with WebGL support.

### AI Feature Setup

1. Navigate to the server directory: `cd server`
2. Install dependencies: `npm install`
3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
4. Start the server: `npm start`

## How to Use

### Viewing Controls

- **Rotate the model**: Click and drag on the 3D view
- **Zoom**: Use the mouse wheel or pinch gestures
- **Switch views**: Use the view buttons (front, back, left, right)

### Basic Customization

- **Change color**: Use the color picker in the sidebar
- **Switch models**: Select between T-shirt and hoodie in the sidebar

### Adding Custom Designs

1. Click the "Upload" tab in the sidebar
2. Select an image file from your device
3. The image will appear on the current view of the model
4. Use the bounding box controls to position, rotate, and scale your design

### Using AI-Generated Designs

1. Click the "AI Design" tab in the sidebar
2. Enter a descriptive prompt (e.g., "Abstract watercolor pattern with blue tones")
3. Click "Generate" and wait for the AI to create your design
4. Click "Apply to Shirt" to use the generated image

### Using the Texture Mapper

- **Move design**: Click and drag inside the bounding box
- **Rotate design**: Use the rotate handle (top-right corner)
- **Scale design**: Use the scale handle (bottom-right corner)
- **Position presets**: Use the presets in the Position & Alignment panel
- **Multi-area customization**: Add different designs to different areas

### Saving Your Creation

- Click the "Download" button to save your customized garment as an image

## Troubleshooting

- **Performance issues**: Ensure your browser has WebGL enabled and updated graphics drivers
- **AI generation errors**: Verify your OpenAI API key and server connection
- **Image not appearing**: Try using a different image format or adjusting the size
- **Controls not responding**: Check for console errors and refresh the page

## Example AI Prompts

Try these prompts for great AI-generated designs:

- "A watercolor painting of mountain landscapes"
- "Minimalist line art of faces in a continuous line style"
- "Japanese-inspired wave pattern with koi fish"
- "Retro 80s geometric pattern with bright colors"
- "Abstract color gradient with flowing shapes"

## License

[MIT License](LICENSE)
