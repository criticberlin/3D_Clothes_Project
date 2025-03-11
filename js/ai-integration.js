/**
 * AI Integration for 3D Clothes Project
 * This file handles communication with the AI server for generating textures and designs
 */

// Server configuration - using port 3000 instead of the default 8080
const AI_SERVER_URL = 'http://localhost:3000';
const FALAI_ENDPOINT = `${AI_SERVER_URL}/api/v1/falai`;

/**
 * Generate an image using fal.ai
 * @param {string} prompt - The text description for generating the image
 * @param {function} onSuccess - Callback when image is successfully generated
 * @param {function} onError - Callback when there's an error
 * @param {function} onStart - Callback when generation starts
 * @param {function} onEnd - Callback when generation ends (success or error)
 */
export async function generateAIImage(prompt, { onSuccess, onError, onStart, onEnd } = {}) {
  if (onStart) onStart();

  try {
    console.log(`Generating AI image with prompt: ${prompt}`);

    // Use fal.ai endpoint for generation
    const response = await fetch(FALAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.photo) {
      console.log('AI image generated successfully');
      if (onSuccess) onSuccess(data.photo);
    } else {
      throw new Error('No image data in response');
    }
  } catch (error) {
    console.error('Error generating AI image:', error);
    if (onError) onError(error.message);
  } finally {
    if (onEnd) onEnd();
  }
}

/**
 * Check if the AI server is running
 * @returns {Promise<boolean>} True if server is reachable, false otherwise
 */
export async function checkAIServerStatus() {
  try {
    const response = await fetch(`${FALAI_ENDPOINT}/ping`);
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.error('AI server not reachable:', error);
    return false;
  }
}

// Export default for easy importing
export default {
  generateAIImage,
  checkAIServerStatus
}; 