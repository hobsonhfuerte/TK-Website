
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


/* === LIVE WEEKLY NEWS: CURRENT WEEK + ARCHIVE === */
(async function initWeeklyNews() {
  const loading = document.getElementById('weeklyNewsLoading');
  if (!loading) return;

  const errorBox = document.getElementById('weeklyNewsError');
  const errorText = document.getElementById('weeklyNewsErrorText');
  const layout = document.getElementById('weeklyLayout');
  const archiveList = document.getElementById('archiveList');
  const archiveEmpty = document.getElementById('archiveEmpty');

  try {
    const response = await fetch('/api/weekly-news', { cache: 'no-store' });
    const data = await response.json();

    if (!data.ok || !data.weeks || !data.weeks.length) {
      throw new Error(data.error || 'No weekly updates were found.');
    }

    const [current, ...previous] = data.weeks;

    document.getElementById('currentWeekLabel').textContent =
      `WEEK OF: ${current.label}`;

    renderCurrentWeek(current);

    if (previous.length) {
      renderArchive(previous, archiveList);
    } else {
      archiveEmpty.hidden = false;
    }

    loading.hidden = true;
    layout.hidden = false;
  } catch (error) {
    loading.hidden = true;
    errorText.textContent =
      error.message || 'The latest update is temporarily unavailable.';
    errorBox.hidden = false;
  }
})();

function renderCurrentWeek(week) {
  const body = document.getElementById('currentWeekBody');
  body.innerHTML = '';

  const sections = week.sections && week.sections.length
    ? week.sections
    : [{ title: 'Weekly Update', html: week.fullHtml }];

  sections.forEach(section => {
    const wrapper = document.createElement('div');
    wrapper.className = 'news-section';

    if (isLookAhead(section.title)) {
      wrapper.classList.add('look-ahead');
    }

    const heading = document.createElement('h3');
    heading.textContent = sectionIcon(section.title) + ' ' + section.title;

    const content = document.createElement('div');
    content.className = 'news-section-content';
    content.innerHTML = section.html;

    wrapper.appendChild(heading);
    wrapper.appendChild(content);
    body.appendChild(wrapper);
  });
}

function renderArchive(weeks, target) {
  // Keep the initial version simple and predictable: show weeks in Google Doc order.
  // We can group by month later if desired once we have several months of content.
  weeks.forEach(week => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'archive-link';

    const label = document.createElement('strong');
    label.textContent = week.label;

    const action = document.createElement('span');
    action.textContent = 'View →';

    button.appendChild(label);
    button.appendChild(action);
    button.addEventListener('click', () => openArchiveWeek(week));
    target.appendChild(button);
  });
}

function sectionIcon(title) {
  const value = (title || '').toLowerCase();
  if (value.includes('look ahead') || value.includes('coming') || value.includes('date')) return '📅';
  if (value.includes('reminder') || value.includes('note')) return '💙';
  if (value.includes('this week') || value.includes('overview') || value.includes('weekly')) return '⭐';
  return '📌';
}

function isLookAhead(title) {
  const value = (title || '').toLowerCase();
  return value.includes('look ahead') || value.includes('coming up');
}

function openArchiveWeek(week) {
  const modal = document.getElementById('archiveModal');
  document.getElementById('archiveModalTitle').textContent =
    `WEEK OF: ${week.label}`;
  document.getElementById('archiveModalBody').innerHTML = week.fullHtml;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

(function initArchiveModal() {
  const modal = document.getElementById('archiveModal');
  if (!modal) return;

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.getElementById('archiveModalClose')
    .addEventListener('click', closeModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });
})();
