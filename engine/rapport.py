"""Markdown-rapportage van een beoordeling."""

from __future__ import annotations

from decimal import Decimal

from .model import JaarUitkomst, Status, eur

VLAG = {
    Status.GROEN: "GROEN",
    Status.ORANJE: "ORANJE",
    Status.ROOD: "ROOD",
    Status.BUITEN_BEVOEGDHEID: "BUITEN BEVOEGDHEID",
}


def rapport(uitkomst: JaarUitkomst, titel: str = "") -> str:
    r: list[str] = []
    if titel:
        r.append(f"### {titel}")
        r.append("")
    r.append(f"**Boekjaar {uitkomst.jaar}**")
    r.append("")

    if uitkomst.ontvankelijkheid:
        r.append("**Ontvankelijkheid en bevoegdheid**")
        r.append("")
        for regel in uitkomst.ontvankelijkheid:
            r.append(f"- {regel}")
        r.append("")

    r.append("| Post | Status | Verhuurder | Model | Verschil | Regels |")
    r.append("| --- | --- | ---: | ---: | ---: | --- |")
    for b in uitkomst.beoordelingen:
        if b.status is Status.BUITEN_BEVOEGDHEID:
            model, verschil = "n.v.t.", "-"
        elif b.bedrag_model is None:
            model, verschil = "niet vast te stellen", "-"
        elif b.voorlopig:
            model, verschil = f"EUR {b.bedrag_model} (voorlopig)", f"EUR {b.verschil} (voorlopig)"
        else:
            model, verschil = f"EUR {b.bedrag_model}", f"EUR {b.verschil}"
        r.append(
            f"| {b.omschrijving} | {VLAG[b.status]} | EUR {b.bedrag_verhuurder} | {model} | "
            f"{verschil} | {', '.join(b.regels) or '-'} |"
        )
    r.append("")

    r.append("**Toelichting per post**")
    r.append("")
    for b in uitkomst.beoordelingen:
        r.append(f"*{b.omschrijving}* ({b.categorie}) - {VLAG[b.status]}")
        for regel in b.berekening:
            r.append(f"  - berekening: {regel}")
        for regel in b.toelichting:
            r.append(f"  - {regel}")
        for regel in b.ontbrekende_informatie:
            r.append(f"  - ONTBREEKT: {regel}")
        r.append(
            f"  - automatisering: {b.automatisering.value}; menselijke controle nodig: "
            f"{'ja' if b.menselijke_controle_nodig else 'nee'}"
        )
        r.append("")

    r.append("**Financieel beeld**")
    r.append("")
    r.append(f"- Servicekosten volgens verhuurder (binnen bevoegdheid): EUR {uitkomst.totaal_verhuurder}")
    r.append(f"- Waarvan beoordeeld: EUR {uitkomst.totaal_verhuurder_vastgestelde_posten}")
    r.append(f"- Waarschijnlijk toegestaan volgens beoordelingsmodel: EUR {uitkomst.totaal_model_vastgesteld}")
    r.append(f"- **Potentiele correctie: EUR {uitkomst.potentiele_correctie}**")
    if uitkomst.onbeoordeelde_posten:
        r.append(
            f"- Nog niet te beoordelen (ORANJE): EUR {uitkomst.onbeoordeeld_bedrag} over "
            f"{len(uitkomst.onbeoordeelde_posten)} post(en); zie de ONTBREEKT-regels hierboven."
        )
        r.append(
            f"- Bandbreedte potentiele correctie: EUR {uitkomst.potentiele_correctie} tot "
            f"EUR {eur(uitkomst.potentiele_correctie + uitkomst.onbeoordeeld_bedrag)} "
            "(ondergrens = alle ORANJE-posten blijken toegestaan; bovengrens = alle "
            "ORANJE-posten blijken volledig onterecht)."
        )
    r.append("")
    return "\n".join(r)


def meerjarenoverzicht(uitkomsten: list[JaarUitkomst]) -> str:
    r = ["| Boekjaar | Volgens verhuurder | Volgens model | Potentieel verschil | Nog onbeoordeeld |",
         "| --- | ---: | ---: | ---: | ---: |"]
    totaal_correctie = Decimal(0)
    totaal_onbeoordeeld = Decimal(0)
    for u in uitkomsten:
        totaal_correctie += u.potentiele_correctie
        totaal_onbeoordeeld += u.onbeoordeeld_bedrag
        r.append(
            f"| {u.jaar} | EUR {u.totaal_verhuurder_vastgestelde_posten} | "
            f"EUR {u.totaal_model_vastgesteld} | EUR {u.potentiele_correctie} | "
            f"EUR {u.onbeoordeeld_bedrag} |"
        )
    r.append(
        f"| **Totaal** | | | **EUR {eur(totaal_correctie)}** | EUR {eur(totaal_onbeoordeeld)} |"
    )
    return "\n".join(r)
