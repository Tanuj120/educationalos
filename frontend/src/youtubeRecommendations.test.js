import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialYoutubeState,
  safeYoutubeThumbnail,
  youtubeRecommendationsReducer,
  youtubeWatchUrl,
} from './youtubeRecommendations.js';

test('loading, success, and collapse state stay local to one response', () => {
  const responseA = youtubeRecommendationsReducer(initialYoutubeState, { type: 'loading' });
  const responseB = { ...initialYoutubeState };
  assert.equal(responseA.status, 'loading');
  assert.equal(responseA.expanded, true);
  assert.deepEqual(responseB, initialYoutubeState);

  const loaded = youtubeRecommendationsReducer(responseA, { type: 'success', videos: [{ videoId: 'abc123DEF45' }] });
  assert.equal(loaded.status, 'success');
  assert.equal(youtubeRecommendationsReducer(loaded, { type: 'toggle' }).expanded, false);
});

test('error can transition back through loading for retry', () => {
  const failed = youtubeRecommendationsReducer(initialYoutubeState, { type: 'error', message: 'Temporary failure' });
  assert.equal(failed.status, 'error');
  const retrying = youtubeRecommendationsReducer(failed, { type: 'loading' });
  assert.equal(retrying.status, 'loading');
  assert.equal(retrying.error, '');
});

test('empty results have a distinct state', () => {
  const state = youtubeRecommendationsReducer(initialYoutubeState, { type: 'success', videos: [] });
  assert.equal(state.status, 'empty');
});

test('watch and thumbnail URLs are constrained to safe YouTube values', () => {
  assert.equal(youtubeWatchUrl('abc123DEF45'), 'https://www.youtube.com/watch?v=abc123DEF45');
  assert.equal(youtubeWatchUrl('https://evil.example'), null);
  assert.equal(safeYoutubeThumbnail('https://i.ytimg.com/vi/abc123DEF45/mqdefault.jpg'), 'https://i.ytimg.com/vi/abc123DEF45/mqdefault.jpg');
  assert.equal(safeYoutubeThumbnail('https://evil.example/image.jpg'), null);
});
