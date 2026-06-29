(() => {
  "use strict";

  const FRAME_CONFIG = {
    "evo-square": {
      src: "assets/evo-square.png",
      width: 1080,
      height: 1080,
      filename: "twibbon-show-your-evo-feed.png"
    },
    "evo-story": {
      src: "assets/evo-story.png",
      width: 1080,
      height: 1920,
      filename: "twibbon-show-your-evo-story.png"
    },
    "harley-square": {
      src: "assets/harley-square.png",
      width: 1080,
      height: 1080,
      filename: "twibbon-you-and-your-harley-feed.png"
    },
    "harley-story": {
      src: "assets/harley-story.png",
      width: 1080,
      height: 1920,
      filename: "twibbon-you-and-your-harley-story.png"
    }
  };

  const canvas = document.getElementById("editorCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const canvasWrap = document.getElementById("canvasWrap");
  const frameButtons = [...document.querySelectorAll("[data-frame]")];
  const photoInput = document.getElementById("photoInput");
  const uploadLabel = document.getElementById("uploadLabel");
  const zoomRange = document.getElementById("zoomRange");
  const rotateRange = document.getElementById("rotateRange");
  const zoomValue = document.getElementById("zoomValue");
  const rotateValue = document.getElementById("rotateValue");
  const resetButton = document.getElementById("resetButton");
  const downloadButton = document.getElementById("downloadButton");
  const shareButton = document.getElementById("shareButton");
  const editorSection = document.getElementById("editorSection");
  const errorBox = document.getElementById("errorBox");

  const frameCache = new Map();
  const activePointers = new Map();

  let selectedFrameKey = "evo-square";
  let selectedFrame = null;
  let photo = null;
  let latestBlob = null;

  let baseScale = 1;
  let zoomMultiplier = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;

  let dragStart = null;
  let pinchStart = null;
  let renderQueued = false;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
      image.src = src;
    });
  }

  async function getFrame(key) {
    if (frameCache.has(key)) return frameCache.get(key);
    const image = await loadImage(FRAME_CONFIG[key].src);
    frameCache.set(key, image);
    return image;
  }

  function scheduleRender() {
    latestBlob = null;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (photo) {
      const scale = baseScale * zoomMultiplier;
      ctx.save();
      ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(photo, -photo.naturalWidth / 2, -photo.naturalHeight / 2);
      ctx.restore();
    }

    if (selectedFrame) {
      ctx.drawImage(selectedFrame, 0, 0, canvas.width, canvas.height);
    }
  }

  function fitPhotoToCanvas() {
    if (!photo) return;

    baseScale = Math.max(
      canvas.width / photo.naturalWidth,
      canvas.height / photo.naturalHeight
    );

    zoomMultiplier = 1;
    offsetX = 0;
    offsetY = 0;
    rotation = 0;

    zoomRange.value = "100";
    rotateRange.value = "0";
    updateControlLabels();
    scheduleRender();
  }

  function updateControlLabels() {
    zoomValue.value = `${Math.round(zoomMultiplier * 100)}%`;
    rotateValue.value = `${Math.round(rotation)}°`;
  }

  function setEditorEnabled(enabled) {
    canvasWrap.classList.toggle("is-empty", !enabled);
    zoomRange.disabled = !enabled;
    rotateRange.disabled = !enabled;
    resetButton.disabled = !enabled;
    downloadButton.disabled = !enabled;
    shareButton.disabled = !enabled;

    if (enabled && navigator.canShare) {
      shareButton.hidden = false;
    }
  }

  async function selectFrame(key) {
    clearError();

    const config = FRAME_CONFIG[key];
    if (!config) return;

    selectedFrameKey = key;

    frameButtons.forEach((button) => {
      const active = button.dataset.frame === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
    });

    try {
      selectedFrame = await getFrame(key);
      canvas.width = config.width;
      canvas.height = config.height;

      if (photo) {
        fitPhotoToCanvas();
      } else {
        scheduleRender();
      }
    } catch (error) {
      showError("Desain twibbon gagal dimuat. Pastikan folder assets ikut di-upload.");
      console.error(error);
    }
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Format foto tidak dapat dibuka."));
      };

      image.src = objectUrl;
    });
  }

  function canvasToBlob() {
    return new Promise((resolve, reject) => {
      render();
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Hasil gagal dibuat.")),
        "image/png",
        1
      );
    });
  }

  frameButtons.forEach((button) => {
    button.addEventListener("click", () => selectFrame(button.dataset.frame));
  });

  photoInput.addEventListener("change", async (event) => {
    clearError();

    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("File yang dipilih bukan gambar. Gunakan JPG atau PNG.");
      photoInput.value = "";
      return;
    }

    if (file.size > 35 * 1024 * 1024) {
      showError("Ukuran foto terlalu besar. Pilih foto di bawah 35 MB.");
      photoInput.value = "";
      return;
    }

    uploadLabel.textContent = "MEMPROSES FOTO...";

    try {
      photo = await fileToImage(file);
      fitPhotoToCanvas();
      setEditorEnabled(true);
      uploadLabel.textContent = "GANTI FOTO";
      editorSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showError("Foto tidak dapat dibuka. Coba gunakan JPG/PNG atau screenshot foto tersebut.");
      console.error(error);
    } finally {
      if (!photo) uploadLabel.textContent = "UPLOAD FOTO";
      photoInput.value = "";
    }
  });

  zoomRange.addEventListener("input", () => {
    zoomMultiplier = Number(zoomRange.value) / 100;
    updateControlLabels();
    scheduleRender();
  });

  rotateRange.addEventListener("input", () => {
    rotation = Number(rotateRange.value);
    updateControlLabels();
    scheduleRender();
  });

  resetButton.addEventListener("click", fitPhotoToCanvas);

  function canvasPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!photo) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = canvasPointFromEvent(event);
    activePointers.set(event.pointerId, point);

    if (activePointers.size === 1) {
      dragStart = { pointer: point, offsetX, offsetY };
      pinchStart = null;
    } else if (activePointers.size === 2) {
      const points = [...activePointers.values()];
      pinchStart = {
        distance: distance(points[0], points[1]),
        zoomMultiplier
      };
      dragStart = null;
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!photo || !activePointers.has(event.pointerId)) return;

    event.preventDefault();
    const point = canvasPointFromEvent(event);
    activePointers.set(event.pointerId, point);

    if (activePointers.size === 1 && dragStart) {
      offsetX = dragStart.offsetX + (point.x - dragStart.pointer.x);
      offsetY = dragStart.offsetY + (point.y - dragStart.pointer.y);
      scheduleRender();
    } else if (activePointers.size === 2 && pinchStart) {
      const points = [...activePointers.values()];
      const currentDistance = distance(points[0], points[1]);

      if (pinchStart.distance > 0) {
        zoomMultiplier = Math.min(
          3.5,
          Math.max(1, pinchStart.zoomMultiplier * currentDistance / pinchStart.distance)
        );
        zoomRange.value = String(Math.round(zoomMultiplier * 100));
        updateControlLabels();
        scheduleRender();
      }
    }
  });

  function finishPointer(event) {
    activePointers.delete(event.pointerId);

    if (activePointers.size === 1) {
      const remaining = [...activePointers.values()][0];
      dragStart = { pointer: remaining, offsetX, offsetY };
      pinchStart = null;
    } else {
      dragStart = null;
      pinchStart = null;
    }
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("lostpointercapture", finishPointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!photo) return;
      event.preventDefault();

      const factor = event.deltaY < 0 ? 1.06 : 0.94;
      zoomMultiplier = Math.min(3.5, Math.max(1, zoomMultiplier * factor));
      zoomRange.value = String(Math.round(zoomMultiplier * 100));
      updateControlLabels();
      scheduleRender();
    },
    { passive: false }
  );

  downloadButton.addEventListener("click", async () => {
    if (!photo || !selectedFrame) return;

    clearError();

    try {
      const blob = await canvasToBlob();
      latestBlob = blob;

      const link = document.createElement("a");
      const config = FRAME_CONFIG[selectedFrameKey];
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = config.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (error) {
      showError("Hasil gagal dibuat. Silakan coba kembali.");
      console.error(error);
    }
  });

  shareButton.addEventListener("click", async () => {
    if (!photo || !selectedFrame || !navigator.share) return;

    clearError();

    try {
      const blob = latestBlob || await canvasToBlob();
      latestBlob = blob;

      const config = FRAME_CONFIG[selectedFrameKey];
      const file = new File([blob], config.filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Twibbon Merdeka Ride & Evoria Rally 2026",
          text: "Bike to the Culture",
          files: [file]
        });
      } else {
        showError("Fitur bagikan belum didukung browser ini. Gunakan tombol Download Twibbon.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        showError("Hasil belum dapat dibagikan. Gunakan tombol Download Twibbon.");
        console.error(error);
      }
    }
  });

  selectFrame(selectedFrameKey);
})();
