import mongoose from 'mongoose';

const drawingSchema = new mongoose.Schema({
    title: { 
        type: String, 
        default: 'Untitled Drawing' 
    },
    elements: { 
        type: Array, 
        required: true 
    },
    appState: { 
        type: Object, 
        required: true 
    },
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    },
    isPublic: { 
        type: Boolean, 
        default: false 
    },
    lastSaved: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

const Drawing = mongoose.model('Drawing', drawingSchema);

export default Drawing;
