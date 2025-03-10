# AI Server for 3D Shirt Customizer

This server provides the AI functionality for the 3D Shirt Customizer application, allowing users to generate custom designs using OpenAI's DALL-E API.

## Prerequisites

- Node.js (version 14 or higher recommended)
- An OpenAI API key

## Setup Instructions

1. Install dependencies:

   ```
   npm install
   ```

2. Create a `.env` file in the root directory with your OpenAI API key:

   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   You can obtain an API key from [OpenAI's platform](https://platform.openai.com/api-keys).

3. Start the server:

   ```
   npm start
   ```

   The server will run on `http://localhost:8080` by default.

## API Endpoints

- **GET /api/v1/dalle/ping**: Health check endpoint to verify the server is running
- **POST /api/v1/dalle**: Generate an image based on a text prompt
  - Request body: `{ "prompt": "Your design description here" }`
  - Response: `{ "photo": "data:image/png;base64,..." }`

## Notes

- The server uses OpenAI's DALL-E model to generate images
- Usage may incur charges based on your OpenAI account's usage tier
- Adjust the prompt template in `routes/dalle.routes.js` to customize the AI's behavior
