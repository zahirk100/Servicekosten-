"""Beslisregels uit het Beleidsboek Servicekosten (versie 1 juli 2026).

Elke functie implementeert een of meer RULE-ID's uit docs/07-beslisregels.md.
Waar het beleidsboek geen norm geeft, geeft de regel GEEN bedrag terug maar
vult zij `ontbrekende_informatie`. Het model verzint nooit een bedrag.
"""

from __future__ import annotations

from decimal import Decimal

from .model import Automatisering, Beoordeling, Dossier, Kostenpost, Status, eur
from .normen import (
    NormOntbreekt,
    d,
    elektriciteit_tarief,
    elektriciteit_verbruiksnorm_zelfstandig,
    gas_tarief,
    gas_verbruiksnorm_zelfstandig,
    graaddagen,
    huismeester_uurtarief,
    normen,
    seizoenspatroon,
    water_tarief,
    water_verbruiksnorm,
)

# Het beleidsboek spreekt van een verbruik dat "in belangrijke mate" afwijkt
# (p. 12) zonder dat te kwantificeren. Deze drempel is dus GEEN beleidsboekregel
# maar een instelbare aanname van dit model; zie docs/00-leeswijzer-en-methodiek.md.
DREMPEL_BELANGRIJKE_AFWIJKING = Decimal("0.10")

HANDLERS: dict[str, callable] = {}


def breuk(waarde) -> Decimal:
    """Leest '1/3' of 0.15 als exacte Decimal.

    Het beleidsboek schrijft breuken (2/3e deel, 1/3e deel); die mogen niet
    eerst op vier decimalen worden afgerond, anders wijkt de uitkomst af.
    """
    tekst = str(waarde)
    if "/" in tekst:
        teller, noemer = tekst.split("/", 1)
        return d(teller) / d(noemer)
    return d(tekst)


def regel(*categorieen):
    def wrap(fn):
        for c in categorieen:
            HANDLERS[c] = fn
        return fn

    return wrap


# ---------------------------------------------------------------- hulpfuncties

def maandfactor(dossier: Dossier) -> Decimal:
    """Evenredig deel van het jaar (vastrecht, water, teruggave)."""
    return d(dossier.periode.aantal_maanden) / d(12)


def graaddagenfactor(dossier: Dossier) -> Decimal:
    """Graaddagenmethode voor gas (par. 3.1.3, p. 16; par. 4.2.2, p. 28)."""
    tabel = graaddagen(dossier.periode.jaar)
    deel = sum(d(tabel[str(m)]) for m in dossier.periode.maanden)
    return deel / d(tabel["totaal"])


def seizoensfactor(dossier: Dossier) -> Decimal:
    """Seizoenspatronen voor elektriciteit (par. 3.2.3, Tabel 6, p. 20)."""
    tabel = seizoenspatroon()
    return sum(d(tabel[str(m)]) for m in dossier.periode.maanden)


def gestaffeld_tarief(hoeveelheid: Decimal, tarief: dict, sleutel: str, plafondsleutel: str) -> Decimal:
    """Prijsplafond 2023: eerste schijf laag tarief, rest hoog tarief (p. 14, p. 18)."""
    laag = d(tarief[sleutel])
    hoog = tarief.get(f"{sleutel}_boven_plafond")
    plafond = tarief.get(plafondsleutel)
    if hoog is None or plafond is None or hoeveelheid <= d(plafond):
        return hoeveelheid * laag
    return d(plafond) * laag + (hoeveelheid - d(plafond)) * d(hoog)


def _basis(post: Kostenpost) -> Beoordeling:
    return Beoordeling(
        kostenpost_id=post.id,
        categorie=post.categorie,
        omschrijving=post.omschrijving,
        status=Status.ORANJE,
        bedrag_verhuurder=post.bedrag_verhuurder,
    )


def _rond_status(b: Beoordeling) -> Beoordeling:
    """GROEN/ROOD/ORANJE afleiden uit bedrag_model en ontbrekende informatie."""
    if b.status is Status.BUITEN_BEVOEGDHEID:
        return b
    if b.ontbrekende_informatie or b.bedrag_model is None:
        b.status = Status.ORANJE
        b.voorlopig = b.bedrag_model is not None
        return b
    verschil = b.verschil
    # Een afwijking van minder dan een cent is afrondingsruis, geen correctie.
    if verschil is not None and verschil > Decimal("0.00"):
        b.status = Status.ROOD
    else:
        b.status = Status.GROEN
    return b


def _controleer_grondslag(post: Kostenpost, b: Beoordeling) -> bool:
    """Is er een juridische basis? (p. 9: overeenstemming vereist.)

    Retourneert False als de beoordeling hiermee al is afgerond.
    """
    if post.overeengekomen is False:
        b.regels.append("R-ALG-01")
        b.bedrag_model = eur(0)
        b.status = Status.ROOD
        b.toelichting.append(
            "Niet overeengekomen dat deze kosten voor rekening van de huurder komen; "
            "zonder overeenstemming is er geen juridische basis voor een "
            "betalingsverplichting (Beleidsboek p. 9; Nota van toelichting Besluit "
            "servicekosten, p. 75)."
        )
        b.menselijke_controle_nodig = True
        b.automatisering = Automatisering.SEMI_AUTOMATISCH
        return False
    if post.overeengekomen is None:
        b.regels.append("R-ALG-01")
        b.ontbrekende_informatie.append(
            "Huurovereenkomst/algemene voorwaarden: is deze post (al dan niet "
            "stilzwijgend) overeengekomen? (Beleidsboek p. 9)"
        )
    return True


# ------------------------------------------------ nutsvoorzieningen met meter

def _nibud_gas(dossier: Dossier, b: Beoordeling) -> Decimal:
    w, p = dossier.woonruimte, dossier.periode
    tarief = gas_tarief(p.jaar)
    if w.zelfstandig:
        if not w.woningtype:
            raise NormOntbreekt("Woningtype ontbreekt; zonder woningtype geeft Tabel 1 (p. 13) geen norm.")
        jaarverbruik = gas_verbruiksnorm_zelfstandig(w.woningtype, p.jaar)
        bron = f"Tabel 1 (p. 13), {w.woningtype}"
    else:
        if w.oppervlakte_m2 is None:
            raise NormOntbreekt("Oppervlakte ontbreekt; de norm voor onzelfstandige woonruimte is 25 m3 per m2 (p. 14).")
        jaarverbruik = w.oppervlakte_m2 * d(normen()["gas"]["verbruiksnorm_onzelfstandig_m3_per_m2"]["waarde"])
        bron = f"{w.oppervlakte_m2} m2 x 25 m3 (p. 14)"

    if p.volledig_jaar:
        verbruik = jaarverbruik
        b.berekening.append(f"Normverbruik gas: {verbruik} m3 ({bron}).")
    else:
        factor = graaddagenfactor(dossier)
        b.regels.append("R-PER-01")
        verbruik = (jaarverbruik * factor).quantize(Decimal("1"))
        b.berekening.append(
            f"Normverbruik gas {jaarverbruik} m3 ({bron}); graaddagenmethode "
            f"{p.maand_van}-{p.maand_tot_en_met}/{p.jaar}: factor {factor:.6f} -> {verbruik} m3 "
            "(par. 3.1.3, p. 16)."
        )
    verbruikskosten = gestaffeld_tarief(verbruik, tarief, "tarief_per_m3", "plafond_m3")
    vastrecht = d(tarief["vastrecht_per_jaar"]) / d(dossier.woonruimte.aantal_woonruimten_op_aansluiting)
    vastrecht_deel = vastrecht * maandfactor(dossier)
    b.berekening.append(
        f"Verbruikskosten {verbruik} m3 x EUR {tarief['tarief_per_m3']} = EUR {eur(verbruikskosten)} (Tabel 2, p. 14)."
    )
    b.berekening.append(
        f"Vastrecht EUR {tarief['vastrecht_per_jaar']} / {dossier.woonruimte.aantal_woonruimten_op_aansluiting} "
        f"woonruimte(n) x {p.aantal_maanden}/12 = EUR {eur(vastrecht_deel)}."
    )
    return eur(verbruikskosten + vastrecht_deel)


def _nibud_elektriciteit(dossier: Dossier, b: Beoordeling) -> Decimal:
    w, p = dossier.woonruimte, dossier.periode
    tarief = elektriciteit_tarief(p.jaar)
    if w.zelfstandig:
        if not w.aantal_bewoners:
            raise NormOntbreekt("Aantal bewoners ontbreekt; Tabel 4 (p. 18) is daarvan afhankelijk.")
        jaarverbruik = elektriciteit_verbruiksnorm_zelfstandig(w.aantal_bewoners, p.jaar)
        bron = f"Tabel 4 (p. 18), {w.aantal_bewoners} bewoner(s)"
    else:
        jaarverbruik = d(normen()["elektriciteit"]["verbruiksnorm_onzelfstandig_kwh"]["waarde"])
        bron = "onzelfstandige woonruimte, 1.000 kWh (p. 18)"

    if p.volledig_jaar:
        verbruik = jaarverbruik
        b.berekening.append(f"Normverbruik elektriciteit: {verbruik} kWh ({bron}).")
    else:
        factor = seizoensfactor(dossier)
        b.regels.append("R-PER-02")
        verbruik = jaarverbruik * factor
        b.berekening.append(
            f"Normverbruik {jaarverbruik} kWh ({bron}); seizoenspatroon "
            f"{p.maand_van}-{p.maand_tot_en_met} = {factor * 100:.0f}% -> {verbruik} kWh (Tabel 6, p. 20)."
        )
    verbruikskosten = gestaffeld_tarief(verbruik, tarief, "tarief_per_kwh", "plafond_kwh")
    n = d(w.aantal_woonruimten_op_aansluiting)
    vastrecht = (d(tarief["vastrecht_per_jaar"]) / n)
    teruggave = (d(tarief["belastingteruggave_per_jaar"]) / n)
    # Het beleidsboek rondt in zijn voorbeeld (p. 19) het aandeel per woonruimte
    # eerst af op centen en neemt daarvan het maanddeel.
    vastrecht_deel = eur(vastrecht) * maandfactor(dossier)
    teruggave_deel = eur(teruggave) * maandfactor(dossier)
    b.berekening.append(
        f"Verbruikskosten {verbruik} kWh x EUR {tarief['tarief_per_kwh']} = EUR {eur(verbruikskosten)} (Tabel 5, p. 18)."
    )
    b.berekening.append(
        f"Vastrecht EUR {eur(vastrecht)} x {p.aantal_maanden}/12 = EUR {eur(vastrecht_deel)}; "
        f"belastingteruggave EUR {eur(teruggave)} x {p.aantal_maanden}/12 = EUR {eur(teruggave_deel)}."
    )
    return eur(verbruikskosten + eur(vastrecht_deel) - eur(teruggave_deel))


def _nibud_water(dossier: Dossier, b: Beoordeling) -> Decimal:
    w, p = dossier.woonruimte, dossier.periode
    tarief = water_tarief(p.jaar)
    bewoners = w.aantal_bewoners or 1
    jaarverbruik = water_verbruiksnorm(bewoners, p.jaar)
    verbruik = jaarverbruik * maandfactor(dossier)
    if not p.volledig_jaar:
        b.regels.append("R-PER-03")
    b.berekening.append(
        f"Normverbruik water {jaarverbruik} m3 (Tabel 7, p. 21, {bewoners} bewoner(s))"
        + ("" if p.volledig_jaar else f" x {p.aantal_maanden}/12 = {verbruik} m3 (evenredig, par. 3.3.3, p. 23)")
        + "."
    )
    verbruikskosten = verbruik * d(tarief["tarief_per_m3"])
    vastrecht = d(tarief["vastrecht_per_jaar"]) / d(w.aantal_woonruimten_op_aansluiting)
    vastrecht_deel = eur(vastrecht) * maandfactor(dossier)
    b.berekening.append(
        f"Verbruikskosten {verbruik} m3 x EUR {tarief['tarief_per_m3']} = EUR {eur(verbruikskosten)}; "
        f"vastrecht EUR {eur(vastrecht)} x {p.aantal_maanden}/12 = EUR {eur(vastrecht_deel)} (Tabel 8, p. 22)."
    )
    return eur(verbruikskosten + eur(vastrecht_deel))


NIBUD = {
    "NUT-GAS-METER": _nibud_gas,
    "NUT-ELK-METER": _nibud_elektriciteit,
    "NUT-WATER-METER": _nibud_water,
}

FORFAIT_SOORT = {"NUT-GAS-METER": "gas_m3", "NUT-ELK-METER": "elektriciteit_kwh", "NUT-WATER-METER": "water_m3"}


def _forfait_nuts(dossier: Dossier, categorie: str, b: Beoordeling) -> Decimal | None:
    """Wettelijk vastgesteld verbruik (Tabel 11, p. 60) x Nibud-tarief."""
    cfg = normen()["forfaits_bij_ontbrekende_onderbouwing"]
    soort = FORFAIT_SOORT[categorie]
    sleutel = "zelfstandig" if dossier.woonruimte.zelfstandig else "onzelfstandig"
    hoeveelheid = d(cfg["wettelijk_vastgesteld_verbruik"][soort][sleutel])
    jaar = dossier.periode.jaar
    if categorie == "NUT-GAS-METER":
        t = gas_tarief(jaar)
        bedrag = gestaffeld_tarief(hoeveelheid, t, "tarief_per_m3", "plafond_m3")
        eenheid = "m3"
    elif categorie == "NUT-ELK-METER":
        t = elektriciteit_tarief(jaar)
        bedrag = gestaffeld_tarief(hoeveelheid, t, "tarief_per_kwh", "plafond_kwh")
        eenheid = "kWh"
    else:
        t = water_tarief(jaar)
        bedrag = hoeveelheid * d(t["tarief_per_m3"])
        eenheid = "m3"
    bedrag = bedrag * maandfactor(dossier)
    b.berekening.append(
        f"Forfait par. 6.4.2 (Tabel 11, p. 60): {hoeveelheid} {eenheid} x Nibud-tarief "
        f"x {dossier.periode.aantal_maanden}/12 = EUR {eur(bedrag)}."
    )
    b.toelichting.append(
        "Let op: het beleidsboek verwijst voor het forfait naar bijlage VIII van de "
        "Uitvoeringsregeling huurprijzen woonruimte. Die bedragen staan NIET in het "
        "beleidsboek; hier is gerekend met het wettelijk vastgestelde verbruik uit "
        "Tabel 11 en het Nibud-tarief (voetnoot 16/18, p. 60-61). Verificatie tegen "
        "bijlage VIII is vereist."
    )
    return eur(bedrag)


@regel("NUT-GAS-METER", "NUT-ELK-METER", "NUT-WATER-METER")
def nutsvoorziening_met_meter(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    b.automatisering = Automatisering.SEMI_AUTOMATISCH
    if not _controleer_grondslag(post, b):
        return b

    par = post.parameters
    try:
        normbedrag = NIBUD[post.categorie](dossier, b)
    except NormOntbreekt as exc:
        normbedrag = None
        b.ontbrekende_informatie.append(str(exc))

    # 1. Geen facturen/betaalbewijzen (par. 6.4.2 categorie 1, p. 60).
    if "facturen" not in post.bewijs:
        if post.levering_gemotiveerd_betwist:
            b.regels.append("R-BEW-03")
            b.bedrag_model = eur(0)
            b.toelichting.append(
                "Levering gemotiveerd betwist en geen facturen of andere betaalbewijzen: "
                "de kosten worden op EUR 0,00 gesteld (par. 6.4.2 onder 1, p. 60)."
            )
            return _rond_status(b)
        b.regels.append("R-BEW-01")
        forfait = _forfait_nuts(dossier, post.categorie, b)
        b.bedrag_model = forfait
        b.toelichting.append(
            "De verhuurder heeft de kosten niet met facturen onderbouwd; het bedrag wordt "
            "bepaald op het niveau van het wettelijk vastgestelde verbruik en tarief "
            "(par. 6.4.2 onder 1, p. 60)."
        )
        b.menselijke_controle_nodig = True
        return _rond_status(b)

    # 2. Meterstanden ontbreken (par. 3.1.1/3.2.1/3.3.1).
    standen_bekend = par.get("beginstand") is not None and par.get("eindstand") is not None
    if not standen_bekend and not par.get("meterstanden_aanwezig", False):
        b.regels.append("R-NUT-02")
        if normbedrag is None:
            b.toelichting.append("Meterstanden ontbreken, maar de Nibud-norm kon niet worden bepaald.")
            return _rond_status(b)
        opgevoerd = par.get("verbruik_verhuurder")
        b.toelichting.append(
            "Begin- of eindstand ontbreekt; het opgevoerde verbruik wordt getoetst aan de "
            "landelijke verbruiksnormen en tarieven van het Nibud (p. 12-13)."
        )
        if opgevoerd is None:
            b.bedrag_model = normbedrag
            b.menselijke_controle_nodig = True
            return _rond_status(b)
        b.bedrag_model = normbedrag
        b.toelichting.append(
            f"Opgevoerd verbruik {opgevoerd} tegenover normverbruik; bij een afwijking in "
            "belangrijke mate zonder goede verklaring stelt de Huurcommissie het verbruik "
            "vast conform de Nibud-norm (p. 12). De maatstaf 'in belangrijke mate' is in het "
            "beleidsboek niet gekwantificeerd: menselijke toets vereist."
        )
        b.menselijke_controle_nodig = True
        return _rond_status(b)

    # 3. Meterstanden bekend maar gemotiveerd betwist (par. 3.1.2/3.2.2/3.3.2).
    if par.get("meterstanden_betwist"):
        b.regels.append("R-NUT-03")
        rendement = par.get("rendement_ketel")
        inspectierapport = par.get("inspectierapport_aanwezig")
        if normbedrag is None:
            return _rond_status(b)
        if post.categorie == "NUT-GAS-METER" and par.get("huurder_stelt_installatie_gebrekkig"):
            b.regels.append("R-NUT-04")
            ondergrens = d(normen()["gas"]["rendement_ondergrens_stookinstallatie"]["waarde"])
            if inspectierapport is not True:
                b.bedrag_model = normbedrag
                b.toelichting.append(
                    "De verhuurder heeft geen inspectierapport verstrekt; de Huurcommissie gaat "
                    "dan in het algemeen uit van de Nibud-verbruiksnorm (par. 3.1.2, p. 15)."
                )
            elif rendement is not None and d(rendement) < ondergrens:
                b.bedrag_model = normbedrag
                b.toelichting.append(
                    f"Het ketelrendement ({rendement}) ligt onder de door de Huurcommissie "
                    f"gehanteerde ondergrens van {ondergrens} (par. 3.1.2, p. 15); uitgangspunt "
                    "is de Nibud-verbruiksnorm."
                )
            else:
                b.bedrag_model = normbedrag
                b.toelichting.append(
                    "Meterstanden gemotiveerd betwist: de Huurcommissie bepaalt de "
                    "betalingsverplichting aan de hand van de Nibud-normen en -tarieven, tenzij "
                    "een verklaring voor het hoge verbruik plausibel is (par. 3.1.2, p. 15)."
                )
        else:
            b.bedrag_model = normbedrag
            b.toelichting.append(
                "Meterstanden gemotiveerd betwist: toetsing aan de landelijke verbruiksnormen "
                "en tarieven van het Nibud (par. 3.1.2/3.2.2/3.3.2, p. 15, 19, 23)."
            )
        b.ontbrekende_informatie.append(
            "Menselijke weging: is de betwisting 'gemotiveerd en overtuigend' en is er een "
            "plausibele verklaring voor het verbruik? (p. 15)"
        )
        b.menselijke_controle_nodig = True
        return _rond_status(b)

    # 4. Meterstanden bekend en niet betwist: werkelijke kosten zijn uitgangspunt.
    b.regels.append("R-NUT-01")
    b.bedrag_model = post.bedrag_verhuurder
    b.automatisering = Automatisering.AUTOMATISCH
    b.menselijke_controle_nodig = False
    b.toelichting.append(
        "Meterstanden bekend en niet betwist; de werkelijk gemaakte kosten volgens factuur "
        "zijn uitgangspunt (p. 11)."
    )
    if normbedrag is not None:
        b.berekening.append(f"Referentie Nibud-norm voor dit jaar: EUR {normbedrag} (ter vergelijking).")
    if par.get("collectieve_factuur"):
        b.regels.append("R-NUT-05")
        b.ontbrekende_informatie.append(
            "Collectieve factuur voor meerdere woonruimten: de toegepaste verdeelsleutel moet "
            "worden getoetst (voetnoot 3, p. 11; par. 4.2.1, p. 26)."
        )
        b.menselijke_controle_nodig = True
        b.automatisering = Automatisering.SEMI_AUTOMATISCH
    return _rond_status(b)


# --------------------------------------------- nutsvoorzieningen zonder meter

@regel("NUT-GAS-ZM", "NUT-ELK-ZM", "NUT-WATER-ZM")
def nutsvoorziening_zonder_meter(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    if not _controleer_grondslag(post, b):
        return b
    par = post.parameters
    w, p = dossier.woonruimte, dossier.periode
    totaal = par.get("totale_kosten_complex")

    if "facturen" not in post.bewijs or "specificatieformulier" not in post.bewijs:
        if post.levering_gemotiveerd_betwist and "facturen" not in post.bewijs:
            b.regels.append("R-BEW-03")
            b.bedrag_model = eur(0)
            b.toelichting.append(
                "Geen facturen en levering gemotiveerd betwist: kosten op EUR 0,00 "
                "(par. 6.4.2 categorie 2, p. 61)."
            )
            return _rond_status(b)
        b.regels.append("R-BEW-02")
        categorie_meter = {"NUT-GAS-ZM": "NUT-GAS-METER", "NUT-ELK-ZM": "NUT-ELK-METER", "NUT-WATER-ZM": "NUT-WATER-METER"}[post.categorie]
        b.bedrag_model = _forfait_nuts(dossier, categorie_meter, b)
        b.toelichting.append(
            "Specificatieformulier en/of facturen ontbreken, of het aandeel van de huurder is "
            "niet bepaalbaar: het bedrag wordt bepaald op het niveau van het wettelijk "
            "vastgestelde verbruik en tarief (par. 6.4.2 categorie 2, p. 61)."
        )
        return _rond_status(b)

    if totaal is None:
        b.ontbrekende_informatie.append("Totale kosten van het complex ontbreken; verdeelsleutel niet toepasbaar.")
        return _rond_status(b)

    totaal = d(totaal)
    aantal = w.aantal_woonruimten_complex
    if not aantal:
        b.ontbrekende_informatie.append("Aantal woonruimten in het complex ontbreekt (par. 4.2.1, p. 26).")
        return _rond_status(b)

    if post.categorie == "NUT-GAS-ZM":
        b.regels.append("R-VDS-01")
        cfg = normen()["gas"]["verdeelsleutel_zonder_eigen_meter"]
        if w.oppervlakte_m2 is None or not w.totale_oppervlakte_complex_m2:
            b.ontbrekende_informatie.append(
                "Vloeroppervlakte van de woonruimte en/of van het complex ontbreekt; de "
                "variabele gaskosten (65%) worden naar vloeroppervlakte verdeeld (p. 26)."
            )
            return _rond_status(b)
        vast = totaal * d(cfg["aandeel_vaste_kosten"]) / d(aantal)
        variabel = totaal * d(cfg["aandeel_variabele_kosten"]) * w.oppervlakte_m2 / w.totale_oppervlakte_complex_m2
        aandeel = eur(vast) + eur(variabel)
        b.berekening.append(
            f"Vaste kosten 35% van EUR {eur(totaal)} = EUR {eur(totaal * d('0.35'))}, gelijk over "
            f"{aantal} woonruimten = EUR {eur(vast)} (par. 4.2.1, p. 26)."
        )
        b.berekening.append(
            f"Variabele kosten 65% van EUR {eur(totaal)} = EUR {eur(totaal * d('0.65'))}, naar "
            f"oppervlakte {w.oppervlakte_m2}/{w.totale_oppervlakte_complex_m2} = EUR {eur(variabel)}."
        )
        periodefactor = d(1) if p.volledig_jaar else graaddagenfactor(dossier)
        if periodefactor != d(1):
            b.regels.append("R-PER-01")
        methode = "graaddagenmethode (par. 4.2.2, p. 28)"
    else:
        b.regels.append("R-VDS-02")
        aandeel = eur(totaal / d(aantal))
        b.berekening.append(
            f"Gelijke verdeling over {aantal} woonruimten: EUR {eur(totaal)} / {aantal} = "
            f"EUR {aandeel} (par. 4.2.1, p. 27)."
        )
        if post.categorie == "NUT-ELK-ZM":
            periodefactor = d(1) if p.volledig_jaar else seizoensfactor(dossier)
            if periodefactor != d(1):
                b.regels.append("R-PER-02")
            methode = "seizoenspatronen (par. 4.2.2, p. 28)"
        else:
            periodefactor = maandfactor(dossier)
            if periodefactor != d(1):
                b.regels.append("R-PER-03")
            methode = "evenredig deel van het jaar (par. 4.2.2, p. 28)"

    if periodefactor != d(1):
        b.berekening.append(f"Periodefactor {periodefactor:.6f} volgens {methode}.")
    b.bedrag_model = eur(aandeel * periodefactor)
    b.automatisering = Automatisering.AUTOMATISCH
    b.menselijke_controle_nodig = False
    return _rond_status(b)


# ------------------------------------------------------------- roerende zaken

@regel("SK-03")
def roerende_zaken(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    if not _controleer_grondslag(post, b):
        return b
    par = post.parameters
    cfg = normen()["roerende_zaken"]
    soort = par.get("soort", "standaard")

    if par.get("roerend") is False:
        b.regels.append("R-ROE-01")
        b.bedrag_model = eur(0)
        b.toelichting.append(
            "Onroerende zaak: hiervoor kan geen gebruiksvergoeding in de servicekosten worden "
            "opgenomen; de kosten worden geacht deel uit te maken van de kale huurprijs "
            "(par. 4.3.3, p. 31)."
        )
        return _rond_status(b)
    if par.get("roerend") is None:
        b.regels.append("R-ROE-01")
        b.ontbrekende_informatie.append(
            "Roerend of onroerend? Kan de zaak worden weggenomen zonder beschadiging van "
            "betekenis? (par. 4.3.3, p. 31). Vereist menselijke/feitelijke beoordeling."
        )
        b.menselijke_controle_nodig = True

    if soort == "rookmelder":
        b.regels.append("R-ROE-07")
        b.bedrag_model = eur(0)
        b.ontbrekende_informatie.clear()
        b.toelichting.append(
            "Rookmelders zijn sinds 1 juli 2022 verplicht op grond van het Bouwbesluit; de "
            "kosten komen voor rekening van de verhuurder en er mag geen gebruiksvergoeding "
            "worden gevraagd (par. 4.3.3, p. 33)."
        )
        return _rond_status(b)

    # Waardebepaling (par. 4.3.3, p. 31).
    waarde = par.get("aanschafwaarde")
    waardebron = "aankoopfactuur"
    if waarde is None:
        waarde = par.get("geschatte_waarde")
        waardebron = "schatting op basis van inzicht in de samenstelling"
    if waarde is None:
        b.regels.append("R-ROE-02")
        standaard = d(cfg["wettelijk_standaardbedrag_per_jaar_zonder_gegevens"])
        b.bedrag_model = eur(standaard * maandfactor(dossier))
        b.toelichting.append(
            "Geen aankoopfacturen en geen inzicht in de samenstelling van de roerende zaken: "
            f"het wettelijk vastgestelde standaardbedrag van EUR {standaard} per jaar wordt "
            "aangehouden (par. 4.3.3, p. 31; par. 6.4.2, p. 61)."
        )
        return _rond_status(b)
    waarde = d(waarde)

    # Levensduur en afschrijvingspercentage.
    if soort == "zonnepanelen":
        z = cfg["zonnepanelen"]
        levensduur, percentage = int(z["levensduur_jaren"]), d(z["afschrijvingspercentage"])
        waarde = waarde + d(z["opslag_op_aanschafwaarde_eur"])
        b.regels.append("R-ROE-05")
        b.berekening.append(
            f"Grondslag zonnepanelen: aanschafwaarde + opslag EUR {z['opslag_op_aanschafwaarde_eur']} "
            f"= EUR {eur(waarde)} (par. 4.3.3, p. 32)."
        )
    elif soort == "brandbeveiliging":
        z = cfg["brandbeveiligingsmiddelen"]
        levensduur, percentage = 10, d(z["afschrijvingspercentage"])
        waarde = waarde * d(z["aandeel_waarde_huurder"])
        b.regels.append("R-ROE-06")
        b.berekening.append(
            f"Brandbeveiligingsmiddelen: 50% van de waarde telt mee = EUR {eur(waarde)} "
            "(par. 4.3.3, p. 33)."
        )
    elif soort == "camera":
        z = cfg["beveiligingscameras"]
        levensduur, percentage = 5, d(z["afschrijvingspercentage"])
        waarde = waarde * d(z["aandeel_waarde_huurder"])
        b.regels.append("R-ROE-06")
        b.berekening.append(
            f"Beveiligingscamera's: 70% van de waarde telt mee = EUR {eur(waarde)} "
            "(par. 4.3.3, p. 34)."
        )
    elif soort == "wasapparatuur":
        z = cfg["industriele_wasmachines_en_wasdrogers"]
        levensduur, percentage = int(z["levensduur_jaren"]), d(z["afschrijvingspercentage_eerste_periode"])
        b.regels.append("R-ROE-04")
    else:
        levensduur = int(par.get("levensduur_jaren") or cfg["standaard_levensduur_jaren"])
        sleutel = str(levensduur)
        if sleutel not in cfg["afschrijving_per_levensduur"]:
            b.ontbrekende_informatie.append(
                f"Het beleidsboek noemt afschrijvingspercentages bij een levensduur van 5, 10 "
                f"of 15 jaar (p. 31); voor {levensduur} jaar is geen percentage gegeven."
            )
            return _rond_status(b)
        percentage = d(cfg["afschrijving_per_levensduur"][sleutel])
        b.regels.append("R-ROE-03")

    jaar_in_gebruik = par.get("jaar_in_gebruik")
    if jaar_in_gebruik is None:
        b.ontbrekende_informatie.append(
            "Aanschafjaar/gebruiksjaar van de zaak ontbreekt; zonder dat is niet vast te "
            "stellen of de eerste of de tweede afschrijvingsperiode geldt (p. 32)."
        )
        return _rond_status(b)
    jaar_in_gebruik = int(jaar_in_gebruik)

    if jaar_in_gebruik > 2 * levensduur:
        if par.get("vertegenwoordigt_nog_waarde") is True:
            b.ontbrekende_informatie.append(
                "De zaak is na twee afschrijvingsperioden nog van waarde; een nieuwe "
                "waardebepaling is nodig (p. 32). Handmatige beoordeling."
            )
            b.menselijke_controle_nodig = True
            return _rond_status(b)
        b.bedrag_model = eur(0)
        b.toelichting.append(
            "Na twee afschrijvingsperioden vertegenwoordigt de zaak geen waarde meer; de "
            "betalingsverplichting kan op EUR 0,00 worden gesteld (par. 4.3.3, p. 32)."
        )
        return _rond_status(b)

    if jaar_in_gebruik > levensduur:
        herwaardering = d(cfg["herwaardering_na_afschrijvingsperiode"])
        if soort == "wasapparatuur":
            z = cfg["industriele_wasmachines_en_wasdrogers"]
            jaarbedrag = waarde * d(z["afschrijvingspercentage_tweede_periode_over_oorspronkelijke_waarde"])
            b.berekening.append(
                f"Tweede periode van tien jaar: 6% van de oorspronkelijke waarde EUR {eur(waarde)} "
                f"= EUR {eur(jaarbedrag)} (par. 4.3.3, p. 34)."
            )
        else:
            nieuwe_waarde = waarde * herwaardering
            jaarbedrag = nieuwe_waarde * percentage
            b.berekening.append(
                f"Herwaardering 60% van EUR {eur(waarde)} = EUR {eur(nieuwe_waarde)}; "
                f"{percentage * 100:.2f}% per jaar = EUR {eur(jaarbedrag)} (par. 4.3.3, p. 32)."
            )
    else:
        jaarbedrag = waarde * percentage
        b.berekening.append(
            f"Gebruiksvergoeding {percentage * 100:.2f}% van EUR {eur(waarde)} = EUR {eur(jaarbedrag)} "
            f"(levensduur {levensduur} jaar, par. 4.3.3, p. 31)."
        )

    # Verdeling over woonruimten bij gemeenschappelijk gebruik.
    aantal = par.get("aantal_woonruimten") or 1
    if aantal > 1:
        jaarbedrag = jaarbedrag / d(aantal)
        b.berekening.append(f"Verdeeld over {aantal} woonruimten = EUR {eur(jaarbedrag)} per woonruimte.")

    bedrag = jaarbedrag * maandfactor(dossier)

    if soort == "wasapparatuur":
        z = cfg["industriele_wasmachines_en_wasdrogers"]
        maximum = d(z["maximum_per_woonruimte_per_maand_eur"]) * d(dossier.periode.aantal_maanden)
        if bedrag > maximum:
            b.berekening.append(
                f"Maximum EUR {z['maximum_per_woonruimte_per_maand_eur']} per woonruimte per maand "
                f"x {dossier.periode.aantal_maanden} maanden = EUR {eur(maximum)}; dit maximum geldt "
                "(par. 4.3.3, p. 34)."
            )
            bedrag = maximum

    b.bedrag_model = eur(bedrag)
    if waardebron != "aankoopfactuur":
        b.toelichting.append(
            "Waarde geschat op basis van inzicht in de samenstelling van de roerende zaken "
            "(verkoopwaarde aan het begin van het boekjaar, p. 31); geen aankoopfacturen aanwezig."
        )
        b.menselijke_controle_nodig = True
    else:
        b.automatisering = Automatisering.AUTOMATISCH
        b.menselijke_controle_nodig = b.menselijke_controle_nodig or bool(b.ontbrekende_informatie)
    return _rond_status(b)


# ---------------------------------------------------------------- huismeester

@regel("SK-06")
def huismeester(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    if not _controleer_grondslag(post, b):
        return b
    par = post.parameters
    cfg = normen()["huismeester"]
    b.regels.append("R-HUI-01")

    if "facturen" not in post.bewijs and "urenverantwoording" not in post.bewijs:
        b.regels.append("R-BEW-02")
        b.ontbrekende_informatie.append(
            "Opvragen bij verhuurder: functieomschrijving, facturen dienstverleningsbedrijf en "
            "urenverantwoording/kosten eigen beheer (par. 4.3.6, p. 41)."
        )
        return _rond_status(b)

    uren = par.get("uren")
    totale_kosten = par.get("totale_kosten")
    aantal = par.get("aantal_woonruimten") or dossier.woonruimte.aantal_woonruimten_complex
    if uren is None or totale_kosten is None or not aantal:
        b.ontbrekende_informatie.append(
            "Voor de toets aan het maximale uurtarief zijn het aantal gewerkte uren, de totale "
            "kosten en het aantal woonruimten nodig (par. 4.3.6, p. 40-41)."
        )
        return _rond_status(b)

    try:
        maxtarief = huismeester_uurtarief(dossier.periode.jaar)
    except NormOntbreekt as exc:
        b.ontbrekende_informatie.append(str(exc))
        return _rond_status(b)

    uren, totale_kosten = d(uren), d(totale_kosten)
    getoetst = min(totale_kosten, uren * maxtarief)
    b.berekening.append(
        f"Toets aan maximaal uurtarief: {uren} uur x EUR {maxtarief} = EUR {eur(uren * maxtarief)}; "
        f"gefactureerd EUR {eur(totale_kosten)} -> getoetst EUR {eur(getoetst)} (Tabel 9, p. 40)."
    )
    aandeel = d(par.get("aandeel_huurders") or cfg["aandeel_huurders"])
    ten_laste = getoetst * aandeel
    b.berekening.append(
        f"{aandeel * 100:.0f}% ten laste van de huurders = EUR {eur(ten_laste)}; "
        f"{(1 - aandeel) * 100:.0f}% blijft voor rekening van de verhuurder (p. 41)."
    )
    per_woonruimte = ten_laste / d(aantal)
    b.berekening.append(f"Per woonruimte: EUR {eur(ten_laste)} / {aantal} = EUR {eur(per_woonruimte)}.")
    b.bedrag_model = eur(per_woonruimte * maandfactor(dossier))
    b.toelichting.append(
        "De Huurcommissie kan van de 70/30-verdeling afwijken als de feitelijke werkzaamheden "
        "een andere verdeling rechtvaardigen (p. 41); dat is een inhoudelijke weging."
    )
    b.automatisering = Automatisering.SEMI_AUTOMATISCH
    b.menselijke_controle_nodig = True
    return _rond_status(b)


@regel("SK-06B")
def externe_beveiliging(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    if not _controleer_grondslag(post, b):
        return b
    cfg = normen()["externe_beveiliging"]
    par = post.parameters
    b.regels.append("R-HUI-02")
    if "facturen" not in post.bewijs:
        b.ontbrekende_informatie.append("Facturen van de beveiligingsdienst ontbreken (p. 41).")
        return _rond_status(b)
    if par.get("gecertificeerd") is not True:
        b.ontbrekende_informatie.append(
            "De beveiligingsdienst is niet (aantoonbaar) gecertificeerd; de Huurcommissie vraagt "
            "dan de onderliggende stukken op (p. 41)."
        )
    totale_kosten = par.get("totale_kosten")
    aantal = par.get("aantal_woonruimten") or dossier.woonruimte.aantal_woonruimten_complex
    if totale_kosten is None or not aantal:
        b.ontbrekende_informatie.append("Totale kosten en/of aantal woonruimten ontbreken.")
        return _rond_status(b)
    aandeel = d(cfg["aandeel_huurders"])
    bedrag = d(totale_kosten) * aandeel / d(aantal) * maandfactor(dossier)
    b.berekening.append(
        f"70% van EUR {eur(d(totale_kosten))} = EUR {eur(d(totale_kosten) * aandeel)}, verdeeld over "
        f"{aantal} woonruimten = EUR {eur(bedrag)} (p. 41)."
    )
    b.bedrag_model = eur(bedrag)
    b.menselijke_controle_nodig = True
    return _rond_status(b)


# ------------------------------------------------------- administratiekosten

@regel("SK-11")
def administratiekosten(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    par = post.parameters
    cfg = normen()["administratiekosten"]
    b.regels.append("R-ADM-01")
    b.toelichting.append(
        "Administratiekosten hangen zo nauw samen met de servicekosten dat zij niet "
        "uitdrukkelijk overeengekomen hoeven te zijn (par. 4.3.11, p. 43)."
    )

    if par.get("afrekening_verstrekt") is False:
        b.regels.append("R-ADM-02")
        b.bedrag_model = eur(0)
        b.toelichting.append(
            "Administratiekosten kunnen alleen in rekening worden gebracht als een afrekening "
            "aan de huurder is verstrekt (p. 43). Een te late afrekening mag wel."
        )
        return _rond_status(b)

    grondslag_warmte = par.get("grondslag_warmtelevering")
    grondslag_overig = par.get("grondslag_overige_posten")
    if grondslag_warmte is None and grondslag_overig is None:
        b.ontbrekende_informatie.append(
            "Grondslag ontbreekt: over welke kostenposten (warmtelevering vs. overige) worden "
            "de administratiekosten berekend? (p. 43)"
        )
        return _rond_status(b)

    maximum = Decimal(0)
    if grondslag_warmte is not None:
        pct = d(cfg["max_percentage_warmtelevering_uitbesteed"] if par.get("meting_uitbesteed") else cfg["max_percentage_warmtelevering"])
        deel = d(grondslag_warmte) * pct
        maximum += deel
        b.berekening.append(
            f"Warmtelevering: {pct * 100:.0f}% van EUR {eur(d(grondslag_warmte))} = EUR {eur(deel)} "
            f"({'meting/verdeling uitbesteed' if par.get('meting_uitbesteed') else 'in eigen beheer'}, p. 43)."
        )
    if grondslag_overig is not None:
        pct = d(cfg["max_percentage_overige_posten"])
        deel = d(grondslag_overig) * pct
        maximum += deel
        b.berekening.append(
            f"Overige kostenposten: {pct * 100:.0f}% van EUR {eur(d(grondslag_overig))} = EUR {eur(deel)} (p. 43)."
        )

    ondergrens = d(cfg["minimum_per_afrekening_per_woonruimte_eur"])
    bovengrens = d(cfg["maximum_per_afrekening_per_woonruimte_eur"])
    toegestaan = min(post.bedrag_verhuurder, maximum)
    if toegestaan > bovengrens:
        toegestaan = bovengrens
        b.berekening.append(f"Begrensd op het maximum van EUR {bovengrens} per afrekening per woonruimte (p. 43).")
    if post.bedrag_verhuurder <= ondergrens and toegestaan < ondergrens:
        # Het minimumbedrag van EUR 7,50 blijft toegestaan, ook als het
        # percentage lager uitkomt (p. 43).
        toegestaan = min(post.bedrag_verhuurder, ondergrens)
        b.berekening.append(f"Minimumbedrag EUR {ondergrens} per afrekening per woonruimte toegepast (p. 43).")
    b.bedrag_model = eur(toegestaan)
    b.automatisering = Automatisering.AUTOMATISCH
    b.menselijke_controle_nodig = False
    return _rond_status(b)


# ------------------------------------------- generieke (overige) servicekosten

# Configuratie per kostenpost uit hoofdstuk 4. `forfait_aandeel` verwijst naar
# data/normen.json -> forfaitaire_verdelingen.
CONFIG: dict[str, dict] = {
    "SK-01": {"naam": "Warmtevoorzieningen gemeenschappelijke gedeelten", "regel": "R-SK-01", "bron": "par. 4.3.1, p. 30"},
    "SK-02": {"naam": "Nutsvoorzieningen gemeenschappelijke gedeelten", "regel": "R-SK-02", "bron": "par. 4.3.2, p. 30"},
    "SK-04-GLAS": {
        "naam": "Glazen wassen", "regel": "R-KH-01", "bron": "par. 4.3.4, p. 36",
        "voorwaarde": ("ruiten_bereikbaar", "Zijn de ruiten voor de huurder bereikbaar? Zo nee, dan zijn de kosten niet doorberekenbaar (p. 36)."),
        "forfait": ("glazenwassen_zonder_specificatie", "aandeel_arbeidskosten_huurder", "kosten_gespecificeerd"),
        "forfait_altijd": True,
    },
    "SK-04-SCHOONMAAK": {
        "naam": "Schoonmaken gemeenschappelijke ruimten", "regel": "R-KH-02", "bron": "par. 4.3.4, p. 36",
        "uitsluiting": ("betreft_mutatiekosten", "Mutatiekosten (begin- en eindschoonmaak bij verhuizing) mogen niet bij de huurder in rekening worden gebracht (p. 36)."),
    },
    "SK-04-TUIN": {
        "naam": "Tuinonderhoud", "regel": "R-KH-03", "bron": "par. 4.3.4, p. 37",
        "voorwaarde": ("exclusief_gebruiksrecht", "Heeft de huurder het exclusieve gebruiksrecht van de groenvoorziening? Bij een openbaar karakter of een kijktuin blijven de kosten voor rekening van de verhuurder (p. 37)."),
        "handmatig": True,
    },
    "SK-04-GLADHEID": {
        "naam": "Gladheidsbestrijding", "regel": "R-KH-04", "bron": "par. 4.3.4, p. 37",
        "voorwaarde": ("exclusief_gebruiksrecht", "Heeft de huurder het exclusieve (gezamenlijke) gebruiksrecht van de buitenruimte? (p. 37)"),
    },
    "SK-04-ONTSTOPPING": {
        "naam": "Ontstoppen leidingen en rioleringen", "regel": "R-KH-05", "bron": "par. 4.3.4, p. 37",
        "voorwaarde": ("leidingen_bereikbaar_en_individueel", "Bevinden de leidingen zich in of aan de woonruimte en zijn ze voor de huurder bereikbaar? Leidingen voor meerdere zelfstandige woonruimten en werkzaamheden door een technisch gebrek blijven voor rekening van de verhuurder (p. 37)."),
        "forfait": ("ontstoppingscontract", "aandeel_huurder", "kosten_gespecificeerd"),
        "forfait_altijd_bij": "onderhoudscontract",
    },
    "SK-04-SCHOORSTEEN": {
        "naam": "Schoorsteenvegen en reinigen ventilatiekanalen", "regel": "R-KH-06", "bron": "par. 4.3.4, p. 38",
        "voorwaarde": ("kanaal_bereikbaar", "Is de schoorsteen of het kanaal voor de huurder bereikbaar? (p. 38)"),
    },
    "SK-04-LAMPEN": {
        "naam": "Lampen vervangen", "regel": "R-KH-07", "bron": "par. 4.3.4, p. 38",
        "uitsluiting": ("betreft_armaturen_of_installatie", "Vervangen van armaturen, vernieuwen of repareren van de installatie en vandalismeschade blijven voor rekening van de verhuurder (p. 38)."),
    },
    "SK-04-ONGEDIERTE": {
        "naam": "Ongediertebestrijding", "regel": "R-KH-08", "bron": "par. 4.3.4, p. 38",
        "uitsluiting": ("gevolg_bouwkundige_situatie", "Als het ongedierte het gevolg is van een bouwkundige situatie komen de kosten voor rekening van de verhuurder; de huurder moet dit aannemelijk maken (p. 38)."),
    },
    "SK-04-INSTALLATIE": {
        "naam": "Onderhoud installaties binnen de woonruimte", "regel": "R-KH-09", "bron": "par. 4.3.4, p. 38-39",
        "voorwaarde": ("eenvoudig_onderhoud_binnen_woonruimte", "Gaat het om onderhoudstechnisch eenvoudige werkzaamheden zonder specialistische kennis en zonder noemenswaardige kosten aan een installatie binnen de woonruimte? Periodiek onderhoud aan aard- en nagelvaste (onroerende) installaties, klein onderhoud daaraan en keuringskosten zijn niet doorberekenbaar (p. 39)."),
    },
    "SK-04-SCHILDERWERK": {
        "naam": "Schilderwerkzaamheden", "regel": "R-KH-10", "bron": "par. 4.3.4, p. 39",
        "voorwaarde": ("uitdrukkelijk_overeengekomen_of_op_verzoek_huurder", "Is het schilderwerk uitdrukkelijk overeengekomen (of bij aanvang op verzoek van de huurder uitgevoerd)? Zo niet, dan wordt het geacht te zijn verricht om de woonruimte verhuurbaar te maken en zijn de kosten niet doorberekenbaar (p. 39)."),
        "handmatig": True,
    },
    "SK-05": {"naam": "Huisvuil", "regel": "R-SK-05", "bron": "par. 4.3.5, p. 39-40"},
    "SK-07": {"naam": "Signaallevering", "regel": "R-SK-07", "bron": "par. 4.3.7, p. 42"},
    "SK-08": {"naam": "Elektronische apparatuur", "regel": "R-SK-08", "bron": "par. 4.3.8, p. 42"},
    "SK-09-GLAS": {
        "naam": "Glasverzekering", "regel": "R-VZ-02", "bron": "par. 4.3.9, p. 43",
        "forfait": ("glasverzekering_binnen_opstalverzekering", "aandeel_glasverzekering", "kosten_gespecificeerd"),
        "forfait_altijd_bij": "onderdeel_van_opstalverzekering",
    },
    "SK-09-OPSTAL": {
        "naam": "Opstal-/brand-/storm-/schade-/bedrijfsschade-/aansprakelijkheidsverzekering",
        "regel": "R-VZ-01", "bron": "par. 4.3.9, p. 42-43", "nooit_doorberekenbaar": True,
        "reden": "Verzekeringen die direct verband houden met de onroerende zaak blijven voor rekening van de verhuurder (p. 42-43).",
    },
    "SK-09-INBOEDEL": {"naam": "Inboedelverzekering voor in gebruik gegeven roerende zaken", "regel": "R-VZ-03", "bron": "par. 4.3.9, p. 43"},
    "SK-10": {"naam": "Gemeenschappelijke ruimten", "regel": "R-SK-10", "bron": "par. 4.3.10, p. 43"},
    "SK-12": {
        "naam": "Onderhoudscontract met 24-uursservice", "regel": "R-SK-12", "bron": "par. 4.3.12, p. 44",
        "forfait": ("onderhoudscontract_24uursservice", "aandeel_24uursservice", "kosten_gespecificeerd"),
        "forfait_altijd": True,
    },
    "SK-14-WKO": {
        "naam": "Warmtelevering via WKO-installatie", "regel": "R-WKO-01", "bron": "par. 5.4, p. 49-50",
        "voorwaarde": ("vaste_kosten_gesplitst", "Zijn de vaste kosten gesplitst in kapitaals- en onderhoudslasten van de WKO-installatie (niet doorberekenbaar, want te dekken uit de kale huurprijs) en de overige vaste kosten (wel doorberekenbaar)? Zonder die splitsing is het doorberekenbare deel niet vast te stellen (par. 5.4, p. 49)."),
        "handmatig": True,
    },
    "SK-13": {"naam": "Fonds", "regel": "R-SK-13", "bron": "par. 4.3.13, p. 44", "fonds": True},
    "NSK-01": {
        "naam": "Leegstandsderving", "regel": "R-NSK-01", "bron": "par. 4.3.14, p. 44", "nooit_doorberekenbaar": True,
        "reden": "Het is niet toegestaan gederfde servicekosten als gevolg van leegstand aan de zittende huurders door te berekenen (p. 44).",
    },
    "NSK-02": {
        "naam": "Belastingen en heffingen", "regel": "R-NSK-02", "bron": "par. 4.3.15, p. 44", "buiten_bevoegdheid": True,
        "reden": "Belastingen en heffingen maken geen onderdeel uit van de servicekosten; de Huurcommissie is niet bevoegd hierover uitspraak te doen (p. 44, p. 51).",
    },
    "NSK-03": {
        "naam": "Zorgservicekosten", "regel": "R-NSK-03", "bron": "par. 4.3.16, p. 45", "buiten_bevoegdheid": True,
        "reden": "De Huurcommissie doet alleen uitspraak over woonservicekosten, niet over zorgservicekosten (p. 45).",
    },
}


@regel(*CONFIG.keys())
def overige_servicekost(post: Kostenpost, dossier: Dossier) -> Beoordeling:
    b = _basis(post)
    cfg = CONFIG[post.categorie]
    par = post.parameters
    b.regels.append(cfg["regel"])

    if cfg.get("buiten_bevoegdheid"):
        b.status = Status.BUITEN_BEVOEGDHEID
        b.toelichting.append(cfg["reden"] + f" ({cfg['bron']})")
        b.automatisering = Automatisering.AUTOMATISCH
        b.menselijke_controle_nodig = False
        return b

    if cfg.get("nooit_doorberekenbaar"):
        b.bedrag_model = eur(0)
        b.toelichting.append(cfg["reden"] + f" ({cfg['bron']})")
        b.automatisering = Automatisering.AUTOMATISCH
        b.menselijke_controle_nodig = False
        return _rond_status(b)

    if not _controleer_grondslag(post, b):
        return b

    # Gebruikt of kan de huurder gebruikmaken van de gemeenschappelijke voorziening? (p. 29)
    if dossier.woonruimte.gebruikt_gemeenschappelijke_ruimten is False and par.get("betreft_gemeenschappelijke_voorziening"):
        b.regels.append("R-VDS-04")
        b.bedrag_model = eur(0)
        b.toelichting.append(
            "De huurder maakt geen gebruik van de gemeenschappelijke ruimten of voorzieningen "
            "en hoeft dat ook niet; dan hoeft hij daarvoor niet te betalen (p. 29)."
        )
        return _rond_status(b)

    # Harde uitsluitingsgronden.
    uitsluiting = cfg.get("uitsluiting")
    if uitsluiting and par.get(uitsluiting[0]) is True:
        b.bedrag_model = eur(0)
        b.toelichting.append(uitsluiting[1])
        return _rond_status(b)

    # Voorwaarden voor doorberekenbaarheid.
    voorwaarde = cfg.get("voorwaarde")
    if voorwaarde:
        waarde = par.get(voorwaarde[0])
        if waarde is False:
            b.bedrag_model = eur(0)
            b.toelichting.append("Niet doorberekenbaar: " + voorwaarde[1])
            return _rond_status(b)
        if waarde is None:
            b.ontbrekende_informatie.append(voorwaarde[1])
            b.menselijke_controle_nodig = True

    if cfg.get("fonds"):
        ontbreekt = [v for v in normen()["fondsen"]["voorwaarden"] if v not in par.get("voldaan_aan_voorwaarden", [])]
        if ontbreekt:
            b.ontbrekende_informatie.append(
                "Fondsvoorwaarden nog niet aangetoond: " + "; ".join(ontbreekt) + " (par. 4.3.13, p. 44)."
            )
            b.menselijke_controle_nodig = True

    # Bewijsregels par. 6.4.2 categorie (overige) servicekosten, p. 60-61.
    heeft_facturen = "facturen" in post.bewijs
    heeft_formulier = "specificatieformulier" in post.bewijs
    if not heeft_facturen and post.levering_gemotiveerd_betwist:
        b.regels.append("R-BEW-03")
        b.bedrag_model = eur(0)
        b.ontbrekende_informatie.clear()
        b.toelichting.append(
            "De levering van de zaak of dienst wordt gemotiveerd betwist en de verhuurder heeft "
            "geen facturen of andere betaalbewijzen overgelegd: de kosten worden op EUR 0,00 "
            "gesteld (par. 6.4.2 categorie 2, p. 61; art. 18 lid 4 Uhw)."
        )
        return _rond_status(b)
    if not heeft_facturen or not heeft_formulier:
        b.regels.append("R-BEW-02")
        b.bedrag_model = eur(d(normen()["forfaits_bij_ontbrekende_onderbouwing"]["vast_bedrag_overige_kostenposten_per_jaar_eur"]) * maandfactor(dossier))
        ontbrekend = []
        if not heeft_formulier:
            ontbrekend.append("specificatieformulier (bijlage VII Uitvoeringsregeling huurprijzen woonruimte)")
        if not heeft_facturen:
            ontbrekend.append("facturen of andere betaalbewijzen")
        b.toelichting.append(
            "Ontbrekende onderbouwing (" + " en ".join(ontbrekend) + ") terwijl de levering niet "
            "gemotiveerd wordt betwist: de Huurcommissie houdt voor deze kostenpost doorgaans "
            "EUR 12,00 per jaar aan (par. 6.4.2, p. 60-61)."
        )
        b.automatisering = Automatisering.AUTOMATISCH
        b.menselijke_controle_nodig = True
        return _rond_status(b)

    # Werkelijke kosten als uitgangspunt, eventueel met forfaitaire verdeling.
    basisbedrag = d(par.get("werkelijke_kosten", post.bedrag_verhuurder))
    forfait = cfg.get("forfait")
    if forfait:
        sleutel, veld, voorwaarde_veld = forfait
        gespecificeerd = par.get(voorwaarde_veld)
        van_toepassing = cfg.get("forfait_altijd") or par.get(cfg.get("forfait_altijd_bij", ""), False)
        if van_toepassing and gespecificeerd is not True:
            aandeel = breuk(normen()["forfaitaire_verdelingen"][sleutel][veld])
            b.berekening.append(
                f"Kosten niet gespecificeerd: forfaitair aandeel {aandeel * 100:.2f}% van "
                f"EUR {eur(basisbedrag)} = EUR {eur(basisbedrag * aandeel)} ({cfg['bron']})."
            )
            basisbedrag = basisbedrag * aandeel

    aantal = par.get("aantal_woonruimten")
    if aantal and int(aantal) > 1 and par.get("bedrag_is_complextotaal", True):
        b.regels.append("R-VDS-03")
        b.berekening.append(
            f"Verdeeld over {aantal} woonruimten die gebruik (kunnen) maken van de zaak of "
            f"dienst: EUR {eur(basisbedrag)} / {aantal} = EUR {eur(basisbedrag / d(aantal))} (p. 29)."
        )
        basisbedrag = basisbedrag / d(aantal)

    b.bedrag_model = eur(basisbedrag * maandfactor(dossier))
    if cfg.get("handmatig"):
        b.automatisering = Automatisering.HANDMATIG
        b.menselijke_controle_nodig = True
    elif b.ontbrekende_informatie:
        b.automatisering = Automatisering.SEMI_AUTOMATISCH
    else:
        b.automatisering = Automatisering.AUTOMATISCH
        b.menselijke_controle_nodig = False
    return _rond_status(b)
