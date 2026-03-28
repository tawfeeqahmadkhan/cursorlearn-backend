/**
 * YouTube utilities — no API key required.
 * Video metadata is extracted from the URL and enriched by Apify.
 */

/**
 * Extract video ID from any YouTube URL format
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();

  throw new Error('Invalid YouTube URL. Please paste a valid YouTube video link.');
}

/**
 * Build basic metadata from video ID only (no API key needed).
 * Full title/channel info will be filled in by Apify's response.
 */
function getVideoMetadata(videoId) {
  return {
    videoId,
    title: '',
    channelName: '',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: '',
  };
}

module.exports = { extractVideoId, getVideoMetadata };
