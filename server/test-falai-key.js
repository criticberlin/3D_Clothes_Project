import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Check if API key exists
if (!process.env.FAL_API_KEY) {
  console.error('❌ ERROR: No fal.ai API key found in .env file');
  console.log('Please add your API key to the .env file:');
  console.log('FAL_API_KEY=your-api-key-here');
  process.exit(1);
}

// Test API key
async function testFalApiKey() {
  try {
    console.log('🔑 Testing fal.ai API key...');
    
    // Simple API call to test authentication - using a minimal request
    const response = await fetch('https://110602490-fast-sdxl.gateway.alpha.fal.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${process.env.FAL_API_KEY}`
      },
      body: JSON.stringify({
        prompt: 'A simple test image with blue background',
        width: 512,
        height: 512,
        num_inference_steps: 10  // Using fewer steps for a quicker test
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    if (data.images && data.images.length > 0) {
      console.log('✅ API key is valid! fal.ai API is working correctly.');
      console.log('Generated image URL:', data.images[0].url);
    } else {
      console.log('⚠️ API response did not contain expected image data.');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing API key:', error.message);
    
    if (error.message.includes('authentication') || error.message.includes('authorization')) {
      console.log('The API key may be invalid or expired.');
    }
    
    console.log('\nPlease check your API key and account status at:');
    console.log('https://fal.ai/dashboard');
  }
}

testFalApiKey(); 