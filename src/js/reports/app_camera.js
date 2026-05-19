// ── Reports app: Camera ──
// Captures the live Grid canvas into a downsampled JPEG, saves it to
// localStorage (via Reports._storage under "photos"). Photos app reads the
// same array. We cap stored photos at 30 to stay within localStorage quotas
// (~5MB across all keys — at ~80KB per JPEG that's ~2.4MB).

Reports._cameraMaxPhotos = 30;

// Downsample the Grid canvas to a phone-friendly thumbnail (~400px wide) and
// encode as JPEG at quality 0.55 — keeps stored bytes small.
Reports._cameraCapture = function () {
  if (typeof Grid === 'undefined' || !Grid.canvas) return null;
  const src = Grid.canvas;
  if (!src.width || !src.height) return null;

  const targetW = 480;
  const ratio = src.height / src.width;
  const off = document.createElement('canvas');
  off.width = targetW;
  off.height = Math.round(targetW * ratio);
  const ctx = off.getContext('2d');
  ctx.drawImage(src, 0, 0, off.width, off.height);
  try {
    return off.toDataURL('image/jpeg', 0.55);
  } catch (e) {
    console.warn('[camera] capture failed', e);
    return null;
  }
};

Reports._renderCamera = function () {
  this.titleEl.textContent = 'Camera';

  const photos = this._storage.get('photos', []);
  const recent = photos[photos.length - 1];

  this.content.innerHTML = `
    <div class="rp-cam">
      <div class="rp-cam-viewfinder" id="rpCamViewfinder">
        ${recent
          ? `<img class="rp-cam-preview" src="${recent.dataUrl}" alt="">`
          : `<div class="rp-cam-empty"><div class="rp-cam-empty-icon">${Icons.camera}</div><div class="rp-cam-empty-text">Tap the shutter to capture your facility</div></div>`}
        <div class="rp-cam-flash" id="rpCamFlash"></div>
      </div>
      <div class="rp-cam-controls">
        <button class="rp-cam-thumb" id="rpCamGallery" title="Open Photos">
          ${recent ? `<img src="${recent.dataUrl}" alt="">` : ''}
        </button>
        <button class="rp-cam-shutter" id="rpCamShutter" title="Capture">
          <span class="rp-cam-shutter-inner"></span>
        </button>
        <div class="rp-cam-count">${photos.length}</div>
      </div>
    </div>
  `;

  document.getElementById('rpCamShutter').addEventListener('click', () => {
    const dataUrl = this._cameraCapture();
    if (!dataUrl) return;

    // Flash animation
    const flashEl = document.getElementById('rpCamFlash');
    if (flashEl) {
      flashEl.classList.remove('flash');
      // Force reflow so the animation restarts on each click
      void flashEl.offsetWidth;
      flashEl.classList.add('flash');
    }

    // Save (FIFO cap)
    const all = this._storage.get('photos', []);
    all.push({ id: Date.now(), dataUrl, timestamp: Date.now() });
    while (all.length > this._cameraMaxPhotos) all.shift();
    this._storage.set('photos', all);

    if (typeof Reports !== 'undefined' && this.log) {
      this.log('system', 'Captured photo');
    }

    // Re-render to update preview + thumb + count
    this._renderCamera();
  });

  document.getElementById('rpCamGallery').addEventListener('click', () => {
    this._activeApp = 'photos';
    this._photosView = 'grid';
    this._photosCurrentId = null;
    this._renderApp();
  });
};
