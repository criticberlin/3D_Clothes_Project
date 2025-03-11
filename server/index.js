import express from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';

import falaiRoutes from './routes/falai.routes.js';

dotenv.config();

const app = express();
const PORT = 3000; // Changed from 8080 to 3000

// Configure CORS to be more permissive during development
app.use(cors({
  origin: '*',  // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: "50mb" }))

// fal.ai route for AI image generation
app.use("/api/v1/falai", falaiRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: "AI Image Generation Server (fal.ai)" })
})

app.listen(PORT, () => console.log(`Server has started on port ${PORT}`))