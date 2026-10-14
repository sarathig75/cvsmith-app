import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { CvTemplate } from './components/Canvas/CvTemplate';
import { draftFromSaved } from './types/cvDraft';
import './print.css';

declare global {
  interface Window {
    __CVSMITH_DRAFT__?: Record<string, unknown>;
  }
}

/** The CV exactly as the preview shows it, for the backend to print to PDF. */
function PrintPage() {
  const draft = draftFromSaved(window.__CVSMITH_DRAFT__ ?? {});
  useEffect(() => {
    // Tell the renderer the page is ready once the fonts are in place.
    void document.fonts.ready.then(() => document.documentElement.setAttribute('data-print-ready', ''));
  }, []);
  return <CvTemplate draft={draft} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<PrintPage />);
