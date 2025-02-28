"""Configuration settings for OCR data generation."""

# Product database
PRODUCTS = [
    {
        "name": "Premium Coffee Beans",
        "descriptions": [
            "Arabica Dark Roast",
            "Colombian Medium Roast",
            "Ethiopian Light Roast",
            "Organic Fair Trade Blend"
        ],
        "category": "Beverages"
    },
    {
        "name": "Fresh Organic Eggs",
        "descriptions": [
            "Free-Range Brown",
            "Cage-Free White",
            "Jumbo Grade A",
            "Omega-3 Enriched"
        ],
        "category": "Dairy"
    },
    {
        "name": "Artisan Bread",
        "descriptions": [
            "Sourdough Loaf",
            "Whole Grain",
            "Multigrain Seeds",
            "Rye Traditional"
        ],
        "category": "Bakery"
    },
    {
        "name": "Premium Cheese",
        "descriptions": [
            "Aged Cheddar",
            "Smoked Gouda",
            "Italian Parmesan",
            "Swiss Original"
        ],
        "category": "Dairy"
    }
]

# Price ranges by category
PRICE_RANGES = {
    "Beverages": (12.99, 24.99),
    "Dairy": (4.99, 12.99),
    "Bakery": (3.99, 8.99)
}

# Product number formats
PRODUCT_NUMBER_FORMATS = [
    "PRD-{}-{}",  # PRD-1234-5678
    "SKU{}{}",    # SKU12345678
    "{}-{}-{}"    # 123-456-789
]

# Date formats and components
MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]

DATE_FORMATS = [
    "{month} {day}, {year}",
    "{month} {day}-{day2}, {year}",
    "{month} {day} - {month2} {day2}, {year}",
    "{m}-{d}-{y} - {m2}-{d2}-{y}",
    "{m}/{d}/{y} - {m2}/{d2}/{y}",
    "{d}-{m}-{y} thru {d2}-{m2}-{y}",
    "Valid {month} {day} - {day2}",
    "Sale ends {month} {day}, {year}",
    "Effective {m}/{d} - {m2}/{d2}",
    "{month} {day} to {month2} {day2}"
]

DATE_PREFIXES = [
    "Sale Date:", 
    "Valid:", 
    "Sale Period:", 
    "Offer Valid:", 
    "Sale Runs:",
    "Deal Valid:",
    "Available:",
    "On Sale:"
]

# Price tag settings
CENTS_OPTIONS = ["99", "98", "97", "95", "00"]  # Common cents values

# Price suffixes and category mappings
PRICE_SUFFIXES = [
    "ONLY",
    "/ea",
    "ea.",
    "Ea.",
    "EA.",
    "/lb",
    "lb.",
    "LB.",
    "/LB",
    ""  # Sometimes no suffix
]

CATEGORY_SUFFIXES = {
    "Beverages": ["ONLY", "/ea", "ea.", "Ea.", "EA.", ""],
    "Dairy": ["ONLY", "/ea", "ea.", "Ea.", "EA.", "/lb", "lb.", "LB.", "/LB", ""],
    "Bakery": ["ONLY", "/ea", "ea.", "Ea.", "EA.", ""]
}

# Color settings
TAG_COLORS = {
    "background": "#FFD700",  # Yellow
    "text": "#FF4500",        # Red-Orange
    "accent": "#FF4500"       # Red-Orange for the triangle/accent
}

# Image generation settings
IMAGE_SETTINGS = {
    "width_range": (400, 600),         # Size for price tags
    "height_range": (200, 300),
    "font_size_range": (35, 45),       # Base font size
    "price_size_ratio": {              # Relative to base font size
        "dollar": 2.0,                 # Dollar amount twice as large
        "cents": 0.8,                  # Cents slightly smaller
        "only": 0.7,                   # ONLY text smallest
        "product": 1.0                 # Product info normal size
    },
    "blur_probability": 0.3,
    "blur_radius_range": (0.5, 1.5),
    "contrast_range": (0.8, 1.2),
    "brightness_range": (0.8, 1.2)
}
