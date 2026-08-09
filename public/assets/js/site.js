
/*
ROOM 21 PHOTO GALLERY
---------------------
For now, add photos by:
1. Put the JPG/PNG/WebP file in public/assets/photos/
2. Add one entry below.

Example:
{ src: "assets/photos/first-day.jpg", caption: "Our first day in Room 21!" },

Later we can replace this with automatic Google Drive/Photos integration.
*/
const classroomPhotos = [
  // Photos will be added throughout the school year.
];

const gallery = document.getElementById('gallery');
const empty = document.getElementById('galleryEmpty');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');
let current = 0;

function renderGallery() {
  if (!gallery || !classroomPhotos.length) return;
  if (empty) empty.remove();

  classroomPhotos.forEach((photo, index) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.caption || 'Room 21 classroom photo';
    image.loading = 'lazy';

    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    caption.textContent = photo.caption || '';

    item.appendChild(image);
    if (photo.caption) item.appendChild(caption);
    item.addEventListener('click', () => openPhoto(index));
    gallery.appendChild(item);
  });
}

function openPhoto(index) {
  if (!lightbox || !classroomPhotos.length) return;
  current = index;
  lbImg.src = classroomPhotos[current].src;
  lbImg.alt = classroomPhotos[current].caption || 'Room 21 classroom photo';
  lbCap.textContent = classroomPhotos[current].caption || '';
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}

function closePhoto() {
  if (!lightbox) return;
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
}

function stepPhoto(direction) {
  if (!classroomPhotos.length) return;
  openPhoto((current + direction + classroomPhotos.length) % classroomPhotos.length);
}

if (lightbox) {
  document.getElementById('lbClose').addEventListener('click', closePhoto);
  document.getElementById('lbPrev').addEventListener('click', () => stepPhoto(-1));
  document.getElementById('lbNext').addEventListener('click', () => stepPhoto(1));
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) closePhoto();
  });
  document.addEventListener('keydown', event => {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') closePhoto();
    if (event.key === 'ArrowLeft') stepPhoto(-1);
    if (event.key === 'ArrowRight') stepPhoto(1);
  });
}

renderGallery();
