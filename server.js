import express from 'express';
import { v1 } from '@google-cloud/aiplatform';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 1) Create Express app & parse environment
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = parseInt(process.env.PORT || '8080', 10);
if (isNaN(port)) {
    console.error('Invalid PORT value');
    process.exit(1);
}

const CONFIG = {
    projectId: 'plucky-weaver-450819-k7',
    modelId: '1401033999995895808',
    lastUpdated: '2025-02-18 03:11:52',
    developer: 'Gabesiegel'
};

// 2) Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        timestamp: CONFIG.lastUpdated
    });
});

// 3) Body Parsing & Build Directory Check
app.use(express.json({ limit: '50mb' }));

const buildPath = path.join(process.cwd(), 'build');
if (!fs.existsSync(buildPath)) {
    console.error('Build directory not found:', buildPath);
    process.exit(1);
}

app.use(express.static(buildPath));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// 4) Health Endpoints
app.get('/_ah/warmup', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: CONFIG.lastUpdated
    });
});

// 5) Vertex AI Prediction Client
const { PredictionServiceClient } = v1;
const predictionClient = new PredictionServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com'
});

// 6) /auth/token Endpoint
app.get('/auth/token', (req, res) => {
    const mockToken = {
        access_token: 'mock_access_token',
        expires_in: 3600 // 1 hour
    };
    res.json(mockToken);
});

// 7) /predict Endpoint
app.post('/predict', async (req, res) => {
    try {
        const { content, mimeType } = req.body;
        if (!content || !mimeType) {
            return res.status(400).json({
                error: 'Missing content or mimeType',
                timestamp: CONFIG.lastUpdated
            });
        }

        const [prediction] = await predictionClient.predict({
            endpoint: process.env.VERTEX_AI_ENDPOINT,
            instances: [{
                content,
                mimeType
            }]
        });

        res.json(prediction);
    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({
            error: error.message,
            timestamp: CONFIG.lastUpdated
        });
    }
});

// 8) Fallback for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

// 9) Start the Server
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[${new Date().toISOString()}] Server starting...`);
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`Project ID: ${CONFIG.projectId}`);
    console.log(`Last Updated: ${CONFIG.lastUpdated}`);
    console.log(`Static files directory: ${buildPath}`);
}).on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

// 10) Graceful Shutdown & Uncaught Errors
const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
