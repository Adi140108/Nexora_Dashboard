🚀 Nexora Dashboard
A full-stack web dashboard built for Vibe-A-Thon 2026. The project features a JavaScript-based frontend deployed on Vercel, backed by a Node.js/Express server with a local database.
It is bulit for Vibeathon 2026

🛠️ Tech Stack
Frontend — JavaScript, HTML, CSS · Deployed on Vercel
Backend — Node.js, Express · Local database · Environment-based config

🗂️ Project Structure
The repository is split into two folders:

Nexora_Dashboard/
├── frontend/   # React app — handles the UI and communicates with the backend via API calls
└── backend/    # Node.js/Express server — exposes REST APIs consumed by the frontend

The frontend and backend are developed and deployed independently. 
The frontend is hosted on Vercel, which automatically builds and deploys it on every push to main. 
The backend is a separate Node.js server deployed on its own platform (e.g. Render or Railway), exposing API endpoints that the frontend calls at runtime.
Environment variables (.env) are used on both sides to manage secrets and API URLs without hardcoding them.
