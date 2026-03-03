import { useEffect, useRef } from "react";
import * as fabric from "fabric";

const Whiteboard = ({ setCanvas, activeTool, activeColor, activeStroke, gridEnabled, darkMode }) => {
  const canvasEl = useRef(null);
  const fabricRef = useRef(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const options = {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "transparent",
      selection: true,
    };
    const fabricCanvas = new fabric.Canvas(canvasEl.current, options);

    // Set initial brush settings
    fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);

    fabricRef.current = fabricCanvas;
    setCanvas(fabricCanvas);

    // Handle Pan Interaction
    // ... (rest of listeners)
    fabricCanvas.on("mouse:down", (opt) => {
      if (fabricRef.current.activeTool === "pan") {
        isDragging.current = true;
        fabricCanvas.selection = false;
        lastPos.current = { x: opt.e.clientX, y: opt.e.clientY };
        fabricCanvas.defaultCursor = "grabbing";
      }
    });

    fabricCanvas.on("mouse:move", (opt) => {
      if (isDragging.current) {
        const e = opt.e;
        const vpt = fabricCanvas.viewportTransform;
        vpt[4] += e.clientX - lastPos.current.x;
        vpt[5] += e.clientY - lastPos.current.y;
        fabricCanvas.requestRenderAll();
        lastPos.current = { x: e.clientX, y: e.clientY };
      }
    });

    fabricCanvas.on("mouse:up", () => {
      if (isDragging.current) {
        fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform);
        isDragging.current = false;
        fabricCanvas.selection = true;
        fabricCanvas.defaultCursor = fabricRef.current.activeTool === "pan" ? "grab" : "default";
      }
    });

    // Handle window resize
    const handleResize = () => {
      fabricCanvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      fabricCanvas.requestRenderAll();
    };
    window.addEventListener("resize", handleResize);

    // Keyboard shortcuts (deletion)
    const handleKeyDown = (e) => {
      const activeObject = fabricCanvas.getActiveObject();
      // If we are editing text, let the text object handle backspace/delete
      if (activeObject && activeObject.isEditing) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObjects = fabricCanvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((obj) => fabricCanvas.remove(obj));
          fabricCanvas.discardActiveObject();
          fabricCanvas.requestRenderAll();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      fabricCanvas.dispose();
    };
  }, [setCanvas]);

  // Update tool settings
  useEffect(() => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    fc.activeTool = activeTool;

    // Reset settings
    fc.isDrawingMode = false;
    fc.selection = true;
    fc.skipTargetFind = false;
    fc.defaultCursor = "default";

    if (activeTool === "freehand") {
      fc.isDrawingMode = true;
      fc.freeDrawingBrush = new fabric.PencilBrush(fc); // Ensure it's a PencilBrush for freehand
      fc.freeDrawingBrush.color = activeColor;
      fc.freeDrawingBrush.width = activeStroke;
    } else if (activeTool === "eraser") {
      fc.isDrawingMode = true;
      // In Fabric 7.x, EraserBrush is available if imported. 
      // For now, we'll use a hack or simple removal on click if EraserBrush is not configured.
      // But let's try to set it up if it's available in the package.
      if (fabric.EraserBrush) {
        fc.freeDrawingBrush = new fabric.EraserBrush(fc);
        fc.freeDrawingBrush.width = activeStroke * 5; // Eraser usually needs to be thicker
      } else {
        // Fallback: remove objects on mouse:down
        fc.skipTargetFind = false;
        fc.selection = false;
        fc.isDrawingMode = false;
        fc.defaultCursor = "crosshair";
      }
    } else if (activeTool === "pan") {
      fc.selection = false;
      fc.skipTargetFind = true;
      fc.defaultCursor = "grab";
    }

    fc.requestRenderAll();
  }, [activeTool, activeColor, activeStroke]);

  // Grid rendering
  useEffect(() => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;
    
    if (gridEnabled) {
      const gridSize = 30;
      const canvas = document.createElement("canvas");
      canvas.width = gridSize;
      canvas.height = gridSize;
      const ctx = canvas.getContext("2d");
      
      ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, gridSize);
      ctx.moveTo(0, 0.5);
      ctx.lineTo(gridSize, 0.5);
      ctx.stroke();
      
      const pattern = new fabric.Pattern({
        source: canvas,
        repeat: "repeat"
      });
      
      fc.backgroundColor = pattern;
      fc.requestRenderAll();
    } else {
      fc.backgroundColor = "transparent";
      fc.requestRenderAll();
    }
  }, [gridEnabled, darkMode]);

  // Handle object deletion in Eraser fallback mode
  useEffect(() => {
    if (!fabricRef.current) return;
    const fc = fabricRef.current;

    const onMouseDown = (opt) => {
      if (fc.activeTool === "eraser" && !fabric.EraserBrush) {
        if (opt.target) {
          fc.remove(opt.target);
          fc.requestRenderAll();
        }
      }
    };

    fc.on("mouse:down", onMouseDown);
    return () => fc.off("mouse:down", onMouseDown);
  }, [activeTool]);

  // Sync brush with color/stroke
  useEffect(() => {
    if (!fabricRef.current || !fabricRef.current.freeDrawingBrush) return;
    const brush = fabricRef.current.freeDrawingBrush;
    if (activeTool === "freehand") {
      brush.color = activeColor;
      brush.width = activeStroke;
    } else if (activeTool === "eraser" && fabric.EraserBrush) {
      brush.width = activeStroke * 5;
    }
  }, [activeColor, activeStroke, activeTool]);

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasEl} />
    </div>
  );
};

export default Whiteboard;
