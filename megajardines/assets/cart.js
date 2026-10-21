// Carrito de pedidos 100% estático: se guarda en el navegador del visitante y
// el pedido se envía por WhatsApp o por correo. No hay pagos en línea.
const Cart = (() => {
  const KEY = "mj-cart-v1";
  let items = [];   // [{id, n, p, img, g, q}]
  let drawer;

  function load() {
    try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { items = []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    renderBadge();
    if (drawer && drawer.classList.contains("open")) renderDrawer();
  }

  const price$ = (n) => "$" + Number(n).toFixed(2);
  const count = () => items.reduce((s, it) => s + it.q, 0);
  const total = () => items.reduce((s, it) => s + it.q * it.p, 0);
  const hasUnpriced = () => items.some((it) => !(it.p > 0));
  const gaItem = (p, q) => ({ item_id: String(p.id), item_name: p.n, price: p.p || 0, quantity: q, item_category: p.g || "" });
  const EMOJI = { plantas: "🪴", macetas: "🏺", piedras: "🪨", abonos: "🟤", "tierras-y-abonos": "🟤" };
  const emojiFor = (it) => EMOJI[it.g] || (String(it.id).startsWith("abono-") ? EMOJI.abonos : "🌿");

  // Link a la página pedido.html con el pedido codificado: ?p=97x3,98x1
  function orderUrl() {
    const u = new URL("pedido.html", location.href);
    u.search = "?p=" + items.map((it) => `${it.id}x${it.q}`).join(",");
    return u.href;
  }

  function add(product, q = 1) {
    q = Math.max(1, Math.min(999, parseInt(q, 10) || 1));
    const it = items.find((x) => x.id === product.id);
    if (it) it.q = Math.min(999, it.q + q);
    else items.push({ id: product.id, n: product.n, p: product.p || 0, img: product.img || "", g: product.g || "", q });
    save();
    track("add_to_cart", { currency: "USD", value: (product.p || 0) * q, items: [gaItem(product, q)] });
    toast(`Agregado: ${product.n}${q > 1 ? " ×" + q : ""}`);
  }
  function setQty(id, q) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    it.q = Math.max(0, Math.min(999, parseInt(q, 10) || 0));
    if (!it.q) {
      items = items.filter((x) => x.id !== id);
      track("remove_from_cart", { currency: "USD", items: [gaItem(it, 1)] });
    }
    save();
  }
  function clear() { items = []; save(); }

  // ---------- interfaz
  function renderBadge() {
    document.querySelectorAll(".cart-count").forEach((b) => {
      b.textContent = count();
      b.hidden = count() === 0;
    });
  }

  function toast(msg) {
    let t = document.getElementById("mj-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "mj-toast";
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.innerHTML = `${msg} · <button type="button">Ver pedido</button>`;
    t.querySelector("button").onclick = open;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function build() {
    drawer = document.createElement("div");
    drawer.className = "cart";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="cart__backdrop" data-close></div>
      <aside class="cart__panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header class="cart__head">
          <h2 id="cart-title">Tu pedido</h2>
          <button class="cart__x" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="cart__body"></div>
      </aside>`;
    document.body.appendChild(drawer);
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return close();
      const row = e.target.closest("[data-id]");
      if (row && e.target.closest("[data-inc]")) setQty(row.dataset.id, +row.querySelector("input").value + 1);
      if (row && e.target.closest("[data-dec]")) setQty(row.dataset.id, +row.querySelector("input").value - 1);
      if (row && e.target.closest("[data-del]")) setQty(row.dataset.id, 0);
      if (e.target.closest("[data-clear]") && confirm("¿Vaciar el pedido?")) clear();
    });
    drawer.addEventListener("change", (e) => {
      const row = e.target.closest("[data-id]");
      if (row && e.target.matches("input")) setQty(row.dataset.id, e.target.value);
    });
    drawer.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const how = e.submitter && e.submitter.value === "mail" ? "mail" : "wa";
      const info = { nombre: f.nombre.value.trim(), tel: f.tel.value.trim(), dir: f.dir.value.trim(), nota: f.nota.value.trim() };
      try { localStorage.setItem("mj-cliente", JSON.stringify(info)); } catch (err) {}
      send(how, info);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function renderDrawer() {
    const body = drawer.querySelector(".cart__body");
    if (!items.length) {
      body.innerHTML = `<div class="cart__empty">
          <p>Tu pedido está vacío.</p>
          <a class="btn btn--primary" href="productos.html">Ver catálogo</a>
        </div>`;
      return;
    }
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("mj-cliente")) || {}; } catch (e) {}
    const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    body.innerHTML = `
      <ul class="cart__list">
        ${items.map((it) => `
          <li class="cart__item" data-id="${it.id}">
            ${it.img ? `<img src="${it.img}" alt="">` : `<div class="cart__noimg"></div>`}
            <div class="cart__info">
              <div class="cart__name">${esc(it.n)}</div>
              <div class="cart__unit">${it.p > 0 ? price$(it.p) + " c/u" : "Precio a consultar"}${!String(it.id).startsWith("abono-") ? ` · cód. ${it.id}` : ""}</div>
              <div class="qty">
                <button type="button" data-dec aria-label="Quitar uno">−</button>
                <input type="number" min="0" max="999" value="${it.q}" aria-label="Cantidad">
                <button type="button" data-inc aria-label="Agregar uno">+</button>
              </div>
            </div>
            <div class="cart__side">
              <strong>${it.p > 0 ? price$(it.p * it.q) : "—"}</strong>
              <button type="button" class="cart__del" data-del>Quitar</button>
            </div>
          </li>`).join("")}
      </ul>
      <div class="cart__total">
        <span>Total referencial</span>
        <strong>${price$(total())}${hasUnpriced() ? `<small>+ productos a consultar</small>` : ""}</strong>
      </div>
      <p class="cart__note">No se cobra nada aquí. Te confirmamos disponibilidad, costo de envío y forma de pago antes de cerrar el pedido.</p>
      <form class="cart__form">
        <label>Nombre<input name="nombre" required autocomplete="name" value="${esc(saved.nombre)}"></label>
        <label>Teléfono<input name="tel" required type="tel" autocomplete="tel" value="${esc(saved.tel)}" placeholder="09..."></label>
        <label>Sector o dirección de entrega<input name="dir" autocomplete="street-address" value="${esc(saved.dir)}" placeholder="Ej. Cumbayá, Av. ..."></label>
        <label>Comentario (opcional)<textarea name="nota" rows="2" placeholder="Ej. entregar en la tarde">${esc(saved.nota)}</textarea></label>
        <button class="btn btn--wa" type="submit" value="wa">Enviar pedido por WhatsApp</button>
        <button class="btn btn--outline" type="submit" value="mail">Enviar por correo</button>
      </form>
      <button type="button" class="cart__clear" data-clear>Vaciar pedido</button>`;
  }

  // bold = true usa *negrita* de WhatsApp; en correo se omite
  function orderText(info, bold) {
    const b = (s) => (bold ? `*${s}*` : s);
    const lines = items.map((it) =>
      `${emojiFor(it)} ${it.n}${!String(it.id).startsWith("abono-") ? ` (cód. ${it.id})` : ""} × ${it.q} → ${it.p > 0 ? price$(it.p * it.q) : "precio a consultar"}`);
    return [
      `🌿 ${b("¡Hola Mega Jardines!")} Quiero hacer este pedido:`,
      "",
      ...lines,
      "",
      `💰 ${b("Total referencial: " + price$(total()))}${hasUnpriced() ? " + productos a consultar" : ""}`,
      "",
      `👤 ${info.nombre}`,
      `📞 ${info.tel}`,
      info.dir ? `📍 ${info.dir}` : "",
      info.nota ? `📝 ${info.nota}` : "",
      "",
      `🔗 Ver mi pedido con fotos: ${orderUrl()}`,
    ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n").trim();
  }

  function send(how, info) {
    const text = orderText(info, how !== "mail");
    track("generate_lead", { currency: "USD", value: total(), method: how === "mail" ? "correo" : "whatsapp",
      items: items.map((it) => gaItem(it, it.q)) });
    if (how === "mail") {
      location.href = `mailto:${MJ.email}?subject=${encodeURIComponent("Pedido web - " + info.nombre)}&body=${encodeURIComponent(text)}`;
    } else {
      window.open(waLink(text), "_blank", "noopener");
    }
  }

  function open() {
    if (!drawer) build();
    renderDrawer();
    track("view_cart", { currency: "USD", value: total(), items: items.map((it) => gaItem(it, it.q)) });
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => drawer.querySelector(".cart__x").focus(), 50);
  }
  function close() {
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function mountButton() {
    const nav = document.querySelector(".header .container");
    if (!nav || nav.querySelector(".cart-btn")) return;
    const btn = document.createElement("button");
    btn.className = "cart-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Ver pedido");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg><span class="cart-count" hidden>0</span>`;
    btn.onclick = open;
    nav.insertBefore(btn, nav.querySelector(".menu-toggle"));
  }

  load();
  document.addEventListener("DOMContentLoaded", () => { mountButton(); renderBadge(); });
  window.addEventListener("storage", (e) => { if (e.key === KEY) { load(); renderBadge(); } });

  return { add, open, count, items: () => items, orderText, orderUrl };
})();
