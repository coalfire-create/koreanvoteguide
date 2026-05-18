import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Google Analytics (GA4) 동적 연동
const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  const script1 = document.createElement("script");
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gaId}');
  `;
  document.head.appendChild(script2);
}

createRoot(document.getElementById("root")!).render(<App />);
