/**
 * @file seed.ts
 * @description Seeds the local Supabase database with all eatery and menu data.
 *   All data is hardcoded inline; no external JSON files required.
 *   Called by: npx tsx scripts/seed.ts
 * @dependencies @supabase/supabase-js
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Bootstrap env
// ---------------------------------------------------------------------------

try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
} catch {
  // .env.local not found — assume env vars are already exported
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedOption {
  name: string
  additional_price_cents: number
  is_default: boolean
  sort_order: number
}

interface ParsedOptionGroup {
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  sort_order: number
  options: ParsedOption[]
}

interface ParsedMenuItem {
  name: string
  group: string
  original_price_cents: number
  market_price_cents: number | null
  image_url: string | null
  option_groups: ParsedOptionGroup[]
}

interface ParsedEatery {
  eatery: {
    name: string
    address: string
    image_url: string | null
  }
  groups: string[]
  menu_items: ParsedMenuItem[]
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------

const EATERIES: ParsedEatery[] = [
  {
    "eatery": {
      "id": "-15157279",
      "school_id": "00000000-0000-0000-0000-000000000001",
      "name": "Flavor Lab by NYU Eats",
      "address": "6 MetroTech Center",
      "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/4ac/18f/5c1f9cc19138d5ffd50bad2565bccad3e6.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8a76358d203e.jpg",
      "delivery_time_label": null,
      "is_active": true,
      "latitude": 40.6947451,
      "longitude": -73.9856619
    },
    "groups": [
      "Smoked BBQ"
    ],
    "menu_items": [
      {
        "name": "Smoked BBQ Platter",
        "group": "Smoked BBQ",
        "original_price_cents": 1299,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d74/963/fe5acf33868a2636f2b02c57884e873e4c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/5f87d3a83da9.jpg",
        "option_groups": [
          {
            "name": "Protein",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Chipotle Black Bean Burger",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Cajun Chicken Quarters",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Chipotle Black Bean Burger",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Smoked Sides",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Coleslaw",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baked Beans",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Corn Bread",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Pickled Red Onion",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Cheese Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Garlic Broccoli",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Corn on the Cob",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Mac & Cheese",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Cauliflower Mac & Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Classic Mac and Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Fountain Beverage",
        "group": "Smoked BBQ",
        "original_price_cents": 229,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/a92/f20/767fbe510fe0c68dff188b426f4a22c56b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8f46821f40cf.jpg",
        "option_groups": []
      }
    ]
  },
  {
    "eatery": {
      "id": "-4483151",
      "school_id": "00000000-0000-0000-0000-000000000001",
      "name": "Palladium",
      "address": "140 E 14th St",
      "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/ea9/e8a/044c21a078bd7dd52ddfacbaaeac271b4b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6dde40606e50.jpg",
      "delivery_time_label": null,
      "is_active": true,
      "latitude": 40.7309461,
      "longitude": -73.9948067
    },
    "groups": [
      "One Sushi",
      "Sips"
    ],
    "menu_items": [
      {
        "name": "Salmon Avocado Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f07/755/7fb0a0d719b5335adb0dfeb6beebde825d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/cc348e9b09d7.jpg",
        "option_groups": []
      },
      {
        "name": "Avocado Cucumber Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/ef0/4fd/61042bc2fb402884f7aa20108e09e78999.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/2bc2684a151f.jpg",
        "option_groups": []
      },
      {
        "name": "Shrimp Tempura Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/870/8fd/2afc19e322dbf1b1e772d183fc50021151.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/67076a5bc9c4.jpg",
        "option_groups": []
      },
      {
        "name": "Tuna Avocado Roll",
        "group": "One Sushi",
        "original_price_cents": 879,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Spicy Salmon Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/754/17d/12a751153d1f32c48085dc7e3bc114387b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/0761dc4ee4ce.jpg",
        "option_groups": []
      },
      {
        "name": "Spicy Tuna Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d21/ae2/3d1451610401224dcf2e0b75d282065d87.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/380a06844df2.jpg",
        "option_groups": []
      },
      {
        "name": "California Roll",
        "group": "One Sushi",
        "original_price_cents": 929,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d76/6f9/71ce2eb2917c5deb8365bbc0a989a077e6.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3b2587923ab0.jpg",
        "option_groups": []
      },
      {
        "name": "Soy Roll",
        "group": "One Sushi",
        "original_price_cents": 1459,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Rainbow Roll",
        "group": "One Sushi",
        "original_price_cents": 1459,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Fire House Roll",
        "group": "One Sushi",
        "original_price_cents": 1459,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Edamame",
        "group": "One Sushi",
        "original_price_cents": 659,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/ff9/c8b/f7bab6fae3b86618218f9530c71342da9f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/a41b352c3faa.jpg",
        "option_groups": []
      },
      {
        "name": "Seaweed Salad",
        "group": "One Sushi",
        "original_price_cents": 659,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/5b3/167/0a7bc3f12dc3004b655c0301c1616b6815.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/71138e9caa86.jpg",
        "option_groups": []
      },
      {
        "name": "Triple Berry, 16 oz.",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/b61/c50/043a4f386e7a11d5f43aed5903fee6e643.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/1eea23fc3e53.jpg",
        "option_groups": [
          {
            "name": "Pick your Protein Booster",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Whey Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Whey Chocolate",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "NO BOOSTER",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Choco Boom, 16 oz.",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/7e9/9e6/815bc207e0574dec13c34f886d68672286.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/45aec159fa8d.jpg",
        "option_groups": [
          {
            "name": "Choose Your Toppings",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Blueberry",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Granola",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Coconut Flakes",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Pick your Protein Booster",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Whey Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Whey Chocolate",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "NO BOOSTER",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Skinny Greeny, 16oz.",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/6ee/071/468ad4ef65fac2a684ee23b193e437dcda.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/2499969e3416.jpg",
        "option_groups": [
          {
            "name": "Pick your Protein Booster",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Whey Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Whey Chocolate",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "NO BOOSTER",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Fruity Sunrise, 16oz.",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/831/1ba/c92bc950d831e9e8b348c09e720c9e1f16.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/c1c1538c3db8.jpg",
        "option_groups": [
          {
            "name": "Pick your Protein Booster",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Whey Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Whey Chocolate",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Vanilla",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "NO BOOSTER",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Green Tea Bubble Tea, 16oz",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/876/dfa/83f1f5a6333db31acf34b6881fe20fb338.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/1b03c0cd4660.jpg",
        "option_groups": [
          {
            "name": "Choose Your Toppings",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Blueberry",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Granola",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Coconut Flakes",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          }
        ]
      },
      {
        "name": "Thai Bubble Tea, 16oz",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/b97/e51/f29548a863d4735dd1826999e486575252.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/627321d670b4.jpg",
        "option_groups": [
          {
            "name": "Choose Your Toppings",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Blueberry",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Granola",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Coconut Flakes",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          }
        ]
      },
      {
        "name": "Acai Bowl",
        "group": "Sips",
        "original_price_cents": 1209,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": [
          {
            "name": "Choose Your Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Blueberry",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Granola",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Coconut Flakes",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          }
        ]
      },
      {
        "name": "Mango Bubble Tea",
        "group": "Sips",
        "original_price_cents": 939,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/301/2f7/a1822c3bf5d13ade412eae9e9f5ac2c66c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/320de643ace6.jpg",
        "option_groups": [
          {
            "name": "Choose Your Toppings",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Blueberry",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Granola",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Coconut Flakes",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "eatery": {
      "id": "-4483124",
      "school_id": "00000000-0000-0000-0000-000000000001",
      "name": "Upstein - Shareables, Cluckstein, Slidestein, Taqueria & Sushi",
      "address": "5-11 University Place",
      "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/e88/9aa/265ad32ade54ed540592ac79931d232a0c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/41e84dbc8d87.jpg",
      "delivery_time_label": null,
      "is_active": true,
      "latitude": 40.7309258,
      "longitude": -73.9947365
    },
    "groups": [
      "Shareables by NYU Eats",
      "Dining Deals",
      "CluckStein",
      "Taqueria",
      "Slidestein",
      "The One Sushi - Sushi, Dumplings, & Entrees",
      "Retail - Beverages",
      "Retail - Everyday Sides"
    ],
    "menu_items": [
      {
        "name": "Signature Breaded Chicken Wings",
        "group": "Shareables by NYU Eats",
        "original_price_cents": 6599,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/06f/591/ddc492244a752e2272662a916e75b0ab86.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6a1a1074bbe1.jpg",
        "option_groups": [
          {
            "name": "Size",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "25 Pieces",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "50 Pieces",
                "additional_price_cents": 4000,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Sauces",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Ranch",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Ranch",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "I would like Utensils, Napkins, Plates, & Serving Utensils",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "No, Thank You",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes, Please",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Signature Breaded Chicken Tenders",
        "group": "Shareables by NYU Eats",
        "original_price_cents": 6599,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d59/9bb/3ca8f8513350cd449a771afc0327e0d65d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8f043f540865.jpg",
        "option_groups": [
          {
            "name": "Size",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "25 Pieces",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "50 Pieces",
                "additional_price_cents": 4000,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Sauces",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Ranch",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Ranch",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "I would like Utensils, Napkins, Plates, & Serving Utensils",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "No, Thank You",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes, Please",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Beyond Vegan Chicken Tenders - VG",
        "group": "Shareables by NYU Eats",
        "original_price_cents": 6999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/e94/c72/797f8acbe3489f68458f9084294343054c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6d474a9f8d1a.jpg",
        "option_groups": [
          {
            "name": "Size",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "25 Pieces",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "50 Pieces",
                "additional_price_cents": 7000,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Sauces",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Ranch",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Ranch",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "I would like Utensils, Napkins, Plates, & Serving Utensils",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "No, Thank You",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes, Please",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Mediterranean Falafel Signature Salad - VG",
        "group": "Shareables by NYU Eats",
        "original_price_cents": 5499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/72a/5a4/3d8c59f94c8911b05128529cc24cbda830.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/37dce981576d.jpg",
        "option_groups": [
          {
            "name": "Size",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Full Pan",
                "additional_price_cents": 3000,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Half Pan",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "I would like Utensils, Napkins, Plates, & Serving Utensils",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No, Thank You",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes, Please",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Seasoned Spiral Fries - VG",
        "group": "Shareables by NYU Eats",
        "original_price_cents": 1999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/814/97a/746f6744b6536e6906683db4fa5372d285.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/296fdaf9ee33.jpg",
        "option_groups": [
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "BBQ Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Ranch",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Blue Cheese",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ketchup",
                "additional_price_cents": 399,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "I would like Utensils, Napkins, Plates, & Serving Utensils",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No, Thank You",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes, Please",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Fried Pickles w/ Dipping Sauce & Bubly",
        "group": "Dining Deals",
        "original_price_cents": 500,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/94f/bd8/d3232d05f898f2dcc9a20bb1bda053a02b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/ef3821af689f.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Mini Cheese Quesadilla, Rice, and Bubly",
        "group": "Dining Deals",
        "original_price_cents": 700,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/51e/166/46fc3d9314d8b9106f2920e8c69a97af52.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f2ace6e5d94f.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Signature Breaded Wings",
        "group": "CluckStein",
        "original_price_cents": 1099,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/273/d4c/a4d220cfec065d8eb663c33faa258019cf.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7aaba83fe877.jpg",
        "option_groups": [
          {
            "name": "Fried Extra Crispy",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Yes Extra Crispy",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Sauce",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Buffalo Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Wings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Signature Breaded Chicken Wings",
                "additional_price_cents": 149,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Pickle Chips - VG",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 6,
            "options": [
              {
                "name": "Pickle Chips - VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 7,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Signature Breaded Chicken Tender Sandwich",
        "group": "CluckStein",
        "original_price_cents": 999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/a26/b42/b912228efb9fd4063d6582e3c2172f56d2.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/219762da0b48.jpg",
        "option_groups": [
          {
            "name": "Sauce",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Buffalo Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Pickle Chips - VG",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Pickle Chips - VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Signature Garden Salad - VG",
        "group": "CluckStein",
        "original_price_cents": 599,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/257/c3e/4df6047c050adf3b6daf5076f15d5e7ca9.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/d6e0f512e2fb.jpg",
        "option_groups": [
          {
            "name": "Dressing",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Smoked Sriracha and Honey BBQ Sauce",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Dressing",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Protein Choice",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Signature Breaded Chicken Tenders",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Grilled Chicken Tenders - AG",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Buffalo Sauce",
                "additional_price_cents": 75,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Smoked Sriracha and Honey BBQ Sauce",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 75,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Jamaican Jerk Sauce",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 150,
                "is_default": false,
                "sort_order": 8
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Grilled Chicken Tender Sandwich",
        "group": "CluckStein",
        "original_price_cents": 999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/af9/738/609fd3ad050aa4e1e048813249fd164fac.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/cb474691ca53.jpg",
        "option_groups": [
          {
            "name": "Sauce",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Buffalo Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Pickle Chips - VG",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Pickle Chips - VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Grilled Chicken Tenders",
        "group": "CluckStein",
        "original_price_cents": 989,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/b3b/afb/3775b309efb00310c080da029cab15c206.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/c54754c6721c.jpg",
        "option_groups": [
          {
            "name": "Sauce",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Buffalo Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Add Grilled Chicken Tenders - AG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Grilled Chicken Tenders",
                "additional_price_cents": 229,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Pickle Chips - VG",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Pickle Chips - VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 6,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Beyond Vegan Chicken Tender Sandwich - VG",
        "group": "CluckStein",
        "original_price_cents": 999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/371/166/1b2c4a499c7921c8decb3bee0b759f85c5.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/4daf0cc7454d.jpg",
        "option_groups": [
          {
            "name": "Sauce",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Sauce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Extra Sauce",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Buffalo Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Honey Mustard Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ranch - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chunky Blue Cheese - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Garlic Parmesan Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Lemon Pepper Sauce - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Spicy Korean Sauce - VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Thai Sweet Chili Sauce - AG, VG",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add Pickle Chips - VG",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Pickle Chips - VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 0
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Tacos (3)",
        "group": "Taqueria",
        "original_price_cents": 999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/9ef/e8d/1a4d6314430de8c755b4d940ca01718784.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f0fa80658acf.jpg",
        "option_groups": [
          {
            "name": "Shell Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Soft Shell Corn Taco",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Hard Shell Corn Taco",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Soft Shell Flour Tortilla",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Choose Your Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Chorizo Crumble - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              }
            ]
          },
          {
            "name": "Taqueria Extras",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Tortilla Chips & Guacamole - AG, VG",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Side of Queso - AG, V",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Side of Guacamole - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Tortilla Chips & Queso - AG, V",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Tortilla Chips & Salsa Roja - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tortilla Chips & Pico De Gallo - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Tortilla Chips - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add on Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Vegan Chorizo Crumble - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 6,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Fajitas (Sauteed Peppers and Onions)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Lime Creme - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 7,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Bowl",
        "group": "Taqueria",
        "original_price_cents": 1099,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/aab/1d8/739a033d11e6fe13875d6f6694eb1367fb.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/16f2ab86caec.jpg",
        "option_groups": [
          {
            "name": "Bowl Base",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Cilantro Brown Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "No Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Choose Your Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Chorizo Crumble - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Taqueria Extras",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Tortilla Chips & Guacamole - AG, VG",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Side of Queso - AG, V",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Side of Guacamole - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Tortilla Chips & Queso - AG, V",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Tortilla Chips & Salsa Roja - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tortilla Chips & Pico De Gallo - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Tortilla Chips - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add on Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Vegan Chorizo Crumble - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 6,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Fajitas (Sauteed Peppers and Onions)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Lime Creme - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          }
        ]
      },
      {
        "name": "Loaded Mac & Cheese",
        "group": "Taqueria",
        "original_price_cents": 1099,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/a4d/f32/1cc1c9a50f6f85bd240604bd55c2b15686.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/0d0fd4810398.jpg",
        "option_groups": [
          {
            "name": "Choose Your Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Chorizo Crumble - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Guacamole",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Queso",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Corn Salsa",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Pico de Gallo",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Black Beans",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Sauteed Peppers and Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Salsa Roja",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Add on Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Vegan Chorizo Crumble - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Fajitas (Sauteed Peppers and Onions)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Lime Creme - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Taqueria Extras",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Tortilla Chips & Guacamole - AG, VG",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Side of Queso - AG, V",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Side of Guacamole - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Tortilla Chips & Queso - AG, V",
                "additional_price_cents": 450,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Tortilla Chips & Salsa Roja - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tortilla Chips & Pico De Gallo - AG, VG",
                "additional_price_cents": 275,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Tortilla Chips - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 6,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Build Your Own Classic Burrito",
        "group": "Taqueria",
        "original_price_cents": 1049,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/a67/4bd/be8d6096346c60af6ca20ea80cf39de728.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/20aa689af72b.jpg",
        "option_groups": [
          {
            "name": "Choose Your Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Chorizo Crumble - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              }
            ]
          },
          {
            "name": "Add on Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Vegan Chorizo Crumble - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Black Beans w/ Chipotle & Tomato - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Guacamole - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Shredded Cheese",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Shredded Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Queso - AG, V",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roasted Corn Salsa - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Fajitas (Sauteed Peppers and Onions)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Pico de Gallo - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Salsa Roja - AG, VG",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Lime Creme - AG, V",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Classic Quesadilla",
        "group": "Taqueria",
        "original_price_cents": 1049,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/29e/8d2/07b63f48013aeaa4a54ed2d5b95a4d5b30.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6150a8d36a61.jpg",
        "option_groups": [
          {
            "name": "Choose Your Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Chorizo Crumble - VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Modify Quesadilla",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "No Peppers & Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add on Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Vegan Chorizo Crumble - AG, VG",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Carnitas",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Seasoned Ground Beef",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chicken Al Pastor",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Jalapeno Cheeseburger",
        "group": "Taqueria",
        "original_price_cents": 1049,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/880/de1/b20c56c89c2502373fee25ba76ae0982d8.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3b27b54dba76.jpg",
        "option_groups": [
          {
            "name": "Choose Your Style",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Quesadilla",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Burrito",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Modify",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "No Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "No Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No 1000 Island Dressing",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Classic American Sliders",
        "group": "Slidestein",
        "original_price_cents": 989,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/5d2/472/0751cfb65675316c95fd93a01ee0a3717c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/60e83b035cdb.jpg",
        "option_groups": [
          {
            "name": "Modify",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "No Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "No Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Pickles",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Slider Add Ons",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Additional Slider",
                "additional_price_cents": 400,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Side of Pickle Chips - AG, VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Crispy Chicken Chipotle Sliders",
        "group": "Slidestein",
        "original_price_cents": 989,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/8dc/80a/d9f4504137db21a94901734c26a425c10d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6da6f8408051.jpg",
        "option_groups": [
          {
            "name": "Slider Add Ons",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Additional Slider",
                "additional_price_cents": 400,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Side of Pickle Chips - AG, VG",
                "additional_price_cents": 79,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add Seasoned Spiral Fries - VG",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Seasoned Spiral Fries - VG",
                "additional_price_cents": 409,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Seaweed Salad",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 689,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/ae4/66b/a19795fce58f325656d7f470b97781941d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/aa3e2f004c96.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Edamame",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 689,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/cd2/afb/81cc7a17ef7c3e0671d1d317a95d0018c8.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/d0a58cbbd47f.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Spicy Crab Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/337/36b/ef7e82dd37817eb07a4a88f4d90db543e0.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/899ab6ae72d5.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Spicy Tuna Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/737/f06/c2ea0bcfb4b086d1020ba4011e8b8db32e.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/a5fcb57ab607.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Shrimp Tempura Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f7b/f37/372e390ea5263c0eb44e0b963b37e36b4b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/b526d0e69ad5.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Avocado Cucumber Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/0cf/1be/bd9d27cef2eb699109120dce076036ea84.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/77ccd06a10a6.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "California Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d47/1f7/36f1dfa5d1bcfddaa7dfacaf79813be386.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/70a1fddb277d.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Egg Custard Bun",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 899,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Vegetable Spring Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 899,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/fab/2e4/e383f4802cf7310e14f1241cd290fc7043.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/13861989596d.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Salmon Avocado Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Firehouse Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/0db/86e/d3609ce684873d61acb3063cc317ff979d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8f4fa3dbc5db.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Red Dragon Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/321/4b6/c56d76522a54dc09b1d248889a7232e2a3.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/bd7a25c0d7e7.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Rainbow Roll",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/e39/4f6/c8557041929ef545c94ce65b8d507bd6fa.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/254bbcaa60c7.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Spicy Veggie Bowl",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/a97/56f/f199946af51cb2e13c9bb13e9135f11e9d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f3477131351e.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Tuna Salmon Poke Bowl",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/98e/bf7/853596924800cfd167030037667260fe8f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/977092980925.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Fried Pork Dumpling",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 899,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Fried  Vegetable Dumpling",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 899,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/e24/538/aa3beacbbd02ebadf8f0ebd4576565695e.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3894c595fbe9.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Shrimp Tempura Bowls",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/bdc/d59/51987fc2b522ba9a6804b1b47745c54780.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6628d4d663a8.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "BBQ Chicken and White Rice",
        "group": "The One Sushi - Sushi, Dumplings, & Entrees",
        "original_price_cents": 1461,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/fa7/b82/8c664ddaa9fa230af435050f0b747efce8.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/b951a12e3ece.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 259,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 159,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Banana",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Apple",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Bubly",
        "group": "Retail - Beverages",
        "original_price_cents": 159,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/677/828/02a22b6b0b53432ca1a74718be2cca4b43.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/96748fbc345f.jpg",
        "option_groups": []
      },
      {
        "name": "Self-Serve Fountain Beverage",
        "group": "Retail - Beverages",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/528/22b/eace772ea5e7af4a68b878298a8da327b9.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/28bdd7f5fc04.jpg",
        "option_groups": []
      },
      {
        "name": "Fountain Lemonade",
        "group": "Retail - Beverages",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/de2/991/238a27d45947e472ed38d41bfd58f59182.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6d2a8791f68a.jpg",
        "option_groups": []
      },
      {
        "name": "Peace Tea",
        "group": "Retail - Beverages",
        "original_price_cents": 299,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/c05/46e/c2d3b9eca94126d7394d45980b20aaf5fb.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3f3823be9870.jpg",
        "option_groups": []
      },
      {
        "name": "Coke, 20oz. Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/12c/5a9/ff928c3ad436131a258c536900678d6277.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/12bd40a3b311.jpg",
        "option_groups": []
      },
      {
        "name": "Coke Zero Sugar, 20oz. Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f8d/7e4/0eff6c33aace2e2ea512da9b84d38fe286.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/4783e3654d4c.jpg",
        "option_groups": []
      },
      {
        "name": "Sprite, 20oz Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/78d/ae7/b10e179880655133f3d53e3e9923552d57.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f2f317314f1e.jpg",
        "option_groups": []
      },
      {
        "name": "Bag of Chips",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/569/922/50be1510f691e345b2237284e28803db1f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/1feae16941af.jpg",
        "option_groups": []
      },
      {
        "name": "Banana",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 129,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/28c/a0b/84346e3e8de9fb17ed502d7a98d9e16a01.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f63c353137fe.jpg",
        "option_groups": []
      },
      {
        "name": "Orange",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 139,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/55f/9b9/adb1840c7557bbc2529e0be1285a4b6307.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7d757dd51045.jpg",
        "option_groups": []
      },
      {
        "name": "Apple",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 139,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/9cd/29c/ba0f44eb1b20a1a14f7f2c22200afac3af.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/761ef207d5b3.jpg",
        "option_groups": []
      }
    ]
  },
  {
    "eatery": {
      "id": "-19515197",
      "school_id": "00000000-0000-0000-0000-000000000001",
      "name": "Upstein - Vedge Craft & Smoothie Lab",
      "address": "5-11 University Place",
      "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/948/d2b/21732da1eaa05010b816247405e3199696.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/65d8e38dbc7b.jpg",
      "delivery_time_label": null,
      "is_active": true,
      "latitude": 40.730940338774,
      "longitude": -73.99481966144745
    },
    "groups": [
      "Vedge Craft",
      "Smoothie Lab",
      "Desserts",
      "Retail - Everyday Sides",
      "Retail - Beverages"
    ],
    "menu_items": [
      {
        "name": "Create Your Own Bowl - AG",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/024/7fc/fc449f1c734b6c804bb0ee14c5afba9893.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6d18366be683.jpg",
        "option_groups": [
          {
            "name": "Base (Vegan)",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "No Base",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Toppings ",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Dressing",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Side Items",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drinks",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "No Drink",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 7,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 8,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 9,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 10,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          }
        ]
      },
      {
        "name": "Grilled Lemon and Herb Marinated Tofu Signature Bowl - AG, V",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/bd9/326/5d447227cdb785aff7c0b9fad21432d54d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/685d745cada7.jpg",
        "option_groups": [
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Mediterranean Falafel Signature Bowl - AG, VG",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/37c/9af/32369ac24db587ae3e2a42de0bc163de07.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/0a25e468114a.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          }
        ]
      },
      {
        "name": "Roasted Greek Vegetable Bowl - AG, V",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/5fc/5c0/8aa03263cd707e0f598bc8b0e55479ded4.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/a648f0f2fc0d.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Vegan Poke Bowl - AG, VG",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/8ba/1e3/0f2c0f6025368eafe6303b4cf16bf39ed4.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7f0e3a2d8108.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 4,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Grilled BBQ Portobello Mushroom Signature Bowl - AG, VG",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/179/9d5/74b72dd7714dde2b5cf3680735c10a9cf9.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/22785a15fb78.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Signature Bowl Combo",
        "group": "Vedge Craft",
        "original_price_cents": 1625,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": [
          {
            "name": "Bowl",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Grilled Lemon and Herb Marinated Tofu Bowl",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "VedgeCraft Buddha Bowl",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Mediterranean Falafel Bowl",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Roasted Greek Vegetable Bowl",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Poke Bowl",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Sides",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Apple",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Sandwiches",
        "group": "Vedge Craft",
        "original_price_cents": 999,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/89f/a51/c1997a71f337b7071ef45e8eb3bc1ff1d2.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f2c56a9a7e49.jpg",
        "option_groups": [
          {
            "name": "Variety",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Greek Falafel Wrap - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Balsamic Mushroom Wrap - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Chorizo Wrap - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drinks",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "No Drink",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Sandwich Combo",
        "group": "Vedge Craft",
        "original_price_cents": 1259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/664/222/1e39fd51b6abb199f2944722ba79e990c0.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/411732383393.jpg",
        "option_groups": [
          {
            "name": "Sandwich",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Greek Falafel Wrap - AG, V",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Balsamic Mushroom Wrap - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Chorizo Wrap - AG, VG",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Drink",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Sides",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Orange",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Apple",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Chips",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Caprese Chickpea Pasta Salad Bowl - Limited Time Offer",
        "group": "Vedge Craft",
        "original_price_cents": 1159,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/e2e/70b/55359b970e77512ccafd34e7de032aa1eb.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/905979215c41.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          }
        ]
      },
      {
        "name": "Spicy Sweet Potato & Baby Kale Bowl - AG, VG",
        "group": "Vedge Craft",
        "original_price_cents": 1249,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/865/f2b/744a06e563c50d7f4a4c3c7da68177a8c1.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/637b5bd29181.jpg",
        "option_groups": [
          {
            "name": "Base (Vegan)",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "No Base",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 300,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Toppings ",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Dressing",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 9
              }
            ]
          },
          {
            "name": "Side Items",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Bag of Chips",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Side",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Drinks",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 5,
            "options": [
              {
                "name": "Fountain Beverage",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Bubly",
                "additional_price_cents": 119,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "20 oz Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz Coke Zero",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "No Drink",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 6,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add Extra Base",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 7,
            "options": [
              {
                "name": "Baby Kale Blend",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Baby Spinach",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Baby Arugula",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Red Quinoa",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Basmati Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Brown Rice",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Chopped Romaine Lettuce",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Add Extra Protein",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 8,
            "options": [
              {
                "name": "Roasted Sweet Potato (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Shawarma Spiced PAOW",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Falafel (Vegan)",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Marinated Tofu",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Cauliflower",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Soy Marinated Portobello Mushrooms",
                "additional_price_cents": 200,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add Extra Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 9,
            "options": [
              {
                "name": "Blistered Grape Tomatoes (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Roasted Red Peppers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Black Beans (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Cucumbers (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Tomato Parsely Salad (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Curry Roasted Chickpeas (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Grilled Scallions (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Avocado (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Feta Cheese",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Pickled Red Onion (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 10
              },
              {
                "name": "Hummus (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 11
              },
              {
                "name": "Kalamata Olives",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 12
              },
              {
                "name": "Shredded Carrots",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 13
              },
              {
                "name": "Roasted Corn (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 14
              },
              {
                "name": "Pickled Purple Cabbage (vegan)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 15
              },
              {
                "name": "Roasted Sunflower Seeds (vegan)",
                "additional_price_cents": 49,
                "is_default": false,
                "sort_order": 16
              }
            ]
          },
          {
            "name": "Add Extra Dressing",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 10,
            "options": [
              {
                "name": "Tahini Oregano Vinaigrette",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Olive Oil (Vegan/Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Vegan Tzatziki Sauce (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Fresh Lemon Juice",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Vegan Green Goddess Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Vegan Chipotle Lime Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Vegan Orange Balsamic Vinaigrette (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "Avocado Tzatziki & Lemon Dressing",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "Vegan Ranch Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Vegan Carrot Ginger Dressing (Avoiding Gluten)",
                "additional_price_cents": 100,
                "is_default": false,
                "sort_order": 9
              }
            ]
          }
        ]
      },
      {
        "name": "Strawberry Banana",
        "group": "Smoothie Lab",
        "original_price_cents": 1059,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/717/72e/5776431fbb2fbb50a44554a899c3c61be1.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6ab4e44311d7.jpg",
        "option_groups": [
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Boost",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Whey Protein",
                "additional_price_cents": 369,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Mango Refresher",
        "group": "Smoothie Lab",
        "original_price_cents": 1059,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/831/1ba/c92bc950d831e9e8b348c09e720c9e1f16.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/c1c1538c3db8.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Boost",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Whey Protein",
                "additional_price_cents": 369,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Pineapple Mango",
        "group": "Smoothie Lab",
        "original_price_cents": 1059,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/bde/874/c50aa364eb0ddfcf30817e485839468e11.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/692cf582f0b8.jpg",
        "option_groups": [
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add a Snack",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Banana",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Apple",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Orange",
                "additional_price_cents": 109,
                "is_default": false,
                "sort_order": 2
              }
            ]
          },
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          },
          {
            "name": "Boost",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 3,
            "options": [
              {
                "name": "Whey Protein",
                "additional_price_cents": 369,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Going Green",
        "group": "Smoothie Lab",
        "original_price_cents": 1059,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/970/d79/9b100cff25fa3a0b40c38fd9fd56b4879f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/14b3b369cfca.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Boost",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Whey Protein",
                "additional_price_cents": 369,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Acai Berry Kale",
        "group": "Smoothie Lab",
        "original_price_cents": 1109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/7e1/5d7/9cd97aa4d629431007d9e10b9c8f2efcd2.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/066fbcb2595e.jpg",
        "option_groups": [
          {
            "name": "Add a Beverage",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "No Beverage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Fountain Drink",
                "additional_price_cents": 189,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Fountain Lemonade",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Gold Peak Sweet Tea 18.5oz",
                "additional_price_cents": 319,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "20 oz. Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "20 oz. Diet Coke",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "20 oz. Coke Zero Sugar",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "20 oz. Sprite",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 7
              },
              {
                "name": "20oz. Dasani Water",
                "additional_price_cents": 289,
                "is_default": false,
                "sort_order": 8
              },
              {
                "name": "Red Bull 8oz. Original",
                "additional_price_cents": 389,
                "is_default": false,
                "sort_order": 9
              },
              {
                "name": "Red Bull 12oz. Original",
                "additional_price_cents": 519,
                "is_default": false,
                "sort_order": 10
              }
            ]
          },
          {
            "name": "Bag Choice",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Yes Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "No Bag",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Boost",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Whey Protein",
                "additional_price_cents": 369,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Flourless Chocolate Cake - AG, V",
        "group": "Desserts",
        "original_price_cents": 589,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/00f/c3e/4f033727eaec28fe4f90f1f7d14c3d7f06.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/82953c869f13.jpg",
        "option_groups": []
      },
      {
        "name": "Chocolate Mousse Cup - AG, V",
        "group": "Desserts",
        "original_price_cents": 499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d34/b83/80a8d88498ec7b92ee01e356eae15a9e00.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/04592df4995d.jpg",
        "option_groups": []
      },
      {
        "name": "Apples w/ Cinnamon & Cream Cup - AG, V",
        "group": "Desserts",
        "original_price_cents": 499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/5eb/883/8c1f8d3b5e223a369beb5e15593bae1772.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f1c44caa7be5.jpg",
        "option_groups": []
      },
      {
        "name": "GF Chocolate Chip Cookie - AG, V",
        "group": "Desserts",
        "original_price_cents": 349,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/747/90d/298b5caa04f4f0c520a6e7d146a96ae440.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/5afcf167e47f.jpg",
        "option_groups": []
      },
      {
        "name": "GF Chocolate Chip Brownie - AG, V",
        "group": "Desserts",
        "original_price_cents": 349,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/034/0e8/0acc58e9a0fb1fd3214ba5238ec51c294b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/03805c3d1c21.jpg",
        "option_groups": []
      },
      {
        "name": "Bag of Chips",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/4b3/20d/f403b963e061fa4f5c1e3de7dbdd14c295.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8071a73862cb.jpg",
        "option_groups": []
      },
      {
        "name": "Banana",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/28c/a0b/84346e3e8de9fb17ed502d7a98d9e16a01.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f63c353137fe.jpg",
        "option_groups": []
      },
      {
        "name": "Orange",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/55f/9b9/adb1840c7557bbc2529e0be1285a4b6307.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7d757dd51045.jpg",
        "option_groups": []
      },
      {
        "name": "Apple",
        "group": "Retail - Everyday Sides",
        "original_price_cents": 109,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/9cd/29c/ba0f44eb1b20a1a14f7f2c22200afac3af.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/761ef207d5b3.jpg",
        "option_groups": []
      },
      {
        "name": "Bubly",
        "group": "Retail - Beverages",
        "original_price_cents": 149,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/677/828/02a22b6b0b53432ca1a74718be2cca4b43.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/96748fbc345f.jpg",
        "option_groups": []
      },
      {
        "name": "Self-Serve Fountain Beverage",
        "group": "Retail - Beverages",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/528/22b/eace772ea5e7af4a68b878298a8da327b9.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/28bdd7f5fc04.jpg",
        "option_groups": []
      },
      {
        "name": "Fountain Lemonade",
        "group": "Retail - Beverages",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/de2/991/238a27d45947e472ed38d41bfd58f59182.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6d2a8791f68a.jpg",
        "option_groups": []
      },
      {
        "name": "Peace Tea",
        "group": "Retail - Beverages",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/c05/46e/c2d3b9eca94126d7394d45980b20aaf5fb.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3f3823be9870.jpg",
        "option_groups": []
      },
      {
        "name": "Coke, 20oz. Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 279,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/12c/5a9/ff928c3ad436131a258c536900678d6277.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/12bd40a3b311.jpg",
        "option_groups": []
      },
      {
        "name": "Coke Zero Sugar, 20oz. Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 279,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f8d/7e4/0eff6c33aace2e2ea512da9b84d38fe286.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/4783e3654d4c.jpg",
        "option_groups": []
      },
      {
        "name": "Sprite, 20oz Bottle",
        "group": "Retail - Beverages",
        "original_price_cents": 279,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/78d/ae7/b10e179880655133f3d53e3e9923552d57.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f2f317314f1e.jpg",
        "option_groups": []
      }
    ]
  },
  {
    "eatery": {
      "id": "-3441887",
      "school_id": "00000000-0000-0000-0000-000000000001",
      "name": "Jasper Kane Cafe - Shareables, Grill, Sushi & Deli",
      "address": "6 Metrotech Center",
      "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/325/4b7/46919431ab26870c8a59eeed2337828f6c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8ae286e6cee2.jpg",
      "delivery_time_label": null,
      "is_active": true,
      "latitude": 40.6945309,
      "longitude": -73.986125
    },
    "groups": [
      "All Day Breakfast",
      "Burger 718 Grill",
      "Sushi",
      "Jay St Subs",
      "Drinks"
    ],
    "menu_items": [
      {
        "name": "Vegetable Omelete",
        "group": "All Day Breakfast",
        "original_price_cents": 599,
        "market_price_cents": null,
        "option_groups": [],
        "image_url": null
      },
      {
        "name": "Meat Omelete",
        "group": "All Day Breakfast",
        "original_price_cents": 699,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/7cd/2f5/79453d9f886e218c0fa254ff8b8c5eb82b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/eb0ae11f1c78.jpg",
        "option_groups": [
          {
            "name": "Meat",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Pork Sausage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pork Bacon",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Ham",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Turkey Sausage",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Turkey Bacon",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Add-ons",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Peppers",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Spinach",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Mushrooms",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Cheddar Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "No add-ins",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          }
        ]
      },
      {
        "name": "Sausage Egg & Cheese On a Roll",
        "group": "All Day Breakfast",
        "original_price_cents": 529,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/906/f8e/5c3ac8a57be6862d7754806d04405c9b0f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/2cd20464371b.jpg",
        "option_groups": []
      },
      {
        "name": "Bacon Egg & Cheese On a Roll",
        "group": "All Day Breakfast",
        "original_price_cents": 529,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/53f/d9e/fdf9138c04fc1130373c9964c1818c3344.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/4f9adff9c6ae.jpg",
        "option_groups": []
      },
      {
        "name": "Egg & Cheese On a Roll",
        "group": "All Day Breakfast",
        "original_price_cents": 629,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/862/c53/cac85ac4baf41a112bc36995149018915b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/2130572e58c2.jpg",
        "option_groups": []
      },
      {
        "name": "Egg White Scramble",
        "group": "All Day Breakfast",
        "original_price_cents": 499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/4f3/b46/61d33f6c51fb439f5d8d98938d7b3af036.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f4f67796139f.jpg",
        "option_groups": []
      },
      {
        "name": "Scrambled Eggs",
        "group": "All Day Breakfast",
        "original_price_cents": 169,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/37c/787/b3b6383b37a781f525798c6ed887510bbe.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/840ce90c4f35.jpg",
        "option_groups": []
      },
      {
        "name": "Hash Browns",
        "group": "All Day Breakfast",
        "original_price_cents": 209,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/b8b/8f5/1c953cc8bb8587e261bd878006056ed23a.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/cf0730264fa9.jpg",
        "option_groups": []
      },
      {
        "name": "Egg White Omelete",
        "group": "All Day Breakfast",
        "original_price_cents": 499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/d2c/004/c3bf1166d1eb87c3038a8349e115f71f12.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/eb808580b7f1.jpg",
        "option_groups": []
      },
      {
        "name": "Plain Egg Omelete",
        "group": "All Day Breakfast",
        "original_price_cents": 499,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/736/473/0d4f75a836de58923ed768cc6929b19fe9.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/49bf7cf9fd3c.jpg",
        "option_groups": []
      },
      {
        "name": "Turkey Sausage",
        "group": "All Day Breakfast",
        "original_price_cents": 205,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/618/4af/2a2ff0d91a2abcbd82acaa90619593ed68.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8b9c38859d8d.jpg",
        "option_groups": []
      },
      {
        "name": "Pork Sausage",
        "group": "All Day Breakfast",
        "original_price_cents": 199,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/30b/451/f92635cef282db0e0fb521233bf1cf8b77.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/5ec68dac7342.jpg",
        "option_groups": []
      },
      {
        "name": "Turkey Bacon",
        "group": "All Day Breakfast",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/874/373/829a0b1d0041e6faf019e91bca031feebd.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/36e956a1b6e3.jpg",
        "option_groups": []
      },
      {
        "name": "Pork Bacon",
        "group": "All Day Breakfast",
        "original_price_cents": 259,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/07a/013/56bad200244bfe49058930e9f2dfe6c57d.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6723fe2187c0.jpg",
        "option_groups": []
      },
      {
        "name": "Hand Smashed Burger",
        "group": "Burger 718 Grill",
        "original_price_cents": 909,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/8cd/0ce/a5c975d131a281d57dd6edcb19c6ca2b34.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/dfa289e734f3.jpg",
        "option_groups": [
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pickles",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add-on",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Dill Pickle",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Hand Smashed Cheese Burger",
        "group": "Burger 718 Grill",
        "original_price_cents": 989,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/0d0/6e5/1df18c72d42639d9f660ab2c861562aa2c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/00efbfac1bd9.jpg",
        "option_groups": [
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pickles",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add-on",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Dill Pickle",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Impossible Burger",
        "group": "Burger 718 Grill",
        "original_price_cents": 1159,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f34/a0e/bdd055257ee803bfc799440aa21091a944.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/8f238e8545e6.jpg",
        "option_groups": [
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Pickles",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              }
            ]
          },
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Add-on",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 2,
            "options": [
              {
                "name": "Dill Pickle",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              }
            ]
          }
        ]
      },
      {
        "name": "Crispy Chicken Sandwich",
        "group": "Burger 718 Grill",
        "original_price_cents": 759,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/025/133/43263f713c70fd05f9a0242089a3f09bb0.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/0df59d303d1b.jpg",
        "option_groups": [
          {
            "name": "Customize",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Pickle",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Mayo",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Ketcup",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Make it a Combo?",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "No",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Yes",
                "additional_price_cents": 299,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Chicken Tenders 3pc",
        "group": "Burger 718 Grill",
        "original_price_cents": 759,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/fb7/a7b/d72f0d331779d7ce067b74a90c8f20a03b.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/6c5e5f3fce10.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Onion Rings",
        "group": "Burger 718 Grill",
        "original_price_cents": 559,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/88e/1e2/aeba0b6d2c114dcd85c12562890ea992b3.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/e0aba55ff412.jpg",
        "option_groups": []
      },
      {
        "name": "Chicken Tenders 5pc",
        "group": "Burger 718 Grill",
        "original_price_cents": 969,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/9a2/1f5/d769bbd64f91c0d24e049e0a0c58ba8f51.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/d168a1c0b39a.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          }
        ]
      },
      {
        "name": "Hot Dog",
        "group": "Burger 718 Grill",
        "original_price_cents": 399,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/8db/2dc/abfc5bec7fcd8ef64452a7d620c428ad25.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3bbd1dc437fb.jpg",
        "option_groups": [
          {
            "name": "Side",
            "selection_type": "single",
            "is_required": false,
            "sort_order": 0,
            "options": [
              {
                "name": "French Fries",
                "additional_price_cents": 479,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Onion Rings",
                "additional_price_cents": 559,
                "is_default": false,
                "sort_order": 1
              }
            ]
          },
          {
            "name": "Extras",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 1,
            "options": [
              {
                "name": "Relish",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Push Cart Onions",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Saurkraut",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              }
            ]
          }
        ]
      },
      {
        "name": "French Fries",
        "group": "Burger 718 Grill",
        "original_price_cents": 479,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/00e/118/41b16ec4bbf049256347e536dda9883106.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/33da56049286.jpg",
        "option_groups": []
      },
      {
        "name": "California Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/8d5/e78/cb657b6da380da6e2da110f1e56407f602.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/ff32096f6ef9.jpg",
        "option_groups": []
      },
      {
        "name": "Avocado Cucumber Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/455/fac/e29c410eac87237dd37a00618f8667532f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/5570d4a4f8ae.jpg",
        "option_groups": []
      },
      {
        "name": "Spicy Tuna Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/098/ae2/4a1e6a38c3f0d35ac69f36673655ee5d3a.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/2ecc4d9e1878.jpg",
        "option_groups": []
      },
      {
        "name": "Spicy Salmon Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Tuna Avocado Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Shrimp Tempura Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/be7/63b/ae14210b472b7805dc4365631a71017df0.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7517e4e3c710.jpg",
        "option_groups": []
      },
      {
        "name": "Salmon Avocado Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/78f/40a/31e03d8d012754807d61aab37c57523d87.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/7e7442869e87.jpg",
        "option_groups": []
      },
      {
        "name": "Spicy Crab Roll",
        "group": "Sushi",
        "original_price_cents": 979,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/def/8e2/31c4fdc8b079e6ad9f5efa365a77d6611f.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/cbeaa0a2aff7.jpg",
        "option_groups": []
      },
      {
        "name": "Seaweed Salad",
        "group": "Sushi",
        "original_price_cents": 689,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f03/ea5/7e60d71c722934eb359dae17861c8d6d7c.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f9a0d5f91dd7.jpg",
        "option_groups": []
      },
      {
        "name": "Edamame",
        "group": "Sushi",
        "original_price_cents": 689,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/693/0c9/985728a782f2149fb137a61791cfdb75d7.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f7299859e366.jpg",
        "option_groups": []
      },
      {
        "name": "Red Dragon Roll",
        "group": "Sushi",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Rainbow Roll",
        "group": "Sushi",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/86d/bbc/6f11b4c4d761f9ab0933793a7b4e2976ea.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/140a5196c0b4.jpg",
        "option_groups": []
      },
      {
        "name": "Fire House Roll",
        "group": "Sushi",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/9dd/521/770b2e16248a6a8e7d24df661580709a30.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/cda7c570a413.jpg",
        "option_groups": []
      },
      {
        "name": "Soy Roll",
        "group": "Sushi",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Sushi Sampler",
        "group": "Sushi",
        "original_price_cents": 1539,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Tuna Salmon Poke Bowl",
        "group": "Sushi",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/f09/9f7/3f3cd637a35964e76364283225d9edc1c3.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/ca42e8b93248.jpg",
        "option_groups": []
      },
      {
        "name": "Shrimp Tempura Poke Bowl",
        "group": "Sushi",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Veggie Poke Bowl",
        "group": "Sushi",
        "original_price_cents": 1649,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Create Your Own Sandwich",
        "group": "Jay St Subs",
        "original_price_cents": 1069,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/b67/c49/602ff7d14f02ba820950d13cc1e34238ad.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/27da684f40d7.jpg",
        "option_groups": [
          {
            "name": "Bread",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 0,
            "options": [
              {
                "name": "Kaiser Bun",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Multigrain Bread",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Whole Wheat Bread",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "White Bread",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Plain Wrap",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Spinach Wrap",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "6 inch Hero",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Protein",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 1,
            "options": [
              {
                "name": "Classic Hummus",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "House Tuna Salad",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Genoa Salami",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Sliced Smoked Ham",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Sliced Turkey Breast",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Roast Beef",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "No Protein",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              }
            ]
          },
          {
            "name": "Cheese",
            "selection_type": "single",
            "is_required": true,
            "sort_order": 2,
            "options": [
              {
                "name": "Swiss Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Cheddar Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "American Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Provolone",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "No Cheese",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              }
            ]
          },
          {
            "name": "Toppings",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 3,
            "options": [
              {
                "name": "Red Onion",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Tomato",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Lettuce",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Jalapeno Pepper",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Green Bell Pepper",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "Cucumber",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              },
              {
                "name": "Roasted Pepper",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 6
              },
              {
                "name": "No Toppings",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 7
              }
            ]
          },
          {
            "name": "Condiments",
            "selection_type": "multiple",
            "is_required": true,
            "sort_order": 4,
            "options": [
              {
                "name": "Harissa Aioli",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Russian Dressing",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Honey Mustard",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Deli Mustard",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 3
              },
              {
                "name": "Mayo",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 4
              },
              {
                "name": "No Condiments",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 5
              }
            ]
          },
          {
            "name": "Add-ons",
            "selection_type": "multiple",
            "is_required": false,
            "sort_order": 5,
            "options": [
              {
                "name": "House Fried Potato Chips",
                "additional_price_cents": 139,
                "is_default": false,
                "sort_order": 0
              },
              {
                "name": "Dill Pickle Spear",
                "additional_price_cents": 0,
                "is_default": false,
                "sort_order": 1
              },
              {
                "name": "Extra Cheese",
                "additional_price_cents": 209,
                "is_default": false,
                "sort_order": 2
              },
              {
                "name": "Extra Meat",
                "additional_price_cents": 419,
                "is_default": false,
                "sort_order": 3
              }
            ]
          }
        ]
      },
      {
        "name": "Lay's Potato Chips",
        "group": "Jay St Subs",
        "original_price_cents": 139,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/69e/b11/bcb8820163f103531f74cd72c713cbe198.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/3d4f5a7d6337.jpg",
        "option_groups": []
      },
      {
        "name": "Fountain Drink",
        "group": "Drinks",
        "original_price_cents": 239,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/dfc/d1d/6c004ddd22befe121802594afa49dd0e33.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/0131c0775f6f.jpg",
        "option_groups": []
      },
      {
        "name": "20 oz. Coca Cola",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/89b/ff2/c7b23a019e5af1d5f8a6e0230b57d2a462.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/f779c8cc1269.jpg",
        "option_groups": []
      },
      {
        "name": "20 oz. Seagrams Ginger Ale",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "20 oz. Orange Fanta",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "20 oz. Sprite",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "20 oz. Pepsi",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/45f/3c4/a59934a3e7380da144f5150ddd75f58045.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/caf7b3ffc382.jpg",
        "option_groups": []
      },
      {
        "name": "20 oz. Pepsi Zero",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "20 oz. Diet Pepsi",
        "group": "Drinks",
        "original_price_cents": 289,
        "market_price_cents": null,
        "image_url": /* https://media-cdn.grubhub.com/image/upload/tapingo-shops-assets/media/images/48d/c37/2eba1ef1efaf5e894145541e3ab181ecb5.jpg */ "http://127.0.0.1:54351/storage/v1/object/public/menu-images/387a50c2641b.jpg",
        "option_groups": []
      },
      {
        "name": "Gatorade Orange",
        "group": "Drinks",
        "original_price_cents": 299,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Gatorade Fruit Punch",
        "group": "Drinks",
        "original_price_cents": 299,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Vitamin Water - Topical Mango Refresh",
        "group": "Drinks",
        "original_price_cents": 319,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Vitamin Water - Focus - Kiwi Strawberry",
        "group": "Drinks",
        "original_price_cents": 319,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Vitamin Water - XXX - Acai Blueberry Pomegranate",
        "group": "Drinks",
        "original_price_cents": 319,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Gold Peak Sweetened Green Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Gold Peak Raspberry Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Pure Leaf Lemon Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Pure Leaf Raspberry Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Pure Leaf Extra Sweet Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Pure Leaf Sweet Tea",
        "group": "Drinks",
        "original_price_cents": 339,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Starbucks Coffee Frappuccino",
        "group": "Drinks",
        "original_price_cents": 539,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Starbucks Caramel Frappuccino",
        "group": "Drinks",
        "original_price_cents": 539,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      },
      {
        "name": "Naked Juice Green Machine",
        "group": "Drinks",
        "original_price_cents": 729,
        "market_price_cents": null,
        "image_url": null,
        "option_groups": []
      }
    ]
  }
]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  // Upsert school
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .upsert({ name: 'New York University', slug: 'nyu' }, { onConflict: 'slug' })
    .select('id')
    .single()
  if (schoolError || !school) {
    console.error('Error upserting school:', schoolError)
    process.exit(1)
  }
  console.log(`School ready (id: ${school.id})`)

  for (const data of EATERIES) {
    const eateryName = data.eatery.name
    console.log(eateryName)

    // Upsert eatery
    const { data: existing } = await supabase
      .from('eateries')
      .select('id')
      .eq('school_id', school.id)
      .eq('name', eateryName)
      .maybeSingle()

    let eateryId: string
    if (existing) {
      const { error } = await supabase
        .from('eateries')
        .update({ image_url: data.eatery.image_url })
        .eq('id', existing.id)
      if (error) { console.error(`Error updating eatery "${eateryName}":`, error); process.exit(1) }
      eateryId = existing.id
    } else {
      const { data: inserted, error } = await supabase
        .from('eateries')
        .insert({
          name: eateryName,
          address: data.eatery.address,
          image_url: data.eatery.image_url,
          school_id: school.id,
          is_active: true,
        })
        .select('id')
        .single()
      if (error || !inserted) { console.error(`Error inserting eatery "${eateryName}":`, error); process.exit(1) }
      eateryId = inserted.id
    }

    // Clean up existing option groups for this eatery before re-inserting
    await cleanupEateryOptionGroups(eateryId)

    // Delete old menu items and groups
    const { error: deleteItemsError } = await supabase.from('menu_items').delete().eq('restaurant_id', eateryId)
    if (deleteItemsError) { console.error('Error clearing menu items:', deleteItemsError); process.exit(1) }

    const { error: deleteGroupsError } = await supabase.from('menu_item_groups').delete().eq('eatery_id', eateryId)
    if (deleteGroupsError) { console.error('Error clearing menu groups:', deleteGroupsError); process.exit(1) }

    // Insert menu_item_groups
    const groupNameToId = new Map<string, string>()
    for (const groupName of data.groups) {
      const { data: grp, error } = await supabase
        .from('menu_item_groups')
        .insert({ eatery_id: eateryId, name: groupName })
        .select('id')
        .single()
      if (error || !grp) { console.error(`Error inserting group "${groupName}":`, error); process.exit(1) }
      groupNameToId.set(groupName, grp.id)
    }

    // Insert menu items
    const insertedItems: Array<{ id: string; item: ParsedMenuItem }> = []
    for (const item of data.menu_items) {
      const groupId = groupNameToId.get(item.group)
      if (!groupId) { console.error(`Unknown group "${item.group}" for item "${item.name}"`); process.exit(1) }
      const { data: menuItem, error } = await supabase
        .from('menu_items')
        .insert({
          restaurant_id: eateryId,
          group_id: groupId,
          name: item.name,
          original_price_cents: item.original_price_cents,
          market_price_cents: item.original_price_cents,
          image_url: item.image_url,
          is_available: true,
        })
        .select('id')
        .single()
      if (error || !menuItem) { console.error(`Error inserting item "${item.name}":`, error); process.exit(1) }
      insertedItems.push({ id: menuItem.id, item })
    }

    // Insert option groups, options, and assignments
    for (const { id: menuItemId, item } of insertedItems) {
      for (const og of item.option_groups) {
        const { data: grp, error: ogError } = await supabase
          .from('menu_item_option_groups')
          .insert({
            name: og.name,
            selection_type: og.selection_type,
            is_required: og.is_required,
            sort_order: og.sort_order,
          })
          .select('id')
          .single()
        if (ogError || !grp) { console.error(`Error inserting option group "${og.name}":`, ogError); process.exit(1) }

        if (og.options.length > 0) {
          const { error: optError } = await supabase
            .from('menu_item_options')
            .insert(og.options.map(o => ({
              option_group_id: grp.id,
              name: o.name,
              additional_price_cents: o.additional_price_cents,
              is_default: o.is_default,
              sort_order: o.sort_order,
            })))
          if (optError) { console.error(`Error inserting options for "${og.name}":`, optError); process.exit(1) }
        }

        const { error: assignError } = await supabase
          .from('menu_item_option_group_assignments')
          .insert({ menu_item_id: menuItemId, option_group_id: grp.id, sort_order: og.sort_order })
        if (assignError) { console.error('Error inserting assignment:', assignError); process.exit(1) }
      }
    }
  }

  console.log('\nSeed complete.')
}

seed()

// --- Helpers ---

/**
 * Deletes all option groups reachable via the junction table for the given eatery.
 * @param eateryId - the eatery's UUID
 * @called-by seed
 */
async function cleanupEateryOptionGroups(eateryId: string): Promise<void> {
  const { data: items } = await supabase.from('menu_items').select('id').eq('restaurant_id', eateryId)
  if (!items || items.length === 0) return

  const itemIds = items.map((r: { id: string }) => r.id)
  const { data: assignments } = await supabase
    .from('menu_item_option_group_assignments')
    .select('option_group_id')
    .in('menu_item_id', itemIds)
  if (!assignments || assignments.length === 0) return

  const optGroupIds = [...new Set(assignments.map((a: { option_group_id: string }) => a.option_group_id))]
  if (optGroupIds.length === 0) return

  const { error } = await supabase.from('menu_item_option_groups').delete().in('id', optGroupIds)
  if (error) { console.error(`Error cleaning up option groups for eatery ${eateryId}:`, error); process.exit(1) }
}
