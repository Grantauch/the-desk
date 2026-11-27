// The Command screen as a tech tree: four branches, each step bought with medals in order.
(function (root) {
  const BK = root.BK;
  const $ = (id) => document.getElementById(id);
  const UP = BK.UI.prototype;
  const Save = BK.Save;

  UP.showCommand = function () {
    this.screen("command");
    const S = Save.data;
    const grid = $("unlock-grid");
    grid.className = "tech-grid";
    grid.innerHTML = "";
    const sub = document.querySelector("#command .screen-sub");
    if (sub) sub.textContent = "Spend medals earned in battle. Each branch opens one step at a time, and every step lasts forever.";
    for (const b of BK.TECH) {
      const col = document.createElement("div");
      col.className = "tech-col";
      const have = b.nodes.filter((id) => S.unlocks[id]).length;
      col.innerHTML = `<div class="tech-h"><i data-ic="${b.icon}"></i><b>${b.name}</b><span>${have} / ${b.nodes.length}</span></div>`;
      b.nodes.forEach((id, i) => {
        const u = BK.UNLOCK_BY_ID[id];
        const owned = !!S.unlocks[id];
        const open = !u.requires || S.unlocks[u.requires];
        const el = document.createElement("div");
        el.className = "tech" + (owned ? " owned" : open ? " open" : " shut");
        el.innerHTML = `<div class="ty">${u.type}</div><h4>${u.name}</h4><p>${u.desc}</p>`
          + `<button class="buy" ${owned || !open || S.medals < u.cost ? "disabled" : ""}>${owned ? "Owned" : open ? `${u.cost} medals` : `Needs ${BK.UNLOCK_BY_ID[u.requires].name}`}</button>`;
        el.querySelector(".buy").onclick = () => {
          if (owned || !open || S.medals < u.cost) return;
          S.medals -= u.cost;
          S.unlocks[id] = true;
          Save.write();
          BK.Audio.upgrade();
          this.showCommand();
        };
        if (i) col.insertAdjacentHTML("beforeend", `<i class="tech-link${owned ? " lit" : ""}"></i>`);
        col.appendChild(el);
      });
      grid.appendChild(col);
    }
    if (BK.paintIcons) BK.paintIcons(grid);
  };
})(typeof window !== "undefined" ? window : globalThis);
