# Voorbeeldafrekeningen

Drie verzonnen afrekeningen om de applicatie mee te testen, elk in twee vormen:

- **`.pdf`** — een factuur zoals een verhuurder die verstuurt, met briefhoofd,
  adresblok en een tabel met kolommen. Upload hem in stap 2. Dit is de weg die
  een echte huurder loopt, inclusief de tekstextractie uit de pdf.
- **`.txt`** — dezelfde afrekening als platte tekst, om te plakken.

Beide geven precies dezelfde posten en dezelfde uitkomst; `tests/test_voorbeelden.py`
bewaakt dat, en legt ook de uitkomsten zelf vast. Wijzigt er iets aan de regels of
de parser, dan valt die test om.

De uitkomst hangt af van de antwoorden op de vijf vragen, dus die staan er per
voorbeeld bij.

De pdf's worden gemaakt met `python3 tools/maak_voorbeeld_facturen.py`.

---

## 1 — `voorbeeld-1-klopt-2024`

Een afrekening die klopt. Acht posten, allemaal toegestaan, allemaal onderbouwd.

**Antwoorden:** boekjaar 2024 · flatwoning/appartement · 2 bewoners · 32 woningen
in het complex · "Ja, facturen én een gespecificeerd overzicht" · voorschot 552.

**Verwacht:** *Geen afwijking gevonden — € 0,00.* Acht posten groen, samen
€ 534,00 toegestaan. De € 18,00 die de huurder terugkrijgt, komt uit de eigen
berekening van de verhuurder; de applicatie is het daarmee eens.

---

## 2 — `voorbeeld-2-te-veel-gerekend-2024`

Wel netjes onderbouwd, maar met posten die niet doorberekend mogen worden.

**Antwoorden:** boekjaar 2024 · flatwoning/appartement · 1 bewoner · 60 woningen
in het complex · "Ja, facturen én een gespecificeerd overzicht" · voorschot 960.

**Verwacht:** *Je hebt mogelijk recht op € 296,00*, oplopend tot € 386,00.

| Post | Gerekend | Toegestaan | Waarom |
| --- | --- | --- | --- |
| Leegstandsderving | € 120,00 | € 0,00 | Leegstand mag niet op zittende huurders worden afgewenteld (par. 4.3.14, p. 44) |
| Opstalverzekering | € 88,00 | € 0,00 | Verzekering van het gebouw is voor de verhuurder (par. 4.3.9, p. 42-43) |
| Onderhoudscontract cv met 24-uursservice | € 110,00 | € 22,00 | Alleen het 24-uursdeel mag; niet gespecificeerd, dus forfaitair 20% (par. 4.3.12, p. 44) |
| Glasbewassing buitenzijde | € 90,00 | € 30,00 *(voorlopig)* | Bereikbaar maken is voor de verhuurder; alleen het arbeidsloon mag, forfaitair 1/3 (par. 4.3.4, p. 36) |
| Rioolheffing | € 130,00 | — | Een heffing, geen servicekost: de Huurcommissie is niet bevoegd (par. 4.3.15, p. 44) |
| Schoonmaak, elektriciteit algemene ruimten | € 275,00 | € 275,00 | In orde |

Glasbewassing staat op oranje omdat nog niet vaststaat of de ruiten voor de
huurder bereikbaar zijn. Beantwoord die vraag met "Ja" via **Zelf beantwoorden**
en de post wordt rood: de correctie loopt dan op naar € 356,00.

---

## 3 — `voorbeeld-3-geen-onderbouwing-2024`

De verhuurder stuurt alleen een lijstje met bedragen. Geen facturen, geen
specificatie.

**Antwoorden:** boekjaar 2024 · flatwoning/appartement · 3 bewoners · complex
leeg laten · "Nee, ik heb niets gezien" · voorschot 600.

**Verwacht:** *Je hebt mogelijk recht op € 492,00.* Alle zes posten rood: zonder
onderbouwing houdt de Huurcommissie € 12,00 per post per jaar aan
(par. 6.4.2, p. 60-61). € 564,00 gerekend, € 72,00 toegestaan.

Dit laat de zwaarste regel uit het beleidsboek zien: wie zijn kosten niet
onderbouwt, mag ze in de praktijk niet rekenen.
