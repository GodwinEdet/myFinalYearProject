# Malaria Detection System

CNN + Grad-CAM blood smear classification — MERN + Python full-stack project.

## Project Structure

```
malaria-detection/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express API
├── ml/              # Python FastAPI + CNN + Grad-CAM
└── docs/            # Deployment guide
```

## Quick Start

### 1. ML Service (Python)
```bash
cd ml
pip install -r requirements.txt
# Place your trained malaria_cnn.h5 inside ml/model/
uvicorn app:app --reload --port 8000
```

### 2. Backend (Node.js)
```bash
cd server
npm install
cp .env.example .env   # fill in your values
npm run dev
```

### 3. Frontend (React)
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Training the Model
```bash
cd ml
# Download NIH Cell Images dataset first, then:
python train.py
# This produces ml/model/malaria_cnn.h5
```

## Deployment
See `docs/DEPLOYMENT.md` for full step-by-step instructions:
- Hugging Face Spaces (ML service)
- Render (Node.js API)
- Vercel (React frontend)
- MongoDB Atlas (database)
