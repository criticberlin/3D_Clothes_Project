import * as dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Check if API key exists
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: No OpenAI API key found in .env file');
  console.log('Please add your API key to the .env file:');
  console.log('OPENAI_API_KEY=your-api-key-here');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test API key
async function testApiKey() {
  try {
    console.log('🔑 Testing OpenAI API key...');
    
    // Simple API call to test authentication
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, are you working?' }],
      max_tokens: 10
    });
    
    console.log('✅ API key is valid! OpenAI API is working correctly.');
    console.log('Response:', completion.choices[0].message.content);
    
  } catch (error) {
    console.error('❌ Error testing API key:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('The API key may be invalid or expired.');
    } else if (error.message.includes('billing')) {
      console.log('Your OpenAI account may need billing information added.');
    }
    
    console.log('\nPlease check your API key and account status at:');
    console.log('https://platform.openai.com/account/api-keys');
  }
}

testApiKey(); 