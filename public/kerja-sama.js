import { api } from "/common.js";
import { introText, renderPartners } from "/about-render.js";
import "/photo-view.js";

// Collaborations: the partners and texts admins edit under Warga & Mitra in /pengelola.
let about = null;
function draw() {
  if (!about) return;
  introText(document.getElementById("collabIntro"), about.texts.collabIntro);
  introText(document.getElementById("sponsorText"), about.texts.sponsorText);
  renderPartners(document.getElementById("partnerList"), about.partners);
}
api("/api/about").then((a) => { about = a; draw(); }).catch(() => {});
addEventListener("langchange", draw);
