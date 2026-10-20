/* À la douce heure - affichage du contenu
   Ce script lit contenu.json et remplit les pages.
   Pour changer un texte, un prix ou un horaire : modifiez contenu.json, pas ce fichier. */
(function () {
  "use strict";

  var ICONES = "images/icones.svg#i-";
  var params = new URLSearchParams(location.search);
  var modeCapture = params.has("capture");
  var estLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  /* ---------- Outils ---------- */

  var MOT_A_COMPLETER = /[àa] compl[ée]ter/i;
  var MOT_A_COMPLETER_TOUS = /[àa] compl[ée]ter/gi;

  function echapper(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Texte sûr, avec les "À COMPLÉTER" bien visibles
  function txt(s) {
    return echapper(s).replace(MOT_A_COMPLETER_TOUS, function (m) {
      return '<mark class="a-completer">' + m + "</mark>";
    });
  }

  function aCompleter(s) { return MOT_A_COMPLETER.test(String(s || "")); }
  function rempli(s) { return String(s == null ? "" : s).trim() !== ""; }

  // N'accepte que des adresses web, e-mail, téléphone ou fichiers du site
  function lienSur(u) {
    u = String(u || "").trim();
    if (!u || aCompleter(u)) return null;
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w\-./%#?=&]+$/.test(u) && u.indexOf("//") !== 0 && !/^[a-z]+:/i.test(u)) return u;
    return null;
  }

  function icone(nom, classe) {
    return '<svg class="icone' + (classe ? " " + classe : "") + '" aria-hidden="true"><use href="' + ICONES + nom + '"></use></svg>';
  }

  function lire(objet, chemin) {
    return chemin.split(".").reduce(function (o, cle) { return o == null ? undefined : o[cle]; }, objet);
  }

  function $(sel) { return document.querySelector(sel); }
  function remplir(sel, html) { var el = $(sel); if (el) el.innerHTML = html; return el; }
  function cacher(sel) { var el = $(sel); if (el) el.hidden = true; }

  function photoAAjouter(texte) {
    return '<div class="photo-a-ajouter">' + icone("flower-lotus") + "<span>" + txt(texte) + "</span></div>";
  }

  // "photo": "À VENIR" affiche un emplacement réservé ; "photo": "" n'affiche rien
  var MOT_A_VENIR = /^\s*[àa] venir\s*$/i;
  function photoOuEmplacement(src, alt, classe) {
    if (!rempli(src)) return "";
    if (MOT_A_VENIR.test(src)) {
      return '<div class="' + classe + ' photo-a-venir">' + icone("camera") +
        "<span><strong>Photo à venir</strong>" + (rempli(alt) ? "<br>" + txt(alt) : "") + "</span></div>";
    }
    return '<div class="' + classe + '">' + image(src, alt) + "</div>";
  }

  // Image, ou emplacement "photo à ajouter" si le fichier est absent
  function image(src, alt, options) {
    options = options || {};
    var s = lienSur(src);
    if (!s) return photoAAjouter("Photo à ajouter : À COMPLÉTER");
    return '<img src="' + echapper(s) + '" alt="' + echapper(alt || "") + '"' +
      ' width="' + (options.largeur || 1050) + '" height="' + (options.hauteur || 1400) + '"' +
      (options.prioritaire ? ' fetchpriority="high"' : (modeCapture ? "" : ' loading="lazy"')) +
      ' decoding="async" data-verifier-image>';
  }

  function surveillerImages() {
    document.querySelectorAll("img[data-verifier-image]").forEach(function (img) {
      img.removeAttribute("data-verifier-image");
      img.addEventListener("error", function () {
        var div = document.createElement("div");
        div.innerHTML = photoAAjouter("Photo introuvable : " + img.getAttribute("src") + ". Vérifiez le nom du fichier.");
        img.replaceWith(div.firstChild);
      });
    });
  }

  function paragraphes(liste) {
    return (liste || []).filter(rempli).map(function (p) { return "<p>" + txt(p) + "</p>"; }).join("");
  }

  /* ---------- Messages d'aide ---------- */

  function alerte(html) {
    var el = $("#alerte-technique");
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
  }

  function erreurJson(texte, err) {
    var message = String(err && err.message || "");
    var ligne = null, m;
    if ((m = message.match(/line (\d+)/i))) ligne = +m[1];
    else if ((m = message.match(/position (\d+)/i))) ligne = texte.slice(0, +m[1]).split("\n").length;
    var extrait = ligne ? texte.split("\n")[ligne - 1] : "";
    var conseil = /[“”]/.test(texte)
      ? "<br>Le fichier contient des guillemets penchés (“ ou ”). Remplacez-les par des guillemets droits (\")."
      : "<br>Vérifiez surtout les guillemets et les virgules autour de cette ligne, et de la ligne juste au-dessus.";
    alerte(
      "<strong>Le fichier contenu.json contient une erreur" + (ligne ? " vers la ligne " + ligne : "") + ".</strong>" +
      (extrait ? "Ligne concernée : <code>" + echapper(extrait.trim()) + "</code>" : "") +
      conseil +
      "<br>Pour revenir à la version précédente : voir le guide, partie « Revenir en arrière »."
    );
  }

  /* ---------- Éléments communs à toutes les pages ---------- */

  function remplirTextes(c) {
    document.querySelectorAll("[data-texte]").forEach(function (el) {
      var v = lire(c, el.getAttribute("data-texte"));
      if (v == null) return;
      el.innerHTML = txt(v);
    });
  }

  function remplirLiensReservation(c) {
    var lien = lienSur(c.contact && c.contact.lien_reservation);
    document.querySelectorAll("[data-lien-reservation]").forEach(function (a) {
      if (lien) {
        a.href = lien;
        a.target = "_blank";
        a.rel = "noopener";
        a.setAttribute("aria-label", a.textContent.trim() + " (ouvre le site de réservation dans un nouvel onglet)");
      } else {
        a.href = "index.html#contact";
      }
    });
  }

  function adresseHtml(cab) {
    if (!cab) return "";
    return txt(cab.adresse_ligne1) + "<br>" + txt(cab.code_postal) + " " + txt(cab.ville);
  }

  function remplirPied(c) {
    remplir("#pied-adresse", adresseHtml(c.cabinet) +
      (rempli(c.contact.telephone) ? '<br><a href="tel:' + echapper(c.contact.telephone.replace(/[^\d+]/g, "")) + '">' + txt(c.contact.telephone) + "</a>" : "") +
      (rempli(c.contact.email) && !aCompleter(c.contact.email) ? '<br><a href="mailto:' + echapper(c.contact.email) + '">' + txt(c.contact.email) + "</a>" : ""));
    var an = $("#annee");
    if (an) an.textContent = new Date().getFullYear();
  }

  function menuMobile() {
    var bouton = $(".menu-bouton"), menu = $("#menu");
    if (!bouton || !menu) return;
    function fermer() { menu.classList.remove("ouvert"); bouton.setAttribute("aria-expanded", "false"); }
    bouton.addEventListener("click", function () {
      var ouvert = menu.classList.toggle("ouvert");
      bouton.setAttribute("aria-expanded", String(ouvert));
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) fermer(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });
  }

  /* ---------- Page d'accueil ---------- */

  function iconeMassage(nom) {
    nom = String(nom).toLowerCase();
    if (/périnatal|perinatal|enceinte/.test(nom)) return "heart";
    if (/bébé|bebe|enfant/.test(nom)) return "baby";
    if (/fragilis|âgée|agee|ehpad/.test(nom)) return "hand-heart";
    if (/duo/.test(nom)) return "users";
    if (/atelier/.test(nom)) return "users-three";
    if (/féminin|feminin/.test(nom)) return "flower-lotus";
    return "leaf";
  }

  function iconeInfo(texte) {
    texte = String(texte).toLowerCase();
    if (/parking|stationnement|voiture/.test(texte)) return "car-simple";
    if (/étage|etage|escalier/.test(texte)) return "stairs";
    if (/mobilité|mobilite|handicap|fauteuil/.test(texte)) return "wheelchair";
    return "info";
  }

  var ICONES_DEROULE = ["chats-circle", "drop", "leaf", "coffee"];

  var OUVRE = ' target="_blank" rel="noopener"';

  // Lien fléché : nouvel onglet pour un autre site, même page pour une ancre (#...)
  function lienFleche(url, texte, classe) {
    var u = lienSur(url);
    if (!u) return "";
    return '<a class="lien-fleche' + (classe ? " " + classe : "") + '" href="' + echapper(u) + '"' +
      (/^https?:/i.test(u) ? OUVRE : "") + ">" + txt(texte) + " " + icone("arrow-up-right") + "</a>";
  }

  // Galerie de photos d'un cabinet (Gaël : 4 photos, Guidel : 5 photos)
  function galerieHtml(photos) {
    return (photos || []).filter(function (p) { return rempli(p.fichier); }).map(function (p) {
      return '<figure class="revele">' + image(p.fichier, p.description) + "</figure>";
    }).join("");
  }

  // Petite mosaïque de photos : "À VENIR" affiche un cadre "Photo à venir", "" retire l'emplacement
  function mosaique(photos) {
    var liste = (photos || []).map(function (p) {
      return photoOuEmplacement(p.fichier, p.description, "mosaique__photo");
    }).filter(rempli);
    return { html: liste.join(""), nombre: liste.length };
  }

  // Prendre soin de soi > Bouger : le texte, puis la carte du partenaire.
  // Le mot "ici" d'un paragraphe renvoie vers le site du partenaire.
  function sportHtml(s) {
    if (!s) return "";
    var lien = lienSur(s.lien);
    var paras = (s.paragraphes || []).filter(rempli).map(function (p) {
      var h = txt(p);
      if (lien) {
        h = h.replace(/(^|[\s(«])(ici)(?=[\s,.:;!?)»]|$)/, function (m, avant, mot) {
          return avant + '<a href="' + echapper(lien) + '"' + OUVRE +
            ' aria-label="' + echapper(rempli(s.lien_texte) ? s.lien_texte : mot) + ' (nouvel onglet)">' + mot + "</a>";
        });
      }
      return "<p>" + h + "</p>";
    }).join("");
    var logo = lienSur(s.logo)
      ? '<div class="partenaire__logo">' + image(s.logo, s.logo_description, { largeur: 660, hauteur: 660 }) + "</div>"
      : "";
    return '<div class="soin-sport__texte revele"><h2>' + icone("heart") + "<span>" + txt(s.titre) + "</span></h2>" + paras + "</div>" +
      '<aside class="partenaire revele"' + (rempli(s.partenaire) ? ' aria-label="' + echapper(s.partenaire) + '"' : "") + ">" + logo +
      (rempli(s.partenaire) ? '<p class="partenaire__nom">' + txt(s.partenaire) + "</p>" : "") +
      (rempli(s.lieu) ? '<p class="partenaire__lieu">' + icone("map-pin") + "<span>" + txt(s.lieu) + "</span></p>" : "") +
      (rempli(s.texte) ? '<p class="partenaire__texte">' + txt(s.texte) + "</p>" : "") +
      lienFleche(s.lien, rempli(s.lien_texte) ? s.lien_texte : "Voir le site") + "</aside>";
  }

  // Prendre soin de soi > Fréquence : 12 pastilles (les mois de l'année),
  // dont autant de pleines que de massages par an ("fois_par_an")
  function frequenceHtml(f) {
    var etapes = (f && f.etapes) || [];
    return etapes.map(function (e, i) {
      var n = Math.max(0, Math.min(12, parseInt(e.fois_par_an, 10) || 0));
      var pastilles = "";
      for (var k = 0; k < 12; k++) pastilles += '<span' + ((k * n) % 12 < n ? ' class="plein"' : "") + "></span>";
      return '<li class="revele' + (i === etapes.length - 1 ? " frequence--fort" : "") + '">' +
        '<span class="frequence__mois" aria-hidden="true">' + pastilles + "</span>" +
        '<span class="frequence__rythme">' + txt(e.rythme) + "</span>" +
        '<span class="frequence__texte">' + txt(e.texte) + "</span></li>";
    }).join("");
  }

  // Accueil : une tuile photo par page du site
  function tuilesHtml(tuiles) {
    return (tuiles || []).filter(function (t) { return lienSur(t.page); }).map(function (t) {
      return '<li class="revele"><a class="tuile" href="' + echapper(lienSur(t.page)) + '">' +
        '<span class="tuile__photo">' + image(t.photo, "", { largeur: 800, hauteur: 600 }) + "</span>" +
        '<span class="tuile__texte"><strong>' + txt(t.titre) + "</strong>" +
        (rempli(t.texte) ? "<span>" + txt(t.texte) + "</span>" : "") + "</span>" +
        icone("arrow-up-right", "tuile__fleche") + "</a></li>";
    }).join("");
  }

  // Haut de page (toutes les pages sauf l'accueil) : photo "pages" > ... > "photo".
  // "" : pas de photo, "À VENIR" : cadre Photo à venir.
  function afficherEntetePage(c, page) {
    var p = (c.pages && c.pages[page]) || {};
    var entete = $(".page-entete");
    if (!entete) return;
    var photo = remplir("#page-photo", rempli(p.photo) ? photoOuEmplacement(p.photo, p.photo_description, "page-entete__image") : "");
    if (!rempli(p.photo)) {
      if (photo) photo.hidden = true;
      entete.classList.add("page-entete--sans-photo");
    }
  }

  // Remplit les parties présentes sur la page (chaque page n'en contient qu'une partie)
  function afficherContenu(c, page) {
    afficherEntetePage(c, page);

    // Accueil
    var acc = c.accueil || {};
    remplir("#hero-photo", image(acc.photo, acc.photo_description, { prioritaire: true }));
    remplir("#tuiles", tuilesHtml(acc.tuiles));

    // Le massage ayurvédique
    var ay = c.massage_ayurvedique || {};
    remplir("#ayurveda-paragraphes", paragraphes(ay.paragraphes));
    var ayPhoto = remplir("#ayurveda-photo", photoOuEmplacement(ay.photo, ay.photo_description, "ayurveda__image"));
    if (ayPhoto && !rempli(ay.photo)) ayPhoto.hidden = true;

    // Déontologie
    var deo = c.deontologie || {};
    var ICONES_PRINCIPES = ["hand-heart", "info", "lock-simple", "handshake", "hand-soap", "graduation-cap"];
    remplir("#deontologie-photo", photoOuEmplacement(deo.photo, deo.photo_description, "deontologie__image"));
    remplir("#principes", (deo.principes || []).map(function (p, i) {
      return '<li class="revele">' + icone(ICONES_PRINCIPES[i] || "leaf", "principes__icone") +
        "<h3>" + txt(p.titre) + "</h3><p>" + txt(p.texte) + "</p></li>";
    }).join(""));
    if (!deo.principes || !deo.principes.length) cacher("#deontologie");
    remplir("#deroule", (ay.deroule || []).map(function (e, i) {
      return '<li class="revele">' + icone(ICONES_DEROULE[i] || "leaf") +
        "<h4>" + txt(e.titre) + "</h4><p>" + txt(e.texte) + "</p></li>";
    }).join(""));

    // Les massages
    var visibles = ((c.massages && c.massages.liste) || []).filter(function (m) { return m.afficher !== false; });
    var bento = $("#liste-massages");
    if (bento) {
      bento.className = "bento" + (visibles.length === 6 ? " bento--6" : "");
      bento.innerHTML = visibles.map(function (m, i) {
        var classes = "carte revele";
        if (i === 1) classes += " carte--peche carte--vedette";
        if (i === 3) classes += " carte--turquoise";
        // Sur ordinateur, le 2e et le 4e massage s'affichent en pleine largeur, photo sur le côté
        if (visibles.length === 6 && rempli(m.photo) && (i === 1 || i === 3)) classes += " carte--horizontale" + (i === 3 ? " carte--inverse" : "");
        if (/projet|bientôt|bientot/i.test((m.pour_qui || "") + " " + (m.infos || ""))) classes += " carte--projet";
        var tarif = rempli(m.tarif)
          ? '<span class="carte__tarif">' + icone("coins") + "<span>" + txt(m.tarif) + "</span></span>"
          : '<span class="carte__tarif">' + icone("coins") + '<a href="tarifs.html">Voir les tarifs</a></span>';
        var points = (m.points || []).filter(rempli);
        return '<article class="' + classes + '">' +
          (i === 1 ? '<span class="galet galet--peche" aria-hidden="true"></span>' : "") +
          photoOuEmplacement(m.photo, m.photo_description, "carte__photo") +
          icone(iconeMassage(m.nom), "carte__icone") +
          "<h3>" + txt(m.nom) + "</h3>" +
          (rempli(m.pour_qui) ? '<p class="carte__pour">' + txt(m.pour_qui) + "</p>" : "") +
          '<div class="carte__texte"><p>' + txt(m.texte) + "</p>" +
          (points.length ? "<ul>" + points.map(function (p) { return "<li>" + txt(p) + "</li>"; }).join("") + "</ul>" : "") +
          "</div>" +
          '<div class="carte__pied">' +
          (rempli(m.infos) ? "<span>" + icone("map-pin") + "<span>" + txt(m.infos) + "</span></span>" : "") +
          tarif + "</div></article>";
      }).join("");
    }

    // Tarifs
    var prestations = (c.tarifs && c.tarifs.prestations) || [];
    var nomPrincipal = prestations.length ? prestations[0].nom : "";
    remplir("#liste-prix", prestations.map(function (p) {
      var special = p.nom !== nomPrincipal;
      return '<li class="revele' + (special ? " prix--special" : "") + '">' +
        '<span class="prix__duree">' + txt(p.duree) + "</span>" +
        '<span class="prix__nom">' + txt(p.nom) + "</span>" +
        (rempli(p.description) ? '<span class="prix__desc">' + txt(p.description) + "</span>" : "") +
        '<span class="prix__montant">' + txt(p.prix) + "</span></li>";
    }).join(""));
    remplir("#moyens-paiement", ((c.paiement && c.paiement.moyens) || []).map(txt).join(", "));

    // Offres (affichées seulement si "afficher": true)
    remplir("#offres", (c.offres || []).filter(function (o) { return o.afficher === true; }).map(function (o) {
      return '<div class="offre revele"><h3>' + txt(o.titre) + "</h3><p>" + txt(o.texte) + "</p></div>";
    }).join(""));

    // Bons cadeaux
    var bc = c.bons_cadeaux || {};
    remplir("#cadeau-image", image(bc.image, bc.image_description, { largeur: 900, hauteur: 382 }));
    // Boutique en ligne de bons cadeaux (autre site, nouvel onglet)
    var boutique = $("#lien-boutique"), lienBoutique = lienSur(bc.lien_boutique);
    if (boutique && lienBoutique) {
      boutique.href = lienBoutique;
      boutique.hidden = false;
      boutique.setAttribute("aria-label", (rempli(bc.lien_boutique_texte) ? bc.lien_boutique_texte : "Boutique en ligne") + " (ouvre la boutique dans un nouvel onglet)");
    }
    if (!lienBoutique || !rempli(bc.en_ligne)) cacher("#cadeau-en-ligne");

    // Le cabinet
    var cab = c.cabinet || {};
    remplir("#galerie", galerieHtml(cab.photos));
    remplir("#adresse", adresseHtml(cab));
    var itin = $("#lien-itineraire"), lienItin = lienSur(cab.lien_itineraire);
    if (itin) { if (lienItin) itin.href = lienItin; else itin.hidden = true; }
    remplir("#infos-pratiques", (cab.infos_pratiques || []).filter(rempli).map(function (t) {
      return "<li>" + icone(iconeInfo(t)) + "<span>" + txt(t) + "</span></li>";
    }).join(""));
    // Le cabinet de Guidel
    var gu = c.cabinet_guidel;
    if (!gu) {
      cacher("#guidel");
    } else {
      var galGu = remplir("#galerie-guidel", galerieHtml(gu.galerie));
      if (galGu && !galGu.innerHTML) galGu.hidden = true;
      remplir("#adresse-guidel", adresseHtml(gu));
      var itinGu = $("#lien-itineraire-guidel"), lienGu = lienSur(gu.lien_itineraire);
      if (itinGu) { if (lienGu) itinGu.href = lienGu; else itinGu.hidden = true; }
      var mo = mosaique(gu.photos), photosGu = remplir("#photos-guidel", mo.html);
      if (photosGu) {
        photosGu.className = "mosaique mosaique--" + mo.nombre + " revele";
        photosGu.hidden = !mo.nombre;
      }
    }

    // Prendre soin de soi
    var soin = c.prendre_soin;
    if (!soin) {
      cacher("#prendre-soin");
    } else {
      remplir("#soin-sport", sportHtml(soin.sport));
      remplir("#frequence", frequenceHtml(soin.frequence));
      if (!(soin.frequence && soin.frequence.etapes && soin.frequence.etapes.length)) cacher(".soin-frequence");
    }

    // Horaires (le jour actuel est mis en avant)
    var jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    var aujourdhui = jours[new Date().getDay()];
    remplir("#horaires", ((c.horaires && c.horaires.jours) || []).map(function (j) {
      var classes = [];
      if (/fermé|ferme/i.test(j.heures)) classes.push("ferme");
      if (String(j.jour).toLowerCase() === aujourdhui) classes.push("aujourdhui");
      var cl = classes.length ? ' class="' + classes.join(" ") + '"' : "";
      return "<dt" + cl + ">" + txt(j.jour) + "</dt><dd" + cl + ">" + txt(j.heures) + "</dd>";
    }).join(""));

    // À propos
    var ap = c.a_propos || {};
    remplir("#a-propos-paragraphes", paragraphes(ap.paragraphes));
    var lienForm = $("#lien-formation"), urlForm = lienSur(ap.formation_lien);
    if (lienForm && urlForm) { lienForm.href = urlForm; lienForm.hidden = false; }
    if (!rempli(ap.transition) || !c.prendre_soin) cacher(".a-propos__transition");
    if (!rempli(ap.formation)) cacher(".a-propos__formation");
    remplir("#portrait", rempli(ap.photo) && !aCompleter(ap.photo)
      ? image(ap.photo, ap.photo_description)
      : photoAAjouter("Photo de " + (c.site.praticienne || "la praticienne") + " : À COMPLÉTER"));

    // Contact
    var ct = c.contact || {}, moyens = [];
    if (rempli(ct.telephone)) {
      moyens.push('<li><a href="tel:' + echapper(ct.telephone.replace(/[^\d+]/g, "")) + '">' + icone("phone") + txt(ct.telephone) + "</a></li>");
    }
    if (rempli(ct.email)) {
      moyens.push(aCompleter(ct.email)
        ? "<li><span>" + icone("envelope-simple") + "E-mail : " + txt(ct.email) + "</span></li>"
        : '<li><a href="mailto:' + echapper(ct.email) + '">' + icone("envelope-simple") + txt(ct.email) + "</a></li>");
    }
    if (rempli(ct.avis_google)) {
      var lienAvis = lienSur(ct.avis_google);
      moyens.push(lienAvis
        ? '<li><a href="' + echapper(lienAvis) + '" target="_blank" rel="noopener">' + icone("star") + "Lire les avis Google</a></li>"
        : "<li><span>" + icone("star") + "Avis Google : " + txt(ct.avis_google) + "</span></li>");
    }
    var lienInsta = lienSur(ct.instagram);
    if (lienInsta) {
      moyens.push('<li><a href="' + echapper(lienInsta) + '" target="_blank" rel="noopener">' + icone("instagram-logo") + "Instagram</a></li>");
    }
    remplir("#moyens-contact", moyens.join(""));

    if (page === "accueil") donneesStructurees(c);
  }

  // Informations pour Google (données structurées schema.org)
  function donneesStructurees(c) {
    var prix = ((c.tarifs && c.tarifs.prestations) || []).map(function (p) {
      return parseFloat(String(p.prix).replace(",", ".").replace(/[^\d.]/g, ""));
    }).filter(function (n) { return !isNaN(n); });
    var url = lienSur(c.site.adresse_web) || location.origin;
    var donnees = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: c.site.nom,
      description: c.site.description_google,
      url: url,
      image: url.replace(/\/$/, "") + "/images/partage-reseaux.jpg",
      logo: url.replace(/\/$/, "") + "/images/logo.png",
      telephone: c.contact.telephone,
      address: {
        "@type": "PostalAddress",
        streetAddress: c.cabinet.adresse_ligne1,
        postalCode: c.cabinet.code_postal,
        addressLocality: c.cabinet.ville,
        addressCountry: "FR"
      }
    };
    if (rempli(c.contact.email) && !aCompleter(c.contact.email)) donnees.email = c.contact.email;
    if (prix.length) donnees.priceRange = Math.min.apply(null, prix) + " € - " + Math.max.apply(null, prix) + " €";
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(donnees);
    document.head.appendChild(s);
  }

  /* ---------- Pages légales ---------- */

  function afficherPageLegale(c, cle) {
    var page = c[cle];
    if (!page) return;
    document.title = page.titre + " | " + c.site.nom;
    remplir("#page-titre", txt(page.titre));
    remplir("#page-contenu", (page.sections || []).map(function (s) {
      // Les adresses web écrites dans le texte deviennent cliquables
      var lignes = paragraphes(s.lignes).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, function (u) {
        return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>";
      });
      return "<section><h2>" + txt(s.titre) + "</h2>" + lignes + "</section>";
    }).join(""));
    remplir("#page-maj", "Dernière mise à jour : " + txt(page.mise_a_jour));
  }

  /* ---------- Panneau de vérification des "À COMPLÉTER" ---------- */

  function trouverACompleter(objet, chemin, resultats) {
    if (typeof objet === "string") {
      if (aCompleter(objet)) resultats.push(chemin);
    } else if (Array.isArray(objet)) {
      objet.forEach(function (v, i) {
        var nom = v && (v.nom || v.titre || v.jour || v.lieu);
        trouverACompleter(v, chemin.concat(nom ? String(nom) : "n°" + (i + 1)), resultats);
      });
    } else if (objet && typeof objet === "object") {
      if (objet.afficher === false) return;
      Object.keys(objet).forEach(function (k) {
        if (k.charAt(0) === "_") return;
        trouverACompleter(objet[k], chemin.concat(k.replace(/_/g, " ")), resultats);
      });
    }
    return resultats;
  }

  function panneauVerification(c) {
    if (modeCapture || !(estLocal || params.has("verif"))) return;
    var liste = trouverACompleter(c, [], []);
    if (!liste.length) return;
    var div = document.createElement("details");
    div.className = "verif";
    if (params.has("verif")) div.open = true;
    div.innerHTML = "<summary>" + liste.length + " élément" + (liste.length > 1 ? "s" : "") + " « À COMPLÉTER »</summary>" +
      "<p>Ce panneau n'apparaît que sur votre ordinateur (ou avec ?verif à la fin de l'adresse). Les visiteurs ne le voient pas.</p>" +
      "<ol>" + liste.map(function (ch) { return "<li>" + echapper(ch.join(" › ")) + "</li>"; }).join("") + "</ol>";
    document.body.appendChild(div);
  }

  /* ---------- Animations et navigation ---------- */

  function animations() {
    if (modeCapture || !("IntersectionObserver" in window)) return;
    // Les éléments ne sont masqués qu'une fois l'observateur actif :
    // s'il ne se déclenche jamais, tout le contenu reste visible.
    var actif = false;
    var obs = new IntersectionObserver(function (entrees) {
      if (!actif) { actif = true; document.documentElement.classList.add("anim"); }
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".revele").forEach(function (el) { obs.observe(el); });
  }

  // Pour les captures du guide : ?capture&seul=tarifs n'affiche que cette section
  function sectionSeule() {
    var id = params.get("seul");
    if (!modeCapture || !id) return;
    document.querySelectorAll("main > section, .entete, .pied, .rdv-mobile").forEach(function (el) {
      if (el.id !== id) el.hidden = true;
    });
  }

  function allerALAncre() {
    if (!location.hash) return;
    var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cible) cible.scrollIntoView({ behavior: "instant" });
  }

  /* ---------- Démarrage ---------- */

  // Titre et description pour Google : "site" pour l'accueil, "pages" > ... pour les autres pages
  function titreGoogle(c, page) {
    var infos = page === "accueil" ? c.site : c.pages && c.pages[page];
    if (!infos) return;
    if (rempli(infos.titre_google)) document.title = infos.titre_google;
    var meta = document.querySelector('meta[name="description"]');
    if (meta && rempli(infos.description_google)) meta.setAttribute("content", infos.description_google);
  }

  function demarrer(c) {
    var page = document.body.getAttribute("data-page");
    if (page !== "legale") titreGoogle(c, page);
    remplirTextes(c);
    remplirLiensReservation(c);
    remplirPied(c);
    if (page === "legale") afficherPageLegale(c, document.body.getAttribute("data-cle"));
    else afficherContenu(c, page);
    surveillerImages();
    sectionSeule();
    animations();
    panneauVerification(c);
    document.body.classList.add("pret");
    allerALAncre();
  }

  menuMobile();

  if (location.protocol === "file:") {
    alerte("<strong>Le site ne peut pas s'afficher en ouvrant directement ce fichier.</strong>" +
      "Pour le voir sur cet ordinateur, double-cliquez sur <code>Voir-le-site.bat</code> dans le dossier du projet.");
    return;
  }

  fetch("contenu.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then(function (texte) {
      var contenu;
      try {
        contenu = JSON.parse(texte.replace(/^﻿/, ""));
      } catch (err) {
        erreurJson(texte, err);
        return;
      }
      demarrer(contenu);
    })
    .catch(function () {
      alerte("<strong>Impossible de charger le fichier contenu.json.</strong>Vérifiez qu'il est bien présent à côté de index.html, puis rechargez la page.");
    });
})();
