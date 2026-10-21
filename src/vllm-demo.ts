// The vLLM manager page (/work/vllm/): what work.ts does for every /work/ page, plus the interactive
// demo, which only this page loads. The demo runs entirely in the browser on made-up data.

import { setupAscii } from "./ascii";
import { setupThemeToggle } from "./lib/theme-toggle";
import { mountDemo } from "./work/vllm-demo/app";

document.documentElement.classList.add("js");
setupThemeToggle();
setupAscii(document.body.dataset.banner ?? "Hubert Jablonski");
const root = document.getElementById("vdemo");
if (root) mountDemo(root);
