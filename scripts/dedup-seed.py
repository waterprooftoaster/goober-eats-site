#!/usr/bin/env python3
"""
@file dedup-seed.py
@description Removes duplicate menu items (by name) from seed.ts.
  Called by: one-time manual run: python3 scripts/dedup-seed.py
"""

import re
import os

SEED_PATH = os.path.join(os.path.dirname(__file__), 'seed.ts')
MARKER = '"menu_items": ['


def dedup_menu_items(content: str) -> str:
    """
    Removes duplicate items within each "menu_items" array, keeping the first occurrence.
    @param content - Full text of seed.ts
    @returns Cleaned content with duplicates removed
    @called-by __main__
    """
    result = []
    pos = 0

    while pos < len(content):
        idx = content.find(MARKER, pos)
        if idx == -1:
            result.append(content[pos:])
            break

        # Append everything up to and including "menu_items": [
        result.append(content[pos:idx + len(MARKER)])
        pos = idx + len(MARKER)

        seen_names: set[str] = set()

        while pos < len(content):
            # Collect separator text (whitespace, commas) between items
            sep_start = pos
            while pos < len(content) and content[pos] in ' \n\r\t,':
                pos += 1
            separator = content[sep_start:pos]

            if pos >= len(content):
                result.append(separator)
                break

            if content[pos] == ']':
                # End of menu_items array
                result.append(separator + ']')
                pos += 1
                break

            if content[pos] == '{':
                item_start = pos
                depth = 0
                in_string = False
                string_char = ''
                in_block_comment = False

                while pos < len(content):
                    ch = content[pos]

                    if in_block_comment:
                        if ch == '*' and pos + 1 < len(content) and content[pos + 1] == '/':
                            pos += 2
                            in_block_comment = False
                        else:
                            pos += 1
                        continue

                    if in_string:
                        if ch == '\\':
                            pos += 2
                            continue
                        if ch == string_char:
                            in_string = False
                        pos += 1
                        continue

                    if ch == '/' and pos + 1 < len(content) and content[pos + 1] == '*':
                        in_block_comment = True
                        pos += 2
                        continue

                    if ch in ('"', "'"):
                        in_string = True
                        string_char = ch
                        pos += 1
                        continue

                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            pos += 1
                            break
                    pos += 1

                item_text = content[item_start:pos]
                # First "name": "..." in the item is the item name (not option group names)
                name_match = re.search(r'"name":\s*"([^"]+)"', item_text)
                name = name_match.group(1) if name_match else None

                if name and name in seen_names:
                    pass  # drop duplicate item and its preceding separator
                else:
                    if name:
                        seen_names.add(name)
                    result.append(separator + item_text)
            else:
                # Unexpected character — pass through
                result.append(separator + content[pos])
                pos += 1

    return ''.join(result)


if __name__ == '__main__':
    with open(SEED_PATH, 'r') as f:
        original = f.read()

    cleaned = dedup_menu_items(original)

    with open(SEED_PATH, 'w') as f:
        f.write(cleaned)

    removed = original.count('\n') - cleaned.count('\n')
    print(f'Done. Removed ~{removed} lines.')
