// /lab/: the detection lab's design preview (ui/lab.ts) on its own page.

import labReplay from "./lib/lab-replay.json";
import { byId } from "./lib/dom";
import { setupThemeToggle } from "./lib/theme-toggle";
import { mountLab } from "./ui/lab";

document.documentElement.classList.add("js");
setupThemeToggle();
mountLab(byId("lab-panel"), labReplay);
