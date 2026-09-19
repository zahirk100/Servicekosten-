"""Concepten voor de twee brieven die het beleidsboek verplicht stelt.

Zonder schriftelijk bezwaar (afrekening ontvangen) of een schriftelijke opvraag
(geen afrekening ontvangen) verklaart de Huurcommissie het verzoek
niet-ontvankelijk (par. 6.3.1 en 6.3.2, p. 56-57). Deze module genereert die
brieven uit de beoordeling, zodat de bezwaren per kostenpost zijn gemotiveerd -
wat par. 6.3.1 uitdrukkelijk eist.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from .model import Dossier, JaarUitkomst, Status, eur


def _euro(waarde: Decimal | None) -> str:
    if waarde is None:
        return "-"
    return f"EUR {eur(waarde):,.2f}".replace(",", "~").replace(".", ",").replace("~", ".")


def bezwaarbrief(uitkomst: JaarUitkomst, dossier: Dossier, vandaag: date | None = None) -> str:
    vandaag = vandaag or date.today()
    reactie_uiterlijk = vandaag + timedelta(weeks=3)

    rood = [b for b in uitkomst.beoordelingen
            if b.status is Status.ROOD and (b.verschil or Decimal(0)) > 0]
    oranje = [b for b in uitkomst.beoordelingen if b.status is Status.ORANJE]

    r: list[str] = []
    r.append("[Uw naam]")
    r.append("[Uw adres]")
    r.append("[Postcode en woonplaats]")
    r.append("")
    r.append("Aan: [naam verhuurder]")
    r.append("[adres verhuurder]")
    r.append("")
    r.append(f"Datum: {vandaag.strftime('%d-%m-%Y')}")
    r.append(f"Betreft: bezwaar tegen de afrekening servicekosten {uitkomst.jaar}")
    r.append("")
    r.append("Geachte heer/mevrouw,")
    r.append("")
    r.append(
        f"Op [datum] ontving ik van u de afrekening servicekosten over {uitkomst.jaar}. "
        "Ik ben het niet eens met een aantal posten. Hieronder licht ik per kostenpost toe "
        "waarom, zoals artikel 7:260 BW en het Beleidsboek Servicekosten van de Huurcommissie "
        "van mij verlangen."
    )
    r.append("")

    if rood:
        r.append("1. Posten waartegen ik bezwaar maak")
        r.append("")
        for nummer, b in enumerate(rood, start=1):
            r.append(f"{nummer}. {b.omschrijving} - in rekening gebracht: {_euro(b.bedrag_verhuurder)}")
            for regel in b.toelichting:
                r.append(f"   {regel}")
            for regel in b.berekening:
                r.append(f"   {regel}")
            r.append(
                f"   Volgens het beleidsboek kom ik uit op {_euro(b.bedrag_model)}. "
                f"Ik verzoek u dit te corrigeren met {_euro(b.verschil)}."
            )
            r.append("")
        r.append(
            f"Het totaal van de door mij betwiste correcties bedraagt "
            f"{_euro(uitkomst.potentiele_correctie)}."
        )
        r.append("")

    if oranje:
        volgnummer = 2 if rood else 1
        r.append(f"{volgnummer}. Posten waarvoor ik aanvullende informatie nodig heb")
        r.append("")
        r.append(
            "Op grond van artikel 7:259 lid 4 BW heb ik recht op inzage in de boeken en andere "
            "bescheiden die aan de afrekening ten grondslag liggen. Voor de volgende posten "
            "verzoek ik u die stukken te verstrekken:"
        )
        r.append("")
        for b in oranje:
            r.append(f"- {b.omschrijving} ({_euro(b.bedrag_verhuurder)}):")
            for regel in b.ontbrekende_informatie:
                r.append(f"  {regel}")
        r.append("")

    r.append(
        f"Ik verzoek u binnen drie weken, dus uiterlijk {reactie_uiterlijk.strftime('%d-%m-%Y')}, "
        "op dit bezwaar te reageren en de afrekening zo nodig aan te passen. Ontvang ik binnen "
        "die termijn geen reactie, of neemt uw reactie mijn bezwaren niet weg, dan leg ik het "
        "geschil voor aan de Huurcommissie."
    )
    r.append("")
    r.append("Met vriendelijke groet,")
    r.append("")
    r.append("[Uw naam]")
    r.append("")
    r.append("---")
    r.append(
        "Concept, gegenereerd op basis van het Beleidsboek Servicekosten (versie 1 juli 2026). "
        "Controleer de gegevens tussen [ ] en de inhoudelijke juistheid voordat u verstuurt. "
        "Dit is geen juridisch advies."
    )
    return "\n".join(r)


def opvraagbrief(jaar: int, vandaag: date | None = None) -> str:
    """Brief voor de opvraagplicht: er is geen afrekening ontvangen (par. 6.3.2, p. 57)."""
    vandaag = vandaag or date.today()
    reactie_uiterlijk = vandaag + timedelta(weeks=3)
    return "\n".join([
        "[Uw naam]",
        "[Uw adres]",
        "[Postcode en woonplaats]",
        "",
        "Aan: [naam verhuurder]",
        "[adres verhuurder]",
        "",
        f"Datum: {vandaag.strftime('%d-%m-%Y')}",
        f"Betreft: verzoek om de afrekening servicekosten {jaar}",
        "",
        "Geachte heer/mevrouw,",
        "",
        f"Op grond van artikel 7:259 lid 2 BW bent u verplicht mij uiterlijk zes maanden na "
        f"afloop van het kalenderjaar een naar soort uitgesplitst overzicht te verstrekken van "
        f"de in dat jaar in rekening gebrachte kosten voor nutsvoorzieningen en servicekosten, "
        f"met vermelding van de wijze van berekening. Voor het jaar {jaar} was die termijn "
        f"uiterlijk 30 juni {jaar + 1}.",
        "",
        "Ik heb deze afrekening niet ontvangen. Hierbij verzoek ik u die alsnog te verstrekken, "
        f"uiterlijk binnen drie weken, dus vóór {reactie_uiterlijk.strftime('%d-%m-%Y')}.",
        "",
        "Ontvang ik de afrekening niet binnen die termijn, dan leg ik de vaststelling van mijn "
        "betalingsverplichting voor aan de Huurcommissie (artikel 7:260 BW).",
        "",
        "Met vriendelijke groet,",
        "",
        "[Uw naam]",
        "",
        "---",
        "Concept op basis van het Beleidsboek Servicekosten (versie 1 juli 2026), paragraaf 6.3.2. "
        "Dit is geen juridisch advies.",
    ])
