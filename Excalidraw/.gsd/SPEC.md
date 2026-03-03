# Specification: Excalidraw Clone Enhancements

**Status:** FINALIZED
**Author:** Antigravity (AI Assistant)
**Date:** 2026-02-22

## 1. Objective

Enhance the current Excalidraw clone with professional features, strong branding identity, improved usability, fix existing bugs in the text tool, and optimize workspace space with a draggable/collapsible toolbar.

## 2. Proposed Features

### 2.9. Draggable & Collapsible Sidebar Toolbar

- **Feature:** Convert the fixed top toolbar into a draggable and collapsible sidebar.
- **Implementation:**
  - Add a toggle button to slide the toolbar in/out.
  - Implement drag-and-drop functionality for the entire toolbar container.
  - Consolidate tools into a more compact sidebar format to maximize canvas space.

### 2.7. Text Tool Fixes

- **Issue:** Placeholder "Type here..." is not automatically cleared.
- **Issue:** Deleting text sometimes removes the entire object.
- **Fix:** Automatically enter editing mode and select all text when a new text object is added. Ensure backspace only deletes characters, not the object (unless empty).

### 2.8. Color Palette Expansion

- **Feature:** Add more professional and diverse colors to the toolbar.

### 2.1. Layering Controls (Done)

- Bring to Front / Send to Back functionality.

### 2.2. Background Grid (Done)

- Toggleable dot grid for alignment.

### 2.3. SVG Export (Done)

- High-quality vector export.

### 2.4. Image Import (Done)

- Local file upload support.

### 2.5. Help Modal (Done)

- Shortcut guide for users.

### 2.6. Logo and Branding

- **Feature:** A custom logo and application name ("Antidraw" or similar) in the UI.
- **Implementation:** Generate a premium logo asset, update the header with the brand name.

### 2.10. Backend Integration

- **Feature:** A dedicated backend for persistence and potentially collaboration.
- **Implementation:**
  - Create `Backend-draw` directory.
  - Initialize with Node.js and Express.
  - Set up basic API structure for future persistence.

## 3. Tech Stack Impact

- **Frontend:** React, Vite.
- **Backend:** Node.js, Express.

## 4. Acceptance Criteria

- [x] Users can move objects to front/back via UI buttons.
- [x] Users can toggle a grid on/off.
- [x] Users can download an SVG version of their drawing.
- [x] Users can upload an image and it appears on the canvas.
- [x] A help modal shows the list of shortcuts.
- [x] Application has a distinct logo and professional branding.
- [x] Branding is consistent across dark/light modes.
- [ ] Backend is initialized in `Backend-draw` with Express.
