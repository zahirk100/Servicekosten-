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

  /* Bijlagen staan los van het hoofddocument: een foto van ~170 kB past niet
     samen met de bevindingen binnen de documentlimiet. */
  async function schrijfBijlagen(id, bijlagen) {
    if (!bijlagen || !bijlagen.length) return;
    if (modus === "gedeeld") {
      for (let i = 0; i < bijlagen.length; i++) {
        await db.collection(COLLECTIE).doc(id).collection("bijlagen").doc("b" + i).set(bijlagen[i]);
      }
    } else {
      const alles = lokaalLees();
      if (alles[id]) { alles[id]._bijlagen = bijlagen; lokaalSchrijf(alles); }
    }
  }

  async function laadBijlagen(id) {
    if (modus === "gedeeld") {
      try {
        const snap = await db.collection(COLLECTIE).doc(id).collection("bijlagen").get();
        return snap.docs.map((d) => d.data());
      } catch { return []; }
    }
    const alles = lokaalLees();
    return (alles[id] && alles[id]._bijlagen) || [];
  }

  async function dienIn(aanvraag) {
    const id = nieuwId();
    const bijlagen = aanvraag.bijlagen || [];
    const kaal = Object.assign({}, aanvraag);
    delete kaal.bijlagen;
    const doc = Object.assign({}, kaal, {
      id, ingediend_op: new Date().toISOString(), status: "nieuw",
      notities: [], viewer_id: viewerId || null, aantal_bijlagen: bijlagen.length,
    });
    if (modus === "gedeeld") {
      await db.collection(COLLECTIE).doc(id).set(doc);
      await schrijfBijlagen(id, bijlagen);
    } else {
      const alles = lokaalLees();
      alles[id] = doc;
      alles[id]._bijlagen = bijlagen;
      if (!lokaalSchrijf(alles)) {
        throw new Error("Opslaan lukte niet — mogelijk zijn de foto's samen te groot voor de opslag van " +
          "deze browser. Verwijder een foto en probeer het opnieuw.");
      }
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

  /* Een halfingevulde controle overleeft het sluiten van het tabblad. Alleen
     op dit apparaat, en alleen tot indienen. */
  const CONCEPT = "servicekosten.concept.v1";

  function bewaarConcept(staat) {
    try {
      localStorage.setItem(CONCEPT, JSON.stringify(Object.assign({ bewaard_op: Date.now() }, staat)));
      return true;
    } catch {
      // Opslag vol of uitgezet: het concept is een gemak, geen voorwaarde. De
      // aanroeper mag het opnieuw proberen zonder de foto's.
      return false;
    }
  }
  function leesConcept() {
    try {
      const rauw = localStorage.getItem(CONCEPT);
      if (!rauw) return null;
      const staat = JSON.parse(rauw);
      // Ouder dan een week: niet meer aanbieden.
      if (Date.now() - (staat.bewaard_op || 0) > 7 * 864e5) { wisConcept(); return null; }
      return staat;
    } catch { return null; }
  }
  function wisConcept() { try { localStorage.removeItem(CONCEPT); } catch { /* niets */ } }

  const Opslag = {
    aanvragen: [], geladen: false, isBeheerder: false, magSchrijven: null, foutcode: null,
    get modus() { return modus; },
    get viewerId() { return viewerId; },
    start, lijst, dienIn, werkBij, verwijder, laadBijlagen,
    bewaarConcept, leesConcept, wisConcept,
    opWijziging(fn) { luisteraars.add(fn); return () => luisteraars.delete(fn); },
    stop() { if (stopSnapshot) stopSnapshot(); },
  };

  global.Opslag = Opslag;
})(typeof globalThis !== "undefined" ? globalThis : this);
