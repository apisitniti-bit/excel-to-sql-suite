/**
 * Test if adding/removing the dark class actually changes styles
 * This tests the CSS/Tailwind setup without any React state
 */
export function DirectDarkClassTester() {
  const toggleDarkClassDirectly = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      console.log('[Direct Test] Removed dark class. hasDark:', html.classList.contains('dark'));
    } else {
      html.classList.add('dark');
      console.log('[Direct Test] Added dark class. hasDark:', html.classList.contains('dark'));
    }
    
    // Check computed styles
    const body = document.body;
    const computed = window.getComputedStyle(body);
    const bgColor = computed.backgroundColor;
    const textColor = computed.color;
    console.log('[Direct Test] Computed styles:', { bgColor, textColor });
  };

  return (
    <div className="p-4 bg-yellow-200 text-black border-2 border-black rounded-lg space-y-2">
      <p className="font-bold text-sm">Direct Dark Class Test</p>
      <p className="text-xs">Click button to directly toggle dark class on &lt;html&gt;</p>
      <p className="text-xs text-gray-700">Watch browser console for computed style output</p>
      <button
        onClick={toggleDarkClassDirectly}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
      >
        Toggle Dark Class Directly
      </button>
      <p className="text-xs">
        HTML dark class: <span className="font-bold">{document.documentElement.classList.contains('dark') ? 'YES' : 'NO'}</span>
      </p>
    </div>
  );
}
