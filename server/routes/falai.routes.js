import express from 'express';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = express.Router();

// Validate API key
function validateApiKey() {
  if (!process.env.FAL_API_KEY) {
    throw new Error('FAL_API_KEY is not set in environment variables');
  }
}

// Health check endpoint with more details
router.route('/ping').get((req, res) => {
  try {
    validateApiKey();
    res.status(200).json({
      status: 'ok',
      message: 'Fal.ai Server is running',
      apiKeyStatus: 'present',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(200).json({
      status: 'error',
      message: 'Fal.ai Server is running but not properly configured',
      apiKeyStatus: 'missing',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.route('/').post(async (req, res) => {
  try {
    validateApiKey();
    
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    console.log(`Generating image using fal.ai for prompt: "${prompt}"`);

    // Fal.ai API for image generation (using text-to-image model)
    const response = await fetch('https://110602490-fast-sdxl.gateway.alpha.fal.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_API_KEY}`
      },
      body: JSON.stringify({
        prompt: `A high-quality, detailed image for a t-shirt design: ${prompt}. The image should be suitable for printing on a t-shirt, with clean edges.`,
        negative_prompt: "low quality, blurry, distorted",
        width: 1024,
        height: 1024,
        num_inference_steps: 40,
        guidance_scale: 7.5,
        num_images: 1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Fal.ai API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Get the image URL or base64 data depending on the fal.ai response format
    const imageUrl = data.images?.[0]?.url;

    // If we have a URL, we need to fetch the image and convert to base64
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to fetch generated image');
      }
      const imageBuffer = await imageResponse.buffer();
      const base64Image = imageBuffer.toString('base64');

      // Return in the format expected by the client
      res.status(200).json({ photo: `data:image/png;base64,${base64Image}` });
    } else if (data.error) {
      throw new Error(data.error);
    } else {
      throw new Error("Failed to generate image - no URL returned");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({
      message: "Something went wrong",
      details: error.message
    });
  }
});

export default router; 