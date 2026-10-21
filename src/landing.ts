// The landing page (/): the projects and a short About. Links into the old single page (/#attack,
// /#verify, ...) still work: a fragment this page does not have is the cluster page's, so the visitor
// is sent there with it - a navigation, never a scroll on this page. So is the old ?mock=1.

import { setupAscii } from "./ascii";
import { mountNodePanels } from "./node-panel";
import { setupThemeToggle } from "./lib/theme-toggle";

function toCluster(): void {
  const id = decodeURIComponent(location.hash.slice(1));
  const mock = new URLSearchParams(location.search).has("mock");
  if ((id && !document.getElementById(id)) || mock) location.replace(`/cluster/${location.search}${location.hash}`);
}

toCluster();
addEventListener("hashchange", toCluster);
document.documentElement.classList.add("js");
setupThemeToggle();
setupAscii("Hubert Jabłoński");
// "The way in": pointing at a box, tapping or focusing it shows its details under the drawing.
mountNodePanels();
