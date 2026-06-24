"""
train.py — Train the malaria detection CNN on the NIH dataset.

Dataset: https://www.kaggle.com/datasets/iarunava/cell-images-for-detecting-malaria
         or  https://lhncbc.nlm.nih.gov/LHC-research/LHC-projects/image-processing/malaria-datasheet.html

Structure expected:
  data/
    Parasitized/   (*.png)
    Uninfected/    (*.png)

Run:
  python train.py

Output:
  model/malaria_cnn.h5
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, callbacks
from sklearn.metrics import (
    classification_report,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ─── Config ──────────────────────────────────────────────────────────────────
DATA_DIR = "data"
MODEL_DIR = "model"
IMG_SIZE = (130, 130)
BATCH_SIZE = 32
EPOCHS = 25
SEED = 42
VALIDATION_SPLIT = 0.2

os.makedirs(MODEL_DIR, exist_ok=True)

# ─── Data loading & augmentation ─────────────────────────────────────────────
print("Loading dataset...")

train_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_DIR,
    validation_split=VALIDATION_SPLIT,
    subset="training",
    seed=SEED,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["Uninfected", "Parasitized"],
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_DIR,
    validation_split=VALIDATION_SPLIT,
    subset="validation",
    seed=SEED,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode="binary",
    class_names=["Uninfected", "Parasitized"],
)

# Normalise pixel values to [0, 1]
normalization = layers.Rescaling(1.0 / 255)
train_ds = train_ds.map(lambda x, y: (normalization(x), y), num_parallel_calls=tf.data.AUTOTUNE)
val_ds   = val_ds.map(lambda x, y: (normalization(x), y), num_parallel_calls=tf.data.AUTOTUNE)

# Cache and prefetch
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(1000, seed=SEED).prefetch(AUTOTUNE)
val_ds   = val_ds.cache().prefetch(AUTOTUNE)

# ─── Augmentation layer (applied during training only) ───────────────────────
data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal_and_vertical"),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.1),
    layers.RandomBrightness(0.1),
], name="augmentation")

# ─── Model architecture ──────────────────────────────────────────────────────
def build_model(input_shape=(130, 130, 3)):
    inputs = tf.keras.Input(shape=input_shape)
    x = data_augmentation(inputs)

    # Block 1
    x = layers.Conv2D(32, (3, 3), activation="relu", padding="same", name="conv1_1")(x)
    x = layers.Conv2D(32, (3, 3), activation="relu", padding="same", name="conv1_2")(x)
    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.25)(x)

    # Block 2
    x = layers.Conv2D(64, (3, 3), activation="relu", padding="same", name="conv2_1")(x)
    x = layers.Conv2D(64, (3, 3), activation="relu", padding="same", name="conv2_2")(x)
    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.25)(x)

    # Block 3
    x = layers.Conv2D(128, (3, 3), activation="relu", padding="same", name="conv3_1")(x)
    x = layers.Conv2D(128, (3, 3), activation="relu", padding="same", name="conv3_2")(x)
    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.25)(x)

    # Block 4
    x = layers.Conv2D(256, (3, 3), activation="relu", padding="same", name="conv4_1")(x)
    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.BatchNormalization()(x)

    # Classifier head
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(512, activation="relu")(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(1, activation="sigmoid", name="output")(x)

    return tf.keras.Model(inputs, x, name="MalariaCNN")

model = build_model()
model.summary()

# ─── Compile ─────────────────────────────────────────────────────────────────
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="binary_crossentropy",
    metrics=[
        "accuracy",
        tf.keras.metrics.Precision(name="precision"),
        tf.keras.metrics.Recall(name="recall"),
        tf.keras.metrics.AUC(name="auc"),
    ],
)

# ─── Callbacks ───────────────────────────────────────────────────────────────
cb_list = [
    callbacks.ModelCheckpoint(
        filepath=os.path.join(MODEL_DIR, "malaria_cnn.h5"),
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    ),
    callbacks.EarlyStopping(
        monitor="val_loss",
        patience=5,
        restore_best_weights=True,
        verbose=1,
    ),
    callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=3,
        min_lr=1e-6,
        verbose=1,
    ),
    callbacks.CSVLogger(os.path.join(MODEL_DIR, "training_log.csv")),
]

# ─── Train ───────────────────────────────────────────────────────────────────
print("\nTraining...")
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    callbacks=cb_list,
)

# ─── Evaluate ────────────────────────────────────────────────────────────────
print("\nEvaluating on validation set...")
y_true, y_pred_proba = [], []

for images, labels in val_ds:
    preds = model.predict(images, verbose=0)
    y_pred_proba.extend(preds.flatten())
    y_true.extend(labels.numpy().flatten())

y_pred = (np.array(y_pred_proba) >= 0.5).astype(int)
y_true = np.array(y_true).astype(int)

acc  = accuracy_score(y_true, y_pred)
prec = precision_score(y_true, y_pred)
rec  = recall_score(y_true, y_pred)
f1   = f1_score(y_true, y_pred)
# Specificity = recall of the negative class
spec = recall_score(y_true, y_pred, pos_label=0)

print("\n── Evaluation Results ──────────────────────")
print(f"Accuracy:    {acc:.4f}")
print(f"Precision:   {prec:.4f}")
print(f"Recall:      {rec:.4f}")
print(f"F1 Score:    {f1:.4f}")
print(f"Specificity: {spec:.4f}")
print("\n── Classification Report ────────────────────")
print(classification_report(y_true, y_pred, target_names=["Uninfected", "Parasitized"]))

# ─── Save training plots ──────────────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 4))

axes[0].plot(history.history["accuracy"], label="Train")
axes[0].plot(history.history["val_accuracy"], label="Val")
axes[0].set_title("Accuracy")
axes[0].set_xlabel("Epoch")
axes[0].legend()

axes[1].plot(history.history["loss"], label="Train")
axes[1].plot(history.history["val_loss"], label="Val")
axes[1].set_title("Loss")
axes[1].set_xlabel("Epoch")
axes[1].legend()

plt.tight_layout()
plt.savefig(os.path.join(MODEL_DIR, "training_curves.png"), dpi=150)
print(f"\nModel saved to {MODEL_DIR}/malaria_cnn.h5")
print(f"Training curves saved to {MODEL_DIR}/training_curves.png")
