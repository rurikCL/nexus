const soundResolveCache = new Map();
const soundFetchCache = new Map();
const soundAudioCache = new Map();
const configValueCache = new Map();
const configFetchCache = new Map();

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

async function resolveConfigValue(name) {
  const cacheKey = String(name).trim().toLowerCase();
  if (!cacheKey) return null;

  if (configValueCache.has(cacheKey)) {
    return configValueCache.get(cacheKey);
  }

  if (!configFetchCache.has(cacheKey)) {
    configFetchCache.set(cacheKey, (async () => {
      const token = localStorage.getItem('nx-token');
      const params = new URLSearchParams({ q: name, per_page: '25' });

      try {
        const res = await fetch(`/api/admin/configuraciones?${params.toString()}`, {
          headers: {
            Accept: 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!res.ok) return null;

        const payload = await res.json().catch(() => null);
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const row = rows.find((item) => String(item?.nombre ?? '').trim().toLowerCase() === cacheKey)
          ?? rows.find((item) => String(item?.nombre ?? '').trim().toLowerCase().includes(cacheKey))
          ?? rows[0]
          ?? null;

        return String(row?.valor_texto ?? '').trim() || null;
      } catch {
        return null;
      }
    })());
  }

  const value = await configFetchCache.get(cacheKey);
  configValueCache.set(cacheKey, value);
  return value;
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

export async function playConfiguredSound(configKey, fallbackSoundName, opts) {
  const mapped = await resolveConfigValue(configKey);
  return playSound(mapped || fallbackSoundName, opts);
}

export const playClickHabilidad = (opts) => playConfiguredSound('sonido_click_habilidad', 'click_minimo', opts);
export const playClickOpcion = (opts) => playConfiguredSound('sonido_click_opcion', 'menu_click', opts);
export const playMensajeUsuario = (opts) => playConfiguredSound('sonido_mensaje', 'mensaje_usuario', opts);
export const playNotificacionDuelo = (opts) => playConfiguredSound('sonido_notificacion_duelo', 'notificacion', opts);
export const playAtras = (opts) => playConfiguredSound('sonido_atras', 'atras_click', opts);
