// Configuración del negocio: cambia aquí los datos de contacto y se actualiza todo el sitio.
const MJ = {
  name: "Mega Jardines",
  city: "Quito, Ecuador",
  email: "info@megajardines.com",
  waMain: "593983746866",      // WhatsApp principal (098 374 6866)
  waAlt: "593996679763",       // WhatsApp secundario (099 667 9763)
  instagram: "https://www.instagram.com/megajardinesuio/",
  facebook: "https://www.facebook.com/Megajardinesuio-160937375713184/",
  logo: "img/logo-jardines.png",
  // Google Analytics 4: pega aquí el "ID de medición" (G-XXXXXXXXXX). Vacío = sin métricas.
  ga4Id: "",
  // Tierras y abonos (sin precio fijo): se piden como "precio a consultar"
  supplies: ["Tierra negra", "Tierra preparada", "Humus", "Abono de champiñón",
    "Arena de río lavada", "Cascajo de coco", "Cascajo de pomes", "Aireadores"],
};

const waLink = (text, phone = MJ.waMain) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// ---------- Métricas (Google Analytics 4). track() no hace nada si no hay ga4Id.
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
if (MJ.ga4Id) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MJ.ga4Id}`;
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", MJ.ga4Id);
}
function track(event, params = {}) {
  if (MJ.ga4Id) gtag("event", event, params);
  else if (location.hostname === "localhost") console.debug("[métrica]", event, params);
}

// Clics de contacto en cualquier página (WhatsApp, correo, redes)
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  if (href.startsWith("https://wa.me/")) track("contact_whatsapp", { link_text: a.textContent.trim().slice(0, 60) || "botón flotante", page: location.pathname });
  else if (href.startsWith("mailto:")) track("contact_email", { page: location.pathname });
  else if (/instagram\.com|facebook\.com/.test(href)) track("social_click", { network: href.includes("instagram") ? "instagram" : "facebook" });
});
const fmtPhone = (n) => "0" + n.slice(3, 5) + " " + n.slice(5, 8) + " " + n.slice(8);

const ICONS = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8zM20.5 3.5C18.2 1.2 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.6 4.2 1.6 6L0 24l6.2-1.6c1.8 1 3.8 1.5 5.8 1.5 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.4z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.7-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function renderChrome() {
  const page = document.body.dataset.page;
  const link = (href, label, key) =>
    `<a href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`;

  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <div class="topbar"><div class="container">
        <span>Jardinería y vivero en ${MJ.city}</span>
        <span><a href="${waLink("Hola Mega Jardines")}">WhatsApp ${fmtPhone(MJ.waMain)}</a> · <a href="mailto:${MJ.email}">${MJ.email}</a></span>
      </div></div>
      <header class="header"><div class="container">
        <a class="logo" href="index.html" aria-label="${MJ.name} - inicio"><img src="${MJ.logo}" alt="${MJ.name}"></a>
        <button class="menu-toggle" aria-label="Abrir menú" aria-expanded="false">${ICONS.menu}</button>
        <nav class="nav" id="nav">
          ${link("index.html", "Inicio", "home")}
          ${link("productos.html", "Productos", "productos")}
          ${link("servicios.html", "Servicios", "servicios")}
          ${link("index.html#contacto", "Contacto", "contacto")}
          <a class="btn btn--primary" href="${waLink("Hola, quisiera una cotización.")}">Cotizar gratis</a>
        </nav>
      </div></header>`;
    const btn = header.querySelector(".menu-toggle");
    const nav = header.querySelector(".nav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    });
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="footer"><div class="container">
        <div class="footer__grid">
          <div>
            <div class="footer__logo"><img src="${MJ.logo}" alt="${MJ.name}"></div>
            <p>Vivero y servicios de jardinería en ${MJ.city}. Plantas, macetas, piedras decorativas, sustratos y todo para crear y cuidar tu jardín.</p>
            <div class="social">
              <a href="${MJ.instagram}" aria-label="Instagram" target="_blank" rel="noopener">${ICONS.ig}</a>
              <a href="${MJ.facebook}" aria-label="Facebook" target="_blank" rel="noopener">${ICONS.fb}</a>
              <a href="${waLink("Hola Mega Jardines")}" aria-label="WhatsApp">${ICONS.wa}</a>
              <a href="mailto:${MJ.email}" aria-label="Correo">${ICONS.mail}</a>
            </div>
          </div>
          <div>
            <h4>Productos</h4>
            <ul>
              <li><a href="productos.html?g=plantas">Plantas</a></li>
              <li><a href="productos.html?g=macetas">Macetas</a></li>
              <li><a href="productos.html?g=piedras">Piedras</a></li>
              <li><a href="productos.html?g=tierras-y-abonos">Tierras y abonos</a></li>
            </ul>
          </div>
          <div>
            <h4>Servicios</h4>
            <ul>
              <li><a href="servicios.html#mantenimiento">Mantenimiento</a></li>
              <li><a href="servicios.html#diseno">Diseño</a></li>
              <li><a href="servicios.html#construccion">Construcción</a></li>
              <li><a href="servicios.html#plagas">Control de plagas</a></li>
              <li><a href="servicios.html#riego">Sistemas de riego</a></li>
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href="${waLink("Hola Mega Jardines")}">WhatsApp ${fmtPhone(MJ.waMain)}</a></li>
              <li><a href="${waLink("Hola Mega Jardines", MJ.waAlt)}">WhatsApp ${fmtPhone(MJ.waAlt)}</a></li>
              <li><a href="mailto:${MJ.email}">${MJ.email}</a></li>
              <li>${MJ.city}</li>
            </ul>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} ${MJ.name}. Todos los derechos reservados.</span>
          <span><a href="terminos.html">Términos y condiciones</a> · <a href="privacidad.html">Política de privacidad</a></span>
        </div>
      </div></footer>
      <a class="wa-float" href="${waLink("Hola Mega Jardines, necesito información.")}" aria-label="Escríbenos por WhatsApp">${ICONS.wa}</a>
      <div class="cookie" id="cookie">
        Usamos cookies para medir visitas y mejorar el sitio. Más información en nuestra <a href="privacidad.html">política de privacidad</a>.
        <div><button class="btn btn--primary" id="cookie-ok">Entendido</button></div>
      </div>`;
    const cookie = document.getElementById("cookie");
    let seen = false;
    try { seen = localStorage.getItem("mj-cookie") === "1"; } catch (e) {}
    if (!seen) cookie.classList.add("show");
    document.getElementById("cookie-ok").addEventListener("click", () => {
      cookie.classList.remove("show");
      try { localStorage.setItem("mj-cookie", "1"); } catch (e) {}
    });
  }

  document.querySelectorAll("[data-wa]").forEach((a) => { a.href = waLink(a.dataset.wa); });
}

// Lightbox reutilizable: openLightbox(listaDeImagenes, indice, titulos?)
const Lightbox = (() => {
  let el, img, cap, list = [], captions = [], i = 0;
  function build() {
    el = document.createElement("div");
    el.className = "lightbox";
    el.innerHTML = `<button class="lb-close" aria-label="Cerrar">×</button>
      <button class="lb-prev" aria-label="Anterior">‹</button>
      <figure style="margin:0"><img alt=""><figcaption></figcaption></figure>
      <button class="lb-next" aria-label="Siguiente">›</button>`;
    document.body.appendChild(el);
    img = el.querySelector("img");
    cap = el.querySelector("figcaption");
    el.querySelector(".lb-close").onclick = close;
    el.querySelector(".lb-prev").onclick = () => show(i - 1);
    el.querySelector(".lb-next").onclick = () => show(i + 1);
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    document.addEventListener("keydown", (e) => {
      if (!el.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(i - 1);
      if (e.key === "ArrowRight") show(i + 1);
    });
  }
  function show(n) {
    i = (n + list.length) % list.length;
    img.src = list[i];
    cap.textContent = (captions[i] || "") + `  ${i + 1} / ${list.length}`;
  }
  function close() { el.classList.remove("open"); }
  return {
    open(images, index = 0, titles = []) {
      if (!el) build();
      list = images; captions = titles;
      show(index);
      el.classList.add("open");
    },
  };
})();

document.addEventListener("DOMContentLoaded", renderChrome);
