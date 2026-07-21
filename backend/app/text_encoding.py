from __future__ import annotations


MOJIBAKE_REPLACEMENTS = (
    ("Ä°", "İ"),
    ("Ä±", "ı"),
    ("Äž", "Ğ"),
    ("ÄŸ", "ğ"),
    ("Åž", "Ş"),
    ("ÅŸ", "ş"),
    ("Ã‡", "Ç"),
    ("Ã§", "ç"),
    ("Ã–", "Ö"),
    ("Ã¶", "ö"),
    ("Ãœ", "Ü"),
    ("Ã¼", "ü"),
    ("â€™", "’"),
    ("â€œ", "“"),
    ("â€", "”"),
    ("â€“", "–"),
    ("â€”", "—"),
)


def repair_mojibake(
    value: str | None,
) -> str | None:
    """
    Yanlış karakter kodlaması nedeniyle oluşan
    yaygın Türkçe karakter bozulmalarını düzeltir.

    Doğru metinlere dokunmaz.
    """
    if value is None:
        return None

    repaired_value = value

    for broken_text, correct_text in (
        MOJIBAKE_REPLACEMENTS
    ):
        repaired_value = (
            repaired_value.replace(
                broken_text,
                correct_text,
            )
        )

    return repaired_value