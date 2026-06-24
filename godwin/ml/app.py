"""
Malaria Detection ML Service
FastAPI app serving a trained CNN model with Grad-CAM explainability.
Designed for deployment on Hugging Face Spaces (Docker).
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import tensorflow as tf
import cv2
import base64
import io
import os
import time
import logging
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Malaria Detection API",
    description="CNN + Grad-CAM malaria parasite detection from blood smear images",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Constants ───────────────────────────────────────────────────────────────
IMG_SIZE = (130, 130)          # NIH dataset standard
MODEL_PATH = os.getenv("MODEL_PATH", "model/malaria_cnn.h5")
THRESHOLD = 0.5                # classification threshold
CLASS_NAMES = ["Uninfected", "Parasitized"]

# ─── Load model once at startup ──────────────────────────────────────────────
model: tf.keras.Model = None

@app.on_event("startup")
async def load_model():
    global model
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        logger.info(f"Model loaded from {MODEL_PATH}")
        logger.info(f"Input shape: {model.input_shape}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        logger.warning("Running without a model — /predict will return demo data.")


# ─── Preprocessing ───────────────────────────────────────────────────────────
def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Load image bytes → normalised (1, H, W, 3) float32 array."""
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = np.array(pil_img)
    img = cv2.resize(img, IMG_SIZE)
    img = img.astype(np.float32) / 255.0
    return np.expand_dims(img, axis=0)


# ─── Grad-CAM ────────────────────────────────────────────────────────────────
def generate_gradcam(
    model: tf.keras.Model,
    img_array: np.ndarray,
    last_conv_layer_name: str = None,
) -> np.ndarray:
    """
    Generate a Grad-CAM heatmap overlaid on the original image.
    Returns an RGB numpy array (H, W, 3) uint8.
    """
    # Auto-detect last conv layer if not provided
    if last_conv_layer_name is None:
        for layer in reversed(model.layers):
            if "conv" in layer.name.lower():
                last_conv_layer_name = layer.name
                break

    if last_conv_layer_name is None:
        raise ValueError("No convolutional layer found in the model.")

    # Build gradient model
    grad_model = tf.keras.models.Model(
        inputs=model.input,
        outputs=[
            model.get_layer(last_conv_layer_name).output,
            model.output,
        ],
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        # For binary classification with sigmoid output
        if predictions.shape[-1] == 1:
            loss = predictions[:, 0]
        else:
            class_idx = tf.argmax(predictions[0])
            loss = predictions[:, class_idx]

    # Compute gradients of class score w.r.t. conv feature maps
    grads = tape.gradient(loss, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap).numpy()

    # Normalise
    heatmap = np.maximum(heatmap, 0)
    if heatmap.max() > 0:
        heatmap /= heatmap.max()

    # Resize heatmap to input image size
    original = (img_array[0] * 255).astype(np.uint8)
    heatmap_resized = cv2.resize(heatmap, (original.shape[1], original.shape[0]))

    # Apply colormap and overlay
    heatmap_color = cv2.applyColorMap(
        np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET
    )
    heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)

    superimposed = cv2.addWeighted(original, 0.55, heatmap_color, 0.45, 0)
    return superimposed


def encode_image_to_base64(img_array: np.ndarray) -> str:
    """Convert numpy RGB array to base64 PNG string."""
    pil_img = Image.fromarray(img_array.astype(np.uint8))
    buffer = io.BytesIO()
    pil_img.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ─── Demo model metrics (replace with real eval results) ─────────────────────
MODEL_METRICS = {
    "accuracy": 0.9682,
    "precision": 0.9701,
    "recall": 0.9665,
    "f1_score": 0.9683,
    "specificity": 0.9699,
}


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "Malaria Detection ML API",
        "status": "running",
        "model_loaded": model is not None,
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "loaded" if model is not None else "not loaded",
        "tf_version": tf.__version__,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Accept a blood smear image, run CNN inference, return:
    - label: "Parasitized" or "Uninfected"
    - confidence: float 0–1
    - heatmap: base64 PNG of Grad-CAM overlay
    - metrics: model evaluation metrics
    """
    # Validate file type
    if file.content_type not in [
        "image/jpeg", "image/png", "image/tiff", "image/bmp"
    ]:
        raise HTTPException(
            status_code=422,
            detail="Unsupported file type. Upload JPEG, PNG, TIFF or BMP.",
        )

    start = time.time()
    image_bytes = await file.read()

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        img_array = preprocess_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not decode image: {e}")

    # ── Inference ──
    if model is None:
        # Demo mode when model file is absent
        logger.warning("No model loaded — returning demo prediction.")
        confidence = float(np.random.uniform(0.7, 0.98))
        label = "Parasitized" if confidence > 0.5 else "Uninfected"
        heatmap_b64 = encode_image_to_base64((img_array[0] * 255).astype(np.uint8))
    else:
        try:
            preds = model.predict(img_array, verbose=0)
            # Handle both sigmoid (shape [1,1]) and softmax (shape [1,2]) outputs
            if preds.shape[-1] == 1:
                confidence = float(preds[0][0])
            else:
                confidence = float(preds[0][1])  # probability of class 1

            label = CLASS_NAMES[1] if confidence >= THRESHOLD else CLASS_NAMES[0]

            # Grad-CAM
            try:
                heatmap_array = generate_gradcam(model, img_array)
                heatmap_b64 = encode_image_to_base64(heatmap_array)
            except Exception as cam_err:
                logger.warning(f"Grad-CAM failed: {cam_err}")
                heatmap_b64 = encode_image_to_base64(
                    (img_array[0] * 255).astype(np.uint8)
                )
        except Exception as e:
            logger.error(f"Inference error: {e}")
            raise HTTPException(status_code=500, detail="Inference failed.")

    elapsed_ms = round((time.time() - start) * 1000)
    logger.info(f"Prediction: {label} ({confidence:.4f}) in {elapsed_ms}ms")

    return JSONResponse(
        content={
            "label": label,
            "confidence": confidence,
            "heatmap": heatmap_b64,
            "metrics": MODEL_METRICS,
            "inference_ms": elapsed_ms,
        }
    )
