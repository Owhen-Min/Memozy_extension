import { createRoot } from "react-dom/client";
import App from "./App";

// DOM이 로드된 후 렌더링
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(<App />);
  }
});
