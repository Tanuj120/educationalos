export const initialYoutubeState = Object.freeze({
  expanded: false,
  status: 'idle',
  videos: [],
  error: '',
});

export function youtubeRecommendationsReducer(state, action) {
  switch (action.type) {
    case 'toggle':
      return { ...state, expanded: !state.expanded };
    case 'loading':
      return { ...state, expanded: true, status: 'loading', error: '' };
    case 'success': {
      const videos = Array.isArray(action.videos) ? action.videos : [];
      return { ...state, expanded: true, status: videos.length ? 'success' : 'empty', videos, error: '' };
    }
    case 'error':
      return { ...state, expanded: true, status: 'error', error: action.message || 'Could not find videos.' };
    default:
      return state;
  }
}

export function youtubeWatchUrl(videoId) {
  return /^[A-Za-z0-9_-]{6,20}$/.test(String(videoId || ''))
    ? `https://www.youtube.com/watch?v=${videoId}`
    : null;
}

export function safeYoutubeThumbnail(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'i.ytimg.com' || host.endsWith('.ytimg.com') || host.endsWith('.ggpht.com'))
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function formatPublishedDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
