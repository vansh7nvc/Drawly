import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { connectDB } from './db_connection.js';
import dotenv from 'dotenv';
import User from './models/users.js';
import Drawing from './models/drawings.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 5001;

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for complex drawings

// --- Real-time Collaboration (Socket.io) ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
    });

    socket.on('draw-element', ({ roomId, element }) => {
        socket.to(roomId).emit('draw-element', element);
    });

    socket.on('canvas-update', ({ roomId, objects }) => {
        socket.to(roomId).emit('canvas-update', objects);
    });

    socket.on('cursor-move', ({ roomId, cursorData }) => {
        socket.to(roomId).emit('cursor-move', cursorData);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});


// User Registration Endpoint
app.post("/users", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const user = new User({ username, email, password });
        await user.save();
        res.status(201).json({ message: "User created successfully", userId: user._id });
    } catch (err) {
        console.error("Registration error:", err);
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        if (err.code === 11000) {
            return res.status(400).json({ message: "Username or email already exists" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
});

// User Login Endpoint
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        
        res.json({ message: "Login successful", userId: user._id });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Save Drawing Endpoint
app.post("/drawings", async (req, res) => {
    try {
        const { title, elements, appState, userId } = req.body;
        
        if (!userId || !elements) {
            return res.status(400).json({ message: "userId and elements are required" });
        }

        const drawing = new Drawing({
            title: title || 'Untitled Drawing',
            elements,
            appState,
            owner: userId
        });

        await drawing.save();
        res.status(201).json({ 
            message: "Drawing saved successfully", 
            drawingId: drawing._id,
            _id: drawing._id,
            title: drawing.title,
            lastSaved: drawing.lastSaved 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving drawing" });
    }
});

// Get User's Drawings (with Search)
app.get("/drawings/user/:userId", async (req, res) => {
    try {
        const { search } = req.query;
        let query = { owner: req.params.userId };
        
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const drawings = await Drawing.find(query)
            .select('title lastSaved isPublic')
            .sort({ lastSaved: -1 });
        res.json(drawings);
    } catch (err) {
        console.error("Error fetching drawings:", err);
        res.status(500).json({ message: "Error fetching drawings" });
    }
});

// Get Single Drawing
app.get("/drawings/single/:id", async (req, res) => {
    try {
        const drawing = await Drawing.findById(req.params.id);
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found" });
        }
        res.json(drawing);
    } catch (err) {
        console.error("Error fetching single drawing:", err);
        res.status(500).json({ message: "Error fetching drawing" });
    }
});
// Rename Drawing
app.patch("/drawings/:id", async (req, res) => {
    try {
        const { title } = req.body;
        const drawing = await Drawing.findByIdAndUpdate(
            req.params.id, 
            { title, lastSaved: Date.now() }, 
            { new: true }
        );
        res.json(drawing);
    } catch (err) {
        console.error("Error renaming drawing:", err);
        res.status(500).json({ message: "Error renaming drawing" });
    }
});

// Update Drawing Content (PATCH to avoid duplicate saves - BUG-3 fix)
app.patch("/drawings/:id/content", async (req, res) => {
    try {
        const { elements, appState, title, userId } = req.body;
        const drawing = await Drawing.findOneAndUpdate(
            { _id: req.params.id, owner: userId },
            { elements, appState, ...(title && { title }), lastSaved: Date.now() },
            { new: true }
        );
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found or not authorized" });
        }
        res.json(drawing);
    } catch (err) {
        console.error("Error updating drawing content:", err);
        res.status(500).json({ message: "Error updating drawing" });
    }
});

// Toggle Public/Private Status (with ownership check - BUG-9 fix)
app.patch("/drawings/share/:id", async (req, res) => {
    try {
        const { isPublic, userId } = req.body;
        // Find drawing - if userId provided, verify ownership
        const query = { _id: req.params.id };
        if (userId) query.owner = userId;
        const drawing = await Drawing.findOneAndUpdate(
            query, 
            { isPublic }, 
            { new: true }
        );
        if (!drawing) {
            return res.status(404).json({ message: "Drawing not found or not authorized" });
        }
        res.json(drawing);
    } catch (err) {
        console.error("Error updating share status:", err);
        res.status(500).json({ message: "Error updating visibility" });
    }
});

// Delete Drawing
app.delete("/drawings/:id", async (req, res) => {
    try {
        await Drawing.findByIdAndDelete(req.params.id);
        res.json({ message: "Drawing deleted successfully" });
    } catch (err) {
        console.error("Error deleting drawing:", err);
        res.status(500).json({ message: "Error deleting drawing" });
    }
});

// --- AI Generation Endpoint ---
app.post("/ai/generate", async (req, res) => {
    try {
        const { prompt, userKey } = req.body;
        
        // Use user-provided key if available, otherwise fallback to server key
        let activeModel = aiModel;
        if (userKey) {
            const userGenAI = new GoogleGenerativeAI(userKey);
            activeModel = userGenAI.getGenerativeModel({ 
                model: "gemini-2.0-flash",
            });
        }

        const systemPrompt = `You are a professional diagram architect. 
        Translate user requests into a JSON array of Fabric.js objects.
        Supported types: 'rect', 'circle', 'triangle', 'line', 'text'.
        
        Rules:
        1. Use modern, professional colors (indigo: #6366f1, slate: #475569, success: #22c55e).
        2. Set strokeWidth: 2 and rx: 8 for rectangles.
        3. For 'text', use fontFamily: 'Inter'.
        4. Center drawing around 500, 350.
        5. IMPORTANT: Return ONLY a JSON object with an "elements" key containing the array.
        
        Example request: "Draw a login box"
        Example response: { "elements": [{"type": "rect", "left": 400, "top": 300, "width": 200, "height": 100, "fill": "#ffffff", "stroke": "#6366f1", "strokeWidth": 2, "rx": 8}] }`;

        const result = await activeModel.generateContent([
            { text: systemPrompt },
            { text: `User Request: ${prompt}` }
        ]);

        const responseText = result.response.text();
        // Strip markdown code fences if present (Gemini sometimes wraps JSON in ```json ... ```)
        const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        res.json(JSON.parse(cleaned));
    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ message: "AI failed to generate diagram" });
    }
});

app.get('/', (req, res) => {
    res.send('Backend for Antidraw is running!');
});

// Endpoint to check DB status
app.get('/db-status', (req, res) => {
    const isConnected = mongoose.connection.readyState === 1;
    res.json({ status: isConnected ? "connected" : "disconnected" });
});

httpServer.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    const dbConnected = await connectDB();
    if (dbConnected) {
        console.log("Database integrated successfully.");
    } else {
        console.log("Database connection failed. Please check your .env credentials.");
    }
});
