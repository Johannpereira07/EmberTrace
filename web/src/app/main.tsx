import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

// Hash routes so the static server needs no fallback: "#/explore" is the explorer, anything else the story.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));
const StoryPage = lazy(() => import('../story/StoryPage').then((m) => ({ default: m.StoryPage })));

const isExplorer = () => window.location.hash.startsWith('#/explore');

function Root() {
  const [explorer, setExplorer] = useState(isExplorer);
  useEffect(() => {
    const onHash = () => {
      const next = isExplorer();
      setExplorer((prev) => {
        if (prev !== next) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return <Suspense fallback={null}>{explorer ? <App /> : <StoryPage />}</Suspense>;
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');
createRoot(root).render(<Root />);
