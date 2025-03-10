import express from 'express';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const router = express.Router();

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.route('/').get((req, res) => {
  res.status(200).json({ message: "Hello from DALL.E ROUTES" })
})

// Add health check endpoint
router.route('/ping').get((req, res) => {
  res.status(200).json({ status: 'ok', message: 'AI Server is running' });
})

router.route('/').post(async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    console.log(`Generating image for prompt: "${prompt}"`);

    const response = await openai.images.generate({
      model: "dall-e-2",
      prompt: `A high-quality, detailed image for a t-shirt design: ${prompt}. The image should be suitable for printing on a t-shirt, with clean edges and a transparent background.`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });

    // Extract base64 data
    const image = response.data[0].b64_json;

    // Convert to data URL for easier handling in the frontend
    const dataURL = `data:image/png;base64,${image}`;

    res.status(200).json({ photo: dataURL });
  } catch (error) {
    console.error("Error generating image:", error);

    // More detailed error message
    res.status(500).json({
      message: "Something went wrong",
      details: error.message
    })
  }
})

export default router;