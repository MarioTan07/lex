// Tapping a photo (a .zoom button) opens it bigger with its caption: the figure's caption, or the photo's description.
// The page needs the #photoView dialog (About us and Collaborations have it).
const view = document.getElementById("photoView");
if (view) {
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".zoom[data-full]");
    if (!b) return;
    const img = b.querySelector("img");
    document.getElementById("photoBig").src = b.dataset.full;
    document.getElementById("photoBig").alt = img.alt;
    document.getElementById("photoCap").textContent = b.closest("figure")?.querySelector("figcaption")?.textContent || img.alt;
    view.showModal();
  });
  document.getElementById("photoClose").addEventListener("click", () => view.close());
  view.addEventListener("click", (e) => { if (e.target === view) view.close(); });
}
