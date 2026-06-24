# Malaria Detection System — Deployment Guide

## Overview

| Layer | Local dev | Production |
|---|---|---|
| React frontend | `localhost:5173` | Vercel |
| Node/Express API | `localhost:5000` | Render (or Railway) |
| Python ML service | `localhost:8000` | Hugging Face Spaces |
| Database | MongoDB Atlas (free) | MongoDB Atlas |

---

## Step 1 — Train & save your model locally

Before deploying, you need a trained model file: `ml/model/malaria_cnn.h5`.

### 1.1 Download the NIH Malaria Dataset

```bash
# Option A: Kaggle CLI
pip install kaggle
kaggle datasets download -d iarunava/cell-images-for-detecting-malaria
unzip cell-images-for-detecting-malaria.zip -d ml/data/

# Option B: Direct download from NIH
# https://lhncbc.nlm.nih.gov/LHC-research/LHC-projects/image-processing/malaria-datasheet.html
```

Your `ml/data/` folder must look like this:
```
ml/data/
  Parasitized/   (13,779 .png images)
  Uninfected/    (13,779 .png images)
```

### 1.2 Train the model

```bash
cd ml
pip install -r requirements.txt
python train.py
```

Training takes ~20–40 minutes on a CPU, ~5 minutes on a GPU.  
The best model is saved to `ml/model/malaria_cnn.h5`.

---

## Step 2 — Deploy the ML service to Hugging Face Spaces

### 2.1 Create a Hugging Face account

Sign up at https://huggingface.co if you don't have an account.

### 2.2 Create a new Space

1. Go to https://huggingface.co/new-space
2. Name it `malaria-ml` (or any name you choose)
3. Set **SDK** to **Docker**
4. Set visibility to **Public** (free tier)
5. Click **Create Space**

### 2.3 Push your ML code

```bash
# Install the HF CLI
pip install huggingface_hub

# Login
huggingface-cli login

# Clone the Space repo
git clone https://huggingface.co/spaces/<YOUR_HF_USERNAME>/malaria-ml
cd malaria-ml

# Copy your ML files into it
cp /path/to/malaria-detection/ml/app.py .
cp /path/to/malaria-detection/ml/requirements.txt .
cp /path/to/malaria-detection/ml/Dockerfile .
mkdir model
cp /path/to/malaria-detection/ml/model/malaria_cnn.h5 model/

# Commit and push
git add .
git commit -m "Add FastAPI malaria detection service"
git push
```

### 2.4 Wait for the Space to build

Hugging Face will build the Docker image automatically (~3–5 minutes).  
Your service will be live at:

```
https://<YOUR_HF_USERNAME>-malaria-ml.hf.space
```

Test it:
```bash
curl https://<YOUR_HF_USERNAME>-malaria-ml.hf.space/health
# Expected: {"status": "ok", "model": "loaded", ...}
```

> **Note on model size**: If your `.h5` file is over 100MB, use Git LFS:
> ```bash
> git lfs install
> git lfs track "*.h5"
> git add .gitattributes
> ```

---

## Step 3 — Set up MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a **Free (M0)** cluster (choose a region close to your users)
3. Under **Database Access**, create a user with password
4. Under **Network Access**, add `0.0.0.0/0` (allow all IPs) for now
5. Click **Connect → Connect your application** and copy the connection string

Your connection string looks like:
```
mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/malaria_detect?retryWrites=true&w=majority
```

---

## Step 4 — Deploy the Node.js API to Render

### 4.1 Push your code to GitHub

```bash
cd malaria-detection
git init
git add .
git commit -m "Initial commit"
gh repo create malaria-detection --public --source=. --push
# or: git remote add origin https://github.com/<you>/malaria-detection.git && git push -u origin main
```

### 4.2 Create a Render Web Service

1. Sign up at https://render.com
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `malaria-detect-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGODB_URI` | *(your Atlas connection string)* |
| `ML_API_URL` | `https://<YOUR_HF_USERNAME>-malaria-ml.hf.space` |
| `CLIENT_URL` | *(will fill in after Step 5)* |

6. Click **Create Web Service**

Your API will be live at: `https://malaria-detect-api.onrender.com`

---

## Step 5 — Deploy the React frontend to Vercel

### 5.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 5.2 Deploy

```bash
cd malaria-detection/client
vercel
```

Follow the prompts:
- Link to your Vercel account
- Set project name: `malaria-detect`
- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

### 5.3 Set the API URL environment variable

In the Vercel dashboard → Settings → Environment Variables, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://malaria-detect-api.onrender.com` |

Then update `client/vite.config.js` to use it, or set the proxy target to your Render URL in production.

### 5.4 Update CORS on the server

Go back to Render → Environment Variables and set:

```
CLIENT_URL = https://malaria-detect.vercel.app
```

Redeploy the server.

---

## Step 6 — Local development setup

Run all three services locally in separate terminals:

```bash
# Terminal 1 — Python ML service
cd malaria-detection/ml
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Terminal 2 — Node.js API
cd malaria-detection/server
cp .env.example .env
# Edit .env: set ML_API_URL=http://localhost:8000
npm install
npm run dev

# Terminal 3 — React frontend
cd malaria-detection/client
npm install
npm run dev
# Open http://localhost:5173
```

---

## Environment variables reference

### `server/.env`
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
ML_API_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
```

### `ml/.env` (optional)
```env
MODEL_PATH=model/malaria_cnn.h5
```

---

## Troubleshooting

### "ML service timed out"
Hugging Face free Spaces **sleep after inactivity**. The first request after a cold start can take 30–60 seconds. This is normal. Upgrade to a paid Space or use a warm-up ping if needed.

### "Model not loaded"
Check that `ml/model/malaria_cnn.h5` is in the Hugging Face Space repo. Large files (>50MB) require Git LFS — see Step 2.4 note.

### CORS errors in browser
Make sure `CLIENT_URL` in your server's environment matches your Vercel URL exactly (no trailing slash).

### Mongoose connection warnings
Atlas requires IP allowlisting. Make sure `0.0.0.0/0` is in your Atlas Network Access list, or add the specific IP of your Render service.

---

## Project file structure (final)

```
malaria-detection/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── UploadZone.jsx
│   │       ├── ResultPanel.jsx
│   │       └── HistoryPanel.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                    # Node.js + Express API
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   ├── models/Result.js
│   │   └── routes/
│   │       ├── predict.js
│   │       └── history.js
│   ├── .env.example
│   └── package.json
│
└── ml/                        # Python FastAPI + CNN
    ├── app.py                 # FastAPI inference service
    ├── train.py               # CNN training script
    ├── requirements.txt
    ├── Dockerfile             # For Hugging Face Spaces
    └── model/
        └── malaria_cnn.h5    # Trained model (generated by train.py)
```
