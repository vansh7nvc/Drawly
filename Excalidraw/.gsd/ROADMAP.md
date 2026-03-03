# Roadmap

## Milestone 1: Core Enhancements

### Phase 1: Layering & Grid

- [x] Implement "Bring to Front" and "Send to Back" buttons in toolbar.
- [x] Add Grid toggle state and background pattern rendering.
- **Goal:** Improve object arrangement and precision.

### Phase 2: Export & Import

- [x] Add SVG Export functionality.
- [x] Implement Image Import via file picker.
- **Goal:** Enhance interoperability and asset usage.

### Phase 3: UI & Help

- [x] Create Help Modal with shortcut listings.
- [x] Polish UI (better active states, responsive tweaks).
- **Goal:** Improved user discovery and accessibility.

### Phase 4: Branding & Identity

- [x] Generate and integrate a custom logo.
- [x] Add branding title ("Antidraw") to the header.
- [x] Polish colors and typography for a "premium" feel.
- **Goal:** Establish a unique and professional identity.

## Milestone 2: Polish & UX Improvements

### Phase 5: Tool Refinement & Customization

- [x] Fix Text tool placeholder behavior (select on add).
- [x] Expand color palette with more professional options.
- **Goal:** Improve text editing flow and provide more color choices.

### Phase 6: Space Optimization (Sidebar Toolbar)

- [ ] Implement Draggable toolbar support.
- [ ] Add sidebar collapse/slide toggle.
- [ ] Consolidate secondary/main toolbars into a unified draggable container.
- **Goal:** Maximize canvas workspace and user flexibility.

## Milestone 3: Backend & Persistence

### Phase 7: Backend Infrastructure

- [x] Initialize `Backend-draw` folder.
- [x] Install `express` and other initial dependencies.
- [x] Set up basic "Hello World" server.
- **Goal:** Establish the foundation for server-side logic and persistence.

## Milestone 4: Advanced Core & Smart Interactions

### Phase 8: Connector & Smart Binding

- [ ] Implement Smart Binding (lines/arrows snap to shape borders).
- [ ] Add Elbow Arrows (Orthogonal routing).
- **Goal:** Enable proper flowchart and diagram creation.

### Phase 9: Styling & Theming

- [ ] Integrate hand-drawn rendering techniques (e.g., custom paths or Rough.js).
- [ ] Add Dark/Light mode theming.
- [ ] Add advanced fill styles (cross-hatch, hachure).
- **Goal:** Achieve the signature aesthetic and improve visual customization.

### Phase 10: Advanced Canvas Tools

- [ ] Multi-Format Export (High-fidelity PDF) & Clipboard copy support.
- [ ] Element Switching (Toggle between shapes quickly).
- **Goal:** Better user workflow and professional export options.

## Milestone 5: Cloud Infrastructure & Persistence

### Phase 11: Accounts & Database

- [ ] Design MongoDB schemas for Users, Workspaces, and Drawings.
- [ ] Implement User Authentication (JWT/OAuth).
- **Goal:** Allow users to save their drawings to the cloud securely.

### Phase 12: File Management

- [ ] Create Dashboard for Workspace & Folder organization.
- [ ] Implement cloud save/load functionalities.
- **Goal:** Power-user capabilities for managing multiple diagrams.

## Milestone 6: Real-Time Collaboration

### Phase 13: Live Sessions

- [ ] Set up WebSocket server (Socket.io or similar).
- [ ] Implement Real-Time Collaboration with live cursor tracking.
- [ ] Implement session sharing & Read-Only Links.
- **Goal:** Seamless multiplayer whiteboard experience.

## Milestone 7: AI & Generative Features

### Phase 14: AI Integrations

- [ ] Add Text-to-Diagram capabilities using natural language processing.
- [ ] Implement Bring Your Own Key (BYOK) for Gemini & OpenAI integration.
- **Goal:** Advanced generative tools with zero infrastructure cost and direct user control.

## Progress

- **Milestone 1:** 100%
- **Milestone 2:** 50%
  - **Phase 5:** 100%
  - **Phase 6:** 0%
- **Milestone 3:** 100%
  - **Phase 7:** 100%
- **Milestone 4:** 0%
- **Milestone 5:** 100%
  - **Phase 11:** 100% (Database schemas and initial endpoints complete)
  - **Phase 12:** 100% (Dashboard UI, Cloud load/save, Search, Rename, and Delete integrated)
- **Milestone 6:** 100%
  - **Phase 13:** 100% (Socket.io infrastructure and room logic complete)
  - **Phase 14:** 100% (Real-time cursor tracking and element sync complete)
  - **Phase 15:** 100% (Session sharing and Read-Only Links complete)
- **Milestone 7:** 0%
