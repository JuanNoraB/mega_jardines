// Tarjetas de producto y lógica del catálogo (filtros, búsqueda, orden).
const money = (n) => (n > 0 ? "$" + n.toFixed(2) : "Consultar");

function renderProducts(container, list) {
  container.innerHTML = list.map((p, i) => `
    <article class="product">
      <div class="product__img${p.img ? "" : " product__img--none"}"><img src="${p.img || MJ.logo}" alt="${p.n}" loading="lazy"${p.img ? ` data-i="${i}"` : ""}></div>
      <div class="product__body">
        <div class="product__name">${p.n}</div>
        ${p.d ? `<div class="product__desc">${p.d}</div>` : ""}
        <div class="product__price">${money(p.p)}</div>
        <div class="product__buy" data-i="${i}">
          <div class="qty">
            <button type="button" data-dec aria-label="Menos">−</button>
            <input type="number" min="1" max="999" value="1" aria-label="Cantidad de ${p.n}">
            <button type="button" data-inc aria-label="Más">+</button>
          </div>
          <button type="button" class="btn btn--primary" data-add>Agregar al pedido</button>
        </div>
        <a class="product__ask" href="${waLink(`Hola Mega Jardines, me interesa: ${p.n} (${money(p.p)}). ¿Está disponible?`)}">Preguntar por WhatsApp</a>
      </div>
    </article>`).join("");
  container.querySelectorAll("img[data-i]").forEach((img) =>
    img.addEventListener("click", () =>
      Lightbox.open(list.map((p) => p.img || MJ.logo), +img.dataset.i, list.map((p) => `${p.n} · ${money(p.p)}`))));
  container.onclick = (e) => {
    const buy = e.target.closest(".product__buy");
    if (!buy) return;
    const input = buy.querySelector("input");
    if (e.target.closest("[data-inc]")) input.value = Math.min(999, (+input.value || 1) + 1);
    if (e.target.closest("[data-dec]")) input.value = Math.max(1, (+input.value || 1) - 1);
    if (e.target.closest("[data-add]")) {
      Cart.add(list[+buy.dataset.i], input.value);
      input.value = 1;
    }
  };
}

function initCatalog() {
  const d = window.MJ_DATA;
  const params = new URLSearchParams(location.search);
  const state = { g: params.get("g") || "", c: params.get("c") || "", q: "", sort: "name", shown: 48 };
  const $ = (id) => document.getElementById(id);

  // Panel de filtros
  const filters = $("filters");
  const total = d.products.length;
  filters.innerHTML =
    `<button data-g="" data-c="">Todo el catálogo <small>${total}</small></button>` +
    d.tree.map((grp) => {
      const n = d.products.filter((p) => p.g === grp.g).length;
      const cats = grp.cats.filter((c) => c.count > 0);
      return `<h4>${grp.label}</h4>
        <button data-g="${grp.g}" data-c="">Todas las ${grp.label.toLowerCase()} <small>${n}</small></button>` +
        (cats.length > 1 ? cats.map((c) => `<button data-g="${grp.g}" data-c="${c.k}">${c.label} <small>${c.count}</small></button>`).join("") : "");
    }).join("");
  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.g = b.dataset.g; state.c = b.dataset.c; state.shown = 48;
    track("select_category", { group: state.g || "todo", category: state.c || "todas" });
    filters.classList.remove("open");
    update(true);
  });

  let searchTimer;
  $("search").addEventListener("input", (e) => {
    state.q = e.target.value; state.shown = 48; update();
    // Registra la búsqueda cuando el usuario deja de escribir (1,2 s)
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = state.q.trim();
      if (q.length < 3) return;
      const n = parseInt($("count").textContent, 10) || 0;
      track(n ? "search" : "search_no_results", { search_term: q.toLowerCase(), results: n });
    }, 1200);
  });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  $("more").addEventListener("click", () => { state.shown += 48; update(); });
  $("filters-toggle").addEventListener("click", () => filters.classList.toggle("open"));

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function update(scroll) {
    filters.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.dataset.g === state.g && b.dataset.c === state.c));
    const q = norm(state.q.trim());
    // Busca en el nombre y en las categorías del producto (ej. "orquidea" encuentra los Cymbidium)
    const catLabel = {};
    d.tree.forEach((t) => t.cats.forEach((c) => { catLabel[c.k] = norm(t.label + " " + c.label); }));
    const matches = (p) => norm(p.n).includes(q) || p.c.some((k) => catLabel[k].includes(q));
    let list = d.products.filter((p) =>
      (!state.g || p.g === state.g) && (!state.c || p.c.includes(state.c)) && (!q || matches(p)));
    if (state.sort === "low") list = [...list].sort((a, b) => a.p - b.p);
    if (state.sort === "high") list = [...list].sort((a, b) => b.p - a.p);

    const grp = d.tree.find((t) => t.g === state.g);
    const cat = grp && grp.cats.find((c) => c.k === state.c);
    $("cat-title").textContent = cat ? cat.label : grp ? grp.label : "Todo el catálogo";
    $("count").textContent = `${list.length} producto${list.length === 1 ? "" : "s"}`;
    const grid = $("grid");
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No encontramos productos con ese nombre. <a href="${waLink("Hola, busco: " + state.q)}">Pregúntanos por WhatsApp</a> y te ayudamos.</div>`;
    } else {
      renderProducts(grid, list.slice(0, state.shown));
    }
    $("more").parentElement.style.display = list.length > state.shown ? "" : "none";

    const url = new URL(location);
    url.searchParams.delete("g"); url.searchParams.delete("c");
    if (state.g) url.searchParams.set("g", state.g);
    if (state.c) url.searchParams.set("c", state.c);
    history.replaceState(null, "", url);
    if (scroll) $("catalogo").scrollIntoView({ behavior: "smooth" });
  }
  update();
}
