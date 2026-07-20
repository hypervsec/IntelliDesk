from app.services import find_similar_tickets


def test_dect_ticket_ranking() -> None:
    query_text = (
        "Konu: Kablosuz telefon bağlantı sorunu\n"
        "Açıklama: Ofiste kullanılan 4574 dahili numaralı "
        "DECT telefon hizmet dışı görünüyor. Cihaz üzerinden "
        "arama yapılamıyor ve hat bağlantısı kurulamıyor."
    )

    results = find_similar_tickets(
        query_text=query_text,
        limit=5,
    )

    assert results
    assert len(results) <= 5
    assert str(results[0]["request_id"]) == "21373"

    resolution = (
        results[0]["resolution"]
        or ""
    ).lower()

    assert "dect" in resolution
    assert "tanimlama" in resolution


def test_printer_imaging_unit_ranking() -> None:
    query_text = (
        "Konu: Yazıcı görüntüleme ünitesi uyarısı\n"
        "Açıklama: Sekreterlikte kullanılan yazıcının "
        "ekranında görüntüleme ünitesinin değiştirilmesi "
        "gerektiğine dair uyarı çıkıyor. Uyarı nedeniyle "
        "yazıcı sağlıklı şekilde kullanılamıyor."
    )

    results = find_similar_tickets(
        query_text=query_text,
        limit=5,
    )

    assert results
    assert len(results) <= 5
    assert str(results[0]["request_id"]) == "17832"

    resolution = (
        results[0]["resolution"]
        or ""
    ).lower()

    assert "görüntüleme birimi" in resolution
    assert "siyah" in resolution