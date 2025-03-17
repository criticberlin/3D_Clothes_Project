/**
 * Advanced Calculations Module for 3D Fabric Simulation
 * 
 * This module provides advanced mathematical algorithms for realistic fabric
 * simulation, texture mapping, lighting calculations, and physics-based rendering.
 */

import * as THREE from 'three';

// Constants for physical properties of different fabric types
const FABRIC_PROPERTIES = {
    cotton: {
        density: 0.5,             // g/cm³
        stretchFactor: 0.05,      // Resistance to stretching (lower = more elastic)
        bendFactor: 0.15,         // Resistance to bending (lower = more flexible)
        wrinkleFactor: 0.8,       // Tendency to form wrinkles (higher = more wrinkles)
        roughness: 0.75,          // Surface roughness
        reflectivity: 0.05,       // Light reflectivity
        anisotropy: 0.6,          // Directional dependency of light reflection
        diffuseScattering: 0.85,  // How much light is scattered
        threadDensity: 120,       // Threads per inch
        threadThickness: 0.02     // mm
    },
    polyester: {
        density: 0.38,
        stretchFactor: 0.12,
        bendFactor: 0.08,
        wrinkleFactor: 0.4,
        roughness: 0.5,
        reflectivity: 0.2,
        anisotropy: 0.4,
        diffuseScattering: 0.7,
        threadDensity: 140,
        threadThickness: 0.015
    },
    silk: {
        density: 0.33,
        stretchFactor: 0.04,
        bendFactor: 0.05,
        wrinkleFactor: 0.7,
        roughness: 0.3,
        reflectivity: 0.35,
        anisotropy: 0.8,
        diffuseScattering: 0.6,
        threadDensity: 160,
        threadThickness: 0.01
    },
    wool: {
        density: 0.29,
        stretchFactor: 0.08,
        bendFactor: 0.2,
        wrinkleFactor: 0.6,
        roughness: 0.85,
        reflectivity: 0.02,
        anisotropy: 0.5,
        diffuseScattering: 0.9,
        threadDensity: 80,
        threadThickness: 0.04
    }
};

/**
 * Calculate physically-based material properties for a specific fabric type and color
 * @param {string} fabricType - The type of fabric (e.g., 'cotton', 'polyester')
 * @param {THREE.Color} color - The color of the fabric
 * @returns {Object} Material properties object for Three.js
 */
export function calculateFabricMaterialProperties(fabricType = 'cotton', color = new THREE.Color(0xffffff)) {
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;

    // Convert color to HSL to adjust properties based on brightness
    const hsl = {};
    color.getHSL(hsl);

    // Determine if this is a very dark color (like black)
    const isDarkColor = hsl.l < 0.15;

    // Adjust roughness based on color brightness (darker colors need different handling)
    let brightnessAdjustedRoughness;
    if (isDarkColor) {
        // For very dark colors like black, we need higher roughness to render correctly
        brightnessAdjustedRoughness = Math.max(properties.roughness, 0.75);
    } else {
        // For normal colors, adjust based on lightness
        brightnessAdjustedRoughness = properties.roughness * (1 - hsl.l * 0.2);
    }

    // Calculate anisotropy direction based on thread pattern (simulating fabric weave direction)
    const anisotropyRotation = Math.PI / 4; // 45 degrees by default

    // Calculate sheen intensity based on fabric type and color saturation
    // Dark colors should have less sheen to appear more realistic
    const sheenIntensity = isDarkColor
        ? properties.reflectivity * 0.3
        : properties.reflectivity * (1 + hsl.s * 0.5);

    // Calculate sheen color (typically slightly shifted towards the color's complementary)
    // For dark colors, we need a subtle sheen that's visible but not overpowering
    const sheenColor = new THREE.Color(color);
    if (isDarkColor) {
        // For dark colors, add just a hint of lightness to the sheen
        sheenColor.offsetHSL(0, 0, 0.05);
    } else {
        sheenColor.offsetHSL(0.5, 0, 0.1);
    }

    // Result properties for Three.js MeshPhysicalMaterial
    return {
        color: color,
        roughness: brightnessAdjustedRoughness,
        metalness: isDarkColor ? 0.01 : properties.reflectivity * 0.05, // Less metalness for dark fabrics
        clearcoat: isDarkColor ? 0.1 : properties.reflectivity * 0.5,  // Less clearcoat for dark fabrics
        clearcoatRoughness: properties.roughness * 0.8,
        sheen: sheenIntensity,
        sheenRoughness: 1 - properties.reflectivity,
        sheenColor: sheenColor,
        anisotropy: properties.anisotropy,
        anisotropyRotation: anisotropyRotation,
        transmission: 0,
        ior: 1.4, // Index of refraction for most fabrics
        thickness: 0.01 * (properties.threadThickness * 100),
    };
}

/**
 * Generate advanced normal map for fabric with realistic weave pattern
 * 
 * @param {number} width - Width of the texture
 * @param {number} height - Height of the texture
 * @param {string} fabricType - Type of fabric
 * @param {number} seed - Random seed for variation
 * @returns {THREE.Texture} The generated normal map
 */
export function generateAdvancedFabricNormalMap(width, height, fabricType = 'cotton', seed = Math.random() * 1000) {
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;

    // Use higher resolution for better quality
    const textureWidth = Math.max(width, 2048);
    const textureHeight = Math.max(height, 2048);

    // Create a canvas to draw the normal map
    const canvas = document.createElement('canvas');
    canvas.width = textureWidth;
    canvas.height = textureHeight;

    const ctx = canvas.getContext('2d');

    // Fill with neutral normal color (rgb: 128, 128, 255) - represents "flat" surface
    ctx.fillStyle = 'rgb(128, 128, 255)';
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    // Random number generator with seed
    const random = (i) => {
        const x = Math.sin(i + seed) * 10000;
        return x - Math.floor(x);
    };

    // Simulate thread pattern based on fabric type
    const threadCount = properties.threadDensity;
    const threadThickness = properties.threadThickness * 50; // Scale for visibility
    const threadPattern = fabricType === 'silk' ? 'twill' :
        fabricType === 'wool' ? 'loose' : 'plain';

    // Calculate the thread pattern scale based on fabric type
    const threadScale = fabricType === 'silk' ? 0.7 :
        fabricType === 'wool' ? 1.5 : 1.0;

    // Draw base fabric weave pattern
    const warpColor = 'rgb(170, 128, 255)'; // Slightly raised threads in one direction
    const weftColor = 'rgb(90, 128, 255)';  // Slightly lowered threads in other direction

    const gridSize = Math.floor(textureWidth / (threadCount * threadScale));

    // Draw different weave patterns based on fabric type
    if (threadPattern === 'twill') {
        // Twill pattern (diagonal pattern like in denim)
        ctx.fillStyle = warpColor;

        for (let y = 0; y < textureHeight; y += gridSize) {
            for (let x = 0; x < textureWidth; x += gridSize * 4) {
                const offset = Math.floor(y / gridSize) % 4;
                for (let i = 0; i < 2; i++) {
                    const xPos = (x + (offset + i) * gridSize) % textureWidth;
                    ctx.fillRect(xPos, y, gridSize, gridSize);
                }
            }
        }
    } else if (threadPattern === 'loose') {
        // Loose pattern (for wool, more random)
        for (let y = 0; y < textureHeight; y += gridSize) {
            for (let x = 0; x < textureWidth; x += gridSize) {
                // Random variation for wool texture
                const randomValue = random(x * 0.1 + y * 0.1);
                if (randomValue > 0.5) {
                    ctx.fillStyle = warpColor;
                } else {
                    ctx.fillStyle = weftColor;
                }

                // Varying thread thickness for wool
                const threadVariation = 0.8 + random(x + y) * 0.4;
                ctx.fillRect(x, y, gridSize * threadVariation, gridSize * threadVariation);
            }
        }

        // Add extra noise for wool's fuzzy appearance
        for (let i = 0; i < textureWidth * 0.05; i++) {
            const x = Math.floor(random(i * 2) * textureWidth);
            const y = Math.floor(random(i * 2 + 1) * textureHeight);
            const size = 1 + Math.floor(random(i * 3) * 3);

            ctx.fillStyle = random(i) > 0.5 ? warpColor : weftColor;
            ctx.fillRect(x, y, size, size);
        }
    } else {
        // Plain weave (standard basket weave for cotton)
        for (let y = 0; y < textureHeight; y += gridSize * 2) {
            for (let x = 0; x < textureWidth; x += gridSize * 2) {
                // First thread direction
                ctx.fillStyle = warpColor;
                ctx.fillRect(x, y, gridSize, gridSize);
                ctx.fillRect(x + gridSize, y + gridSize, gridSize, gridSize);

                // Second thread direction
                ctx.fillStyle = weftColor;
                ctx.fillRect(x + gridSize, y, gridSize, gridSize);
                ctx.fillRect(x, y + gridSize, gridSize, gridSize);
            }
        }
    }

    // Add micro-variations to simulate fabric irregularities
    const imageData = ctx.getImageData(0, 0, textureWidth, textureHeight);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Random micro-variation based on fabric type
        const variation = (random(i / 1000) - 0.5) * (properties.wrinkleFactor * 30);

        // Apply to normal map RGB (keep blue as is for normal maps)
        data[i] = Math.max(0, Math.min(255, data[i] + variation));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + variation));
    }

    ctx.putImageData(imageData, 0, 0);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);

    // Set proper texture parameters
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5); // Adjust scale of fabric pattern
    texture.needsUpdate = true;

    return texture;
}

/**
 * Calculate physically accurate wrinkle patterns for fabric based on mesh deformation
 * 
 * @param {THREE.Mesh} mesh - The mesh to calculate wrinkles for
 * @param {string} fabricType - Type of fabric
 * @param {Array} constraintPoints - Points that constrain the fabric (e.g., shoulders, chest)
 * @returns {Float32Array} Displacement map for wrinkles
 */
export function calculateFabricWrinkles(mesh, fabricType = 'cotton', constraintPoints = []) {
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;
    const geometry = mesh.geometry;
    const wrinkleFactor = properties.wrinkleFactor;

    // If we have position attributes, we can calculate tension and compression
    if (geometry.attributes.position) {
        const positionAttr = geometry.attributes.position;
        const normalAttr = geometry.attributes.normal;
        const vertexCount = positionAttr.count;

        // Create displacement data
        const displacementData = new Float32Array(vertexCount);

        // Calculate influence of constraint points (areas where fabric is held)
        const constraintInfluence = new Float32Array(vertexCount).fill(0);

        // Set up constraint points influence
        if (constraintPoints.length > 0) {
            for (let i = 0; i < vertexCount; i++) {
                const x = positionAttr.getX(i);
                const y = positionAttr.getY(i);
                const z = positionAttr.getZ(i);
                const position = new THREE.Vector3(x, y, z);

                // Calculate minimum distance to any constraint point
                let minDistance = Infinity;
                for (const point of constraintPoints) {
                    const distance = position.distanceTo(point);
                    minDistance = Math.min(minDistance, distance);
                }

                // Influence decreases with distance from constraint points
                constraintInfluence[i] = Math.max(0, 1 - minDistance / 0.5); // 0.5 is influence radius
            }
        }

        // Calculate curvature-based wrinkles
        for (let i = 0; i < vertexCount; i++) {
            // Get vertex and its normal
            const nx = normalAttr.getX(i);
            const ny = normalAttr.getY(i);
            const nz = normalAttr.getZ(i);

            // Calculate curvature approximation (this is simplified)
            const curvature = (Math.abs(nx) + Math.abs(ny) + Math.abs(nz)) / 3;

            // Areas with high constraint have fewer wrinkles
            const constraintFactor = 1 - constraintInfluence[i];

            // Calculate wrinkle intensity
            displacementData[i] = curvature * wrinkleFactor * constraintFactor * 0.05;

            // Add some randomness for natural variation
            displacementData[i] += (Math.random() * 2 - 1) * wrinkleFactor * 0.01;
        }

        return displacementData;
    }

    // Fallback: return empty displacement data
    return new Float32Array(mesh.geometry.attributes.position.count).fill(0);
}

/**
 * Apply physically-based light interaction calculations for fabric
 * 
 * @param {THREE.Material} material - The material to enhance
 * @param {string} fabricType - Type of fabric
 * @param {THREE.Color} color - Base color of the fabric
 */
export function enhanceFabricLightInteraction(material, fabricType = 'cotton', color = new THREE.Color(0xffffff)) {
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;

    // Convert color to HSL for calculations
    const hsl = {};
    color.getHSL(hsl);

    // Create and apply environment map intensity based on fabric properties
    // More reflective fabrics (silk) show more environment, less reflective (cotton) show less
    material.envMapIntensity = properties.reflectivity * 2;

    // Apply subsurface scattering properties if supported by the material
    if (material.isMeshPhysicalMaterial) {
        // Calculate subsurface properties based on fabric density and color
        // Thinner, lighter colored fabrics show more subsurface scattering
        const subsurfaceIntensity = (1 - properties.density) * hsl.l * 0.5;

        if ('attenuationDistance' in material) {
            // Modern Three.js subsurface properties
            material.attenuationDistance = 0.5 + subsurfaceIntensity;
            material.attenuationColor = new THREE.Color(color).multiplyScalar(0.8);
        }
    }

    // Enhance normal map influence based on fabric type
    if (material.normalMap) {
        // Adjust normal map strength based on fabric type
        // Rougher fabrics (wool) have stronger normal influence
        material.normalScale.set(
            properties.roughness * 1.2,
            properties.roughness * 1.2
        );
    }

    return material;
}

/**
 * Transform 2D fabric.js canvas to 3D texture with proper perspective correction
 * 
 * @param {HTMLCanvasElement} fabricCanvas - The Fabric.js canvas element
 * @param {Object} textureOptions - Options for perspective transformation
 * @returns {THREE.Texture} Transformed texture ready for 3D mapping
 */
export function transformFabricCanvasTo3D(fabricCanvas, textureOptions = {}) {
    // Validate input
    if (!fabricCanvas) {
        console.error("Invalid fabric canvas provided");
        throw new Error("Invalid fabric canvas provided");
    }

    // Extract options with safe defaults
    const {
        perspectiveX = 0,      // Horizontal perspective distortion
        perspectiveY = 0,      // Vertical perspective distortion
        rotation = 0,          // Rotation in radians
        stretchX = 1,          // Horizontal stretching factor
        stretchY = 1,          // Vertical stretching factor
        targetWidth = 1024,    // Output texture width
        targetHeight = 1024,   // Output texture height
    } = textureOptions;

    try {
        // Create a temporary canvas for the transformed output
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const ctx = tempCanvas.getContext('2d');

        if (!ctx) {
            throw new Error("Could not get 2D context from canvas");
        }

        // Clear the canvas with transparent background
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Set up the transformation matrix
        ctx.save();
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate(rotation);

        // Apply perspective transformation if needed
        if (perspectiveX !== 0 || perspectiveY !== 0) {
            // This is a simplified perspective transform using scale+translate
            // For true perspective, a more complex transform matrix would be needed
            const scaleX = 1 + perspectiveX * 0.1;
            const scaleY = 1 + perspectiveY * 0.1;
            ctx.scale(scaleX * stretchX, scaleY * stretchY);
        } else {
            ctx.scale(stretchX, stretchY);
        }

        // Draw the original canvas with transformation
        try {
            ctx.drawImage(
                fabricCanvas,
                -fabricCanvas.width / 2,
                -fabricCanvas.height / 2,
                fabricCanvas.width,
                fabricCanvas.height
            );
        } catch (drawError) {
            console.error("Error drawing canvas:", drawError);
            // Fallback to a simpler draw without transformation
            ctx.restore();
            ctx.drawImage(fabricCanvas, 0, 0, targetWidth, targetHeight);
        }

        ctx.restore();

        // Create a Three.js texture from the transformed canvas
        const texture = new THREE.CanvasTexture(tempCanvas);
        texture.needsUpdate = true;

        // Set appropriate texture parameters
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        return texture;
    } catch (error) {
        console.error("Error in transformFabricCanvasTo3D:", error);

        // Create a fallback texture with an error message
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 512;
        fallbackCanvas.height = 512;
        const ctx = fallbackCanvas.getContext('2d');

        if (ctx) {
            // Draw a simple pattern to indicate an error occurred
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#ff0000';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error processing texture', 256, 256);
        }

        // Create a basic texture from the fallback canvas
        const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
        fallbackTexture.needsUpdate = true;
        return fallbackTexture;
    }
}

/**
 * Calculate UV coordinates for precise texture placement on a complex 3D model
 * 
 * @param {THREE.Mesh} mesh - The mesh to calculate new UVs for
 * @param {Object} placementOptions - Options for texture placement
 * @returns {Float32Array} New UV coordinates
 */
export function calculatePreciseTextureUVs(mesh, placementOptions = {}) {
    const {
        position = 'center',      // Placement position: 'center', 'left', 'right', 'back'
        scale = 1,                // Scale of the texture
        offsetX = 0,              // Horizontal offset (-1 to 1)
        offsetY = 0,              // Vertical offset (-1 to 1)
        rotation = 0,             // Rotation in radians
        wrapAround = false,       // Whether the texture should wrap around curved surfaces
    } = placementOptions;

    // Get geometry data
    const geometry = mesh.geometry;
    if (!geometry.attributes.uv) return null;

    const originalUVs = geometry.attributes.uv.array;
    const positions = geometry.attributes.position.array;
    const normals = geometry.attributes.normal ? geometry.attributes.normal.array : null;

    // Create a new UV array
    const newUVs = new Float32Array(originalUVs.length);

    // Position center points based on placement option
    let centerU = 0.5, centerV = 0.5;
    let directionVector = new THREE.Vector3(0, 0, 1); // Front facing by default

    switch (position) {
        case 'left':
            centerU = 0.25;
            directionVector.set(1, 0, 0.2); // Left chest
            break;
        case 'right':
            centerU = 0.75;
            directionVector.set(-1, 0, 0.2); // Right chest
            break;
        case 'back':
            directionVector.set(0, 0, -1); // Back of shirt
            break;
        case 'center':
        default:
            directionVector.set(0, 0, 1); // Center front
            break;
    }

    // Get transformation matrix for rotation
    const rotationMatrix = new THREE.Matrix3().setFromMatrix4(
        new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), rotation)
    );
    directionVector.applyMatrix3(rotationMatrix);

    // Calculate new UVs for each vertex
    for (let i = 0; i < originalUVs.length; i += 2) {
        // Get the original UV coordinates
        const u = originalUVs[i];
        const v = originalUVs[i + 1];

        // Get position and normal for this vertex
        const vertIdx = i / 2 * 3;
        const posX = positions[vertIdx];
        const posY = positions[vertIdx + 1];
        const posZ = positions[vertIdx + 2];

        // Calculate dot product between normal and direction vector
        // This helps determine if this part of the mesh faces the right direction
        let visibilityFactor = 1;
        if (normals) {
            const normalX = normals[vertIdx];
            const normalY = normals[vertIdx + 1];
            const normalZ = normals[vertIdx + 2];

            const normalVector = new THREE.Vector3(normalX, normalY, normalZ);
            visibilityFactor = Math.max(0, normalVector.dot(directionVector));

            // If we want to wrap around, we use a softer falloff
            if (wrapAround) {
                visibilityFactor = Math.pow(visibilityFactor, 0.5);
            }
        }

        // Calculate new UV coordinates
        // Start with original UVs
        let newU = u;
        let newV = v;

        // Apply scaling around the center point
        newU = centerU + (u - centerU) / scale;
        newV = centerV + (v - centerV) / scale;

        // Apply offset
        newU += offsetX * 0.5;
        newV += offsetY * 0.5;

        // Store the new UVs, but only modify them if this part is visible
        // from the direction we care about
        if (visibilityFactor > 0.1) {
            // Blend between original and new UVs based on visibility
            newUVs[i] = newU * visibilityFactor + u * (1 - visibilityFactor);
            newUVs[i + 1] = newV * visibilityFactor + v * (1 - visibilityFactor);
        } else {
            // Keep original UVs for parts facing away
            newUVs[i] = u;
            newUVs[i + 1] = v;
        }
    }

    return newUVs;
}

/**
 * Calculate physically accurate color adjustment based on fabric properties
 * 
 * @param {THREE.Color} baseColor - The input color
 * @param {string} fabricType - Type of fabric
 * @param {Object} options - Additional adjustment options
 * @returns {THREE.Color} The adjusted color for physically accurate rendering
 */
export function calculateFabricColor(baseColor, fabricType = 'cotton', options = {}) {
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;
    const {
        weathered = 0,    // 0-1 scale of fabric weathering/fading
        wet = 0,          // 0-1 scale of fabric wetness
        lighting = 'neutral', // 'warm', 'cool', 'neutral' lighting environment
    } = options;

    // Convert color to HSL for easier adjustment
    const hsl = {};
    baseColor.getHSL(hsl);

    // Apply fabric-specific color adjustments
    // Different fabrics reflect light differently and affect the perceived color

    // Cotton tends to be more matte and slightly warmer
    if (fabricType === 'cotton') {
        hsl.s *= 0.9; // Slightly reduce saturation
        hsl.l = Math.max(0.1, Math.min(0.9, hsl.l * 0.95)); // Slightly darker
    }
    // Polyester often has a slight sheen and maintains color better
    else if (fabricType === 'silk') {
        hsl.s *= 1.1; // Increase saturation
        hsl.l = Math.min(0.95, hsl.l * 1.05); // Slightly brighter
    }
    // Wool absorbs more light and appears more muted
    else if (fabricType === 'wool') {
        hsl.s *= 0.8; // Reduce saturation
        hsl.l = Math.max(0.1, hsl.l * 0.9); // Darker
    }

    // Apply weathering/fading effect
    if (weathered > 0) {
        // Weathered fabrics lose saturation and become lighter
        hsl.s = Math.max(0, hsl.s * (1 - weathered * 0.5));
        hsl.l = Math.min(0.9, hsl.l + weathered * 0.1);
    }

    // Apply wetness effect
    if (wet > 0) {
        // Wet fabrics appear darker and more saturated
        hsl.s = Math.min(1, hsl.s * (1 + wet * 0.3));
        hsl.l = Math.max(0.05, hsl.l * (1 - wet * 0.3));
    }

    // Apply lighting environment adjustments
    if (lighting === 'warm') {
        // Warm lighting adds a slight yellow/orange tint
        hsl.h += (hsl.h > 0.1 && hsl.h < 0.5) ? -0.02 : 0.02;
    } else if (lighting === 'cool') {
        // Cool lighting adds a slight blue tint
        hsl.h += (hsl.h > 0.5 && hsl.h < 0.9) ? 0.02 : -0.02;
    }

    // Create a new color with the adjusted HSL values
    const adjustedColor = new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);

    return adjustedColor;
}

/**
 * Calculate spectral color distribution for more accurate fabric rendering
 * This simulates how fabrics interact with different wavelengths of light
 * 
 * @param {THREE.Color} baseColor - Base color
 * @param {string} fabricType - Type of fabric
 * @returns {Object} Spectral distribution data for advanced rendering
 */
export function calculateSpectralDistribution(baseColor, fabricType = 'cotton') {
    // Convert to HSL color space for calculations
    const hsl = {};
    baseColor.getHSL(hsl);

    // Each fabric type absorbs and reflects different parts of the spectrum
    const properties = FABRIC_PROPERTIES[fabricType] || FABRIC_PROPERTIES.cotton;

    // Create a simplified spectral distribution (normally this would be per wavelength)
    // Here we simplify to RGB channels for Three.js compatibility
    const redResponse = calculateChannelResponse(hsl.h, properties, 0);   // Red channel (longer wavelengths)
    const greenResponse = calculateChannelResponse(hsl.h, properties, 0.33); // Green channel (medium wavelengths)
    const blueResponse = calculateChannelResponse(hsl.h, properties, 0.66); // Blue channel (shorter wavelengths)

    // Return the spectral data as both RGB values and multipliers
    return {
        // RGB values for direct color use
        r: baseColor.r * redResponse,
        g: baseColor.g * greenResponse,
        b: baseColor.b * blueResponse,

        // Channel multipliers for more advanced shaders
        redMultiplier: redResponse,
        greenMultiplier: greenResponse,
        blueMultiplier: blueResponse,

        // Reflectance values can be used in physically-based rendering
        reflectance: [redResponse, greenResponse, blueResponse]
    };
}

// Private helper function
function calculateChannelResponse(hue, properties, channelHue) {
    // Calculate distance to this channel's hue (in color wheel space)
    const hueDist = Math.min(
        Math.abs(hue - channelHue),
        1 - Math.abs(hue - channelHue)
    );

    // Base response based on proximity to this channel's wavelength
    let response = 1 - hueDist * 2;
    response = Math.max(0.2, response); // Even non-matching wavelengths have some response

    // Modify response based on fabric properties
    // Denser fabrics absorb more light overall
    response *= (1 - properties.density * 0.2);

    // Fabrics with higher diffuse scattering spread the response more evenly
    response = response * (1 - properties.diffuseScattering) +
        properties.diffuseScattering * 0.8;

    return response;
}

// Export the fabric properties for use in other modules
export { FABRIC_PROPERTIES }; 