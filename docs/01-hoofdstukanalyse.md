# 01 - Hoofdstukanalyse: elke regel uit het beleidsboek

Per regel: onderwerp, exacte regel, voorwaarden, uitzonderingen, benodigde input en bewijs,
berekening, percentages/maxima/minima/normen, verdeelsleutel, afschrijving, termijnen, wat er
gebeurt bij ontbrekend bewijs, de softwarebeslisregel en de automatiseerbaarheid.
Labels A/B/C: zie `00-leeswijzer-en-methodiek.md`.

---

## Hoofdstuk 2 - Algemene informatie

### R-ALG-00 | Onderscheid nutsvoorzieningen met individuele meter vs. (overige) servicekosten
- **Regel (A):** Kosten voor nutsvoorzieningen met een individuele meter zijn de vergoedingen voor
  gas, elektriciteit en water waarvoor de huurder een eigen meter in het woonruimtegedeelte heeft.
  Servicekosten zijn alle overige zaken en diensten in verband met de bewoning - inclusief gas,
  elektriciteit en water zónder eigen meter. (par. 2.1, p. 8; art. 7:237 lid 3 BW, voetnoot 1.)
- **Toepassingsvoorwaarde:** doorslaggevend is of het individuele verbruik bepaalbaar is, bijvoorbeeld
  als relatief aandeel in een totaalverbruik van een wooncomplex (voetnoot 2, p. 8).
- **Benodigde input:** per kostenpost: is er een individuele meter in het woonruimtegedeelte? (ja/nee)
- **Bewijs:** huurovereenkomst, meterstandenopgave, afrekening.
- **Gevolg:** bepaalt of hoofdstuk 3 (meter) of hoofdstuk 4 (geen meter) van toepassing is, en
  daarmee welk bewijs- en forfaitregime geldt.
- **Beslisregel:** `IF individuele_meter_aanwezig THEN route = HOOFDSTUK_3 ELSE route = HOOFDSTUK_4`
- **Automatiseerbaarheid:** semi-automatisch (aanwezigheid meter volgt meestal uit de afrekening,
  maar niet altijd eenduidig).

### R-ALG-01 | Zonder overeenstemming geen betalingsverplichting
- **Regel (A):** Kosten mogen alleen in rekening worden gebracht als huurder en verhuurder (al dan
  niet stilzwijgend) zijn overeengekomen dat deze voor rekening van de huurder komen. Is dat niet
  het geval, dan is er geen juridische basis voor een betalingsverplichting (p. 9; bevestigd in de
  Nota van toelichting bij het Besluit servicekosten, p. 75).
- **Uitzondering (A):** administratiekosten hoeven niet uitdrukkelijk overeengekomen te zijn
  (par. 4.3.11, p. 43).
- **Benodigde input:** huurovereenkomst, algemene voorwaarden, historie van eerdere afrekeningen.
- **Bewijs ontbreekt:** post wordt ORANJE met de vraag om de huurovereenkomst.
- **Beslisregel:** `IF overeengekomen == FALSE THEN bedrag = 0,00 (ROOD)`
  `ELSE IF overeengekomen == NULL THEN ORANJE + vraag huurovereenkomst op`
- **Automatiseerbaarheid:** semi-automatisch. "Stilzwijgend overeengekomen" is een juridische
  waardering die menselijke controle vraagt.

### R-ALG-02 | Werkelijk gemaakte kosten als uitgangspunt
- **Regel (A):** Alleen feitelijk gemaakte kosten mogen in rekening worden gebracht. De
  Huurcommissie eist dat de verhuurder de relevante facturen of andere betaalbewijzen tijdig
  overlegt (p. 9, p. 11, par. 4.1 p. 25).
- **Uitzondering (A):** afwijken van de werkelijke kosten mag alleen als een partij aannemelijk
  maakt dat die kosten geen reële afspiegeling zijn van de kosten voor de betreffende voorziening
  (p. 11, p. 25).
- **Beslisregel:** `IF facturen_aanwezig AND geen_betwisting THEN bedrag_model = factuurbedrag`
- **Automatiseerbaarheid:** automatisch bij aanwezige facturen; de "reële afspiegeling"-toets is
  handmatig.

### R-ALG-03 | Overeengekomen vast bedrag of percentage
- **Regel (A):** Zijn partijen een vast percentage of bedrag overeengekomen, dan is de **verhuurder**
  daaraan gebonden, ook als de werkelijke kosten hoger uitvallen. Voor de **huurder** geldt dat niet:
  overstijgt het overeengekomen bedrag de werkelijke kosten, dan kan de Huurcommissie op verzoek van
  de huurder de betalingsverplichting verlagen (voetnoot 4, p. 11).
- **Berekening:** `betalingsverplichting = MIN(werkelijke_kosten_volgens_model, overeengekomen_bedrag)`
- **Automatiseerbaarheid:** automatisch, mits het overeengekomen bedrag uit het contract is gehaald.

### R-ALG-04 | Hogere vaststelling mogelijk
- **Regel (A):** De Huurcommissie kan tot een hóger bedrag komen dan de verhuurder heeft afgerekend,
  als dat redelijk is - bijvoorbeeld bij een rekenfout of bij toepassing van een andere redelijke
  verdeelsleutel (par. 2.3.3, p. 10).
- **Gevolg voor software:** het potentiële verschil kan negatief zijn. Dat mag niet worden
  weggelaten of afgekapt: het is een reëel risico voor de huurder dat vóór het indienen van een
  verzoek zichtbaar moet zijn.
- **Automatiseerbaarheid:** automatisch (het model berekent het verschil met teken).

### R-ALG-05 | BTW volledig doorberekenbaar
- **Regel (A):** De btw over nutsvoorzieningen met eigen meter en over (overige) servicekosten mag
  volledig aan de huurder worden doorberekend, ongeacht of de verhuurder btw-plichtig is
  (par. 2.3.3, p. 10).
- **Beslisregel:** `btw_over_servicekosten IS NOOIT een correctiegrond`
- **Automatiseerbaarheid:** automatisch (negatieve regel: nooit als afwijking markeren).

### R-VS-01 | Voorschotbedrag: reikwijdte
- **Regel (A):** Toetsing van het maandelijkse voorschotbedrag kan uitsluitend betrekking hebben op
  nutsvoorzieningen met een eigen meter, niet op (overige) servicekosten (par. 2.3.2, p. 10;
  par. 3.4, p. 23).
- **Automatiseerbaarheid:** automatisch.

---

## Hoofdstuk 3 - Nutsvoorzieningen met een individuele meter

### R-NUT-01 | Meterstanden zijn het uitgangspunt
- **Regel (A):** Bij een individuele meter mag in het algemeen worden aangenomen dat het verschil
  tussen begin- en eindstand het daadwerkelijke verbruik weergeeft; dat is het uitgangspunt (p. 11).
- **Benodigde input:** beginstand, eindstand, factuur van de leverancier.
- **Berekening:** `bedrag_model = factuurbedrag toegerekend aan de huurder`
- **Automatiseerbaarheid:** automatisch.

### R-NUT-02 | Meterstanden ontbreken -> Nibud-norm
- **Regel (A):** Ontbreekt de begin- of eindstand, dan toetst de Huurcommissie het opgevoerde verbruik
  aan de landelijke verbruiksnormen van het Nibud. Wijkt het opgevoerde verbruik daar in belangrijke
  mate van af zonder goede verklaring, dan stelt zij verbruik én betalingsverplichting vast conform
  de Nibud-normen, met de Nibud-tarieven (p. 12; par. 3.1.1 p. 13, 3.2.1 p. 17, 3.3.1 p. 21).
- **Normbedragen gas (Tabel 1, p. 13), zelfstandige woonruimte, m3/jaar:**

  | Type woning | 2023 | 2024 | 2025 |
  | --- | ---: | ---: | ---: |
  | Flatwoning/appartement | 840 | 810 | 750 |
  | Tussenwoning | 1.170 | 1.090 | 990 |
  | Hoekwoning | 1.370 | 1.280 | 1.160 |
  | Twee onder een kap | 1.550 | 1.470 | 1.320 |
  | Vrijstaande woning | 2.040 | 1.960 | 1.740 |

  Onzelfstandige woonruimte: **25 m3 per m2 oppervlakte** (p. 14).
- **Tarieven gas (Tabel 2, p. 14):** 2023 EUR 1,45 per m3 tot 1.200 m3 en EUR 1,77 daarboven
  (prijsplafond); 2024 EUR 1,31; 2025 EUR 1,36. Vastrecht: EUR 223,56 / EUR 236,76 / EUR 323,16.
  De Huurcommissie hanteert de Nibud-gegevens die jaarlijks in juli worden vastgesteld (p. 14).
- **Normen elektriciteit (Tabel 4, p. 18), kWh/jaar, naar aantal bewoners:**
  1: 1.830 / 1.750 / 1.640 - 2: 2.850 / 2.700 / 2.550 - 3: 3.430 / 3.250 / 3.080 -
  4: 4.010 / 3.790 / 3.600 - 5: 4.350 / 4.150 / 3.980 (2023/2024/2025).
  Onzelfstandige woonruimte: **1.000 kWh per jaar** (p. 18).
- **Tarieven elektriciteit (Tabel 5, p. 18):** 2023 EUR 0,40 per kWh tot 2.900 kWh en EUR 0,45
  daarboven; 2024 EUR 0,29; 2025 EUR 0,27. Vastrecht EUR 350,52 / EUR 412,44 / EUR 561,36.
  Belastingteruggave EUR 596,86 / EUR 631,39 / EUR 635,19 (wordt **afgetrokken**).
- **Normen water (Tabel 7, p. 21), m3/jaar, naar aantal bewoners:** 1: 68 - 2: 95 - 3: 123 -
  4: 163 - 5: 187 (gelijk voor 2023, 2024 en 2025).
- **Tarieven water (Tabel 8, p. 22):** EUR 1,31 / EUR 1,60 / EUR 1,77 per m3; vastrecht
  EUR 74,00 / EUR 79,00 / EUR 85,00.
- **Verdeling vastrecht bij meerdere woonruimten op één aansluiting (A):** gelijk over het aantal
  woonruimten (voorbeelden p. 15, p. 19, p. 22).
- **Berekening gas:** `kosten = verbruik_norm x tarief_per_m3 + vastrecht x maanden/12 / aantal_woonruimten`
- **Berekening elektriciteit:** `kosten = verbruik x tarief + vastrecht_aandeel - belastingteruggave_aandeel`
- **Berekening water:** `kosten = verbruik x tarief + vastrecht_aandeel`
- **Bewijs ontbreekt:** geen meterstanden is juist de toepassingsvoorwaarde van deze regel; geen
  facturen valt onder R-BEW-01.
- **Beslisregel:**
  ```
  IF beginstand IS NULL OR eindstand IS NULL
     THEN normbedrag = nibud(jaar, woningtype|bewoners|oppervlakte, periode)
          IF verbruik_verhuurder IS NULL THEN bedrag_model = normbedrag
          ELSE IF afwijking_van_norm IS "in belangrijke mate" AND geen_goede_verklaring
               THEN bedrag_model = normbedrag
               ELSE bedrag_model = factuurbedrag
  ```
- **Automatiseerbaarheid:** semi-automatisch. De rekenkant is volledig automatisch; de maatstaf
  "in belangrijke mate" en "goede verklaring" (bv. een strenge winter, p. 12) is **label C** -
  niet gekwantificeerd in het beleidsboek - en vereist menselijke weging.

### R-NUT-03 | Meterstanden gemotiveerd betwist -> Nibud-norm
- **Regel (A):** Zijn de meterstanden bekend maar betwist de huurder gemotiveerd en overtuigend de
  hoogte van het geadministreerde verbruik, dan bepaalt de Huurcommissie de redelijke
  betalingsverplichting aan de hand van de Nibud-normen en -tarieven (par. 3.1.2 p. 15,
  3.2.2 p. 19, 3.3.2 p. 23).
- **Hulpmiddelen bij de weging (A):** bij elektriciteit kan het verbruik in voorgaande jaren een
  indicatie geven (p. 19); bij gas een inspectierapport van de installatie (p. 15).
- **Beslisregel:** `IF meterstanden_betwist AND betwisting_is_gemotiveerd_en_overtuigend THEN bedrag_model = normbedrag`
- **Automatiseerbaarheid:** semi-automatisch; "gemotiveerd en overtuigend" is een menselijk oordeel.

### R-NUT-04 | Rendement collectieve stookinstallatie: ondergrens 80%
- **Regel (A):** Stelt de huurder dat de collectieve stookinstallatie onvoldoende functioneert, dan
  kan bij de verhuurder het inspectierapport worden opgevraagd. De Huurcommissie hanteert als
  ondergrens een **rendement van 80%**. Voldoet de installatie daar niet aan, óf verstrekt de
  verhuurder het inspectierapport niet, dan gaat de Huurcommissie in het algemeen uit van de
  Nibud-verbruiksnorm (par. 3.1.2, p. 15).
- **Benodigd bewijs:** inspectierapport met ketelrendement.
- **Verhuurder levert niet:** Nibud-norm.
- **Beslisregel:**
  ```
  IF huurder_stelt_installatie_gebrekkig
     AND (inspectierapport IS NULL OR rendement < 0,80)
     THEN bedrag_model = normbedrag
  ```
- **Automatiseerbaarheid:** automatisch zodra het rendement als getal beschikbaar is; het uitlezen
  van een inspectierapport is semi-automatisch.

### R-NUT-05 | Collectieve factuur voor meerdere woonruimten
- **Regel (A):** Heeft de factuur betrekking op meerdere woonruimten (één aansluiting), dan bestaat
  die vaak deels uit verbruikskosten en deels uit verbruiksonafhankelijke kosten (bv. netbeheer). De
  verhuurder past dan een verdeelsleutel toe; de Huurcommissie toetst die sleutel en de toepassing
  daarvan **desgevraagd** (voetnoot 3, p. 11; p. 12).
- **Beslisregel:** `IF collectieve_factuur THEN markeer verdeelsleutel als te toetsen (ORANJE)`
- **Automatiseerbaarheid:** semi-automatisch.

### R-NUT-06 | Kosten van verbruiksmeters en kostenverdeling zijn doorberekenbaar
- **Regel (A):** De kosten die worden gemaakt om de totale kosten over meerdere woonruimten te
  verdelen, mogen bij de huurder in rekening worden gebracht: de kosten van roerende
  verbruiksmeters en de kosten van een daarin gespecialiseerd bedrijf (par. 3.1, p. 13; par. 3.2,
  p. 17).
- **Automatiseerbaarheid:** automatisch als de post correct is geclassificeerd.

### R-PER-01 | Gas: graaddagenmethode bij een kortere periode
- **Regel (A):** Loopt de huur- of factuurperiode korter dan twaalf maanden, dan schat de
  Huurcommissie het verbruik met de graaddagenmethode. Stookgrens 18 graden C, etmaalgemiddelde
  binnentemperatuur 18 graden C, weerstation De Bilt (par. 3.1.3, p. 16; par. 4.2.2, p. 28).
- **Graaddagen (Tabel 3, p. 16), jaartotalen:** 2023: 2.437,51 - 2024: 2.437,31 - 2025: 2.583,84.
  Maandwaarden staan in `data/normen.json`.
- **Berekening:** `verbruik_periode = verbruik_jaar x (som graaddagen in periode / jaartotaal)`,
  afgerond op hele m3 (voorbeelden p. 14 en p. 17).
- **Vaste kosten:** evenredig naar maanden (`vastrecht x maanden/12`, voorbeeld p. 14).
- **Automatiseerbaarheid:** automatisch, mits de graaddagen voor het betreffende jaar bekend zijn.
  Voor 2026 en later: **niet vast te stellen op basis van het beleidsboek.**

### R-PER-02 | Elektriciteit: seizoenspatronen bij een kortere periode
- **Regel (A):** Voor elektriciteit gebruikt de Huurcommissie seizoenspatronen; die percentages
  wijzigen niet en zijn elk jaar hetzelfde (par. 3.2.3, Tabel 6, p. 20).
- **Percentages:** jan 10 - feb 8 - mrt 9 - apr 8 - mei 8 - jun 7 - jul 6 - aug 7 - sep 8 - okt 9 -
  nov 10 - dec 10 (totaal 100%).
- **Berekening:** `verbruik_periode = verbruik_jaar x som(percentages van de maanden)`.
  Vastrecht en belastingteruggave gaan evenredig naar maanden (voorbeeld p. 19).
- **Automatiseerbaarheid:** volledig automatisch; als enige periodemethode jaaronafhankelijk.

### R-PER-03 | Water: evenredig deel van het jaar
- **Regel (A):** Het waterverbruik is gelijkmatig over het jaar verdeeld; bij een afwijkende
  afrekenperiode kan een evenredig deel ten laste van de huurder worden gebracht (par. 3.3.3, p. 23).
- **Berekening:** `kosten_periode = kosten_jaar x maanden/12`
- **Automatiseerbaarheid:** volledig automatisch.

### R-VS-02 | Toetsing van het voorschotbedrag
- **Regel (A):** De Huurcommissie beoordeelt of het voorschotbedrag **in aanzienlijke mate** afwijkt
  van wat in redelijke verhouding staat tot de te verwachten kosten. Zij toetst aan een recente,
  aan de huurder verstrekte afrekening die **niet ouder dan drie jaar** mag zijn (par. 3.4, p. 23-24;
  par. 6.5, p. 62; art. 19 Uhw, p. 68).
- **Beoordelingsdatum (A):** de eerste van de maand nadat het verzoek is ontvangen (p. 24; art. 19
  lid 4 Uhw).
- **Drempel (A):** het totaalbedrag van de betwiste kosten moet minimaal **EUR 3,00 per maand** zijn
  (p. 24, p. 62).
- **Ontvankelijkheidseis (A):** de huurder moet op het moment van het verzoek nog wonen op het adres
  waarvoor hij het voorschot betaalt (p. 24, p. 62).
- **Inflatie (A):** bij het vaststellen van een nieuw voorschotbedrag houdt de Huurcommissie
  rekening met de inflatie; art. 19 lid 3 Uhw noemt de consumentenprijsindex voor
  werknemersgezinnen (p. 24, voetnoot 5; p. 68-69).
- **Afronding (A):** een nieuw vastgesteld voorschotbedrag wordt afgerond op hele euro's (p. 24).
- **Verhuurder levert niet:** vaststelling op basis van de Nibud-verbruiksnormen en -tarieven
  (p. 10, p. 24 voetnoot 5, p. 62).
- **Beslisregel:**
  ```
  IF huurder_woont_niet_meer_op_adres THEN niet-ontvankelijk
  IF betwist_bedrag_per_maand < 3,00 THEN niet-ontvankelijk
  IF afrekening_ouder_dan_3_jaar OR afrekening_ontbreekt THEN grondslag = nibud
  ELSE grondslag = recente_afrekening x (1 + cpi_index)
  nieuw_voorschot = ROUND(grondslag / 12, 0)
  ```
- **Automatiseerbaarheid:** semi-automatisch. De maatstaf "in aanzienlijke mate" is **label C**, en
  het concrete CPI-percentage staat niet in het beleidsboek: *niet vast te stellen op basis van het
  beleidsboek.*

---

## Hoofdstuk 4 - (Overige) servicekosten

### R-VDS-01 | Verdeelsleutel gas zonder eigen meter
- **Regel (A):** Voorkeursverdeling van de totale gaskosten over meerdere woonruimten:
  **35% vaste kosten, gelijk over het aantal woonruimten** en **65% variabele kosten, naar
  vloeroppervlakte** (par. 4.2.1, p. 26).
- **Benodigde input:** totale gaskosten complex, aantal woonruimten, oppervlakte van de woonruimte,
  totale oppervlakte van het complex.
- **Berekening:** `aandeel = (0,35 x totaal / n) + (0,65 x totaal x opp / totale_opp)`
  (voorbeeld p. 27: EUR 245,00 + EUR 341,25 = EUR 586,25).
- **Automatiseerbaarheid:** volledig automatisch bij complete invoer.

### R-VDS-02 | Verdeelsleutel elektriciteit en water zonder eigen meter
- **Regel (A):** Gelijke verdeling over het aantal woonruimten (par. 4.2.1, p. 27).
- **Berekening:** `aandeel = totaal / aantal_woonruimten`
- **Automatiseerbaarheid:** volledig automatisch.

### R-VDS-03 | Verdeelsleutel overige zaken en diensten
- **Regel (A):** De kosten van gemeenschappelijke zaken en diensten moeten op een goede manier aan
  de individuele huurders worden toegerekend, meestal via een kostenverdeelsleutel. Die kan in de
  huurovereenkomst zijn overeengekomen. **Wordt een verdeelsleutel enige jaren achtereen gebruikt,
  dan wordt deze geacht te zijn overeengekomen.** De Huurcommissie kan van een overeengekomen sleutel
  afwijken als die naar haar oordeel niet redelijk is. In beginsel worden de kosten **gelijk verdeeld
  over het aantal woonruimten dat gebruik maakt of kan maken** van de zaak of dienst, tenzij er goede
  redenen zijn voor een andere verdeling (p. 29).
- **Beslisregel:**
  ```
  IF verdeelsleutel_overeengekomen OR verdeelsleutel_meerdere_jaren_gebruikt
     THEN sleutel = overeengekomen_sleutel  (toetsbaar op redelijkheid)
     ELSE sleutel = gelijk over aantal woonruimten dat gebruik (kan) maken
  ```
- **Automatiseerbaarheid:** semi-automatisch; de redelijkheidstoets van een afwijkende sleutel is
  handmatig.

### R-VDS-04 | Geen gebruik van gemeenschappelijke ruimten -> geen betalingsverplichting
- **Regel (A):** Een huurder die in het geheel geen gebruik maakt en ook niet hoeft te maken van de
  gemeenschappelijke ruimten of voorzieningen, hoeft daarvoor niet te betalen. Voorbeeld uit het
  beleidsboek: een woning op de begane grond met eigen toegang, zonder berging of brievenbus in de
  gemeenschappelijke ruimten (p. 29).
- **Beslisregel:** `IF geen_gebruik_en_geen_gebruiksmogelijkheid THEN bedrag = 0,00`
- **Automatiseerbaarheid:** semi-automatisch (feitelijke situatie; eventueel onderzoek ter plaatse).

### R-SK-01 | Warmtevoorzieningen gemeenschappelijke gedeelten (Besluit servicekosten, post 1)
- **Regel (A):** Doorberekenbaar: levering van elektriciteit, gas, olie, verwarmd water of andere
  energie voor het verwarmen van de gemeenschappelijke gedeelten, en het gebruik en aflezen van
  warmte- en verbruiksmeters van die gedeelten (par. 4.3.1, p. 30; bijlage 3, p. 72).
- **Toets:** op basis van facturen en berekeningen beoordeelt de Huurcommissie of de kosten voor
  vergoeding in aanmerking komen én of ze juist zijn toegerekend (p. 30).
- **Automatiseerbaarheid:** semi-automatisch.

### R-SK-02 | Nutsvoorzieningen gemeenschappelijke gedeelten (post 2)
- **Regel (A):** Doorberekenbaar: elektriciteit, gas en water voor het verbruik in de
  gemeenschappelijke gedeelten en voor gemeenschappelijke voorzieningen; het gebruik en aflezen van
  meters, het verwerken van meteropnamen in het overzicht van art. 7:259 lid 2 BW en de overige
  administratieve werkzaamheden voor de toedeling aan individuele huurders (par. 4.3.2, p. 30).
- **Automatiseerbaarheid:** semi-automatisch.

### R-ROE-01 | Alleen roerende zaken; onroerend zit in de kale huur
- **Regel (A):** In de servicekosten mag een gebruiksvergoeding voor **roerende** zaken worden
  berekend; voor onroerende zaken niet. Roerend = weg te nemen zonder beschadiging van betekenis
  aan de zaak of de woonruimte (voorbeelden: tapijt, laminaat, gordijnen, lampen, koelkast,
  wasmachine, magnetron, meubilair). Onroerend = niet weg te nemen zonder beschadiging van
  betekenis, of volgens verkeersopvatting onderdeel van de woonruimte (voorbeelden:
  inbouwapparatuur, cv-installatie, radiatoren, tegelvloer). De kosten van onroerende zaken worden
  geacht deel uit te maken van de kale huurprijs (par. 4.3.3, p. 30-31).
- **Zonnepanelen (A):** eerst beoordelen of ze volgens verkeersopvatting bestanddeel van de woning
  zijn (is de woning zonder de panelen onvoltooid, bv. een nul-op-de-meterwoning?); daarna of ze
  zonder beschadiging van betekenis weg te nemen zijn. **In het dak geïntegreerde panelen vormen een
  bestanddeel** (onroerend); **op het dak gemonteerde panelen niet** (roerend) (p. 33).
- **Beslisregel:** `IF NOT roerend THEN bedrag = 0,00 (ROOD)`
- **Automatiseerbaarheid:** semi-automatisch. De kwalificatie roerend/onroerend is een feitelijk en
  juridisch oordeel; bij geschil kan onderzoek ter plaatse volgen (par. 6.8, p. 64).

### R-ROE-02 | Waardebepaling roerende zaken
- **Regel (A):** De waarde wordt bepaald op basis van de aankoopfacturen van de verhuurder. Zijn die
  er niet, maar is wél inzicht gegeven in de samenstelling van de roerende zaken, dan wordt de waarde
  op basis daarvan geschat (schatting van de **verkoopwaarde aan het begin van het boekjaar**). Zijn
  ook die gegevens niet beschikbaar, dan geldt het **wettelijk vastgestelde standaardbedrag van
  EUR 12,00 per jaar** (par. 4.3.3, p. 31; herhaald in par. 6.4.2, p. 61).
- **Beslisregel:**
  ```
  IF aankoopfactuur THEN waarde = factuurwaarde
  ELSE IF inzicht_in_samenstelling THEN waarde = geschatte_verkoopwaarde_begin_boekjaar
  ELSE bedrag = 12,00 per jaar
  ```
- **Automatiseerbaarheid:** automatisch bij factuur; schatting is semi-automatisch.

### R-ROE-03 | Gebruiksvergoeding en afschrijvingstermijnen
- **Regel (A):** De gebruiksvergoeding hangt af van de verwachte levensduur:
  **5 jaar -> 20% per jaar; 10 jaar -> 10% per jaar; 15 jaar -> 6,67% per jaar** (p. 31).
- **Levensduur 10 jaar (A):** gevelkachels, kleine boilers, geisers, brandbeveiligingsmiddelen, en
  huishoudelijke en technische apparaten en laminaat voor zover bestemd voor één woonruimte (p. 31).
- **Levensduur overige roerende zaken (A):** doorgaans 5 jaar. De Huurcommissie kan afwijken en een
  kortere of langere levensduur hanteren (p. 31-32).
- **Herwaardering (A):** de vastgestelde vergoeding mag worden berekend over een periode van 5, 10 of
  15 jaar. Daarna vindt een nieuwe waardebepaling plaats; de Huurcommissie gaat doorgaans uit van
  **herwaardering op 60% van de oorspronkelijke waarde**, waarover opnieuw 20%, 10% of 6,67% per jaar
  in rekening mag worden gebracht. Vertegenwoordigt de zaak geen waarde meer, dan kan de
  betalingsverplichting op **EUR 0,00** worden gesteld (p. 32).
- **Berekening:**
  ```
  IF jaar_in_gebruik <= levensduur        THEN jaarbedrag = waarde x percentage
  ELSE IF jaar_in_gebruik <= 2x levensduur THEN jaarbedrag = (waarde x 0,60) x percentage
  ELSE                                     jaarbedrag = 0,00 (tenzij nieuwe waardebepaling)
  ```
  (voorbeeld gordijnen p. 32: EUR 300 -> EUR 60,00; na herwaardering EUR 180 -> EUR 36,00; daarna
  EUR 0,00.)
- **Automatiseerbaarheid:** automatisch, mits waarde en aanschafjaar bekend zijn.

### R-ROE-04 | Industriële wasmachines en wasdrogers
- **Regel (A):** Gebruiksvergoeding op basis van de aanschafwaarde volgens aankoopfactuur.
  Gemiddelde levensduur **10 jaar**, ook bij gemeenschappelijk gebruik: de eerste tien jaar **10%
  van de aanschafwaarde** per jaar, de tweede tien jaar **6% van de oorspronkelijke waarde** per jaar
  (na herwaardering op 60%). **Maximum EUR 5,00 per maand per woonruimte** (EUR 60,00 per jaar),
  ongeacht de samenstelling van de wasfaciliteiten (par. 4.3.3, p. 34).
- **Zonder aankoopfacturen (A):** zijn er wel facturen van een derde partij die de apparatuur levert,
  dan mag een redelijke gebruiksvergoeding op basis van de aanschafwaarde worden gevraagd. Blijkt de
  aanschafwaarde niet uit die factuur, dan wordt zij geschat op basis van inzicht in soort en aantal;
  ook dan geldt levensduur 10 jaar en hetzelfde maximum (p. 34).
- **Berekening:** `min(jaarbedrag / aantal_woonruimten, 5,00 x aantal_maanden)`
  (voorbeeld p. 35: EUR 66,66 -> begrensd op EUR 60,00; tweede periode EUR 40,00.)
- **Automatiseerbaarheid:** automatisch.

### R-ROE-05 | Zonnepanelen
- **Regel (A):** Levensduur **15 jaar**, afschrijving afgerond **6,67% per jaar**. Na die periode
  herwaardering op **60%** van de oorspronkelijke waarde, met een **extra periode van vijftien jaar**
  tegen 6,67% van die lagere waarde. Bovendien mag een **opslag van EUR 2.000,00 bovenop de
  aanschafwaarde** worden gerekend, voor onderhoud, monitoring en het vervangen van omvormers
  (par. 4.3.3, p. 32).
- **Berekening:** `jaarbedrag = (aanschafwaarde + 2.000,00) x 0,0667`
- **Automatiseerbaarheid:** automatisch zodra vaststaat dat de panelen roerend zijn (R-ROE-01).

### R-ROE-06 | Brandbeveiligingsmiddelen en beveiligingscamera's
- **Regel (A) brandbeveiliging:** brandblussers en blusdekens zijn voor huurder én verhuurder van
  belang; voor de gebruiksvergoeding mag daarom slechts **50% van de waarde** worden gebruikt, met
  een afschrijvingspercentage van **10%** (levensduur 10 jaar). Van de **onderhoudskosten** mag **50%**
  worden doorberekend (p. 33-34).
- **Regel (A) beveiligingscamera's:** in beginsel **70%** van de waarde, met afschrijving **20%**
  (levensduur 5 jaar). Ook van de **onderhoudskosten** mag **70%** worden doorberekend (p. 34).
- **Voorwaarde (A):** alleen als het een roerende voorziening betreft.
- **Automatiseerbaarheid:** automatisch.

### R-ROE-07 | Rookmelders: geen gebruiksvergoeding
- **Regel (A):** Sinds 1 juli 2022 zijn eigenaren op grond van het Bouwbesluit verplicht op iedere
  bouwlaag een rookmelder te plaatsen. De kosten komen daarom voor rekening van de verhuurder en
  **er mag geen gebruiksvergoeding voor rookmelders worden gevraagd**. Huurder en verhuurder kunnen
  wel afspreken dat het vervangen van batterijen als kleine herstelling wordt doorberekend (p. 33).
- **Beslisregel:** `IF post == rookmelder AND soort == gebruiksvergoeding THEN bedrag = 0,00 (ROOD)`
- **Automatiseerbaarheid:** automatisch.

### R-KH-00 | Kleine herstellingen: hoofdregel
- **Regel (A):** Kleine herstellingen komen voor rekening van de huurder (art. 7:217 BW / Besluit
  kleine herstellingen). Worden ze krachtens de huurovereenkomst door de verhuurder uitgevoerd, dan
  mag hij de uitvoeringskosten als servicekostenpost in rekening brengen (par. 4.3.4, p. 36;
  bijlage 3 post 4, p. 72; bijlage 4, p. 78-81).
- **Twee terugkerende maatstaven uit het Besluit (A):** de **bereikbaarheidsmaatstaf** (onderdelen m,
  n, o, q, s, u) en de maatstaf **"geen noemenswaardige kosten"** (onderdelen d, h, i, j, k, r, u)
  (Nota van toelichting, p. 82-83).
- **Uitzondering (A):** is de kleine herstelling het gevolg van een gebrek dat de verhuurder niet
  tijdig opheft, dan komt zij voor rekening van de verhuurder (p. 82).

### R-KH-01 | Glazen wassen (Bbkh, onder q)
- **Regel (A):** Alleen doorberekenbaar als de ruiten **voor de huurder bereikbaar** zijn. De kosten
  van het bereikbaar maken (bijvoorbeeld een hoogwerker) blijven voor rekening van de verhuurder;
  alleen de **arbeidskosten** mogen worden doorberekend. Kan de verhuurder de totale kosten niet
  specificeren, dan gaat de Huurcommissie uit van **2/3 bereikbaar maken en 1/3 arbeidskosten**
  (par. 4.3.4, p. 36).
- **Berekening:** `doorberekenbaar = totale_kosten x 1/3` (als niet gespecificeerd)
- **Beslisregel:**
  ```
  IF NOT ruiten_bereikbaar THEN bedrag = 0,00
  ELSE IF NOT kosten_gespecificeerd THEN bedrag = totaal x 1/3
  ELSE bedrag = arbeidskosten
  ```
- **Automatiseerbaarheid:** automatisch zodra de bereikbaarheid vaststaat; die vaststelling is
  semi-automatisch.

### R-KH-02 | Schoonmaken gemeenschappelijke ruimten (Bbkh, onder p)
- **Regel (A):** Doorberekenbaar. **Mutatiekosten - de begin- en eindschoonmaak bij verhuizing -
  mogen niet bij de huurder in rekening worden gebracht** (par. 4.3.4, p. 36).
- **Beslisregel:** `IF betreft_mutatiekosten THEN bedrag = 0,00 ELSE bedrag = werkelijke kosten / verdeelsleutel`
- **Automatiseerbaarheid:** automatisch, mits de afrekening mutatiekosten apart benoemt. Vaak
  verborgen in een verzamelpost: dan semi-automatisch.

### R-KH-03 | Tuinonderhoud (Bbkh, onder l)
- **Regel (A):** Alleen doorberekenbaar als de huurder het **exclusieve gebruiksrecht** van de
  groenvoorziening heeft. Heeft de groenvoorziening een **openbaar karakter**, dan blijven de kosten
  voor rekening van de verhuurder. Iedere groenvoorziening wordt per geval beoordeeld; afscheidingen
  als hekken, bosschages en verbodsbordjes kunnen een rol spelen (par. 4.3.4, p. 37).
- **Kijktuin (A):** bij een kijktuin kan de huurder de tuin alleen zien, niet betreden. Hij kan dus
  zelf geen onderhoud uitvoeren, zodat de verhuurder dat niet van hem overneemt: **de
  onderhoudskosten van een kijktuin zijn niet doorberekenbaar** (p. 37).
- **Automatiseerbaarheid:** handmatig. Het karakter van de groenvoorziening is een feitelijk oordeel;
  bij geschil is onderzoek ter plaatse mogelijk (par. 6.8, p. 64).

### R-KH-04 | Gladheidsbestrijding (onder tuinonderhoud)
- **Regel (A):** Doorberekenbaar, mits de huurder het **exclusieve (gezamenlijke) gebruiksrecht** van
  de buitenruimte heeft. Buitenruimte kan onder meer de groenvoorziening, het parkeerterrein en een
  gemeenschappelijk toegangspad zijn (par. 4.3.4, p. 37).
- **Automatiseerbaarheid:** semi-automatisch.

### R-KH-05 | Ontstoppen leidingen en rioleringen (Bbkh, onder n)
- **Regel (A):** Alleen doorberekenbaar als de leidingen en rioleringen zich **in of aan de
  woonruimte** bevinden en **voor de huurder bereikbaar** zijn - vanuit de woonruimte tot aan de
  aansluiting op het gemeente- of hoofdriool. Gaat het om leidingen voor **meerdere zelfstandige
  woonruimten**, dan blijven de kosten voor de verhuurder. Zijn de werkzaamheden het gevolg van een
  **technisch gebrek**, dan eveneens (par. 4.3.4, p. 37).
- **Ontstoppingscontract (A):** een contract met een gespecialiseerd bedrijf dekt meestal zowel
  individuele als gemeenschappelijke leidingen. Omdat de verhuurder een onderhoudsplicht heeft voor
  de gemeenschappelijke gedeelten, gaat de Huurcommissie uit van een verdeling waarbij **50% aan de
  huurder wordt doorberekend en 50% voor rekening van de verhuurder blijft** (p. 37).
- **Automatiseerbaarheid:** semi-automatisch; de 50/50-verdeling bij een contract is automatisch.

### R-KH-06 | Schoorsteenvegen en reinigen ventilatiekanalen (Bbkh, onder m)
- **Regel (A):** Alleen doorberekenbaar als de schoorsteen of het kanaal **voor de huurder
  bereikbaar** is. Jaarlijks vegen is noodzakelijk bij installaties die met **hout, olie of kolen**
  worden gestookt; bij **gasgestookte** installaties is dat niet noodzakelijk, maar kan wel een
  periodieke controle op de werking van het afvoerkanaal plaatsvinden (par. 4.3.4, p. 38).
- **Automatiseerbaarheid:** semi-automatisch.

### R-KH-07 | Lampen vervangen (Bbkh, onder g)
- **Regel (A):** Doorberekenbaar zijn de kosten van gering en dagelijks onderhoud: **lampen,
  tl-buizen en tl-starters vervangen en reparaties aan kapjes en schakelaars**. Voor rekening van de
  verhuurder blijven: **vervangen van armaturen, vernieuwen van (delen van) de installatie,
  reparaties aan de installatie en schade door vandalisme** (par. 4.3.4, p. 38).
- **Automatiseerbaarheid:** semi-automatisch (vereist een gespecificeerde factuur).

### R-KH-08 | Ongediertebestrijding (Bbkh, onder r)
- **Regel (A):** In beginsel voor rekening van de huurder, **tenzij** het ongedierte het gevolg is
  van een **bouwkundige situatie**. De **bewijslast** dat dit zo is, ligt bij de huurder
  (par. 4.3.4, p. 38).
- **Automatiseerbaarheid:** semi-automatisch; de bouwkundige oorzaak is een feitelijk oordeel.

### R-KH-09 | Onderhoud installaties binnen de woonruimte (Bbkh, onder i)
- **Regel (A):** Kleine herstellingen aan installaties die zich geheel binnen het woonruimtegedeelte
  bevinden (individuele cv, mechanische ventilatie) zijn doorberekenbaar, mits het gaat om
  werkzaamheden die **onderhoudstechnisch eenvoudig** zijn, **geen specialistische kennis** vereisen
  en waaraan **geen noemenswaardige kosten** zijn verbonden - bijvoorbeeld ontluchten en bijvullen
  (par. 4.3.4, p. 38).
- **Tegenhanger (A):** technische installaties die **aard- en nagelvast** aan het gebouw zijn
  verbonden zijn onroerend; de verhuurder heeft daarvoor een onderhoudsplicht. De **periodieke
  onderhoudskosten, het klein onderhoud en de keuringskosten** daarvan kunnen **niet** als
  servicekosten worden doorberekend (p. 39).
- **Automatiseerbaarheid:** semi-automatisch.

### R-KH-10 | Schilderwerkzaamheden (Bbkh, onder a en b)
- **Regel (A):** Zijn schilderwerkzaamheden (en/of behangen en witten) **niet uitdrukkelijk
  overeengekomen**, dan worden ze geacht te zijn uitgevoerd om de woonruimte verhuurbaar te maken en
  zijn de kosten **niet doorberekenbaar**. Alleen als de huurder **bij het aangaan van de
  huurovereenkomst** om zulke werkzaamheden verzoekt, kunnen de kosten in rekening worden gebracht -
  en dan, net als bij roerende zaken, **over een periode van vijf of tien jaar** (par. 4.3.4, p. 39).
- **Tweede mogelijkheid (A):** bij **onzelfstandige woonruimten** kan schilderwerk in
  gemeenschappelijke ruimten (keuken, badkamer, gemeenschappelijke huiskamer) worden doorberekend,
  **mits uitdrukkelijk overeengekomen**, als jaarlijkse gebruiksvergoeding met een **gelijke
  verdeelsleutel** over het aantal onzelfstandige woonruimten dat van die ruimten gebruikmaakt (p. 39).
- **Automatiseerbaarheid:** handmatig; berust op contractuitleg.

### R-SK-05 | Huisvuil (post 5)
- **Regel (A):** Doorberekenbaar zijn de **kostprijs van vuilniszakken** en de **kosten van transport
  van de vuilniszakken van de woonruimte naar de openbare weg**. Wordt een vuilcontainer ter
  beschikking gesteld, dan mag daarvan de **huur of een gebruiksvergoeding** worden doorberekend.
  Het ophalen van huisvuil kan ook onderdeel zijn van de taken van een huismeester of
  schoonmaakbedrijf; dan is het geen aparte post (par. 4.3.5, p. 39-40).
- **Automatiseerbaarheid:** semi-automatisch (let op dubbeltelling met huismeester/schoonmaak).

### R-HUI-01 | Huismeester: maximaal uurtarief en 70/30-verdeling
- **Regel (A):** De huismeester kan in loondienst zijn of worden ingehuurd; in beide gevallen toetst
  de Huurcommissie de doorberekende kosten aan een **maximaal toegestaan uurtarief inclusief btw**
  (Tabel 9, p. 40): **2023 en 2024: EUR 40,00; 2025 en 2026: EUR 41,00**.
- **Verdeling (A):** de werkzaamheden zijn voor huurders én verhuurder van belang; de Huurcommissie
  houdt in principe **70% ten laste van de huurders en 30% ten laste van de verhuurder** aan. Zij kan
  daarvan afwijken als de feitelijke werkzaamheden een andere verdeling rechtvaardigen (p. 41).
- **Op te vragen bewijs (A):** functieomschrijving, facturen van het dienstverleningsbedrijf en
  urenverantwoording/kosten eigen beheer (p. 41).
- **Berekening:** `min(gefactureerd, uren x max_uurtarief) x 0,70 / aantal_woonruimten`
  (voorbeeld p. 41: 800 uur, EUR 34.000 -> getoetst EUR 32.000 -> EUR 22.400 -> EUR 149,33 per woning.)
- **Automatiseerbaarheid:** semi-automatisch. De rekenkant is automatisch; afwijken van 70/30 is een
  inhoudelijke weging.

### R-HUI-02 | Externe beveiliging
- **Regel (A):** Ook hier **70% huurders / 30% verhuurder**, aansluitend bij het huismeesterbeleid.
  **Geen maximaal uurtarief**; de facturen zijn uitgangspunt en worden aan de redelijkheid getoetst.
  Is de beveiligingsdienst **gecertificeerd**, dan volstaat de factuur; zo niet, dan vraagt de
  Huurcommissie de onderliggende stukken op (par. 4.3.6, p. 41).
- **Automatiseerbaarheid:** semi-automatisch; de redelijkheidstoets zonder tariefnorm is handmatig.

### R-SK-07 | Signaallevering (post 7)
- **Regel (A):** Doorberekenbaar: de kosten van het afsluiten en het abonnement voor **radio,
  televisie en internet**, inclusief de kosten van de **roerende elektronische apparatuur** om het
  signaal op te vangen en door te leveren, de **auteursrechten** en een **alarmtelefoon in de lift**
  (par. 4.3.7, p. 42; bijlage 3 post 7, p. 73).
- **Automatiseerbaarheid:** automatisch bij correcte classificatie.

### R-SK-08 | Elektronische apparatuur (post 8)
- **Regel (A):** Diensten rond het gebruik van elektronische apparatuur, videobewaking, alarmering en
  datanetwerken: het in gebruik geven van **roerende** elektronische randapparatuur en kleine
  herstellingen daaraan (par. 4.3.8, p. 42). Het beleidsboek geeft hier **geen** aanvullend
  uitvoeringsbeleid. Voor camera's geldt wel R-ROE-06.
- **Automatiseerbaarheid:** semi-automatisch.

### R-VZ-01 | Verzekeringen die voor rekening van de verhuurder blijven
- **Regel (A):** Verzekeringen die **direct verband houden met de onroerende zaak** blijven voor
  rekening van de verhuurder: opstal-, brand-, storm-, schade-, bedrijfsschade- en
  aansprakelijkheidsverzekering (par. 4.3.9, p. 42-43).
- **Beslisregel:** `IF verzekering IN {opstal, brand, storm, schade, bedrijfsschade, aansprakelijkheid} THEN bedrag = 0,00`
- **Automatiseerbaarheid:** automatisch bij correcte classificatie.

### R-VZ-02 | Glasverzekering
- **Regel (A):** De kosten van een **glasverzekering** mogen wel worden doorberekend. Maakt de
  glasverzekering onderdeel uit van de opstalverzekering, dan mogen uitsluitend de kosten die op de
  glasverzekering betrekking hebben worden doorberekend. Kan de verhuurder de totale kosten niet
  specificeren, dan gaat de Huurcommissie uit van **15% van de kosten van de opstalverzekering**
  (par. 4.3.9, p. 43).
- **Automatiseerbaarheid:** automatisch.

### R-VZ-03 | Inboedelverzekering voor in gebruik gegeven roerende zaken
- **Regel (A):** Doorberekenbaar (par. 4.3.9, p. 43). Voorwaarden uit het Besluit servicekosten
  (post 9, p. 74): aanwijsbaar voordeel voor de huurder, uitkeringen alleen voor het doel van de
  verzekering, en jaarlijks rekening en verantwoording in het overzicht van art. 7:259 lid 2 BW.
- **Automatiseerbaarheid:** semi-automatisch.

### R-SK-10 | Gemeenschappelijke ruimten (post 10)
- **Regel (A):** De in het Besluit servicekosten bedoelde zaken en diensten ten behoeve van het
  gebruiksrecht van de gemeenschappelijke gedeelten (par. 4.3.10, p. 43). Verzamelpost; de
  inhoudelijke regels volgen uit de posten waaruit zij is opgebouwd, met R-VDS-03 en R-VDS-04 voor
  de toerekening.
- **Automatiseerbaarheid:** semi-automatisch (vereist uitsplitsing).

### R-ADM-01 | Administratiekosten: percentages, minimum en maximum
- **Regel (A):** Voor alle administratieve handelingen om tot een servicekostenafrekening te komen
  mag de verhuurder administratiekosten in rekening brengen. Deze post **hoeft niet uitdrukkelijk
  overeengekomen te zijn** (par. 4.3.11, p. 43).
- **Percentages (A), inclusief btw:**
  - warmtelevering (gas, olie of andere brandstof): **maximaal 2%**;
  - warmtelevering waarbij meting en verdeling zijn **uitbesteed**: **maximaal 1%**;
  - alle overige kostenposten: **maximaal 5%**.
- **Grenzen (A):** minimum **EUR 7,50** per afrekening per woonruimte; maximum **EUR 75,00** per
  afrekening per woonruimte.
- **Berekening:** `min(max(2%|1% x warmtegrondslag + 5% x overige grondslag, 7,50), 75,00)`
- **Automatiseerbaarheid:** volledig automatisch bij bekende grondslag.

### R-ADM-02 | Administratiekosten alleen bij een verstrekte afrekening
- **Regel (A):** Administratiekosten kunnen **alleen** in rekening worden gebracht als een afrekening
  aan de huurder is verstrekt. Zij mogen **ook** in rekening worden gebracht bij een **te late**
  afrekening (p. 43).
- **Beslisregel:** `IF NOT afrekening_verstrekt THEN bedrag = 0,00 ELSE pas R-ADM-01 toe`
- **Automatiseerbaarheid:** volledig automatisch.

### R-SK-12 | Onderhoudscontracten met 24-uursservice
- **Regel (A):** Bevat een onderhoudscontract een 24-uursservice (zeven dagen per week een storing
  kunnen melden, die op korte termijn wordt behandeld), dan zijn de kosten van **die extra service**
  doorberekenbaar. Kan de verhuurder de totale onderhoudskosten niet specificeren, dan gaat de
  Huurcommissie uit van een verdeling waarbij **20% wordt aangemerkt als de kosten voor deze
  service**; alleen die 20% mag in rekening worden gebracht (par. 4.3.12, p. 44).
- **Samenhang:** het periodieke onderhoud zelf aan onroerende installaties is niet doorberekenbaar
  (R-KH-09).
- **Automatiseerbaarheid:** automatisch.

### R-SK-13 | Fondsen
- **Regel (A):** Partijen kunnen een fonds vormen voor relatief lage, moeilijk toewijsbare kosten
  (ontstoppingsfonds, glasfonds, lampenfonds). Een fonds moet voldoen aan **vier** voorwaarden:
  1. de verhuurder geeft inzage in de hoogte van het fonds en de betalingen daaruit;
  2. de bijdrage is een redelijke vergoeding voor de levering of dienst;
  3. de **omvang van het fonds is maximaal drie keer de jaaropbrengst**;
  4. de inleg wordt alleen gebruikt voor de betreffende levering of dienst (par. 4.3.13, p. 44).
- **Beslisregel:** `IF NOT alle vier voorwaarden aangetoond THEN ORANJE + benoem welke ontbreekt`
- **Automatiseerbaarheid:** semi-automatisch; voorwaarde 3 is rekenkundig toetsbaar, de overige niet.

### R-NSK-01 | Leegstandsderving: niet toegestaan
- **Regel (A):** Het is **niet toegestaan** gederfde servicekosten als gevolg van leegstand aan de
  zittende huurders door te berekenen (par. 4.3.14, p. 44).
- **Automatiseerbaarheid:** automatisch.

### R-NSK-02 | Belastingen en heffingen: buiten de bevoegdheid
- **Regel (A):** Belastingen en heffingen maken **geen** onderdeel uit van de servicekosten; huurder
  of verhuurder betaalt deze als *belastingplichtige*, niet als huurder of verhuurder. De
  Huurcommissie is **niet bevoegd** hierover uitspraak te doen. De huurder is wel verplicht de
  heffingen aan de verhuurder te betalen wanneer die ze op eigen naam voor hem heeft voldaan
  (par. 4.3.15, p. 44; par. 6.1, p. 51).
- **Gevolg voor software:** de post valt buiten de berekening en mag **niet** als correctie worden
  opgevoerd; hij wordt apart getoond als BUITEN BEVOEGDHEID.
- **Automatiseerbaarheid:** automatisch.

### R-NSK-03 | Zorgservicekosten: buiten de bevoegdheid
- **Regel (A):** De Huurcommissie doet alleen uitspraak over **woonservicekosten**. Zorgservicekosten
  (maaltijdverstrekking, verpleging, alarmservice) vallen buiten haar bevoegdheid (par. 4.3.16, p. 45).
- **Automatiseerbaarheid:** semi-automatisch; de afbakening woon/zorg kan discussie geven.

### R-SK-OPEN | De opsomming is niet limitatief
- **Regel (A):** De Huurcommissie heeft ruimte de opsomming in de toekomst aan te vullen met andere
  kostenposten, mits die voldoen aan de wettelijke omschrijving van servicekosten (p. 29). Ook de
  Nota van toelichting bij het Besluit servicekosten stelt dat de opsomming niet limitatief is (p. 75).
- **Gevolg voor software:** een onbekende post mag nooit automatisch als niet-doorberekenbaar worden
  weggezet. Hij wordt ORANJE met de vraag om classificatie.
- **Automatiseerbaarheid:** handmatig.

---

## Hoofdstuk 5 - Specifieke kwesties

### R-EIG-01 | Eigendomsoverdracht: wie is partij?
- **Regel (A):** Rechten en plichten uit de huurovereenkomst die **ná** de overdracht opeisbaar
  worden, gaan over op de nieuwe eigenaar/verhuurder. De **oude** eigenaar is partij als hij de
  afrekening heeft verstrekt of had moeten verstrekken (dat laatste ziet op het halfjaar na afloop
  van het kalenderjaar). De **nieuwe** eigenaar is partij als de afrekening nog niet is verstrekt en
  de termijn daarvoor nog niet is verstreken (par. 5.1, p. 46).
- **Overdracht in de eerste zes maanden van een jaar (A):** bepalend is of al is afgerekend. Is de
  oude eigenaar al afgerekend, dan is hij partij; is nog niet afgerekend en vindt de overdracht vóór
  30 juni plaats, dan is de nieuwe eigenaar partij (p. 46).
- **Zelfde verhuurder (A):** verandert bij de overdracht niet de verhuurder (bijvoorbeeld omdat de
  beheerder op eigen naam de huurovereenkomst is aangegaan), dan heeft de eigendomsoverdracht geen
  invloed op de contractuele relatie; partijen blijven gelijk (p. 47).
- **Beslisregel:**
  ```
  IF afrekening_verstrekt_voor_overdrachtsdatum THEN partij = oude_eigenaar
  ELSE IF overdrachtsdatum <= uiterste_afrekendatum THEN partij = nieuwe_eigenaar
  ELSE partij = oude_eigenaar  (hij had moeten verstrekken)
  ```
- **Automatiseerbaarheid:** automatisch bij bekende overdrachtsdatum; die datum komt doorgaans van
  buiten het dossier (Kadaster / mededeling verhuurder).

### R-PER-04 | Afwijkende (gebroken) afrekenperiode
- **Regel (A):** De verhuurder moet uiterlijk zes maanden na afloop van het kalenderjaar afrekenen.
  Loopt de factuurperiode van de leverancier anders (bijvoorbeeld augustus-augustus), dan geldt:
  **bij een gebroken boekjaar heeft de verhuurder tot het einde van het kalenderjaar waarin de
  afwijkende periode eindigt, plus zes maanden, om af te rekenen** (par. 5.2, p. 47-48). Voorbeeld
  uit het beleidsboek: factuurperiode augustus 2024 - augustus 2025 -> jaarafrekening uiterlijk
  30 juni 2026.
- **Aanvulling (A):** betaalt de huurder via de servicekosten ook individuele stookkosten, dan
  moeten die eveneens in de afrekening servicekosten worden opgenomen (p. 47).
- **Verhuizing (A):** verhuizing tijdens de afwijkende afrekenperiode heeft **geen invloed** op de
  uiterste afrekendatum (p. 48). Vergelijk art. 7:259 lid 3 BW: bij beëindiging van de huur ziet het
  overzicht op het reeds verstreken deel van het kalenderjaar (p. 65).
- **Wettelijke grondslag (A):** art. 7:259 lid 2 BW, tweede volzin: kosten over een andere periode
  van twaalf maanden die een boekjaar vormt en in het verstreken kalenderjaar eindigt, neemt de
  verhuurder op in het overzicht van dát verstreken kalenderjaar (p. 65).
- **Beslisregel:** `uiterste_afrekendatum = 30 juni van (jaar waarin de afwijkende periode eindigt + 1)`
- **Automatiseerbaarheid:** automatisch.

### R-ZON-01 | Teruglevering bij zonnepanelen
- **Regel (A) roerende panelen:** of de huurder profiteert, hangt af van de gemaakte afspraken.
  Betaalt de huurder een **gebruiksvergoeding**, dan heeft hij in beginsel recht op de **volledige
  opbrengsten**, tenzij de verhuurder aantoont dat dit onredelijk zou zijn - bijvoorbeeld omdat de
  gebruiksvergoeding slechts een klein deel van de investeringskosten dekt. In dat geval beslist de
  Huurcommissie welke verdeling gerechtvaardigd is. Zijn er **geen afspraken** over de financiering
  en betaalt de verhuurder de kosten volledig zonder die (deels) door te berekenen, dan komen **alle
  opbrengsten toe aan de verhuurder** (par. 5.3, p. 48).
- **Regel (A) onroerende panelen:** de verhuurder wordt geacht de volledige kosten in de huurprijs te
  dekken; de huurder heeft daarom in beginsel recht op de **volledige opbrengsten**. Afwijken kan
  alleen als de verhuurder aantoont dat die veronderstelling niet klopt. Is een
  **energieprestatievergoeding** afgesproken, dan gaat de Huurcommissie ervan uit dat de kosten
  daarin of in de huurprijs zijn gedekt; ook dan komen de opbrengsten in beginsel volledig aan de
  huurder toe (p. 48).
- **Beslisregel:**
  ```
  IF panelen_onroerend OR energieprestatievergoeding THEN opbrengsten -> huurder
  ELSE IF huurder_betaalt_gebruiksvergoeding THEN opbrengsten -> huurder (tenzij verhuurder onredelijkheid aantoont)
  ELSE opbrengsten -> verhuurder
  ```
- **Automatiseerbaarheid:** semi-automatisch; de tegenbewijsroute is handmatig.

### R-WKO-01 | Warmtelevering via een WKO-installatie
- **Regel (A):** Een WKO-installatie is een **onroerende aanhorigheid**. De kosten van onroerende
  zaken moeten uit de kale huurprijs worden gedekt. De verhuurder mag de **kapitaals- en
  onderhoudslasten** van de WKO-installatie daarom **niet** via de servicekosten doorberekenen. Het
  **variabele verbruik** kan volgens de normale regels worden afgerekend, en het **resterende deel
  van de vaste kosten** (bijvoorbeeld vaste energiekosten, transportkosten/netbeheer, meetdiensten)
  mag wel worden doorberekend. De verhuurder moet de vaste kosten dus **splitsen** (par. 5.4, p. 49).
- **Drie situaties na het Acantus-arrest (Hoge Raad, 2021) (A), p. 50:**
  1. Huurder en verhuurder hebben een energieleveringsovereenkomst: de verhuurder is leverancier en
     mag de kapitaals- en onderhoudslasten **niet** doorberekenen.
  2. De huurder heeft een overeenkomst met een **derde** energieleverancier: die derde mag de
     kapitaals- en onderhoudslasten wél doorberekenen (met maxima op grond van de Warmtewet), maar
     die kosten kunnen **niet** in een servicekostenprocedure bij de Huurcommissie worden beoordeeld.
  3. Kan de verhuurder met die derde leverancier worden **vereenzelvigd** (feitelijk dezelfde
     rechtspersoon), dan mogen de kapitaals- en onderhoudslasten evenmin worden doorberekend.
     Dit is een uitzonderlijke situatie.
- **Beslisregel:**
  ```
  IF leverancier == verhuurder OR vereenzelvigd
     THEN kapitaals_en_onderhoudslasten = 0,00; overige vaste kosten + variabel = doorberekenbaar
  ELSE IF leverancier == derde THEN post valt buiten de servicekostenprocedure
  IF vaste_kosten NOT gesplitst THEN ORANJE + vraag splitsing op
  ```
- **Automatiseerbaarheid:** handmatig. De splitsing van de vaste kosten en de vraag naar
  vereenzelviging zijn niet uit een afrekening af te leiden.
- **Maximumbedragen Warmtewet:** *niet vast te stellen op basis van het beleidsboek.*

---

## Hoofdstuk 6 - Procedureregels

### R-PRC-01 | Omvang van het geschil
- **Regel (A):** De Huurcommissie beslist **alleen** over de kostenposten waarover partijen het
  oneens zijn én die in het verzoekschrift zijn genoemd. Andere kostenposten worden **ongewijzigd**
  overgenomen in de uitspraak (par. 6.1, p. 51).
- **Gevolg voor software:** de selectie van betwiste posten is een bewuste keuze van de huurder en
  bepaalt de maximale correctie. Posten die niet worden genoemd, leveren niets op.
- **Automatiseerbaarheid:** automatisch (het model hoeft alleen de geselecteerde posten te rekenen).

### R-PRC-02 | Bevoegdheid onder de Wet betaalbare huur
- **Regel (A):** Sectorindeling hangt af van de **datum van het huurcontract** (vóór of vanaf
  1 juli 2024) en de **aanvangshuurprijs** (par. 6.2.1, p. 51-52).
  - Contract **vóór** 1 juli 2024: sociale sector (tot en met de liberalisatiegrens) of vrije sector.
  - Contract **op of na** 1 juli 2024: sociale sector, middenhuursector of vrije sector
    (socialehuurgrens en vrijesectorgrens).
- **Uitspraak of advies (A):**
  - contract **vóór** 1 juli 2024 en **sociale sector** -> **uitspraak**;
  - contract **vóór** 1 juli 2024 en **vrije sector** -> alleen **advies**, en uitsluitend als beide
    partijen daar schriftelijk mee instemmen (art. 5 lid 3 Uhw); dit is geen uitspraak;
  - contract **op of na** 1 juli 2024 -> **uitspraak** bij álle huurwoningen, ongeacht sector; een
    advies is in de procedures van art. 7:260 en 7:261 BW dan niet meer mogelijk (p. 52-53).
- **Overgangsrecht (A):** voor contracten van vóór 1 juli 2024 geldt het puntenstelsel bij sociale
  huurwoningen. Bij vrijesectorwoningen die qua punten tot de sociale sector behoren (**minder dan
  143 punten op peildatum 1 juli 2024**) geldt een overgangstermijn van één jaar: vanaf
  **1 juli 2025** kan de huurder de huurprijs laten toetsen (art. 7:254 BW). Wordt de huurprijs
  verlaagd tot een sociaal niveau, dan kan de huurder ook terecht voor de servicekostenprocedure -
  óók voor boekjaren waarin de huurprijs nog geliberaliseerd was (par. 6.2.2, p. 53-55).
- **Bedragen van de liberalisatiegrens, socialehuurgrens en vrijesectorgrens:** *niet vast te stellen
  op basis van het beleidsboek* - dit verwijst naar de bijlagen 4 en 5 van het beleidsboek
  Waarderingsstelsel zelfstandige woonruimte (p. 52).
- **Automatiseerbaarheid:** semi-automatisch. De datum en de aanvangshuurprijs zijn uit het contract
  te halen; de grensbedragen moeten uit een externe bron komen.

### R-PRC-03 | Afrekentermijn en uiterste verzoekdatum
- **Regel (A):** De verhuurder moet binnen een halfjaar na afloop van ieder kalenderjaar afrekenen.
  De huurder dient binnen **24 maanden**, gerekend vanaf de dag dat die halfjaartermijn is verstreken,
  het verzoek in - dus tot uiterlijk **tweeëneenhalf jaar na afloop van het kalenderjaar**
  (par. 6.3 en 6.3.3, p. 55-57; art. 7:260 lid 2 BW, p. 66).
- **Tabel 10 (p. 56):**

  | Periode afrekening | Uiterste afrekendatum | Uiterste verzoekdatum |
  | --- | --- | --- |
  | 2023 | 30 juni 2024 | 30 juni 2026 |
  | 2024 | 30 juni 2025 | 30 juni 2027 |
  | 2025 | 30 juni 2026 | 30 juni 2028 |
  | 2026 | 30 juni 2027 | 30 juni 2029 |

- **Aanvullende regel (A):** het verzoek heeft betrekking op **niet meer dan één tijdvak van ten
  hoogste twaalf maanden per kostensoort** (art. 7:260 lid 2 BW, p. 66).
- **Automatiseerbaarheid:** volledig automatisch.

### R-PRC-04 | Bezwaarplicht (afrekening is verstrekt)
- **Regel (A):** Is de afrekening tijdig verstrekt maar is de huurder het er niet mee eens, dan moet
  hij dat **schriftelijk** bij de verhuurder kenbaar maken en zijn bezwaren toelichten: per welke
  kostenpost en waarom. Hij moet de verhuurder **drie weken** geven om te reageren. Neemt de reactie
  de bezwaren niet weg, of reageert de verhuurder niet binnen drie weken, dan kan de huurder een
  verzoek indienen. **Ontbreekt de schriftelijke kennisgeving, dan verklaart de Huurcommissie het
  verzoek niet-ontvankelijk** (par. 6.3.1, p. 56).
- **Verhuurderszijde (A):** ook de verhuurder kan een verzoek indienen, vanaf drie weken nadat de
  afrekening is verstrekt, mits de huurder niet binnen drie weken heeft gereageerd of niet akkoord
  is. Houdt de verhuurder zich niet aan die drie weken, dan is zijn verzoek niet-ontvankelijk (p. 56).
- **Automatiseerbaarheid:** automatisch (datumrekenen); de inhoudelijke kwaliteit van het
  bezwaarschrift is semi-automatisch.

### R-PRC-05 | Opvraagplicht (geen afrekening ontvangen)
- **Regel (A):** Heeft de huurder geen afrekening ontvangen én is de halfjaartermijn verstreken, dan
  moet hij de afrekening eerst **schriftelijk opvragen** en de verhuurder **drie weken** geven. Blijft
  die uit, of laat de verhuurder weten niet te zullen verstrekken, dan kan de huurder een verzoek
  indienen. **Ontbreekt de schriftelijke kennisgeving, dan is het verzoek niet-ontvankelijk**
  (par. 6.3.2, p. 57).
- **Aanvulling (A):** verstrekt de verhuurder de jaarafrekening alsnog binnen drie weken, dan geldt
  vervolgens de bezwaarplicht van R-PRC-04 (p. 57).
- **Asymmetrie (A):** de **verhuurder** kan géén verzoek indienen als hij geen afrekening aan de
  huurder heeft verstrekt (p. 57).
- **Automatiseerbaarheid:** automatisch.

### R-PRC-06 | Uitzondering bij een naderende indieningstermijn
- **Regel (A):** Kan de huurder door het naderende einde van de tweeëneenhalfjaarstermijn de
  opvraag- of bezwaarplicht niet meer uitvoeren, of de bijbehorende driewekentermijn niet meer in
  acht nemen, dan verklaart de Huurcommissie het verzoek **alsnog ontvankelijk** - mits het verzoek
  is ingediend vóór het verstrijken van die termijn (par. 6.3.3, p. 57-58, met voorbeelden A en B).
- **Beslisregel:**
  ```
  IF geen_bezwaar_of_opvraag
     AND (uiterste_verzoekdatum - vandaag) < 21 dagen
     AND verzoek_wordt_ingediend_voor_uiterste_verzoekdatum
     THEN ontvankelijk
     ELSE niet-ontvankelijk
  ```
- **Automatiseerbaarheid:** automatisch.

### R-PRC-07 | Minimumbedrag betwiste kosten
- **Regel (A):** Het totaalbedrag van de betwiste kosten moet **minimaal EUR 36,00** bedragen; anders
  neemt de Huurcommissie het verzoek niet in behandeling (par. 6.3.4, p. 59). Voor het voorschot
  geldt **EUR 3,00 per maand** (p. 24, p. 62).
- **Automatiseerbaarheid:** volledig automatisch.

### R-PRC-08 | Aanlevertermijn en uitstel voor de verhuurder
- **Regel (A):** De verhuurder krijgt een brief met de benodigde informatie en **drie weken** om die
  te sturen. Hij kan **eenmaal** om uitstel vragen van **maximaal drie weken**, en dat verzoek moet
  **binnen de eerste drie weken** worden gedaan; uitstel dat later wordt gevraagd, wordt afgewezen.
  Maximaal dus **zes weken**. **Nadien aangeleverde informatie wordt buiten beschouwing gelaten**; de
  Huurcommissie doet alleen uitspraak op grond van tijdig aangeleverde relevante informatie
  (par. 6.4.1, p. 59).
- **Gevolg voor software:** dit is de scherpste hefboom in het hele dossier. Informatie die te laat
  komt, telt niet - waardoor de forfaitregels R-BEW-01 t/m R-BEW-03 van toepassing worden.
- **Automatiseerbaarheid:** volledig automatisch (datumrekenen).

### R-BEW-00 | Onderbouwingsplicht van de verhuurder
- **Regel (A):** De verhuurder is verplicht de opgevoerde kosten te onderbouwen en wordt altijd
  gevraagd **facturen of andere betaalbewijzen** over te leggen. Uitdrukkelijk: **een grootboekkaart
  of een overzicht van de facturen is niet voldoende** (par. 6.4.2, p. 59).
- **VvE-uitzondering (A):** is de verhuurder lid van een VvE, dan hoeven niet alle facturen te worden
  verstrekt. Nodig zijn dan: de **jaarrekening van de VvE**, én het **verslag van de algemene
  ledenvergadering** waarin de jaarrekening is vastgesteld en decharge is verleend (of een deel
  daarvan, voorzien van datum en handtekening van de bevoegde functionarissen), én de **afrekening
  die de VvE aan de verhuurder** heeft verstrekt, én de **afrekening die de verhuurder aan de
  huurder** heeft verstrekt (p. 59).
- **Specificatieformulier (A):** voor (overige) servicekosten geldt bovendien de plicht het
  **formulier specificatie servicekosten** te gebruiken (bijlage VII Uitvoeringsregeling huurprijzen
  woonruimte; art. 7:260 lid 3 BW). Dat geldt **ook** als de verhuurder geen afrekening aan de
  huurder heeft verstrekt (p. 60).
- **Meterstanden (A):** voor nutsvoorzieningen met een individuele meter moet de verhuurder ook de
  meterstanden en, indien aan de orde, een berekening van het verbruik aanleveren (par. 6.7, p. 63).
- **Automatiseerbaarheid:** automatisch als checklist; de beoordeling of een document "de factuur
  zelf" is, is semi-automatisch.

### R-BEW-01 | Nutsvoorzieningen met individuele meter: geen onderbouwing
- **Regel (A):** Verstrekt de verhuurder de gevraagde informatie niet binnen de gestelde termijn, dan
  bepaalt de Huurcommissie het bedrag op het niveau dat volgt uit het **wettelijk vastgestelde
  verbruik en tarief** (bijlage VIII Uitvoeringsregeling huurprijzen woonruimte). Betwist de huurder
  de levering **gemotiveerd** en heeft de verhuurder de kosten niet met facturen onderbouwd, dan
  stelt de Huurcommissie de kosten op **EUR 0,00** (par. 6.4.2 categorie 1, p. 60).
- **Wettelijk vastgestelde verbruiken (Tabel 11, p. 60):**

  | Categorie | Zelfstandige woonruimte | Onzelfstandige woonruimte |
  | --- | ---: | ---: |
  | Gas | 400 m3 | 250 m3 |
  | Elektriciteit | 800 kWh | 500 kWh |
  | Water | 25 m3 | 25 m3 |

- **Tarief:** het beleidsboek verwijst naar bijlage VIII van de Uitvoeringsregeling en vermeldt in
  voetnoot 16/18 dat wordt uitgegaan van de gemiddelde prijzen voor gas, elektra en water volgens
  het Nibud, die per jaar verschillen. **De concrete bedragen van bijlage VIII staan niet in het
  beleidsboek** - dit is label C en moet vóór productie uit de Uitvoeringsregeling worden gehaald.
- **Automatiseerbaarheid:** automatisch zodra de tariefbron vaststaat.

### R-BEW-02 | (Overige) servicekosten: ontbrekende onderbouwing -> forfait
- **Regel (A):** Vier situaties uit par. 6.4.2 categorie 2 (p. 60-61):
  1. **Geen** specificatieformulier én **geen** facturen, levering **niet** gemotiveerd betwist ->
     bedrag op het niveau van het wettelijk vastgestelde verbruik en tarief.
  2. **Wel** facturen, **geen** specificatieformulier, waardoor het werkelijke verbruik of het
     aandeel van de huurder in de totale kosten niet kan worden bepaald -> zelfde forfait.
  3. **Wel** specificatieformulier, **geen** facturen, levering **wél** gemotiveerd betwist ->
     **EUR 0,00**.
  4. Als in situatie 3, maar de levering wordt **niet** betwist -> forfait. Voor roerende zaken geldt
     de waardebepaling van R-ROE-02, met als sluitstuk het standaardbedrag van **EUR 12,00 per jaar**.
- **Vast bedrag overige posten (A):** vult de verhuurder het specificatieformulier niet in, dan houdt
  de Huurcommissie voor overige kostenposten doorgaans **EUR 12,00 per jaar per kostenpost** aan
  (p. 60).
- **Wettelijke grondslag (A):** art. 18 lid 4 Uhw - geen of onvolledig formulier: vaststelling op een
  bij ministeriële regeling vastgesteld bedrag, of op EUR 0 als de zaak of dienst niet is geleverd
  (p. 68).
- **Opmerking over de brontekst (B):** de nummering in par. 6.4.2 is in het beleidsboek inconsistent -
  een ongenummerde alinea beschrijft situatie 1, waarna de genummerde punten 1, 2 en 3 terugverwijzen
  naar "situatie 1" en "situatie 3". De vier situaties hierboven zijn de meest voor de hand liggende
  lezing; bij implementatie is verificatie tegen de Uitvoeringsregeling aangewezen.
- **Automatiseerbaarheid:** automatisch, mits per post is vastgelegd welk bewijs aanwezig is.

### R-BEW-03 | Gemotiveerd betwiste levering zonder facturen -> EUR 0,00
- **Regel (A):** Zie R-BEW-01 (categorie 1) en R-BEW-02 situatie 3. Dit is de zwaarste sanctie in het
  beleidsboek en vereist een **actieve, gemotiveerde betwisting door de huurder**.
- **Gevolg voor software:** het systeem moet de huurder actief vragen of hij de levering betwist,
  want dit antwoord verandert de uitkomst van forfait naar nul.
- **Automatiseerbaarheid:** automatisch zodra het antwoord er is; het antwoord komt van de huurder.

### R-PRC-09 | Anonimiseren van processtukken
- **Regel (A):** De verhuurder is verplicht de relevante processtukken ontdaan van persoonsgegevens
  van derden aan te leveren (par. 6.6, p. 62).
- **Gevolg voor software:** relevant voor het genereren van bijlagen bij een verzoek.
- **Automatiseerbaarheid:** semi-automatisch (detectie van persoonsgegevens vraagt controle).

### R-PRC-10 | Onderzoek ter plaatse
- **Regel (A):** De Huurcommissie gelast alleen onderzoek ter plaatse als zij reden heeft aan te nemen
  dat dit relevante informatie oplevert. Dat kan **alleen** in vier gevallen (par. 6.8, p. 63-64):
  1. **Verbruik ter discussie** (stookkosten, gas, water, elektriciteit): huurder betwist gemotiveerd,
     het verbruik wijkt in ruime mate af van het normverbruik, de verhuurder geeft geen aannemelijke
     verklaring én de technische installatie is blijkens het inspectierapport niet de oorzaak.
  2. **Roerende zaken**: huurder betwist de kosten gemotiveerd, de verhuurder heeft geen overtuigend
     weerwoord en foto's of andere informatie geven geen betrouwbaar beeld.
  3. **Tuinonderhoud**: huurder stelt gemotiveerd dat de tuin openbaar is, geen overtuigend weerwoord,
     geen betrouwbaar beeld uit foto's.
  4. **Verdeelsleutel**: huurder betwist de sleutel gemotiveerd, geen overtuigend weerwoord, geen
     betrouwbaar beeld uit foto's.
  Voor overige situaties ziet de Huurcommissie op voorhand geen aanleiding; bijzondere feiten en
  omstandigheden kunnen daarvan afwijken.
- **Gevolg voor software:** dit is precies de lijst van geschilpunten waar een dossier **nooit**
  volledig automatisch kan worden afgehandeld. Het systeem kan wel signaleren dat een van deze vier
  situaties zich voordoet, en de huurder erop wijzen welk bewijsmateriaal (foto's) kansrijk is.
- **Automatiseerbaarheid:** signalering automatisch, beoordeling handmatig.

---

## Bijlagen - wettelijk kader

### Bijlage 1 - artikelen 7:259, 7:260 en 7:261 BW (p. 65-67)
- **Art. 7:259 lid 1 (A):** de betalingsverplichting beloopt het overeengekomen bedrag. Bij gebreke
  van overeenstemming: voor nutsvoorzieningen met individuele meter het bedrag volgens de wettelijke
  voorschriften of wat als **redelijke vergoeding** kan worden beschouwd; voor servicekosten het
  bedrag dat **bij ministeriële regeling** is vastgesteld.
- **Art. 7:259 lid 2 (A):** de verhuurder verstrekt jaarlijks, uiterlijk zes maanden na afloop van
  het kalenderjaar, een **naar soort uitgesplitst overzicht** van de in rekening gebrachte kosten,
  **met vermelding van de wijze van berekening**.
- **Art. 7:259 lid 3 (A):** bij beëindiging van de huur ziet het overzicht op het reeds verstreken
  deel van het kalenderjaar.
- **Art. 7:259 lid 4 (A):** de verhuurder biedt de huurder desverzocht **inzage in de onderliggende
  boeken en bescheiden** of afschriften daarvan. *Dit is voor de software het belangrijkste
  instrument om ORANJE naar GROEN of ROOD te brengen.*
- **Art. 7:260 lid 2 (A):** het verzoek betreft niet meer dan één tijdvak van ten hoogste twaalf
  maanden per kostensoort, en kan worden gedaan tot uiterlijk 24 maanden na het verstrijken van de
  termijn van art. 259 lid 2.
- **Art. 7:261 lid 2 (A):** de huurder is gebonden aan een wijziging van zaken of diensten (en het
  bijbehorende voorschotbedrag) die slechts aan een aantal huurders gezamenlijk geleverd kunnen
  worden, als **ten minste 70%** van die huurders heeft ingestemd. Een huurder die niet instemde kan
  binnen **acht weken** na de schriftelijke kennisgeving een beslissing van de rechter vorderen over
  de redelijkheid van het voorstel.
- **Art. 7:261 lid 3 (A):** is het voorschotbedrag **aanzienlijk hoger** dan de te verwachten kosten,
  dan kan de Huurcommissie het op verzoek van de huurder verlagen.

### Bijlage 2 - artikelen 18 en 19 Uhw (p. 68-69)
- **Art. 18 lid 2 (A):** de Huurcommissie toetst nutsvoorzieningen met individuele meter aan de
  wettelijke voorschriften **en aan de redelijkheid**.
- **Art. 18 lid 3 en 4 (A):** is het formulier gebruikt, dan toetst zij aan voorschriften en
  redelijkheid; is het niet of onvolledig gebruikt, dan stelt zij de servicekosten vast op een bij
  ministeriële regeling vastgesteld bedrag, **of op EUR 0 als de zaak of dienst niet is geleverd**.
- **Art. 19 lid 3 (A):** de te verwachten kosten worden gesteld op het bedrag uit het laatst in de
  **drie voorafgaande kalenderjaren** verstrekte verrekenoverzicht, verhoogd met het percentage
  waarmee de **consumentenprijsindex voor werknemersgezinnen** sindsdien is gestegen. Is er geen
  verrekenoverzicht in die periode, dan worden de kosten gesteld op de **als gebruikelijk aan te
  merken kosten**.
- **Art. 19 lid 4 (A):** het uitgesproken voorschotbedrag treedt in de plaats van het overeengekomen
  bedrag met ingang van de eerste dag van de maand volgend op die waarin het verzoek is ontvangen.

### Bijlage 3 - Besluit servicekosten (p. 70-75)
De elf posten van de bijlage bij artikel 1 zijn integraal verwerkt in de taxonomie
(`02-taxonomie.md`) en in R-SK-01 t/m R-ADM-01 hierboven.
- **Nota van toelichting (A), p. 75:** de opsomming is **niet limitatief**. Ook vergoedingen voor
  andere zaken en diensten die in verband met de bewoning worden geleverd, kunnen servicekosten zijn.
  Bovendien: het enkele feit dat een zaak of dienst in het besluit staat, betekent niet dat die ook
  daadwerkelijk in rekening kan worden gebracht - **daarvoor is nodig dat huurder en verhuurder de
  levering zijn overeengekomen**.

### Bijlage 4 - Besluit kleine herstellingen (p. 76-84)
De bijlage bij artikel 1 somt de kleine herstellingen a t/m v op. De Huurcommissie heeft
uitvoeringsbeleid geformuleerd voor de onderdelen die in R-KH-01 t/m R-KH-10 zijn uitgewerkt
(q, p, l, n, m, g, r, i, a en b). De overige onderdelen (c, d, e, f, h, j, k, o, s, t, u, v) staan
wel in het Besluit maar kennen **geen aanvullend uitvoeringsbeleid** in dit beleidsboek; daarvoor
geldt alleen de hoofdregel R-KH-00.
- **Nota van toelichting (A), p. 82-83:** de opsomming is **niet limitatief**. De
  bereikbaarheidsmaatstaf betekent dat werkzaamheden géén kleine herstelling zijn als de voorziening
  door **fysieke onbereikbaarheid of een contractuele verbodsbepaling** voor de huurder onbereikbaar
  is; die vraag wordt **naar objectieve maatstaven** beantwoord. Kan de huurder de werkzaamheid naar
  objectieve maatstaven wel uitvoeren maar in het concrete geval niet, en laat hij het door de
  verhuurder doen, dan mag die de kosten als servicekosten in rekening brengen.
