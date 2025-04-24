import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// DOM이 로드된 후 렌더링
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <BrowserRouter basename="/history.html">
        <App />
      </BrowserRouter>
    );
  }
}); 