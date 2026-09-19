/* Opslaglaag voor aanvragen.

   Twee modi, in deze volgorde:
   - "gedeeld": de artifact-database. Een huurder dient in, de beheerder ziet
     het binnenkomen. Pas beschikbaar zodra claude.use("db") antwoordt.
   - "lokaal": localStorage. Werkt overal (ook op een eigen webserver), maar
     alleen op dit ene apparaat. De interface zegt dat er ook bij.

   De pagina start altijd in lokale modus en schakelt over zodra de gedeelde
   database zich meldt; niets wacht op een capability die misschien nooit komt. */

(function (global) {
  "use strict";

  const SLEUTEL = "servicekosten.aanvragen.v1";
  const COLLECTIE = "aanvragen";

  let db = null;
  let viewerId = null;
  let modus = "lokaal";
  const luisteraars = new Set();
  let stopSnapshot = null;

  const meld = () => { for (const fn of luisteraars) { try { fn(); } catch (e) { console.error(e); } } };

  /* ------------------------------------------------------------- lokaal */

  function lokaalLees() {
    try {
      const rauw = localStorage.getItem(SLEUTEL);
      return rauw ? JSON.parse(rauw) : {};
    } catch { return {}; }
  }
  function lokaalSchrijf(alles) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(alles)); return true; }
    catch { return false; }
  }

  /* -------------------------------------------------------------- start */

  async function start() {
    if (!global.claude || typeof global.claude.use !== "function") return;
    try {
      const [gedeeld, gebruiker] = await Promise.all([
        global.claude.use("db"), global.claude.use("user"),
      ]);
      if (gebruiker) {
        viewerId = await gebruiker.id();
        Opslag.isBeheerder = (await gebruiker.canEdit()) || (await gebruiker.isOwner());
        Opslag.magSchrijven = await gebruiker.can("data.write");
      }
      if (!gedeeld) { meld(); return; }
      db = gedeeld;
      modus = "gedeeld";
      // Eén abonnement voor de hele pagina; opnieuw abonneren bij elke render
      // zou een lus opleveren.
      stopSnapshot = db.collection(COLLECTIE).orderBy("ingediend_op", "desc").limit(200)
        .onSnapshot(
          (snap) => {
            Opslag.aanvragen = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
            Opslag.geladen = true;
            meld();
          },
          (fout) => {
            console.warn("gedeelde opslag onbeschikbaar:", fout.code);
            modus = "lokaal";
            Opslag.foutcode = fout.code;
            meld();
          });
      meld();
    } catch (fout) {
      console.warn("opslag kon niet starten:", fout);
      meld();
    }
  }

  /* -------------------------------------------------------------- lezen */

  function lijst() {
    if (modus === "gedeeld") return Opslag.aanvragen.slice();
    return Object.values(lokaalLees())
      .sort((a, b) => String(b.ingediend_op).localeCompare(String(a.ingediend_op)));
  }

  /* ----------------------------------------------------------- schrijven */

  function nieuwId() {
    const d = new Date();
    const stempel = d.getFullYear().toString().slice(2) +
      String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    return "A" + stempel + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  async function dienIn(aanvraag) {
    const id = nieuwId();
    const doc = Object.assign({}, aanvraag, {
      id, ingediend_op: new Date().toISOString(), status: "nieuw",
      notities: [], viewer_id: viewerId || null,
    });
    if (modus === "gedeeld") {
      await db.collection(COLLECTIE).doc(id).set(doc);
    } else {
      const alles = lokaalLees();
      alles[id] = doc;
      if (!lokaalSchrijf(alles)) throw new Error("Opslaan lukte niet. Staat de opslag van je browser uit?");
      meld();
    }
    return doc;
  }

  async function werkBij(id, velden) {
    if (modus === "gedeeld") {
      await db.collection(COLLECTIE).doc(id).update(velden);
    } else {
      const alles = lokaalLees();
      if (!alles[id]) throw new Error("Deze aanvraag bestaat niet meer.");
      Object.assign(alles[id], velden);
      lokaalSchrijf(alles);
      meld();
    }
  }

  async function verwijder(id) {
    if (modus === "gedeeld") {
      await db.collection(COLLECTIE).doc(id).delete();
    } else {
      const alles = lokaalLees();
      delete alles[id];
      lokaalSchrijf(alles);
      meld();
    }
  }

  const Opslag = {
    aanvragen: [], geladen: false, isBeheerder: false, magSchrijven: null, foutcode: null,
    get modus() { return modus; },
    get viewerId() { return viewerId; },
    start, lijst, dienIn, werkBij, verwijder,
    opWijziging(fn) { luisteraars.add(fn); return () => luisteraars.delete(fn); },
    stop() { if (stopSnapshot) stopSnapshot(); },
  };

  global.Opslag = Opslag;
})(typeof globalThis !== "undefined" ? globalThis : this);
