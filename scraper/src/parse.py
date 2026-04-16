"""
@file parse.py
@description Transforms raw Grubhub API captures from data/raw/ into Goober Eats
  schema JSON in data/parsed/. Run with --discover to inspect raw data structure
  before writing mappings.
  Called by: python -m src.parse [--discover] [--price-unit cents|dollars]
@dependencies python-dotenv
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

RAW_DIR = Path("data/raw")
PARSED_DIR = Path("data/parsed")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


"""
CLI entry point. Dispatches to --discover mode or transform mode.
@called-by python -m src.parse
"""
def main() -> None:
    args = _parse_args()

    if args.discover:
        _discover()
    else:
        _transform(args.price_unit)


# --- CLI ---


"""
Parses command-line arguments.
@returns parsed Namespace
@called-by main
"""
def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transform raw Grubhub captures to Goober Eats schema"
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Print JSON structure of all raw files (for initial exploration)",
    )
    parser.add_argument(
        "--price-unit",
        choices=["cents", "dollars"],
        default="cents",
        help="Unit of prices in Grubhub responses (default: cents)",
    )
    return parser.parse_args()


# --- Discover Mode ---


"""
Prints the JSON structure (keys, types, nesting) of every raw capture file.
Use this to understand the Grubhub API shape before writing mappings.
@called-by main
"""
def _discover() -> None:
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        logger.warning("No files found in %s", RAW_DIR)
        return

    for filepath in files:
        envelope = _read_envelope(filepath)
        if envelope is None:
            continue

        req = envelope.get("request", {})
        body = envelope.get("response", {}).get("body", {})

        print(f"\n{'='*70}")
        print(f"File: {filepath.name}")
        print(f"  {req.get('method', '?')} {req.get('path', '?')}")
        print(f"  Status: {envelope.get('response', {}).get('status_code', '?')}")
        print(f"  Structure:")
        _print_structure(body, indent=4)


"""
Recursively prints the key/type structure of a JSON object.
@param obj - the JSON value to describe
@param indent - current indentation level (spaces)
@param max_depth - stop recursion beyond this depth
@called-by _discover, self
"""
def _print_structure(obj: Any, indent: int = 0, max_depth: int = 4) -> None:
    prefix = " " * indent
    if max_depth <= 0:
        print(f"{prefix}...")
        return

    if isinstance(obj, dict):
        for key, val in obj.items():
            type_label = _type_label(val)
            print(f"{prefix}{key}: {type_label}")
            if isinstance(val, (dict, list)):
                _print_structure(val, indent + 2, max_depth - 1)
    elif isinstance(obj, list):
        if not obj:
            print(f"{prefix}(empty list)")
        else:
            sample = obj[0]
            print(f"{prefix}[{len(obj)} items] first item: {_type_label(sample)}")
            _print_structure(sample, indent + 2, max_depth - 1)
    else:
        print(f"{prefix}{_type_label(obj)}: {_preview(obj)}")


"""
Returns a human-readable type label for a JSON value.
@param val - any JSON-compatible value
@returns type string like "str", "int", "list[3]", "dict{5 keys}"
@called-by _print_structure
"""
def _type_label(val: Any) -> str:
    if val is None:
        return "null"
    if isinstance(val, bool):
        return "bool"
    if isinstance(val, int):
        return "int"
    if isinstance(val, float):
        return "float"
    if isinstance(val, str):
        return "str"
    if isinstance(val, list):
        return f"list[{len(val)}]"
    if isinstance(val, dict):
        return f"dict{{{len(val)} keys}}"
    return type(val).__name__


"""
Returns a truncated string preview of a value for display.
@param val - any value
@param max_len - max output length
@returns truncated string representation
@called-by _print_structure
"""
def _preview(val: Any, max_len: int = 60) -> str:
    s = str(val)
    if len(s) > max_len:
        return s[: max_len - 3] + "..."
    return s


# --- Transform Mode ---


"""
Transforms raw Grubhub captures into Goober Eats schema JSON files.
Reads SCHOOL_ID from .env, processes each raw file, and writes per-eatery
output to data/parsed/. Prints a skipped-eatery summary to stdout at end.
@param price_unit - "cents" or "dollars"
@called-by main
"""
def _transform(price_unit: str) -> None:
    school_id = _load_school_id()
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        logger.warning("No files found in %s", RAW_DIR)
        return

    eateries: dict[str, dict] = {}
    skipped: list[dict] = []

    for filepath in files:
        try:
            envelope = _read_envelope(filepath)
            if envelope is None:
                continue

            body = envelope.get("response", {}).get("body", {})
            if not isinstance(body, dict):
                continue

            eatery = _extract_eatery(body, school_id)
            if eatery is None:
                continue

            items, groups = _extract_menu_items(body, price_unit)

            if not items:
                skipped.append({
                    "id": eatery.get("id", ""),
                    "name": eatery["name"],
                    "reason": "no menu items",
                })
                continue

            # Merge by name: the same restaurant can appear across multiple captures
            # (user browsed it on different sessions). We union the menu items so
            # no category page is missed. Distinct locations with the same name
            # would also merge here — acceptable given the single-campus dataset.
            key = eatery["name"]
            if key not in eateries:
                eateries[key] = {"eatery": eatery, "groups": [], "menu_items": []}

            existing_groups = set(eateries[key]["groups"])
            new_groups = [g for g in groups if g not in existing_groups]
            eateries[key] = {
                **eateries[key],
                "groups": eateries[key]["groups"] + new_groups,
                "menu_items": eateries[key]["menu_items"] + items,
            }
        except Exception as exc:
            skipped.append({"id": "", "name": filepath.name, "reason": str(exc)})
            logger.warning("Skipping %s — %s", filepath.name, exc)

    if not eateries:
        logger.warning("No eatery data extracted. Run --discover to inspect raw files.")
        _print_skipped(skipped)
        return

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    for name, data in eateries.items():
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        out_path = PARSED_DIR / f"{slug}.json"
        out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        logger.info(
            "Wrote %s — %d groups, %d items",
            out_path.name,
            len(data["groups"]),
            len(data["menu_items"]),
        )

    _print_skipped(skipped)


# --- Extraction (edit after --discover) ---


"""
Extracts eatery fields from a Grubhub API response body.

IMPORTANT: This is a placeholder mapping. After running --discover, update
the key paths to match the actual Grubhub Campus API response structure.

@param body - parsed JSON response body
@param school_id - UUID from .env
@returns eatery dict matching Goober Eats schema, or None if not an eatery response
@called-by _transform
"""
def _extract_eatery(body: dict, school_id: str) -> dict | None:
    # Common Grubhub keys to look for — adjust after discovery
    restaurant = body.get("restaurant") or body.get("restaurant_data") or body.get("data")
    if not isinstance(restaurant, dict):
        return None

    name = restaurant.get("name") or restaurant.get("restaurant_name")
    if not name or not isinstance(name, str):
        return None

    address_obj = restaurant.get("address", {})
    if isinstance(address_obj, dict):
        address = address_obj.get("street_address", "")
    elif isinstance(address_obj, str):
        address = address_obj
    else:
        address = ""

    if not address:
        logger.warning("Eatery %r has no address — using empty string", name)
        address = ""

    lat = _to_float(restaurant.get("latitude"))
    lng = _to_float(restaurant.get("longitude"))
    if lat is not None and not (-90 <= lat <= 90):
        logger.warning("Eatery %r has invalid latitude %s, setting to null", name, lat)
        lat = None
    if lng is not None and not (-180 <= lng <= 180):
        logger.warning("Eatery %r has invalid longitude %s, setting to null", name, lng)
        lng = None

    return {
        "id": str(restaurant.get("id", "")),
        "school_id": school_id,
        "name": name.strip(),
        "address": address.strip(),
        "image_url": restaurant.get("logo") or restaurant.get("image_url"),
        "delivery_time_label": restaurant.get("delivery_time_estimate"),
        "is_active": True,
        "latitude": lat,
        "longitude": lng,
    }


"""
Extracts menu items and their option groups from a Grubhub API response.

IMPORTANT: This is a placeholder mapping. After running --discover, update
the key paths to match the actual Grubhub Campus API response structure.

@param body - parsed JSON response body
@param price_unit - "cents" or "dollars"
@returns tuple of (menu_items list, group_names list)
@called-by _transform
"""
def _extract_menu_items(
    body: dict, price_unit: str
) -> tuple[list[dict], list[str]]:
    items: list[dict] = []
    groups: list[str] = []

    # Look for menu categories — adjust keys after discovery
    restaurant = body.get("restaurant") or body.get("restaurant_data") or body.get("data") or {}
    menu = restaurant.get("menu") or restaurant.get("menu_data") or {}
    categories = (
        restaurant.get("menu_category_list")
        or menu.get("menu_category_list")
        or menu.get("categories")
        or menu.get("menu_categories")
        or []
    )

    for sort_idx, category in enumerate(categories):
        if not isinstance(category, dict):
            continue

        group_name = category.get("name") or category.get("category_name") or f"Category {sort_idx}"
        groups.append(group_name)

        menu_items_list = (
            category.get("menu_item_list")
            or category.get("items")
            or category.get("menu_items")
            or []
        )

        for item_data in menu_items_list:
            if not isinstance(item_data, dict):
                continue

            item = _map_menu_item(item_data, group_name, price_unit)
            if item is not None:
                items.append(item)

    return items, groups


"""
Maps a single Grubhub menu item to the Goober Eats schema.
@param item_data - raw Grubhub menu item dict
@param group_name - the category/group this item belongs to
@param price_unit - "cents" or "dollars"
@returns mapped menu item dict, or None if invalid
@called-by _extract_menu_items
"""
def _map_menu_item(item_data: dict, group_name: str, price_unit: str) -> dict | None:
    name = item_data.get("name") or item_data.get("item_name")
    if not name or not isinstance(name, str):
        return None

    price_raw = _find_price(item_data)
    if price_raw is None:
        logger.warning("Skipping item %r — no price found", name)
        return None

    price_cents = _to_cents(price_raw, price_unit)
    if price_cents < 0:
        logger.warning("Skipping item %r — negative price %d", name, price_cents)
        return None

    image_url = item_data.get("image_url") or _build_image_url(item_data.get("media_image"))

    option_groups = _extract_option_groups(item_data, price_unit)

    return {
        "name": name.strip(),
        "group": group_name,
        "original_price_cents": price_cents,
        "market_price_cents": None,
        "image_url": image_url,
        "option_groups": option_groups,
    }


"""
Extracts option groups (modifiers/customizations) from a menu item.
@param item_data - raw Grubhub menu item dict
@param price_unit - "cents" or "dollars"
@returns list of option group dicts matching Goober Eats schema
@called-by _map_menu_item
"""
def _extract_option_groups(item_data: dict, price_unit: str) -> list[dict]:
    groups: list[dict] = []

    choice_categories = (
        item_data.get("choice_category_list")
        or item_data.get("modifiers")
        or item_data.get("option_groups")
        or []
    )

    for sort_idx, choice_cat in enumerate(choice_categories):
        if not isinstance(choice_cat, dict):
            continue

        group_name = choice_cat.get("name") or choice_cat.get("category_name") or f"Option {sort_idx}"

        min_choices = choice_cat.get("min_choice_options") or 0
        max_choices = choice_cat.get("max_choice_options")
        # null max means unlimited choices; treat as multiple
        selection_type = "single" if isinstance(max_choices, (int, float)) and max_choices <= 1 else "multiple"
        is_required = isinstance(min_choices, (int, float)) and min_choices >= 1

        options = _extract_options(choice_cat, price_unit)

        groups.append({
            "name": group_name,
            "selection_type": selection_type,
            "is_required": is_required,
            "sort_order": sort_idx,
            "options": options,
        })

    return groups


"""
Extracts individual options from a choice category.
@param choice_cat - raw Grubhub choice category dict
@param price_unit - "cents" or "dollars"
@returns list of option dicts matching Goober Eats schema
@called-by _extract_option_groups
"""
def _extract_options(choice_cat: dict, price_unit: str) -> list[dict]:
    options: list[dict] = []

    choice_list = (
        choice_cat.get("choice_option_list")
        or choice_cat.get("options")
        or choice_cat.get("choices")
        or []
    )

    for sort_idx, choice in enumerate(choice_list):
        if not isinstance(choice, dict):
            continue

        name = choice.get("description") or choice.get("name")
        if not name or not isinstance(name, str):
            continue

        price_raw = _find_price(choice)
        add_price_cents = _to_cents(price_raw, price_unit) if price_raw is not None else 0
        if add_price_cents < 0:
            add_price_cents = 0

        is_default = bool(choice.get("defaulted") or choice.get("is_default") or choice.get("default_selected"))

        options.append({
            "name": name.strip(),
            "additional_price_cents": add_price_cents,
            "is_default": is_default,
            "sort_order": sort_idx,
        })

    return options


# --- Utility Helpers ---


"""
Loads and validates SCHOOL_ID from .env file.
@returns validated UUID string
@called-by _transform
"""
def _load_school_id() -> str:
    load_dotenv()
    school_id = os.environ.get("SCHOOL_ID", "").strip()

    if not school_id:
        logger.error("SCHOOL_ID not set in .env")
        sys.exit(1)

    if not UUID_RE.match(school_id):
        logger.error("SCHOOL_ID is not a valid UUID: %s", school_id)
        sys.exit(1)

    return school_id


"""
Reads and parses a raw capture envelope file.
@param filepath - path to the JSON file
@returns parsed envelope dict, or None on error
@called-by _discover, _transform
"""
def _read_envelope(filepath: Path) -> dict | None:
    try:
        data = json.loads(filepath.read_text())
        if not isinstance(data, dict):
            logger.warning("Skipping %s — not a JSON object", filepath.name)
            return None
        return data
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Skipping %s — %s", filepath.name, exc)
        return None


"""
Searches common Grubhub price field locations in a dict.
@param obj - dict that may contain a price
@returns raw price value, or None if not found
@called-by _map_menu_item, _extract_options
"""
def _find_price(obj: dict) -> float | int | None:
    # Direct price field
    for key in ("price", "amount", "base_price"):
        val = obj.get(key)
        if isinstance(val, (int, float)):
            return val

    # Nested price object: { "price": { "amount": 1299 } }
    price_obj = obj.get("price")
    if isinstance(price_obj, dict):
        for key in ("amount", "value", "base_price"):
            val = price_obj.get(key)
            if isinstance(val, (int, float)):
                return val

    return None


"""
Converts a price value to cents.
@param value - raw price value
@param unit - "cents" or "dollars"
@returns integer price in cents
@called-by _map_menu_item, _extract_options
"""
def _to_cents(value: int | float, unit: str) -> int:
    if unit == "dollars":
        return round(float(value) * 100)
    return round(float(value))


"""
Safely traverses nested dicts by key sequence.
@param obj - root dict
@param keys - sequence of keys to traverse
@returns value at the nested path, or None
@called-by _map_menu_item
"""
def _nested_get(obj: dict, *keys: str) -> Any:
    current: Any = obj
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


"""
Converts a value to float, returning None on failure.
Handles string-encoded coordinates from the Tapingo API.
@param val - numeric, string, or None
@returns float, or None if conversion fails
@called-by _extract_eatery
"""
def _to_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


"""
Constructs a full Cloudinary image URL from a media_image dict.
@param media - dict with base_url, public_id, and format keys (or None)
@returns complete image URL string, or None if data is missing
@called-by _map_menu_item
"""
def _build_image_url(media: Any) -> str | None:
    if not isinstance(media, dict):
        return None
    base_url = media.get("base_url", "").rstrip("/")
    public_id = media.get("public_id", "")
    fmt = media.get("format", "jpg")
    if not base_url or not public_id:
        return None
    return f"{base_url}/{public_id}.{fmt}"


"""
Prints the skipped-eatery summary to stdout.
Always called at the end of _transform so callers can assert on it.
@param skipped - list of {id, name, reason} dicts
@called-by _transform
"""
def _print_skipped(skipped: list[dict]) -> None:
    print(f"\nSkipped eateries: {len(skipped)}")
    for entry in skipped:
        print(f"  id={entry['id'] or '?'}  name={entry['name']!r}  reason={entry['reason']}")


if __name__ == "__main__":
    main()
