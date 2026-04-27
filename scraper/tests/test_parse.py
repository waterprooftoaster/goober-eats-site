"""
@file test_parse.py
@description Tests for scraper/src/parse.py — filter, skipped-list, and stdout summary.
  Called by: pytest scraper/tests/test_parse.py
@dependencies pytest, src.parse
"""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

import src.parse as parse_module


# --- Fixtures ---


"""
Builds a minimal valid raw envelope JSON that parse._transform() can process.
@param tmp_path - pytest tmp_path fixture
@param restaurant_id - Grubhub restaurant ID string
@param restaurant_name - display name
@param num_items - how many menu items to include (use 0 to test skip-on-empty)
@returns path to the written JSON file
"""
def _write_raw_envelope(
    tmp_path: Path,
    restaurant_id: str,
    restaurant_name: str,
    num_items: int,
) -> Path:
    items = [
        {
            "name": f"Item {i}",
            "price": {"amount": 500, "currency": "USD"},
            "choice_category_list": [],
            "media_image": None,
        }
        for i in range(num_items)
    ]
    category = {"name": "Category", "menu_item_list": items} if items else {"name": "Empty", "menu_item_list": []}
    body = {
        "restaurant": {
            "id": restaurant_id,
            "name": restaurant_name,
            "address": {"street_address": "1 Test St"},
            "latitude": 40.7,
            "longitude": -74.0,
            "logo": "https://example.com/logo.jpg",
            "media_image": None,
            "menu_category_list": [category] if num_items > 0 else [category],
        }
    }
    envelope = {
        "captured_at": "2026-01-01T00:00:00+00:00",
        "request": {"method": "GET", "path": "/test"},
        "response": {"status_code": 200, "body": body},
    }
    out = tmp_path / f"test_{restaurant_id}.json"
    out.write_text(json.dumps(envelope))
    return out


# --- Tests ---


"""
Verifies that an eatery with zero menu items is added to the skipped list
and not written to data/parsed/.
"""
def test_skips_eatery_with_no_items(tmp_path, capsys):
    raw_dir = tmp_path / "raw"
    parsed_dir = tmp_path / "parsed"
    raw_dir.mkdir()
    parsed_dir.mkdir()

    _write_raw_envelope(raw_dir, "rest-999", "Empty Restaurant", num_items=0)

    with (
        patch.object(parse_module, "RAW_DIR", raw_dir),
        patch.object(parse_module, "PARSED_DIR", parsed_dir),
        patch("src.parse._load_school_id", return_value="00000000-0000-0000-0000-000000000001"),
    ):
        parse_module._transform("cents")

    # No file written
    assert list(parsed_dir.glob("*.json")) == []

    # Skipped restaurant appears in stdout
    captured = capsys.readouterr()
    assert "Empty Restaurant" in captured.out
    assert "no menu items" in captured.out.lower()


"""
Verifies that a file that raises an exception during processing is added to
the skipped list (not re-raised), and the rest of the run completes.
"""
def test_skipped_list_on_exception(tmp_path, capsys):
    raw_dir = tmp_path / "raw"
    parsed_dir = tmp_path / "parsed"
    raw_dir.mkdir()
    parsed_dir.mkdir()

    # Malformed envelope — valid JSON but response body is not a dict
    bad_envelope = {
        "captured_at": "2026-01-01T00:00:00+00:00",
        "request": {"method": "GET", "path": "/bad"},
        "response": {"status_code": 200, "body": "not a dict"},
    }
    (raw_dir / "bad.json").write_text(json.dumps(bad_envelope))

    # Also include a good file to verify the run continues
    _write_raw_envelope(raw_dir, "rest-001", "Good Restaurant", num_items=2)

    with (
        patch.object(parse_module, "RAW_DIR", raw_dir),
        patch.object(parse_module, "PARSED_DIR", parsed_dir),
        patch("src.parse._load_school_id", return_value="00000000-0000-0000-0000-000000000001"),
    ):
        parse_module._transform("cents")

    # Good restaurant was written
    assert len(list(parsed_dir.glob("*.json"))) == 1

    # Skipped summary printed to stdout
    captured = capsys.readouterr()
    assert "bad.json" in captured.out or "skipped" in captured.out.lower()


"""
Verifies that the final stdout always includes a skipped summary block,
even when there are no skipped entries (shows count of 0).
"""
def test_skipped_summary_always_printed(tmp_path, capsys):
    raw_dir = tmp_path / "raw"
    parsed_dir = tmp_path / "parsed"
    raw_dir.mkdir()
    parsed_dir.mkdir()

    _write_raw_envelope(raw_dir, "rest-001", "Good Restaurant", num_items=3)

    with (
        patch.object(parse_module, "RAW_DIR", raw_dir),
        patch.object(parse_module, "PARSED_DIR", parsed_dir),
        patch("src.parse._load_school_id", return_value="00000000-0000-0000-0000-000000000001"),
    ):
        parse_module._transform("cents")

    captured = capsys.readouterr()
    # Summary line must mention skipped count
    assert "skipped" in captured.out.lower()
