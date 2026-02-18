// Muscle Memory Content Script

function getSiteKey() {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('instagram')) return 'instagram';
  if (hostname.includes('facebook')) return 'facebook';
  if (hostname.includes('youtube')) return 'youtube';
  if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
  if (hostname.includes('linkedin')) return 'linkedin';
  if (hostname.includes('tiktok')) return 'tiktok';
  if (hostname.includes('reddit')) return 'reddit';
  return null;
}

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    // Settings changed, background handles blocking on next navigation
  }
  sendResponse({ received: true });
});
