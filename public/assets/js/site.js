
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

  // Optional visual accents only; headings themselves can be anything.
  if (value.includes('look ahead') || value.includes('coming') || value.includes('date')) return '📅';
  if (value.includes('reminder') || value.includes('note')) return '💙';
  if (value.includes('week') || value.includes('learning') || value.includes('overview')) return '⭐';
  if (value.includes('field trip') || value.includes('event')) return '🚌';
  if (value.includes('book') || value.includes('reading')) return '📚';
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


/* === LIVE TWO-TILE WISH LIST === */
(async function initWishList() {
  const loading = document.getElementById('wishListLoading');
  if (!loading) return;

  const errorBox = document.getElementById('wishListError');
  const errorText = document.getElementById('wishListErrorText');
  const content = document.getElementById('wishListContent');

  try {
    const response = await fetch('/api/wish-list', { cache: 'no-store' });
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'The wish list could not be loaded.');
    }

    const wishIntro = document.getElementById('wishListIntro');
    if (wishIntro) wishIntro.hidden = true;
    document.getElementById('wishDailyUse').innerHTML =
      data.dailyUseHtml || '<p>No items listed right now.</p>';
    document.getElementById('wishFunExtras').innerHTML =
      data.funExtrasHtml || '<p>No items listed right now.</p>';

    loading.hidden = true;
    content.hidden = false;
  } catch (error) {
    loading.hidden = true;
    errorText.textContent =
      error.message || 'The wish list is temporarily unavailable.';
    errorBox.hidden = false;
  }
})();


/* === HOMEPAGE HIGHLIGHTS FROM CURRENT WEEKLY NEWS === */
(async function initHomepageWeeklyHighlights() {
  const loading = document.getElementById('homeWeekLoading');
  if (!loading) return;

  const errorBox = document.getElementById('homeWeekError');
  const glance = document.getElementById('homeGlance');
  const weekChip = document.getElementById('homeWeekChip');

  try {
    const response = await fetch('/api/weekly-news', { cache: 'no-store' });
    const data = await response.json();

    if (!data.ok || !data.weeks || !data.weeks.length) {
      throw new Error(data.error || 'No weekly update was found.');
    }

    const current = data.weeks[0];
    weekChip.textContent = `Week of ${current.label}`;

    const thisWeek = findHomepageSection(current.sections, 'this week');
    const reminder = findHomepageSection(current.sections, 'reminder');
    const lookAhead =
      findHomepageSection(current.sections, 'look ahead') ||
      findHomepageSection(current.sections, 'coming up');

    if (thisWeek) {
      renderAtAGlance(thisWeek.html, glance);
      glance.hidden = false;
    } else {
      // If Heather doesn't use a This Week heading one week, keep the card
      // useful by showing a simple message rather than stale content.
      glance.innerHTML =
        '<div class="glance-item" style="grid-column:1/-1">' +
        '<div class="glance-value">See Weekly News for this week’s classroom update.</div>' +
        '</div>';
      glance.hidden = false;
    }

    if (reminder) {
      document.getElementById('homeReminderBody').innerHTML = reminder.html;
      document.getElementById('homeReminderCard').hidden = false;
    }

    if (lookAhead) {
      document.getElementById('homeLookAheadBody').innerHTML = lookAhead.html;
      document.getElementById('homeLookAheadCard').hidden = false;
    }

    loading.hidden = true;
  } catch (error) {
    loading.hidden = true;
    errorBox.hidden = false;
  }
})();

function findHomepageSection(sections, name) {
  if (!sections || !sections.length) return null;
  const needle = name.toLowerCase();

  return sections.find(section =>
    (section.title || '').toLowerCase().includes(needle)
  ) || null;
}

function renderAtAGlance(sectionHtml, target) {
  const temp = document.createElement('div');
  temp.innerHTML = sectionHtml;

  // Convert the Google Doc section into one item per line/list item.
  let rawItems = [...temp.querySelectorAll('li')]
    .map(el => el.textContent.trim())
    .filter(Boolean);

  if (!rawItems.length) {
    const text = temp.innerText || temp.textContent || '';
    rawItems = text
      .split(/\n+/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  target.innerHTML = '';

  rawItems.forEach(item => {
    const parts = item.split(/\s+-\s+|:\s+/);
    const label = (parts.shift() || '').trim();
    const value = parts.join(' - ').trim();

    const card = document.createElement('div');
    card.className = 'glance-item';

    const icon = document.createElement('div');
    icon.className = 'glance-icon';
    icon.textContent = homepageCategoryIcon(label);

    const labelEl = document.createElement('div');
    labelEl.className = 'glance-label';
    labelEl.textContent = label || 'This Week';

    const valueEl = document.createElement('div');
    valueEl.className = 'glance-value';
    valueEl.textContent = value || item;

    card.appendChild(icon);
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    target.appendChild(card);
  });
}

function homepageCategoryIcon(label) {
  const value = (label || '').toLowerCase();
  if (value.includes('art')) return '🎨';
  if (value.includes('library') || value.includes('reading')) return '📚';
  if (value.includes('language')) return '🔤';
  if (value.includes('math')) return '123';
  if (value.includes('science')) return '👃';
  if (value.includes('social')) return '🏫';
  if (value.includes('dramatic') || value.includes('play')) return '🍳';
  return '⭐';
}
