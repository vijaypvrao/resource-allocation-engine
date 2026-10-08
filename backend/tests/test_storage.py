from datetime import datetime
from app.models import Location, Resource, Request
import app.storage as storage


def test_store_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DATA_FILE", tmp_path / "store.json")
    r = Resource("r1", "Tech", Location(12.9, 77.6), frozenset({"hvac"}), datetime(2026,1,1,9), datetime(2026,1,1,17))
    q = Request("q1", "Fix", Location(12.8,77.5), frozenset({"hvac"}), datetime(2026,1,1,10), datetime(2026,1,1,11), 4)
    storage.save_data([r], [q])
    resources, requests = storage.load_data()
    assert resources[0] == r
    assert requests[0] == q
