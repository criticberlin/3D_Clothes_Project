# AI Feature Setup Guide

This guide will help you set up and use the AI-powered design generator for the 3D Shirt Customizer.

## Prerequisites

- Node.js (version 14 or higher)
- An OpenAI API key (get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys))

## Setup Steps

1. **Set up the server**:

   a. Navigate to the server directory:

   ```
   cd server
   ```

   b. Install dependencies:

   ```
   npm install
   ```

   c. Create or edit the `.env` file in the server directory and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   d. Start the server:

   ```
   npm start
   ```

   You should see a message: "Server has started on port 8080"

2. **Use the AI feature in the app**:

   a. Open `index.html` in your web browser

   b. In the sidebar, click on the "AI Design" tab (magic wand icon)

   c. Enter a descriptive prompt for your design

   d. Click "Generate" and wait for the AI to create your design

   e. When the design appears, click "Apply to Shirt" to use it on your 3D model

## Troubleshooting

- **Server Connection Error**: Make sure the server is running on http://localhost:8080
- **API Key Issues**: If you see authentication errors, verify that your OpenAI API key is correct and has sufficient quota/credits

- **Image Generation Errors**: If generation fails, try simplifying your prompt or being more specific

## Example Prompts

Here are some example prompts that work well:

- "A watercolor painting of mountain landscapes"
- "Minimalist line art of faces in a continuous line style"
- "Japanese-inspired wave pattern with koi fish"
- "Retro 80s geometric pattern with bright colors"
- "Abstract color gradient with flowing shapes"

## Important Notes

- Using OpenAI's DALL-E API will incur charges based on your account's usage tier
- For best results, be descriptive in your prompts and specify colors, styles, or themes you want to include
