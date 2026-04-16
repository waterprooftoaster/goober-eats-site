-- Add linked_menu_item_id to menu_item_options.
-- When an option's name matches an existing menu item in the same eatery,
-- this column stores that item's id so the cart can auto-add it as a
-- separate line item rather than pricing it as an add-on.

ALTER TABLE menu_item_options
  ADD COLUMN linked_menu_item_id uuid NULL
    REFERENCES menu_items(id) ON DELETE SET NULL;

CREATE INDEX idx_menu_item_options_linked_menu_item_id
  ON menu_item_options (linked_menu_item_id)
  WHERE linked_menu_item_id IS NOT NULL;
