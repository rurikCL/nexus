const soundResolveCache = new Map();
const soundFetchCache = new Map();
const soundAudioCache = new Map();

function normalizeSoundUrl(path) {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  const cleanPath = String(path).startsWith('/') ? String(path) : `/${String(path)}`;
  if (cleanPath.startsWith('/storage/')) return cleanPath;
  if (cleanPath.startsWith('/public/')) return cleanPath.replace('/public/', '/storage/');
  return `/storage${cleanPath}`;
}

async function resolveSoundUrl(name) {
  const cacheKey = String(name).trim().toLowerCase();
  if (!cacheKey) return null;

  if (soundResolveCache.has(cacheKey)) {
    return soundResolveCache.get(cacheKey);
  }

  if (!soundFetchCache.has(cacheKey)) {
    soundFetchCache.set(cacheKey, (async () => {
      const token = localStorage.getItem('nx-token');
      const params = new URLSearchParams({ q: name, per_page: '25' });

      try {
        const res = await fetch(`/api/admin/rol_sonidos?${params.toString()}`, {
          headers: {
            Accept: 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!res.ok) return null;

        const payload = await res.json().catch(() => null);
        const records = Array.isArray(payload?.data) ? payload.data : [];
        const record = records.find((item) => String(item?.nombre ?? '').trim().toLowerCase() === cacheKey)
          ?? records.find((item) => String(item?.nombre ?? '').trim().toLowerCase().includes(cacheKey))
          ?? records[0]
          ?? null;

        return normalizeSoundUrl(record?.archivo);
      } catch {
        return null;
      }
    })());
  }

  const url = await soundFetchCache.get(cacheKey);
  soundResolveCache.set(cacheKey, url);
  return url;
}

export async function playSound(name, { volume = 0.85 } = {}) {
  const url = await resolveSoundUrl(name);
  if (!url) return false;

  let audio = soundAudioCache.get(url);
  if (!(audio instanceof Audio)) {
    audio = new Audio(url);
    audio.preload = 'auto';
    soundAudioCache.set(url, audio);
  }

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export const playMenuClick = (opts) => playSound('menu_click', opts);
