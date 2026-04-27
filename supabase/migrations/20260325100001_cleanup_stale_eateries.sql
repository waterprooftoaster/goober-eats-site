-- Remove all seeded eateries except Joe's Pizza.
-- Cascading FKs on menu_items, menu_item_groups, etc. handle child rows.
-- Safe to run on empty databases (deletes 0 rows).

DELETE FROM public.eateries
WHERE name IN (
  'Sushi Palace',
  'Burger Barn',
  'Taco Fiesta',
  'Noodle House',
  'The Halal Guys',
  'Insomnia Cookies',
  'Boba Guys',
  'Mamoun''s Falafel',
  'NYU Palladium Dining',
  'Levain Bakery'
);
