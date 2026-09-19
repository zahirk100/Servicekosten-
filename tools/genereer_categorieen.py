#!/usr/bin/env python3
"""Genereert data/categorieen.json: labels en invoervelden per categorie.

Dit bestand stuurt het formulier in de webapplicatie aan. Per categorie staat
erin welke vervolgvragen nodig zijn om de bijbehorende beslisregel te kunnen
toepassen, met de paragraaf uit het beleidsboek erbij.
"""

from __future__ import annotations

import json
from pathlib import Path

WORTEL = Path(__file__).resolve().parent.parent

# Herbruikbare velddefinities.
WERKELIJK = {"naam": "werkelijke_kosten", "label": "Werkelijke kosten volgens factuur", "type": "bedrag",
             "hulp": "Laat leeg als het bedrag op de afrekening al uw aandeel is."}
COMPLEXTOTAAL = {"naam": "bedrag_is_complextotaal", "label": "Bovenstaand bedrag is het totaal voor het hele complex",
                 "type": "ja_nee", "standaard": True}
AANTAL = {"naam": "aantal_woonruimten", "label": "Aantal woonruimten dat gebruik (kan) maken", "type": "geheel",
          "hulp": "In beginsel worden de kosten gelijk verdeeld over dit aantal (p. 29)."}
GEMEENSCHAPPELIJK = {"naam": "betreft_gemeenschappelijke_voorziening",
                     "label": "Betreft een gemeenschappelijke ruimte of voorziening", "type": "ja_nee"}
GESPECIFICEERD = {"naam": "kosten_gespecificeerd", "label": "De verhuurder heeft de kosten gespecificeerd",
                  "type": "ja_nee_onbekend"}


def nuts_meter(brandstof: str, extra: list | None = None) -> list:
    velden = [
        {"naam": "beginstand", "label": "Beginstand meter", "type": "getal"},
        {"naam": "eindstand", "label": "Eindstand meter", "type": "getal"},
        {"naam": "verbruik_verhuurder", "label": f"Door de verhuurder opgevoerd verbruik ({brandstof})", "type": "getal"},
        {"naam": "meterstanden_betwist", "label": "Ik betwist het geadministreerde verbruik gemotiveerd",
         "type": "ja_nee", "hulp": "Leidt tot toetsing aan de Nibud-normen (p. 15)."},
        {"naam": "collectieve_factuur", "label": "De factuur betreft meerdere woonruimten", "type": "ja_nee",
         "hulp": "Dan moet de verdeelsleutel worden getoetst (voetnoot 3, p. 11)."},
    ]
    return velden + (extra or [])


CATEGORIEEN = {
    "NUT-GAS-METER": ("Gas met eigen meter", "Nutsvoorzieningen met individuele meter", "par. 3.1, p. 13-16",
                      nuts_meter("m3", [
                          {"naam": "huurder_stelt_installatie_gebrekkig",
                           "label": "Ik stel dat de collectieve stookinstallatie onvoldoende functioneert", "type": "ja_nee"},
                          {"naam": "inspectierapport_aanwezig", "label": "Inspectierapport van de installatie aanwezig",
                           "type": "ja_nee_onbekend"},
                          {"naam": "rendement_ketel", "label": "Ketelrendement volgens inspectierapport (bijv. 0.78)",
                           "type": "getal", "hulp": "De Huurcommissie hanteert een ondergrens van 80% (p. 15)."},
                      ])),
    "NUT-ELK-METER": ("Elektriciteit met eigen meter", "Nutsvoorzieningen met individuele meter", "par. 3.2, p. 17-20",
                      nuts_meter("kWh")),
    "NUT-WATER-METER": ("Water met eigen meter", "Nutsvoorzieningen met individuele meter", "par. 3.3, p. 21-23",
                        nuts_meter("m3")),
    "NUT-GAS-ZM": ("Gas zonder eigen meter", "Nutsvoorzieningen zonder eigen meter", "par. 4.2.1, p. 26",
                   [{"naam": "totale_kosten_complex", "label": "Totale gaskosten van het complex", "type": "bedrag",
                     "hulp": "Verdeeld als 35% vast (gelijk) en 65% variabel (naar oppervlakte)."}]),
    "NUT-ELK-ZM": ("Elektriciteit zonder eigen meter", "Nutsvoorzieningen zonder eigen meter", "par. 4.2.1, p. 27",
                   [{"naam": "totale_kosten_complex", "label": "Totale elektriciteitskosten van het complex", "type": "bedrag"}]),
    "NUT-WATER-ZM": ("Water zonder eigen meter", "Nutsvoorzieningen zonder eigen meter", "par. 4.2.1, p. 27",
                     [{"naam": "totale_kosten_complex", "label": "Totale waterkosten van het complex", "type": "bedrag"}]),
    "SK-01": ("Warmte gemeenschappelijke gedeelten", "Overige zaken en diensten", "par. 4.3.1, p. 30",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL, GEMEENSCHAPPELIJK]),
    "SK-02": ("Nutsvoorzieningen gemeenschappelijke gedeelten", "Overige zaken en diensten", "par. 4.3.2, p. 30",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL, GEMEENSCHAPPELIJK]),
    "SK-03": ("Roerende zaken (gebruiksvergoeding)", "Overige zaken en diensten", "par. 4.3.3, p. 30-35", [
        {"naam": "roerend", "label": "De zaak is roerend", "type": "ja_nee_onbekend",
         "hulp": "Weg te nemen zonder beschadiging van betekenis. Voor onroerende zaken mag geen vergoeding (p. 31)."},
        {"naam": "soort", "label": "Soort zaak", "type": "keuze",
         "opties": ["standaard", "zonnepanelen", "brandbeveiliging", "camera", "wasapparatuur", "rookmelder"]},
        {"naam": "aanschafwaarde", "label": "Aanschafwaarde volgens aankoopfactuur", "type": "bedrag"},
        {"naam": "geschatte_waarde", "label": "Geschatte waarde (als er geen factuur is)", "type": "bedrag",
         "hulp": "Verkoopwaarde aan het begin van het boekjaar (p. 31)."},
        {"naam": "levensduur_jaren", "label": "Geschatte levensduur", "type": "keuze", "opties": ["5", "10", "15"],
         "hulp": "5 jaar = 20% per jaar, 10 jaar = 10%, 15 jaar = 6,67% (p. 31)."},
        {"naam": "jaar_in_gebruik", "label": "Hoeveelste gebruiksjaar is dit?", "type": "geheel",
         "hulp": "Bepaalt of de eerste periode, de herwaardering op 60% of EUR 0,00 geldt (p. 32)."},
        AANTAL,
    ]),
    "SK-04-GLAS": ("Glazen wassen", "Kleine herstellingen", "par. 4.3.4, p. 36", [
        {"naam": "ruiten_bereikbaar", "label": "De ruiten zijn voor mij bereikbaar", "type": "ja_nee_onbekend",
         "hulp": "Zijn ze dat niet, dan zijn de kosten niet doorberekenbaar (p. 36)."},
        GESPECIFICEERD, WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-SCHOONMAAK": ("Schoonmaak gemeenschappelijke ruimten", "Kleine herstellingen", "par. 4.3.4, p. 36", [
        {"naam": "betreft_mutatiekosten", "label": "Dit betreft mutatiekosten (schoonmaak bij verhuizing)",
         "type": "ja_nee", "hulp": "Mutatiekosten mogen niet worden doorberekend (p. 36)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-TUIN": ("Tuinonderhoud", "Kleine herstellingen", "par. 4.3.4, p. 37", [
        {"naam": "exclusief_gebruiksrecht", "label": "Ik heb het exclusieve gebruiksrecht van de groenvoorziening",
         "type": "ja_nee_onbekend",
         "hulp": "Bij een openbaar karakter of een kijktuin blijven de kosten voor de verhuurder (p. 37)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-GLADHEID": ("Gladheidsbestrijding", "Kleine herstellingen", "par. 4.3.4, p. 37", [
        {"naam": "exclusief_gebruiksrecht", "label": "Ik heb het exclusieve (gezamenlijke) gebruiksrecht van de buitenruimte",
         "type": "ja_nee_onbekend"},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-ONTSTOPPING": ("Ontstoppen leidingen en riolering", "Kleine herstellingen", "par. 4.3.4, p. 37", [
        {"naam": "leidingen_bereikbaar_en_individueel",
         "label": "De leidingen zitten in of aan mijn woning en zijn bereikbaar", "type": "ja_nee_onbekend",
         "hulp": "Gedeelde leidingen of een technisch gebrek: kosten voor de verhuurder (p. 37)."},
        {"naam": "onderhoudscontract", "label": "Het gaat om een ontstoppingscontract", "type": "ja_nee",
         "hulp": "Dan geldt een verdeling van 50% huurder / 50% verhuurder (p. 37)."},
        GESPECIFICEERD, WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-SCHOORSTEEN": ("Schoorsteen en ventilatiekanalen", "Kleine herstellingen", "par. 4.3.4, p. 38", [
        {"naam": "kanaal_bereikbaar", "label": "De schoorsteen of het kanaal is voor mij bereikbaar", "type": "ja_nee_onbekend"},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-LAMPEN": ("Lampen vervangen", "Kleine herstellingen", "par. 4.3.4, p. 38", [
        {"naam": "betreft_armaturen_of_installatie",
         "label": "Het gaat (mede) om armaturen, de installatie zelf of vandalismeschade", "type": "ja_nee",
         "hulp": "Die kosten blijven voor de verhuurder (p. 38)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-ONGEDIERTE": ("Ongediertebestrijding", "Kleine herstellingen", "par. 4.3.4, p. 38", [
        {"naam": "gevolg_bouwkundige_situatie", "label": "Het ongedierte is gevolg van een bouwkundige situatie",
         "type": "ja_nee", "hulp": "U moet dit aannemelijk maken (p. 38)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-INSTALLATIE": ("Onderhoud installaties in de woning", "Kleine herstellingen", "par. 4.3.4, p. 38-39", [
        {"naam": "eenvoudig_onderhoud_binnen_woonruimte",
         "label": "Het gaat om eenvoudig onderhoud zonder specialistische kennis binnen mijn woning",
         "type": "ja_nee_onbekend",
         "hulp": "Periodiek onderhoud en keuringen van aard- en nagelvaste installaties zijn niet doorberekenbaar (p. 39)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-04-SCHILDERWERK": ("Schilderwerkzaamheden", "Kleine herstellingen", "par. 4.3.4, p. 39", [
        {"naam": "uitdrukkelijk_overeengekomen_of_op_verzoek_huurder",
         "label": "Het schilderwerk is uitdrukkelijk overeengekomen of op mijn verzoek uitgevoerd",
         "type": "ja_nee_onbekend"},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-05": ("Huisvuil", "Overige zaken en diensten", "par. 4.3.5, p. 39-40",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL]),
    "SK-06": ("Huismeester", "Overige zaken en diensten", "par. 4.3.6, p. 40-41", [
        {"naam": "uren", "label": "Aantal gewerkte uren in het jaar", "type": "getal", "vereist": True},
        {"naam": "totale_kosten", "label": "Totale huismeesterkosten volgens factuur", "type": "bedrag", "vereist": True},
        AANTAL,
        {"naam": "aandeel_huurders", "label": "Afwijkend aandeel huurders (standaard 0.70)", "type": "getal",
         "hulp": "Afwijken van 70/30 moet worden gemotiveerd (p. 41)."},
    ]),
    "SK-06B": ("Externe beveiliging", "Overige zaken en diensten", "par. 4.3.6, p. 41", [
        {"naam": "totale_kosten", "label": "Totale kosten beveiligingsdienst", "type": "bedrag", "vereist": True},
        {"naam": "gecertificeerd", "label": "De beveiligingsdienst is gecertificeerd", "type": "ja_nee_onbekend"},
        AANTAL,
    ]),
    "SK-07": ("Signaallevering (radio, tv, internet)", "Overige zaken en diensten", "par. 4.3.7, p. 42",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL]),
    "SK-08": ("Elektronische apparatuur", "Overige zaken en diensten", "par. 4.3.8, p. 42",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL]),
    "SK-09-OPSTAL": ("Opstal- of aanverwante verzekering", "Verzekeringen", "par. 4.3.9, p. 42-43", []),
    "SK-09-GLAS": ("Glasverzekering", "Verzekeringen", "par. 4.3.9, p. 43", [
        {"naam": "onderdeel_van_opstalverzekering", "label": "De glasverzekering zit in de opstalverzekering",
         "type": "ja_nee", "hulp": "Zonder specificatie rekent de Huurcommissie 15% van de opstalpremie (p. 43)."},
        GESPECIFICEERD, WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-09-INBOEDEL": ("Inboedelverzekering roerende zaken", "Verzekeringen", "par. 4.3.9, p. 43",
                       [WERKELIJK, COMPLEXTOTAAL, AANTAL]),
    "SK-10": ("Gemeenschappelijke ruimten (verzamelpost)", "Overige zaken en diensten", "par. 4.3.10, p. 43",
              [WERKELIJK, COMPLEXTOTAAL, AANTAL, GEMEENSCHAPPELIJK]),
    "SK-11": ("Administratiekosten", "Overige zaken en diensten", "par. 4.3.11, p. 43", [
        {"naam": "afrekening_verstrekt", "label": "Er is een afrekening aan mij verstrekt", "type": "ja_nee",
         "standaard": True, "hulp": "Zonder verstrekte afrekening mogen geen administratiekosten (p. 43)."},
        {"naam": "grondslag_warmtelevering", "label": "Grondslag warmtelevering (gas, olie, brandstof)", "type": "bedrag",
         "hulp": "Hierover geldt maximaal 2%, of 1% als meting en verdeling zijn uitbesteed."},
        {"naam": "meting_uitbesteed", "label": "Meting en verdeling zijn uitbesteed", "type": "ja_nee"},
        {"naam": "grondslag_overige_posten", "label": "Grondslag overige kostenposten", "type": "bedrag",
         "hulp": "Hierover geldt maximaal 5%. Minimum EUR 7,50, maximum EUR 75,00 per afrekening."},
    ]),
    "SK-12": ("Onderhoudscontract met 24-uursservice", "Aanvullingen Huurcommissie", "par. 4.3.12, p. 44", [
        GESPECIFICEERD, WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-13": ("Fonds (ontstopping, glas, lampen)", "Aanvullingen Huurcommissie", "par. 4.3.13, p. 44", [
        {"naam": "voldaan_aan_voorwaarden", "label": "Aangetoonde fondsvoorwaarden", "type": "meerkeuze",
         "opties": [
             "de verhuurder moet inzage geven over de hoogte van het fonds en de betalingen daaruit",
             "de bijdrage aan het fonds moet een redelijke vergoeding zijn voor de levering of dienst",
             "de omvang van het fonds mag maximaal drie keer de jaaropbrengst zijn",
             "de inleg van het fonds mag alleen gebruikt worden voor de betreffende levering of dienst",
         ]},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "SK-14-WKO": ("Warmtelevering via WKO-installatie", "Aanvullingen Huurcommissie", "par. 5.4, p. 49-50", [
        {"naam": "vaste_kosten_gesplitst",
         "label": "De vaste kosten zijn gesplitst in kapitaals-/onderhoudslasten en overige vaste kosten",
         "type": "ja_nee_onbekend",
         "hulp": "Kapitaals- en onderhoudslasten van de WKO mogen niet worden doorberekend (p. 49)."},
        WERKELIJK, COMPLEXTOTAAL, AANTAL,
    ]),
    "NSK-01": ("Leegstandsderving", "Geen servicekosten", "par. 4.3.14, p. 44", []),
    "NSK-02": ("Belastingen en heffingen", "Buiten de bevoegdheid", "par. 4.3.15, p. 44", []),
    "NSK-03": ("Zorgservicekosten", "Buiten de bevoegdheid", "par. 4.3.16, p. 45", []),
}


def main() -> int:
    uit = {
        "$comment": "Gegenereerd met tools/genereer_categorieen.py. Stuurt het formulier in de webapplicatie aan.",
        "algemene_velden": [
            {"naam": "overeengekomen", "label": "Is deze post overeengekomen in het huurcontract?",
             "type": "ja_nee_onbekend",
             "hulp": "Zonder overeenstemming is er geen betalingsverplichting (p. 9). Administratiekosten hoeven niet uitdrukkelijk overeengekomen te zijn."},
            {"naam": "levering_gemotiveerd_betwist",
             "label": "Ik betwist gemotiveerd dat deze zaak of dienst is geleverd", "type": "ja_nee",
             "hulp": "Zonder facturen van de verhuurder leidt dit tot EUR 0,00 in plaats van een forfait (p. 60-61)."},
        ],
        "bewijsopties": [
            {"waarde": "facturen", "label": "Facturen of betaalbewijzen"},
            {"waarde": "specificatieformulier", "label": "Ingevuld specificatieformulier"},
            {"waarde": "meterstanden", "label": "Meterstanden en verbruiksberekening"},
            {"waarde": "urenverantwoording", "label": "Urenverantwoording"},
            {"waarde": "aankoopfacturen", "label": "Aankoopfacturen roerende zaken"},
            {"waarde": "inspectierapport", "label": "Inspectierapport installatie"},
            {"waarde": "polis", "label": "Verzekeringspolis"},
            {"waarde": "vve_stukken", "label": "VvE-jaarrekening en ALV-verslag"},
        ],
        "categorieen": {
            code: {"label": label, "groep": groep, "bron": bron, "velden": velden}
            for code, (label, groep, bron, velden) in CATEGORIEEN.items()
        },
    }
    doel = WORTEL / "data" / "categorieen.json"
    doel.write_text(json.dumps(uit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{doel} geschreven: {len(CATEGORIEEN)} categorieën")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
