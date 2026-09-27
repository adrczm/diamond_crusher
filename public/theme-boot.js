// Runs before the app loads: paints the page in the appearance chosen in the app (Light or Dark), so a chosen theme
// that differs from the Mac's never flashes the other one. "Auto" is handled by CSS in index.html.
(function () {
  try {
    var t = localStorage.getItem('dc-theme');
    if (t !== 'light' && t !== 'dark') return;
    var root = document.documentElement;
    root.style.colorScheme = t;
    root.style.background = t === 'dark' ? '#1a1a1a' : '#f1f1f1';
  } catch (e) {
    // Storage blocked: follow the Mac's setting.
  }
})();
