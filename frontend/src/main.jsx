import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Track from "./pages/Track.jsx";
import { ToastProvider } from "./ui.jsx";
import "./styles.css";

// /track/<token> is the public page that family opens from a shared link
const m = location.pathname.match(/^\/track\/(\w+)/);
createRoot(document.getElementById("root")).render(<ToastProvider>{m ? <Track token={m[1]} /> : <App />}</ToastProvider>);
