import "./styles/index.css";
import { init } from "./app/bootstrap.js";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
