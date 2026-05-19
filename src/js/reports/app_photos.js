// ── Reports app: Photos ──
// Grid gallery of camera captures, click for fullscreen view with delete.
// Reads the same localStorage slot the Camera writes to.
// State: _photosView ('grid' | 'full'), _photosCurrentId.

Reports._photosView = 'grid';
Reports._photosCurrentId = null;

Reports._renderPhotos = function () {
  this.titleEl.textContent = 'Photos';
  if (this._photosView === 'full' && this._photosCurrentId != null) {
    this._renderPhotoFull();
  } else {
    this._photosView = 'grid';
    this._renderPhotosGrid();
  }
};

Reports._renderPhotosGrid = function () {
  const photos = this._storage.get('photos', []).slice().reverse(); // newest first

  let html = `<div class="rp-pho">
    <div class="rp-pho-header">
      <span class="rp-pho-title">Library</span>
      <span class="rp-pho-count">${photos.length} photo${photos.length === 1 ? '' : 's'}</span>
    </div>`;

  if (photos.length === 0) {
    html += `<div class="rp-pho-empty">
      <div class="rp-pho-empty-icon">${Icons.image}</div>
      <div class="rp-pho-empty-title">No photos yet</div>
      <div class="rp-pho-empty-sub">Use the Camera app to capture your facility.</div>
    </div>`;
  } else {
    html += '<div class="rp-pho-grid">';
    for (const p of photos) {
      html += `<div class="rp-pho-thumb" data-id="${p.id}">
        <img src="${p.dataUrl}" alt="" loading="lazy">
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  this.content.innerHTML = html;

  this.content.querySelectorAll('.rp-pho-thumb').forEach(el => {
    el.addEventListener('click', () => {
      this._photosCurrentId = parseInt(el.dataset.id);
      this._photosView = 'full';
      this._renderPhotos();
    });
  });
};

Reports._renderPhotoFull = function () {
  const photos = this._storage.get('photos', []);
  const idx = photos.findIndex(p => p.id === this._photosCurrentId);
  if (idx < 0) {
    this._photosView = 'grid';
    this._renderPhotosGrid();
    return;
  }
  const photo = photos[idx];
  const date = new Date(photo.timestamp).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  this.content.innerHTML = `
    <div class="rp-pho-full">
      <div class="rp-pho-full-toolbar">
        <button class="rp-pho-back" id="rpPhoBack"><span class="rp-icon-inline">${Icons.chevronLeft}</span> Library</button>
        <span class="rp-pho-full-date">${this._esc(date)}</span>
        <button class="rp-pho-delete" id="rpPhoDelete" title="Delete">${Icons.trash}</button>
      </div>
      <div class="rp-pho-full-image">
        <img src="${photo.dataUrl}" alt="">
      </div>
      <div class="rp-pho-full-nav">
        <button class="rp-pho-nav-btn" id="rpPhoPrev" ${idx === 0 ? 'disabled' : ''}><span class="rp-icon-inline">${Icons.chevronLeft}</span> Prev</button>
        <span class="rp-pho-full-pos">${idx + 1} / ${photos.length}</span>
        <button class="rp-pho-nav-btn" id="rpPhoNext" ${idx === photos.length - 1 ? 'disabled' : ''}>Next <span class="rp-icon-inline">${Icons.chevronRight}</span></button>
      </div>
    </div>
  `;

  document.getElementById('rpPhoBack').addEventListener('click', () => {
    this._photosView = 'grid';
    this._photosCurrentId = null;
    this._renderPhotos();
  });

  document.getElementById('rpPhoDelete').addEventListener('click', () => {
    const all = this._storage.get('photos', []).filter(p => p.id !== this._photosCurrentId);
    this._storage.set('photos', all);
    this._photosView = 'grid';
    this._photosCurrentId = null;
    this._renderPhotos();
  });

  document.getElementById('rpPhoPrev').addEventListener('click', () => {
    if (idx > 0) {
      this._photosCurrentId = photos[idx - 1].id;
      this._renderPhotoFull();
    }
  });

  document.getElementById('rpPhoNext').addEventListener('click', () => {
    if (idx < photos.length - 1) {
      this._photosCurrentId = photos[idx + 1].id;
      this._renderPhotoFull();
    }
  });
};
