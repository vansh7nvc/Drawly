import { useState, useCallback, useEffect, useRef } from "react";
import "./App.css";
import Whiteboard from "./components/Whiteboard";
import LoginModal from "./components/LoginModal";
import Dashboard from "./components/Dashboard";
import MermaidPanel from "./components/MermaidPanel";
import LandingPage from "./components/LandingPage";
import Navbar from "./components/Navbar";
import { io } from "socket.io-client";
import * as fabric from "fabric";

const COLORS = [
  "#1e1e1e", "#ffffff", "#adb5bd", "#e03131", 
  "#f03e3e", "#d6336c", "#ae3ec9", "#7048e8", 
  "#6366f1", "#1971c2", "#0c8599", "#10b981", 
  "#2f9e44", "#37b24d", "#f59f00", "#f08c00", 
  "#e8590c", "#9c36b5", "#64748b", "#232b2b"
];

const STROKE_WIDTHS = [2, 4, 8];

const STORAGE_KEY = "excalidraw-clone-save";

function App() {
  const [canvas, setCanvas] = useState(null);
  const [activeTool, setActiveTool] = useState("select");
  const [activeColor, setActiveColor] = useState("#1e1e1e");
  const [activeStroke, setActiveStroke] = useState(2);
  const [activeFont, setActiveFont] = useState("Inter, sans-serif");
  const [activeFontSize, setActiveFontSize] = useState(24);
  const [activeTextStyle, setActiveTextStyle] = useState({ bold: false, italic: false, underline: false });
  const [zoom, setZoom] = useState(100);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("excalidraw-dark-mode");
    return saved ? JSON.parse(saved) : false;
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("antidraw-user-id");
    return saved || null;
  });
  const [showLogin, setShowLogin] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(() => !localStorage.getItem("antidraw-user-id"));
  const [gridEnabled, setGridEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Toolbar draggable & collapsible state
  const [toolbarPos, setToolbarPos] = useState({ x: window.innerWidth - 340, y: 80 });
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const isDraggingToolbar = useRef(false);
  const toolbarOffset = useRef({ x: 0, y: 0 });

  // Undo/Redo state
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isRestoring = useRef(false);
  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [cursorColor] = useState(() => `#${Math.floor(Math.random()*16777215).toString(16)}`);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentDrawingData, setCurrentDrawingData] = useState(null);
  const lastLoadedRoom = useRef(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("antidraw-gemini-key") || "");
  const [toasts, setToasts] = useState([]);
  const [showShapesPicker, setShowShapesPicker] = useState(false);
  const [showMermaidPanel, setShowMermaidPanel] = useState(false);
  const [view, setView] = useState("landing"); // 'landing' or 'app'

  const shapesPickerRef = useRef(null);

  const showToast = (message, type = "info", duration = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };

  // Close shapes picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (shapesPickerRef.current && !shapesPickerRef.current.contains(e.target)) {
        setShowShapesPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Initialize Socket Connection
  useEffect(() => {
    const newSocket = io("http://localhost:5001");
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  // Sync with Room
  useEffect(() => {
    if (socket) {
      socket.on("draw-element", (elementJson) => {
        if (!canvas) return;
        fabric.util.enlivenObjects([elementJson]).then((objs) => {
          objs.forEach((obj) => {
            // Check if element already exists to avoid duplication
            const exists = canvas.getObjects().find((o) => o.id === obj.id);
            if (!exists) {
              canvas.add(obj);
              canvas.renderAll();
            }
          });
        });
      });

      socket.on("canvas-update", (objects) => {
        if (!canvas) return;
        canvas.loadFromJSON({ objects }).then(() => canvas.renderAll());
      });

      socket.on("cursor-move", ({ userId, x, y, color }) => {
        setRemoteCursors(prev => ({
          ...prev,
          [userId]: { x, y, color, lastSeen: Date.now() }
        }));
      });
    }
    return () => {
      if (socket) {
        socket.off("draw-element");
        socket.off("canvas-update");
        socket.off("cursor-move");
      }
    };
  }, [socket, canvas]);

  // Clean up old cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        const now = Date.now();
        Object.keys(next).forEach(id => {
          if (now - next[id].lastSeen > 3000) delete next[id];
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  // =============================
  //  DARK MODE
  // =============================
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("excalidraw-dark-mode", JSON.stringify(darkMode));
  }, [darkMode]);

  // =============================
  //  SAVE / LOAD (localStorage)
  // =============================
  const saveState = useCallback(() => {
    if (!canvas || isRestoring.current) return;
    const json = JSON.stringify(canvas.toJSON());
    undoStack.current.push(json);
    if (undoStack.current.length > 50) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  }, [canvas]);

  // =============================
  //  SAVE / LOAD / EXPORT
  // =============================
  const handleCloudSave = useCallback(async () => {
    if (!canvas || !currentUser) return;
    
    setSaveStatus("saving-cloud");
    try {
      let response;
      if (currentRoom) {
        // BUG-3 FIX: PATCH existing drawing instead of creating a duplicate
        response = await fetch(`http://localhost:5001/drawings/${currentRoom}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser,
            elements: canvas.toJSON().objects,
            appState: { zoom, activeColor, activeStroke, gridEnabled, darkMode },
          })
        });
      } else {
        // No room yet: create a new drawing
        response = await fetch("http://localhost:5001/drawings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser,
            elements: canvas.toJSON().objects,
            appState: { zoom, activeColor, activeStroke, gridEnabled, darkMode },
            title: "My Cloud Drawing"
          })
        });
        if (response.ok) {
          const newDrawing = await response.json();
          if (newDrawing._id) {
            setCurrentRoom(newDrawing._id);
            lastLoadedRoom.current = newDrawing._id;
          }
        }
      }

      if (response.ok) {
        setSaveStatus("saved-cloud");
        setTimeout(() => setSaveStatus(""), 2000);
      } else {
        setSaveStatus("save-error");
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch (err) {
      console.error("Cloud save error:", err);
      setSaveStatus("save-error");
      setTimeout(() => setSaveStatus(""), 2000);
    }
  }, [canvas, currentUser, currentRoom, zoom, activeColor, activeStroke, gridEnabled, darkMode]);

  const handleSave = useCallback(() => {
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    localStorage.setItem(STORAGE_KEY, json);
    
    if (currentUser) {
      handleCloudSave();
    } else {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }
  }, [canvas, currentUser, handleCloudSave]);

  const handleExportPNG = useCallback(() => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });
    const link = document.createElement("a");
    link.download = `excalidraw-${Date.now()}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSaveStatus("exported");
    setTimeout(() => setSaveStatus(""), 2000);
  }, [canvas]);

  const handleExportSVG = useCallback(() => {
    if (!canvas) return;
    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `excalidraw-${Date.now()}.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaveStatus("exported-svg");
    setTimeout(() => setSaveStatus(""), 2000);
  }, [canvas]);

  const handleImageUpload = useCallback((e) => {
    if (!canvas || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      fabric.Image.fromURL(event.target.result).then((img) => {
        img.scaleToWidth(200);
        img.set({
          left: 100,
          top: 100,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        saveState();
      });
    };
    reader.readAsDataURL(file);
  }, [canvas, saveState]);

  const handleUndo = useCallback(() => {
    if (!canvas || undoStack.current.length === 0) return;
    isRestoring.current = true;
    const currentState = JSON.stringify(canvas.toJSON());
    redoStack.current.push(currentState);
    const prevState = undoStack.current.pop();
    canvas.loadFromJSON(prevState).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
    });
  }, [canvas]);

  const handleRedo = useCallback(() => {
    if (!canvas || redoStack.current.length === 0) return;
    isRestoring.current = true;
    const currentState = JSON.stringify(canvas.toJSON());
    undoStack.current.push(currentState);
    const nextState = redoStack.current.pop();
    canvas.loadFromJSON(nextState).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
    });
  }, [canvas]);

  const handleLoad = useCallback(() => {
    if (!canvas) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      saveState();
      canvas.loadFromJSON(saved).then(() => {
        canvas.renderAll();
        setSaveStatus("loaded");
        setTimeout(() => setSaveStatus(""), 2000);
      });
    } else {
      setSaveStatus("no-save");
      setTimeout(() => setSaveStatus(""), 2000);
    }
  }, [canvas, saveState]);

  const handleLogin = (userId) => {
    setCurrentUser(userId);
    localStorage.setItem("antidraw-user-id", userId);
    setIsDashboardOpen(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("antidraw-user-id");
    setIsDashboardOpen(false);
    setCurrentRoom(null);
    lastLoadedRoom.current = null;
    setShowLogin(true);
  };

  const handleOpenDrawing = useCallback((drawingId) => {
    setCurrentRoom(drawingId);
    setIsDashboardOpen(false);
  }, []);

  // Robust Drawing Loader
  useEffect(() => {
    if (!canvas || !currentRoom || lastLoadedRoom.current === currentRoom) return;

    const loadDrawing = async () => {
      try {
        setSaveStatus("loading-cloud");
        const response = await fetch(`http://localhost:5001/drawings/single/${currentRoom}`);
        if (response.ok) {
          const drawing = await response.json();
          canvas.clear();
          canvas.loadFromJSON({ objects: drawing.elements }).then(() => {
            canvas.renderAll();
            setSaveStatus("loaded-cloud");
            setTimeout(() => setSaveStatus(""), 2000);
            setCurrentDrawingData(drawing);
            lastLoadedRoom.current = currentRoom;
            
            // Join socket room
            if (socket) {
              socket.emit("join-room", currentRoom);
            }
          });
        }
      } catch (err) {
        console.error("Error loading drawing:", err);
        setSaveStatus("load-error");
      }
    };

    loadDrawing();
  }, [canvas, currentRoom, socket]);

  // Handle URL Deep Linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drawingId = params.get('d');
    if (drawingId && canvas) {
      handleOpenDrawing(drawingId);
    }
  }, [canvas, handleOpenDrawing]);

  const handleToggleShare = async () => {
    if (!currentDrawingData) return;
    const newStatus = !currentDrawingData.isPublic;
    
    try {
      const response = await fetch(`http://localhost:5001/drawings/share/${currentDrawingData._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newStatus, userId: currentUser })
      });
      if (response.ok) {
        setCurrentDrawingData({ ...currentDrawingData, isPublic: newStatus });
        showToast(
          newStatus ? '🔗 Drawing is now public! Copy the link to share.' : '🔒 Drawing is now private.',
          newStatus ? 'success' : 'info'
        );
      } else {
        showToast('Failed to update sharing status.', 'error');
      }
    } catch (err) {
      console.error("Share error:", err);
      showToast('Could not connect to server.', 'error');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt || !canvas) return;
    setIsGeneratingAI(true);
    try {
      const response = await fetch("http://localhost:5001/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: aiPrompt,
          userKey: geminiKey 
        })
      });
      
      if (response.ok) {
        const { elements } = await response.json();
        if (!elements || elements.length === 0) {
          showToast('AI returned no elements. Try a different prompt.', 'error');
          return;
        }
        fabric.util.enlivenObjects(elements).then((objs) => {
          objs.forEach((obj) => {
            obj.set({ id: `ai-${Math.random().toString(36).substr(2, 9)}` });
            canvas.add(obj);
          });
          canvas.renderAll();
          setAiPrompt("");
          saveState();
          showToast(`✨ AI generated ${elements.length} element(s)!`, 'success');
        });
      } else {
        // BUG-1/2 FIX: Parse and show the actual error reason
        let reason = 'AI generation failed.';
        try {
          const err = await response.json();
          if (err.message) reason = err.message;
          // Friendly messages for common errors
          if (err.message && err.message.includes('quota')) reason = '⚡ Rate limit hit. Wait ~1 min and try again (free tier).';
          if (err.message && err.message.includes('API key')) reason = '🔑 Invalid API key. Check Settings.';
        } catch(parseErr) { console.debug('AI error parse failed:', parseErr); }
        showToast(reason, 'error', 5000);
      }
    } catch (err) {
      console.error("AI Error:", err);
      showToast('Could not reach AI service. Is the backend running?', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleNewDrawing = () => {
    if (canvas) canvas.clear();
    setIsDashboardOpen(false);
    setCurrentRoom(null);
    lastLoadedRoom.current = null; // BUG-7 FIX: reset so revisited rooms can reload
  };

  // =============================
  //  SHAPE ADDING FUNCTIONS
  // =============================
  const addRect = useCallback(() => {
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 100 + Math.random() * 200,
      top: 100 + Math.random() * 200,
      fill: "",
      width: 120,
      height: 80,
      stroke: activeColor,
      strokeWidth: activeStroke,
      rx: 8,
      ry: 8,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addCircle = useCallback(() => {
    if (!canvas) return;
    const circle = new fabric.Circle({
      left: 150 + Math.random() * 200,
      top: 150 + Math.random() * 200,
      fill: "",
      radius: 50,
      stroke: activeColor,
      strokeWidth: activeStroke,
    });
    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addDiamond = useCallback(() => {
    if (!canvas) return;
    const size = 80;
    const points = [
      { x: size, y: 0 },
      { x: size * 2, y: size },
      { x: size, y: size * 2 },
      { x: 0, y: size },
    ];
    const diamond = new fabric.Polygon(points, {
      left: 200 + Math.random() * 200,
      top: 100 + Math.random() * 200,
      fill: "",
      stroke: activeColor,
      strokeWidth: activeStroke,
    });
    canvas.add(diamond);
    canvas.setActiveObject(diamond);
    canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addLine = useCallback(() => {
    if (!canvas) return;
    const line = new fabric.Line(
      [50, 100, 250, 100],
      {
        left: 100 + Math.random() * 200,
        top: 200 + Math.random() * 200,
        stroke: activeColor,
        strokeWidth: activeStroke,
      }
    );
    canvas.add(line);
    canvas.setActiveObject(line);
    canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addArrow = useCallback(() => {
    if (!canvas) return;
    const line = new fabric.Line([0, 0, 200, 0], {
      stroke: activeColor,
      strokeWidth: activeStroke,
    });
    const triangle = new fabric.Triangle({
      width: 15,
      height: 15,
      fill: activeColor,
      left: 200,
      top: -7,
      angle: 90,
    });
    const group = new fabric.Group([line, triangle], {
      left: 100 + Math.random() * 200,
      top: 200 + Math.random() * 200,
    });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  // ======= NEW SHAPES =======

  const addTriangle = useCallback(() => {
    if (!canvas) return;
    const tri = new fabric.Triangle({
      left: 150 + Math.random() * 200, top: 100 + Math.random() * 200,
      width: 120, height: 110,
      fill: "", stroke: activeColor, strokeWidth: activeStroke,
    });
    canvas.add(tri); canvas.setActiveObject(tri); canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addStar = useCallback(() => {
    if (!canvas) return;
    const pts = [], outerR = 60, innerR = 25, spikes = 5;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      pts.push({ x: r * Math.cos(angle) + outerR, y: r * Math.sin(angle) + outerR });
    }
    const star = new fabric.Polygon(pts, {
      left: 150 + Math.random() * 200, top: 100 + Math.random() * 200,
      fill: "", stroke: activeColor, strokeWidth: activeStroke,
    });
    canvas.add(star); canvas.setActiveObject(star); canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addHexagon = useCallback(() => {
    if (!canvas) return;
    const r = 60;
    const pts = Array.from({ length: 6 }, (_, i) => ({
      x: r * Math.cos((Math.PI / 3) * i - Math.PI / 6) + r,
      y: r * Math.sin((Math.PI / 3) * i - Math.PI / 6) + r,
    }));
    const hex = new fabric.Polygon(pts, {
      left: 150 + Math.random() * 200, top: 100 + Math.random() * 200,
      fill: "", stroke: activeColor, strokeWidth: activeStroke,
    });
    canvas.add(hex); canvas.setActiveObject(hex); canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addParallelogram = useCallback(() => {
    if (!canvas) return;
    const pts = [{ x: 30, y: 0 }, { x: 160, y: 0 }, { x: 130, y: 70 }, { x: 0, y: 70 }];
    const para = new fabric.Polygon(pts, {
      left: 150 + Math.random() * 200, top: 150 + Math.random() * 200,
      fill: "", stroke: activeColor, strokeWidth: activeStroke,
    });
    canvas.add(para); canvas.setActiveObject(para); canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addSpeechBubble = useCallback(() => {
    if (!canvas) return;
    const bubble = new fabric.Path(
      'M 10 10 Q 10 0 20 0 L 140 0 Q 150 0 150 10 L 150 70 Q 150 80 140 80 L 50 80 L 30 100 L 40 80 L 20 80 Q 10 80 10 70 Z',
      { left: 150 + Math.random() * 200, top: 100 + Math.random() * 200,
        fill: "", stroke: activeColor, strokeWidth: activeStroke, strokeLineJoin: 'round' }
    );
    canvas.add(bubble); canvas.setActiveObject(bubble); canvas.renderAll();
  }, [canvas, activeColor, activeStroke]);

  const addText = useCallback(() => {
    if (!canvas) return;
    const text = new fabric.IText("", {
      left: 100 + Math.random() * 200,
      top: 100 + Math.random() * 200,
      fontFamily: activeFont,
      fontSize: activeFontSize,
      fill: activeColor,
      editable: true,
      textAlign: "left",
      fontWeight: activeTextStyle.bold ? 'bold' : 'normal',
      fontStyle: activeTextStyle.italic ? 'italic' : 'normal',
      underline: activeTextStyle.underline,
    });
    
    canvas.add(text);
    canvas.setActiveObject(text);
    
    setTimeout(() => {
      text.enterEditing();
      canvas.requestRenderAll();
    }, 50);

    text.on("editing:exited", () => {
      if (!text.text || text.text.trim() === "") {
        canvas.remove(text);
        canvas.requestRenderAll();
      }
    });
    
    canvas.requestRenderAll();
  }, [canvas, activeColor, activeFont, activeFontSize, activeTextStyle]);

  const removeSelected = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, [canvas]);

  const bringToFront = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => obj.bringToFront());
    canvas.renderAll();
    saveState();
  }, [canvas, saveState]);

  const sendToBack = useCallback(() => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    // To send to back correctly, we need to consider the background if any
    activeObjects.forEach(obj => obj.sendToBack());
    canvas.renderAll();
    saveState();
  }, [canvas, saveState]);

  const toggleGrid = useCallback(() => {
    setGridEnabled(prev => !prev);
  }, []);

  const clearCanvas = useCallback(() => {
    if (!canvas) return;
    saveState();
    canvas.clear();
    canvas.set({ backgroundColor: "transparent" });
    canvas.renderAll();
  }, [canvas, saveState]);

  const handleToolClick = useCallback((tool, action) => {
    setActiveTool(tool);
    if (action) action();
  }, []);

  // =============================
  //  EFFECTS
  // =============================
  useEffect(() => {
    if (!canvas) return;
    const onModified = () => saveState();
    canvas.on("object:added", onModified);
    canvas.on("object:removed", onModified);
    canvas.on("object:modified", onModified);

    return () => {
      canvas.off("object:added", onModified);
      canvas.off("object:removed", onModified);
      canvas.off("object:modified", onModified);
    };
  }, [canvas, saveState]);

  useEffect(() => {
    const handleKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || e.key === "y")) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        handleExportPNG();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        e.preventDefault();
        document.getElementById("image-upload-input").click();
      }

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (canvas && canvas.getActiveObject() && canvas.getActiveObject().isEditing) return;

        switch (e.key.toLowerCase()) {
          case "v": setActiveTool("select"); break;
          case "r": handleToolClick("rect", addRect); break;
          case "c": handleToolClick("circle", addCircle); break;
          case "d": handleToolClick("diamond", addDiamond); break;
          case "l": handleToolClick("line", addLine); break;
          case "a": handleToolClick("arrow", addArrow); break;
          case "p": setActiveTool("freehand"); break;
          case "e": setActiveTool("eraser"); break;
          case "t": handleToolClick("text", addText); break;
          case " ": 
            e.preventDefault();
            setActiveTool("pan"); 
            break;
          case "/":
          case "?":
            setShowHelp(true);
            break;
          default: break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
      handleUndo, handleRedo, handleSave, handleExportPNG, 
    canvas, handleToolClick, addRect, addCircle, 
    addDiamond, addLine, addArrow, addText
  ]);

  // Emit Events
  useEffect(() => {
    if (!canvas || !socket || !currentRoom) return;

    const onObjectChanged = (e) => {
      const obj = e.target;
      if (!obj) return;
      if (!obj.id) obj.id = `${Date.now()}-${Math.random()}`;
      socket.emit("draw-element", { roomId: currentRoom, element: obj.toJSON() });
    };

    const onMouseMove = (e) => {
      if (!socket || !currentRoom) return;
      const pointer = canvas.getPointer(e.e);
      socket.emit("cursor-move", {
        roomId: currentRoom,
        userId: currentUser || socket.id,
        x: pointer.x,
        y: pointer.y,
        color: cursorColor
      });
    };

    canvas.on("object:added", onObjectChanged);
    canvas.on("object:modified", onObjectChanged);
    canvas.on("mouse:move", onMouseMove);

    return () => {
      canvas.off("object:added", onObjectChanged);
      canvas.off("object:modified", onObjectChanged);
      canvas.off("mouse:move", onMouseMove);
    };
  }, [canvas, socket, currentRoom, cursorColor, currentUser]);

  // =============================
  //  CANVAS CORE LOGIC
  // =============================
  const handleToolbarMouseDown = (e) => {
    if (e.target.closest('.toolbar-drag-handle')) {
      isDraggingToolbar.current = true;
      toolbarOffset.current = {
        x: e.clientX - toolbarPos.x,
        y: e.clientY - toolbarPos.y
      };
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isDraggingToolbar.current) {
        setToolbarPos({
          x: e.clientX - toolbarOffset.current.x,
          y: e.clientY - toolbarOffset.current.y
        });
      }
    };
    const handleGlobalMouseUp = () => {
      isDraggingToolbar.current = false;
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [toolbarPos]);

  // =============================
  //  ZOOM
  // =============================
  const handleZoomIn = () => {
    if (!canvas || zoom >= 200) return;
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    canvas.setZoom(newZoom / 100);
    canvas.renderAll();
  };

  const handleZoomOut = () => {
    if (!canvas || zoom <= 25) return;
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    canvas.setZoom(newZoom / 100);
    canvas.renderAll();
  };

  const handleZoomReset = () => {
    if (!canvas) return;
    setZoom(100);
    canvas.setZoom(1);
    canvas.renderAll();
  };

  // Status message helper
  const getStatusText = () => {
    switch (saveStatus) {
      case "saved": return "✓ Saved locally";
      case "saving-cloud": return "☁ Saving to cloud...";
      case "saved-cloud": return "☁ Cloud Sync Complete";
      case "save-error": return "⚠ Cloud Save Failed";
      case "loaded": return "✓ Loaded from save";
      case "loading-cloud": return "☁ Loading from cloud...";
      case "loaded-cloud": return "✓ Cloud Drawing Ready";
      case "load-error": return "⚠ Failed to load";
      case "no-save": return "No saved data found";
      case "exported": return "✓ PNG exported";
      case "exported-svg": return "✓ SVG exported";
      default: return currentUser ? `☁ Cloud Connected (${currentUser.substring(0,6)})` : "Local Workspace";
    }
  };

  if (isDashboardOpen && currentUser) {
    return (
      <Dashboard 
        userId={currentUser} 
        onOpenDrawing={handleOpenDrawing} 
        onNewDrawing={handleNewDrawing} 
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className={`app-container ${darkMode ? "dark" : ""}`}>
      <Navbar 
        view={view} 
        onNavigate={setView} 
        onShowLogin={() => setShowLogin(true)} 
        user={currentUser} 
      />

      {view === "landing" ? (
        <LandingPage onStart={() => setView("app")} />
      ) : (
        <div className="main-editor">
          {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Remote Cursors Overlay */}
      {currentRoom && Object.entries(remoteCursors).map(([id, cursor]) => (
        <div 
          key={id}
          className="remote-cursor"
          style={{ 
            left: cursor.x, 
            top: cursor.y,
            backgroundColor: cursor.color
          }}
        >
          <span className="cursor-label">{id.substring(0, 5)}</span>
        </div>
      ))}



      <div className="auth-controls" style={{ display: "none" }}>
        {currentUser && (
          <button className="auth-btn dashboard-link" onClick={() => setIsDashboardOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </button>
        )}
        {currentRoom && (
          <button className={`auth-btn share-btn ${currentDrawingData?.isPublic ? 'active' : ''}`} onClick={() => setIsShareModalOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
        )}
        {currentUser ? (
          <button className="auth-btn user-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Logout
          </button>
        ) : (
          <button className="auth-btn" onClick={() => setShowLogin(true)}>
            Sign In
          </button>
        )}
        <button className="auth-btn settings-btn" onClick={() => setIsSettingsModalOpen(true)} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      {/* ===== UNIFIED DRAGGABLE SIDEBAR TOOLBAR ===== */}
      <div 
        className={`toolbar-container ${isToolbarCollapsed ? "collapsed" : ""}`}
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
        onMouseDown={handleToolbarMouseDown}
      >
        <div className="toolbar-drag-handle">
          <svg width="20" height="10" viewBox="0 0 20 10" fill="currentColor" opacity="0.5">
            <circle cx="4" cy="3" r="1.5" /><circle cx="10" cy="3" r="1.5" /><circle cx="16" cy="3" r="1.5" />
            <circle cx="4" cy="7" r="1.5" /><circle cx="10" cy="7" r="1.5" /><circle cx="16" cy="7" r="1.5" />
          </svg>
        </div>

        <button 
          className={`toolbar-toggle-btn ${isToolbarCollapsed ? "collapsed" : ""}`}
          onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
          title={isToolbarCollapsed ? "Expand Tools" : "Collapse Tools"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="toolbar-content">
          {isToolbarCollapsed ? (
            <div className="toolbar-row">
              <button className="toolbar-btn active">
                {activeTool === "select" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>}
                {activeTool === "pan" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34L3.35 16.3a2 2 0 0 1 3.3-2.3L8 16"/></svg>}
                {activeTool === "rect" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>}
                {activeTool === "circle" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>}
                {activeTool === "diamond" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l10 10-10 10L2 12z"/></svg>}
                {activeTool === "line" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="19" x2="19" y2="5"/></svg>}
                {activeTool === "arrow" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
                {activeTool === "freehand" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
                {activeTool === "eraser" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21.4 5.6c.8.8.8 2 0 2.8L12 18"/><line x1="6" y1="20" x2="20" y2="20"/></svg>}
                {activeTool === "text" && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9.5" y1="20" x2="14.5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>}
              </button>
            </div>
          ) : (
            <>
              {/* Section: Tools & Shapes */}
              <div className="toolbar-section-label">Tools & Shapes</div>
              <div className="toolbar-row">
                <button className={`toolbar-btn ${activeTool === "select" ? "active" : ""}`} onClick={() => handleToolClick("select")} title="Select (V)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg></button>
                <button className={`toolbar-btn ${activeTool === "pan" ? "active" : ""}`} onClick={() => handleToolClick("pan")} title="Pan (Space)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34L3.35 16.3a2 2 0 0 1 3.3-2.3L8 16"/></svg></button>
                <button className={`toolbar-btn ${activeTool === "freehand" ? "active" : ""}`} onClick={() => handleToolClick("freehand")} title="Freehand (P)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg></button>
                <button className={`toolbar-btn eraser-btn ${activeTool === "eraser" ? "active" : ""}`} onClick={() => handleToolClick("eraser")} title="Eraser (E)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21.4 5.6c.8.8.8 2 0 2.8L12 18"/><line x1="6" y1="20" x2="20" y2="20"/></svg></button>
                <button className={`toolbar-btn ${activeTool === "text" ? "active" : ""}`} onClick={() => handleToolClick("text", addText)} title="Text (T)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9.5" y1="20" x2="14.5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg></button>
                
                {/* Shapes Dropdown Mini */}
                <div className="shapes-picker-wrapper" ref={shapesPickerRef} style={{ marginLeft: 'auto' }}>
                  <button
                    className={`toolbar-btn shapes-trigger-btn ${showShapesPicker ? 'open' : ''} ${
                      ['rect','circle','diamond','line','arrow','triangle','star','hexagon','parallelogram','speech'].includes(activeTool) ? 'has-active' : ''
                    }`}
                    onClick={() => setShowShapesPicker(p => !p)}
                    title="Shapes"
                  >
                    <span className="shapes-trigger-icon">
                      {activeTool === 'rect' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>}
                      {activeTool === 'circle' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>}
                      {activeTool === 'diamond' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l10 10-10 10L2 12z"/></svg>}
                      {activeTool === 'line' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="19" x2="19" y2="5"/></svg>}
                      {activeTool === 'arrow' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
                      {activeTool === 'triangle' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3L22 21H2L12 3z"/></svg>}
                      {activeTool === 'star' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12,2 15.09,9.26 23,9.27 17,14.14 19.18,21.02 12,16.77 4.82,21.02 7,14.14 1,9.27 8.91,9.26"/></svg>}
                      {activeTool === 'hexagon' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 2H7L2 12l5 10h10l5-10z"/></svg>}
                      {activeTool === 'parallelogram' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 18L8 6h12l-3 12H5z"/></svg>}
                      {activeTool === 'speech' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                      {!['rect','circle','diamond','line','arrow','triangle','star','hexagon','parallelogram','speech'].includes(activeTool) && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>
                      )}
                    </span>
                  </button>

                  {showShapesPicker && (
                    <div className="shapes-picker-panel">
                      <div className="shapes-picker-grid">
                        {[
                          { id:'rect', label:'Rect', fn: addRect, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="14" rx="2"/></svg> },
                          { id:'circle', label:'Circle', fn: addCircle, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg> },
                          { id:'diamond', label:'Diamond', fn: addDiamond, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l10 10-10 10L2 12z"/></svg> },
                          { id:'line', label:'Line', fn: addLine, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="19" x2="19" y2="5"/></svg> },
                          { id:'arrow', label:'Arrow', fn: addArrow, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> },
                          { id:'triangle', label:'Triangle', fn: addTriangle, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3L22 21H2L12 3z"/></svg> },
                          { id:'star', label:'Star', fn: addStar, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12,2 15.09,9.26 23,9.27 17,14.14 19.18,21.02 12,16.77 4.82,21.02 7,14.14 1,9.27 8.91,9.26"/></svg> },
                          { id:'hexagon', label:'Hex', fn: addHexagon, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 2H7L2 12l5 10h10l5-10z"/></svg> },
                          { id:'parallelogram', label:'Para', fn: addParallelogram, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 18L8 6h12l-3 12H5z"/></svg> },
                          { id:'speech', label:'Bubble', fn: addSpeechBubble, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                        ].map(s => (
                          <button key={s.id} className={`shape-picker-item compact ${activeTool === s.id ? 'active' : ''}`}
                            title={s.label}
                            onClick={() => { handleToolClick(s.id, s.fn); setShowShapesPicker(false); }}>
                            {s.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="toolbar-divider" />

              {/* Section: Appearance */}
              <div className="toolbar-section-label">Appearance</div>
              <div className="toolbar-row tight">
                <select 
                  className="font-picker compact" 
                  value={activeFont} 
                  onChange={e => setActiveFont(e.target.value)}
                  title="Font Family"
                  style={{ flex: 1 }}
                >
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Courier New', monospace">Courier</option>
                  <option value="'Roboto Mono', monospace">Roboto</option>
                </select>
                <div className="text-style-group compact">
                  <button className={`text-style-btn ${activeTextStyle.bold ? 'active' : ''}`} onClick={() => setActiveTextStyle(s => ({...s, bold: !s.bold}))} title="Bold"><strong>B</strong></button>
                  <button className={`text-style-btn ${activeTextStyle.italic ? 'active' : ''}`} onClick={() => setActiveTextStyle(s => ({...s, italic: !s.italic}))} title="Italic"><em>I</em></button>
                </div>
              </div>
              
              <div className="toolbar-row tight" style={{ marginTop: '4px' }}>
                <div className="color-picker-group mini">
                  {COLORS.slice(0, 10).map((color) => (
                    <div key={color} className={`color-swatch mini ${activeColor === color ? "active" : ""}`} style={{ background: color }} onClick={() => setActiveColor(color)} />
                  ))}
                  <div className="custom-color-wheel-wrapper">
                    <input 
                      type="color" 
                      className="color-swatch mini wheel" 
                      value={activeColor} 
                      onChange={e => setActiveColor(e.target.value)} 
                      title="Custom Color"
                    />
                  </div>
                </div>
              </div>

              <div className="toolbar-row" style={{ marginTop: '4px' }}>
                <div className="stroke-width-group mini">
                  {STROKE_WIDTHS.map((w) => (
                    <button key={w} className={`stroke-btn mini ${activeStroke === w ? "active" : ""}`} onClick={() => setActiveStroke(w)}><div className="stroke-line" style={{ height: w }} /></button>
                  ))}
                </div>
                <div className="font-size-group mini" style={{ marginLeft: 'auto' }}>
                  {[16, 24, 36].map(sz => (
                    <button key={sz} className={`font-size-btn mini ${activeFontSize === sz ? 'active' : ''}`} onClick={() => setActiveFontSize(sz)} title={`${sz}px`}>
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toolbar-divider" />

              {/* Section: Mermaid & AI */}
              <div className="toolbar-row tight">
                <button 
                  className="toolbar-btn text-left-btn compact-ai" 
                  onClick={() => setShowMermaidPanel(true)}
                  title="Mermaid to Diagram"
                  style={{ flex: 1, height: '32px', fontSize: '12px' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" style={{ marginRight: '6px' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Mermaid
                </button>
              </div>

              <div className="ai-input-group compact" style={{ marginTop: '4px' }}>
                <input 
                  type="text" 
                  placeholder="Ask AI..." 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                  disabled={isGeneratingAI}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
                <button 
                  className={`ai-gen-btn mini ${isGeneratingAI ? 'loading' : ''}`}
                  onClick={handleAIGenerate}
                  disabled={isGeneratingAI || !aiPrompt}
                  style={{ width: '32px', height: '32px' }}
                >
                  {isGeneratingAI ? <div className="ai-spinner mini"></div> : <svg viewBox="0 0 24 24" fill="currentColor" width="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                </button>
              </div>

              <div className="toolbar-divider" />

              {/* Section: Actions */}
              <div className="toolbar-row grid-actions">
                <button className="toolbar-btn mini-act" onClick={handleUndo} title="Undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={handleRedo} title="Redo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={handleSave} title="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={handleLoad} title="Load save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={handleExportPNG} title="Export PNG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={handleExportSVG} title="Export SVG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M4 4h16v4H4z" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={bringToFront} title="Front"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l-5.5 9h11L12 2z"/><path d="M12 11v11"/></svg></button>
                <button className="toolbar-btn mini-act" onClick={sendToBack} title="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22l5.5-9h-11L12 22z"/><path d="M12 11V2"/></svg></button>
                <button className={`toolbar-btn mini-act ${gridEnabled ? "active" : ""}`} onClick={toggleGrid} title="Grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3h18v18H3z" /><path d="M3 9h18" /></svg></button>
                <button className={`toolbar-btn mini-act ${darkMode ? "active" : ""}`} onClick={() => setDarkMode(!darkMode)} title="Theme">{darkMode ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}</button>
                <button className="toolbar-btn mini-act delete-btn" onClick={removeSelected} title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
                <button className="toolbar-btn mini-act delete-btn" onClick={clearCanvas} title="Clear All"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /></svg></button>
                <button className="toolbar-btn mini-act" onClick={() => setShowHelp(true)} title="Help"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1" /></svg></button>
              </div>
            </>
          )}
        </div>

        <input type="file" id="image-upload-input" style={{ display: "none" }} accept="image/*" onChange={handleImageUpload} />
      </div>

      {/* ===== CANVAS ===== */}
      <Whiteboard
        setCanvas={setCanvas}
        activeTool={activeTool}
        activeColor={activeColor}
        activeStroke={activeStroke}
        darkMode={darkMode}
        gridEnabled={gridEnabled}
      />

      {/* ===== SHARE MODAL ===== */}
      {isShareModalOpen && (
        <div className="modal-overlay" onClick={() => setIsShareModalOpen(false)}>
          <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Share Drawing</h2>
              <button className="close-btn" onClick={() => setIsShareModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="share-body">
              <p>People with the link can {currentDrawingData?.isPublic ? 'view' : 'request access to'} this drawing.</p>
              
              <div className="share-status-toggle">
                <div className="toggle-label">
                  <strong>Public Access</strong>
                  <span>Allow anyone with the link to view</span>
                </div>
                <button className={`toggle-switch ${currentDrawingData?.isPublic ? 'on' : ''}`} onClick={handleToggleShare}>
                  <div className="switch-knob"></div>
                </button>
              </div>

              {currentDrawingData?.isPublic && (
                <div className="share-link-box">
                  <input readOnly value={`${window.location.origin}${window.location.pathname}?d=${currentDrawingData._id}`} />
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?d=${currentDrawingData._id}`);
                    alert('Link copied to clipboard!');
                  }}>Copy</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== AUTH MODAL ===== */}
      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLogin={handleLogin} 
      />

      {/* ===== SETTINGS MODAL ===== */}
      {isSettingsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Preferences</h2>
              <button className="close-btn" onClick={() => setIsSettingsModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="settings-body">
              <div className="settings-item">
                <div className="settings-label">
                  <strong>Appearance</strong>
                  <span>Switch between light and dark themes</span>
                </div>
                <button className={`theme-toggle-standalone ${darkMode ? 'dark' : ''}`} onClick={() => setDarkMode(!darkMode)}>
                  {darkMode ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="18.36" x2="5.64" y2="16.92"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  )}
                  {darkMode ? 'Dark' : 'Light'}
                </button>
              </div>

              <div className="settings-divider" />

              <div className="settings-item vertical">
                <div className="settings-label">
                  <strong>AI API Key (BYOK)</strong>
                  <span>Use your own Gemini API key for diagram generation.</span>
                </div>
                <div className="key-input-box">
                  <input 
                    type="password" 
                    placeholder="Enter your Gemini API key..." 
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      localStorage.setItem("antidraw-gemini-key", e.target.value);
                    }}
                  />
                  {geminiKey && <button className="clear-key" onClick={() => { setGeminiKey(""); localStorage.removeItem("antidraw-gemini-key"); }}>Clear</button>}
                </div>
                <p className="settings-hint">Your key is stored locally in your browser and never leaves your machine.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== HELP MODAL ===== */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Keyboard Shortcuts</h2>
              <button className="close-btn" onClick={() => setShowHelp(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="shortcut-grid">
              <div className="shortcut-item"><span className="shortcut-desc">Selection</span><span className="shortcut-key">V</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Rectangle</span><span className="shortcut-key">R</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Circle</span><span className="shortcut-key">C</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Diamond</span><span className="shortcut-key">D</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Line</span><span className="shortcut-key">L</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Arrow</span><span className="shortcut-key">A</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Freehand</span><span className="shortcut-key">P</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Text</span><span className="shortcut-key">T</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Eraser</span><span className="shortcut-key">E</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Pan</span><span className="shortcut-key">Space</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Undo</span><span className="shortcut-key">Ctrl+Z</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Redo</span><span className="shortcut-key">Ctrl+Y</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Save</span><span className="shortcut-key">Ctrl+S</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Export</span><span className="shortcut-key">Ctrl+E</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Import</span><span className="shortcut-key">Ctrl+U</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Delete</span><span className="shortcut-key">Del</span></div>
              <div className="shortcut-item"><span className="shortcut-desc">Help</span><span className="shortcut-key">?</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ZOOM CONTROLS ===== */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomOut} id="btn-zoom-out">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="zoom-label" onClick={handleZoomReset}>{zoom}%</span>
        <button className="zoom-btn" onClick={handleZoomIn} id="btn-zoom-in">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className={`status-bar ${saveStatus ? "status-flash" : ""}`}>
        <div className={`status-dot ${saveStatus === "no-save" ? "status-dot-warn" : ""}`} />
        {getStatusText()}
      </div>

      {/* MERMAID MODAL */}
      {showMermaidPanel && (
        <MermaidPanel 
          canvas={canvas} 
          onClose={() => setShowMermaidPanel(false)} 
        />
      )}
        </div>
      )}
    </div>
  );
}

export default App;
