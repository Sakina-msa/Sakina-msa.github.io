/* =====================================================================
   Dashboard interactif — Digitalisation du Luxe
   Reproduit les 3 pages du rapport Power BI à partir de data.js.
   Graphiques dessinés en SVG (aucune bibliothèque externe).
   ===================================================================== */
(function () {
  const D = DATA;
  const A0 = D.annee0;
  const NB_ANNEES = 12;                       // 2015 → 2026
  const DERNIERE = A0 + NB_ANNEES - 1;        // 2026 : année partielle (janv.–sept.)
  const COUL = ["#4C6FA8", "#0C1630", "#A9B8D6", "#C4A46A"]; // LV, Dior, Hermès, Gucci (charte du .pbix)
  // Catégories : 0 Maroquinerie, 1 Prêt-à-porter, 2 Chaussures, 3 Accessoires & Soie, 4 Parfums & Beauté, 5 Joaillerie
  const COUL_CAT = ["#8B7650", "#6B7280", "#B8C7E0", "#E8C9DC", "#7FB5B0", "#2F3A4C"];
  const ORDRE_CAT = [3, 2, 5, 0, 4, 1];      // ordre d'empilement de Power BI (alphabétique, du bas vers le haut)
  const ORDRE_CARTES = [0, 2, 1, 3];         // LV, Hermès, Dior, Gucci
  const ORDRE_MIX = [0, 2, 3, 1];            // LV, Hermès, Gucci, Dior
  const NS = "http://www.w3.org/2000/svg";

  const filtres = { annee: "tout", marque: "tout", pays: "tout" };
  let page = "direction";

  /* ---------- Calculs (équivalents des mesures DAX) ---------- */
  // Lignes de DATA : [annee-2015, jan-sept?, marque, pays, canal, categorie, CA (k€), commandes]
  function lignes(opts) {
    const o = Object.assign({ annee: filtres.annee, marque: filtres.marque, pays: filtres.pays }, opts || {});
    return D.lignes.filter((r) =>
      (o.annee === "tout" || r[0] === o.annee) &&
      (o.marque === "tout" || r[2] === o.marque) &&
      (o.pays === "tout" || r[3] === o.pays));
  }
  const somme = (rs, i) => rs.reduce((t, r) => t + r[i], 0);
  const ca = (rs) => somme(rs, 6);
  const online = (rs) => rs.filter((r) => D.online[r[4]]).reduce((t, r) => t + r[6], 0);

  // CA N-1 à période équivalente : pour 2026 (partielle), on compare à janv.–sept. 2025
  function caN1(opts) {
    const o = Object.assign({ annee: filtres.annee, marque: filtres.marque, pays: filtres.pays }, opts || {});
    const annees = o.annee === "tout" ? [...Array(NB_ANNEES).keys()] : [o.annee];
    let t = 0;
    annees.forEach((a) => {
      if (a === 0) return;
      lignes({ annee: a - 1, marque: o.marque, pays: o.pays }).forEach((r) => {
        if (a + A0 === DERNIERE && r[1] !== 1) return;
        t += r[6];
      });
    });
    return t;
  }
  function croissance(opts) {
    const n1 = caN1(opts);
    return n1 ? ca(lignes(opts)) / n1 - 1 : null;
  }

  /* ---------- Formats ---------- */
  const fr = (x, d) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const md = (k) => fr(k / 1e6, 2) + " Md€";
  const pct = (x, d = 1) => (x === null || isNaN(x) ? "–" : fr(x * 100, d) + " %");
  const signe = (x) => (x === null ? "" : x >= 0 ? "pos" : "neg");

  /* ---------- Info-bulle ---------- */
  const bulle = document.createElement("div");
  bulle.className = "db-bulle";
  document.body.appendChild(bulle);
  function montrer(e, html) {
    bulle.innerHTML = html;
    bulle.style.opacity = 1;
    const x = Math.min(e.clientX + 14, window.innerWidth - bulle.offsetWidth - 8);
    bulle.style.left = x + "px";
    bulle.style.top = e.clientY + 14 + "px";
  }
  const cacher = () => (bulle.style.opacity = 0);
  function survol(el, html) {
    el.addEventListener("mousemove", (e) => montrer(e, html));
    el.addEventListener("mouseleave", cacher);
    el.addEventListener("touchstart", (e) => montrer(e.touches[0], html), { passive: true });
  }

  /* ---------- Petits outils SVG ---------- */
  function svg(w, h) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`);
    s.setAttribute("class", "db-svg");
    return s;
  }
  function el(nom, attrs, parent) {
    const e = document.createElementNS(NS, nom);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function texte(parent, x, y, t, attrs) {
    const e = el("text", Object.assign({ x, y, class: "db-axe" }, attrs || {}), parent);
    e.textContent = t;
    return e;
  }
  const legende = (noms, couls) =>
    '<div class="db-legende">' + noms.map((n, i) => `<span><i style="background:${couls[i]}"></i>${n}</span>`).join("") + "</div>";

  /* Courbes : series = [{nom, coul, valeurs[]}], x = libellés */
  function courbes(cont, x, series, fmtY, maxY, largeur) {
    const W = largeur || 720, H = 250, g = 48, d = 14, h = 16, b = 28;
    const s = svg(W, H);
    const max = maxY || Math.max(...series.flatMap((se) => se.valeurs.filter((v) => v !== null))) * 1.1 || 1;
    const px = (i) => g + (i * (W - g - d)) / (x.length - 1);
    const py = (v) => H - b - (v / max) * (H - b - h);
    for (let k = 0; k <= 4; k++) {
      const v = (max * k) / 4;
      el("line", { x1: g, x2: W - d, y1: py(v), y2: py(v), class: "db-grille" }, s);
      texte(s, g - 6, py(v) + 4, fmtY(v), { "text-anchor": "end" });
    }
    x.forEach((l, i) => { if (i % 2 === 0 || x.length < 8) texte(s, px(i), H - 8, l, { "text-anchor": "middle" }); });
    series.forEach((se) => {
      const pts = se.valeurs.map((v, i) => (v === null ? null : [px(i), py(v)])).filter(Boolean);
      el("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: se.coul, "stroke-width": 2.5, "stroke-linejoin": "round" }, s);
      se.valeurs.forEach((v, i) => {
        if (v === null) return;
        const c = el("circle", { cx: px(i), cy: py(v), r: se.actif === i ? 6 : 3.5, fill: se.coul, stroke: "#fff", "stroke-width": 1.5, class: "db-point" }, s);
        survol(c, `<b>${se.nom}</b><br>${x[i]} : ${fmtY(v, true)}`);
      });
    });
    cont.innerHTML = "";
    cont.appendChild(s);
    cont.insertAdjacentHTML("beforeend", legende(series.map((se) => se.nom), series.map((se) => se.coul)));
  }

  /* Anneau : parts = [{nom, coul, valeur}] */
  function anneau(cont, parts, centre) {
    const W = 260, R = 100, r = 64, cx = 130, cy = 120;
    const s = svg(W, 240);
    const tot = parts.reduce((t, p) => t + p.valeur, 0) || 1;
    let a = -Math.PI / 2;
    parts.forEach((p) => {
      const da = (p.valeur / tot) * Math.PI * 2;
      if (da <= 0) return;
      const a2 = a + Math.min(da, Math.PI * 2 - 0.0001);
      const grand = da > Math.PI ? 1 : 0;
      const P = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
      const [x1, y1] = P(a, R), [x2, y2] = P(a2, R), [x3, y3] = P(a2, r), [x4, y4] = P(a, r);
      const path = el("path", { d: `M${x1},${y1} A${R},${R} 0 ${grand} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${grand} 0 ${x4},${y4} Z`, fill: p.coul, class: "db-part" }, s);
      survol(path, `<b>${p.nom}</b><br>${md(p.valeur)} · ${pct(p.valeur / tot, 2)}`);
      a = a2;
    });
    texte(s, cx, cy + 6, centre, { "text-anchor": "middle", class: "db-centre" });
    cont.innerHTML = "";
    cont.appendChild(s);
    cont.insertAdjacentHTML("beforeend", legende(parts.map((p) => `${p.nom} ${pct(p.valeur / tot, 2)}`), parts.map((p) => p.coul)));
  }

  /* Barres horizontales : items = [{nom, valeur, coul?}] */
  function barresH(cont, items, fmt) {
    const max = Math.max(...items.map((i) => Math.abs(i.valeur))) || 1;
    cont.innerHTML = '<div class="db-barres">' + items.map((it, k) =>
      `<div class="db-barre" data-k="${k}"><span class="db-nom">${it.nom}</span>` +
      `<span class="db-piste"><span style="width:${(Math.abs(it.valeur) / max) * 100}%;background:${it.coul || "#4C6FA8"}"></span></span>` +
      `<span class="db-val">${fmt(it.valeur)}</span></div>`).join("") + "</div>";
    cont.querySelectorAll(".db-barre").forEach((b) => {
      const it = items[b.dataset.k];
      survol(b, `<b>${it.nom}</b><br>${fmt(it.valeur)}`);
    });
  }


  /* Colonnes verticales : items = [{nom, valeur, coul}] */
  function colonnes(cont, items, fmt) {
    const W = 560, H = 250, g = 40, b = 26, h = 22;
    const s = svg(W, H);
    const pas = (x) => Math.ceil((x * 100) / 5) * 5 / 100;      // graduations rondes de 5 %
    const max = pas(Math.max(...items.map((i) => i.valeur), 0) * 1.1) || 0.05;
    const min = -pas(-Math.min(...items.map((i) => i.valeur), 0) * 1.1);
    const py = (v) => h + ((max - v) / (max - min)) * (H - b - h);
    for (let k = 0; k <= 4; k++) {
      const v = min + ((max - min) * k) / 4;
      el("line", { x1: g, x2: W - 10, y1: py(v), y2: py(v), class: "db-grille" }, s);
      texte(s, g - 6, py(v) + 4, fr(v * 100, 0) + " %", { "text-anchor": "end" });
    }
    const lw = (W - g - 10) / items.length;
    items.forEach((it, i) => {
      const x = g + i * lw + lw * 0.22, y0 = py(0), y1 = py(it.valeur);
      const r = el("rect", { x, y: Math.min(y0, y1), width: lw * 0.56, height: Math.abs(y1 - y0), fill: it.coul, class: "db-part" }, s);
      survol(r, `<b>${it.nom}</b><br>${fmt(it.valeur)}`);
      texte(s, x + lw * 0.28, Math.min(y0, y1) - 6, fmt(it.valeur), { "text-anchor": "middle", class: "db-axe db-etiq" });
      texte(s, x + lw * 0.28, H - 8, it.nom, { "text-anchor": "middle" });
    });
    cont.innerHTML = "";
    cont.appendChild(s);
  }

  /* Colonnes 100 % empilées : cols = [{nom, parts[]}] */
  function colonnes100(cont, cols, noms, couls) {
    const W = 560, H = 230, g = 36, b = 26, h = 10;
    const s = svg(W, H);
    const lw = (W - g - 10) / cols.length;
    for (let k = 0; k <= 4; k++) {
      const y = H - b - (k / 4) * (H - b - h);
      el("line", { x1: g, x2: W - 10, y1: y, y2: y, class: "db-grille" }, s);
      texte(s, g - 6, y + 4, k * 25 + " %", { "text-anchor": "end" });
    }
    cols.forEach((c, i) => {
      const tot = c.parts.reduce((t, v) => t + v, 0) || 1;
      let y = H - b;
      const x = g + i * lw + lw * 0.2;
      c.parts.forEach((v, j) => {
        const hh = (v / tot) * (H - b - h);
        const r = el("rect", { x, y: y - hh, width: lw * 0.6, height: hh, fill: couls[j], class: "db-part" }, s);
        survol(r, `<b>${c.nom}</b><br>${noms[j]} : ${pct(v / tot)}`);
        y -= hh;
      });
      texte(s, x + lw * 0.3, H - 8, c.nom, { "text-anchor": "middle" });
    });
    cont.innerHTML = "";
    cont.appendChild(s);
    cont.insertAdjacentHTML("beforeend", legende(noms, couls));
  }

  /* ---------- Pages ---------- */
  const $ = (id) => document.getElementById(id);
  const ANNEES = [...Array(NB_ANNEES).keys()].map((i) => String(A0 + i));
  const libelleAnnee = () => (filtres.annee === "tout" ? "2015–2026" : String(A0 + filtres.annee));

  function kpi(id, valeur, classe) {
    const e = $(id);
    e.textContent = valeur;
    e.className = "db-kpi-val " + (classe || "");
  }

  function pageDirection() {
    const rs = lignes();
    const c = ca(rs);
    const g = croissance();
    kpi("k-ca", md(c));
    kpi("k-croiss", (g > 0 ? "+" : "") + pct(g, 2), signe(g));
    kpi("k-panier", fr(c * 1000 / (somme(rs, 7) || 1), 0) + " €");
    kpi("k-online", pct(online(rs) / (c || 1), 2));
    $("k-croiss-sous").textContent = filtres.annee !== "tout" && A0 + filtres.annee === DERNIERE
      ? "vs janv.–sept. 2025 (période équivalente)" : "vs année précédente";

    // Évolution du CA par marque (2015–2025, années complètes)
    const x = ANNEES.slice(0, NB_ANNEES - 1);
    const marques = filtres.marque === "tout" ? [0, 1, 2, 3] : [filtres.marque];
    courbes($("g-evol"), x, marques.map((m) => ({
      nom: D.marques[m], coul: COUL[m], actif: filtres.annee,
      valeurs: x.map((_, a) => ca(lignes({ annee: a, marque: m })))
    })), (v) => fr(v / 1e6, v < 1e7 ? 1 : 0) + " Md");

    // Part de marque
    anneau($("g-part"), [0, 1, 2, 3].map((m) => ({ nom: D.marques[m], coul: COUL[m], valeur: ca(lignes({ marque: m })) })), md(c));
  }

  function pageEcommerce() {
    const rs = lignes();
    const c = ca(rs) || 1;
    kpi("k-e-online", pct(online(rs) / c, 2));
    kpi("k-e-site", md(ca(rs.filter((r) => r[4] === 2))));
    kpi("k-e-mkt", md(ca(rs.filter((r) => r[4] === 3))));

    // Part online par marque et par année (2015–2026)
    const marques = filtres.marque === "tout" ? [0, 1, 2, 3] : [filtres.marque];
    courbes($("g-e-evol"), ANNEES, marques.map((m) => ({
      nom: D.marques[m], coul: COUL[m], actif: filtres.annee,
      valeurs: ANNEES.map((_, a) => { const r = lignes({ annee: a, marque: m }); const t = ca(r); return t ? online(r) / t : null; })
    })), (v) => fr(v * 100, 0) + " %", null, 1200);

    // CA par canal
    barresH($("g-e-canal"), D.canaux.map((n, k) => ({ nom: n, valeur: ca(rs.filter((r) => r[4] === k)), coul: D.online[k] ? "#4f46e5" : "#4C6FA8" }))
      .sort((a, b) => b.valeur - a.valeur), md);

    // Part online par pays (ignore le filtre pays pour comparer)
    barresH($("g-e-pays"), D.pays.map((n, k) => { const r = lignes({ pays: k }); const t = ca(r); return { nom: n, valeur: t ? online(r) / t : 0 }; })
      .sort((a, b) => b.valeur - a.valeur).map((it) => Object.assign(it, { coul: D.pays[filtres.pays] === it.nom ? "#4f46e5" : "#4C6FA8" })), (v) => pct(v));
  }

  function pageMarques() {
    // Cartes par marque (le filtre marque ne s'applique pas sur cette page)
    $("cartes-marques").innerHTML = ORDRE_CARTES.map((m) => {
      const g = croissance({ marque: m });
      return `<div class="db-marque"><div class="db-marque-nom">${D.marques[m].toUpperCase()}</div><div class="db-trait"></div>` +
        `<div class="db-kpi-lib">Chiffre d'affaires</div><div class="db-marque-ligne"><b>${md(ca(lignes({ marque: m })))}</b>` +
        `<span class="${signe(g)}">${g > 0 ? "+" : ""}${pct(g, 2)}</span></div></div>`;
    }).join("");

    colonnes($("g-m-croiss"), [0, 1, 2, 3].map((m) => ({ nom: D.marques[m], valeur: croissance({ marque: m }) || 0, coul: COUL[m] }))
      .sort((a, b) => b.valeur - a.valeur), (v) => pct(v, 2));

    colonnes100($("g-m-mix"), ORDRE_MIX.map((m) => {
      const r = lignes({ marque: m });
      return { nom: D.marques[m], parts: ORDRE_CAT.map((k) => ca(r.filter((x) => x[5] === k))) };
    }), ORDRE_CAT.map((k) => D.categories[k]), ORDRE_CAT.map((k) => COUL_CAT[k]));
  }

  function rafraichir() {
    document.querySelectorAll(".db-page").forEach((p) => (p.hidden = p.id !== "p-" + page));
    $("f-marque-bloc").hidden = page === "marques";
    $("periode").textContent = libelleAnnee();
    if (page === "direction") pageDirection();
    if (page === "ecommerce") pageEcommerce();
    if (page === "marques") pageMarques();
  }

  /* ---------- Filtres et onglets ---------- */
  function remplir(id, noms) {
    $(id).innerHTML = '<option value="tout">Tout</option>' + noms.map((n, i) => `<option value="${i}">${n}</option>`).join("");
  }
  remplir("f-annee", ANNEES);
  remplir("f-marque", D.marques);
  remplir("f-pays", D.pays);
  [["f-annee", "annee"], ["f-marque", "marque"], ["f-pays", "pays"]].forEach(([id, cle]) =>
    $(id).addEventListener("change", (e) => { filtres[cle] = e.target.value === "tout" ? "tout" : +e.target.value; rafraichir(); }));
  $("f-reset").addEventListener("click", () => {
    filtres.annee = filtres.marque = filtres.pays = "tout";
    ["f-annee", "f-marque", "f-pays"].forEach((id) => ($(id).value = "tout"));
    rafraichir();
  });
  document.querySelectorAll(".onglet").forEach((o) => o.addEventListener("click", () => {
    page = o.dataset.page;
    document.querySelectorAll(".onglet").forEach((x) => x.setAttribute("aria-selected", x === o ? "true" : "false"));
    rafraichir();
  }));
  window.addEventListener("scroll", cacher, { passive: true });

  rafraichir();
})();
