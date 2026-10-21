// The /work/ pages (what I build at work, shown without its code): the theme switch and the hidden
// ASCII mode, as on every page. The banner's words come from the page (<body data-banner>).

import { setupAscii } from "./ascii";
import { setupThemeToggle } from "./lib/theme-toggle";

document.documentElement.classList.add("js");
setupThemeToggle();
setupAscii(document.body.dataset.banner ?? "Hubert Jablonski");
