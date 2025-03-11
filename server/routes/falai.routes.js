import express from 'express';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = express.Router();

// Health check endpoint with more details
router.route('/ping').get((req, res) => {
  const apiKeyPresent = process.env.FAL_API_KEY ? 'present' : 'missing';
  res.status(200).json({ 
    status: 'ok', 
    message: 'Fal.ai Server is running',
    apiKeyStatus: apiKeyPresent,
    timestamp: new Date().toISOString()
  });
});

router.route('/').post(async (req, res) => {
  try {
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
        guidance_scale: 7.5
      })
    });

    const data = await response.json();
    
    // Get the image URL or base64 data depending on the fal.ai response format
    const imageUrl = data.images?.[0]?.url;
    
    // If we have a URL, we need to fetch the image and convert to base64
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      const base64Image = imageBuffer.toString('base64');
      
      // Return in the format expected by the client
      res.status(200).json({ photo: `data:image/png;base64,${base64Image}` });
    } else {
      throw new Error("Failed to generate image");
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