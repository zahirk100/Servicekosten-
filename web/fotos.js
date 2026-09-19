/* Foto's van een afrekening: verkleinen, comprimeren en tonen.

   Een telefoonfoto is al snel 4 MB. Een documentdatabase neemt 256 KiB per
   document, dus de foto wordt in de browser verkleind en gecomprimeerd tot hij
   past. Dat gebeurt vóór opslaan: er gaat nooit een onbewerkte foto het
   apparaat af. */

(function (global) {
  "use strict";

  const MAX_ZIJDE = 1600;        // lange zijde in pixels
  const DOEL_BYTES = 170 * 1024; // ruim onder de documentlimiet van 256 KiB
  const MAX_FOTOS = 6;

  function leesAls(file) {
    return new Promise((klaar, mis) => {
      const lezer = new FileReader();
      lezer.onload = () => klaar(lezer.result);
      lezer.onerror = () => mis(new Error("Het bestand kon niet worden gelezen."));
      lezer.readAsDataURL(file);
    });
  }

  function laad(bron) {
    return new Promise((klaar, mis) => {
      const img = new Image();
      img.onload = () => klaar(img);
      img.onerror = () => mis(new Error("Dit lijkt geen afbeelding te zijn."));
      img.src = bron;
    });
  }

  /** Verkleint en comprimeert tot onder DOEL_BYTES; geeft een data-URL terug. */
  async function verklein(file) {
    if (!/^image\//.test(file.type)) {
      throw new Error("Kies een foto of afbeelding (jpg, png of heic).");
    }
    const bron = await leesAls(file);
    const img = await laad(bron);

    let schaal = Math.min(1, MAX_ZIJDE / Math.max(img.naturalWidth, img.naturalHeight));
    let kwaliteit = 0.72;
    let resultaat = null;

    // Eerst kleiner maken, daarna pas de kwaliteit opofferen: leesbaarheid van
    // een afrekening zit vooral in de resolutie.
    for (let poging = 0; poging < 7; poging++) {
      const doek = document.createElement("canvas");
      doek.width = Math.max(1, Math.round(img.naturalWidth * schaal));
      doek.height = Math.max(1, Math.round(img.naturalHeight * schaal));
      const ctx = doek.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, doek.width, doek.height);
      ctx.drawImage(img, 0, 0, doek.width, doek.height);
      resultaat = doek.toDataURL("image/jpeg", kwaliteit);
      if (resultaat.length * 0.75 <= DOEL_BYTES) break;
      if (poging % 2 === 0) kwaliteit = Math.max(0.4, kwaliteit - 0.12);
      else schaal *= 0.8;
    }
    return {
      naam: file.name || "foto.jpg",
      data: resultaat,
      bytes: Math.round(resultaat.length * 0.75),
      toegevoegd_op: new Date().toISOString(),
    };
  }

  const leesbaar = (bytes) => bytes > 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " MB"
    : Math.round(bytes / 1024) + " kB";

  global.Fotos = { verklein, leesbaar, MAX_FOTOS };
})(typeof globalThis !== "undefined" ? globalThis : this);
