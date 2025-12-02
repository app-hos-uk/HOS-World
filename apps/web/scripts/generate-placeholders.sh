#!/bin/bash

# Script to generate placeholder images for House of Spells Marketplace
# Requires ImageMagick (install with: brew install imagemagick)

# Colors from House of Spells palette
PURPLE_DARK="#4c1d95"
PURPLE_MEDIUM="#7c3aed"
INDIGO="#6366f1"
AMBER="#d97706"
GOLD="#fbbf24"

# Create directories
mkdir -p public/hero
mkdir -p public/banners
mkdir -p public/featured

echo "Generating placeholder images..."

# Hero Banner Images (1920x1080)
echo "Creating hero banners..."
convert -size 1920x1080 xc:"$PURPLE_DARK" -gravity center -pointsize 72 -fill white -annotate +0+0 "Harry Potter\nHero Banner\n1920x1080px" public/hero/harry-potter-banner.jpg
convert -size 1920x1080 xc:"$PURPLE_MEDIUM" -gravity center -pointsize 72 -fill white -annotate +0+0 "Lord of the Rings\nHero Banner\n1920x1080px" public/hero/lotr-banner.jpg
convert -size 1920x1080 xc:"$INDIGO" -gravity center -pointsize 72 -fill white -annotate +0+0 "Game of Thrones\nHero Banner\n1920x1080px" public/hero/got-banner.jpg

# Banner Carousel Images (800x600)
echo "Creating banner carousel images..."
convert -size 800x600 xc:"$PURPLE_MEDIUM" -gravity center -pointsize 48 -fill white -annotate +0+0 "New Arrivals\n800x600px" public/banners/new-arrivals.jpg
convert -size 800x600 xc:"$AMBER" -gravity center -pointsize 48 -fill white -annotate +0+0 "Best Sellers\n800x600px" public/banners/best-sellers.jpg
convert -size 800x600 xc:"$GOLD" -gravity center -pointsize 48 -fill white -annotate +0+0 "Limited Edition\n800x600px" public/banners/limited-edition.jpg
convert -size 800x600 xc:"$INDIGO" -gravity center -pointsize 48 -fill white -annotate +0+0 "Sale Items\n800x600px" public/banners/sale.jpg

# Feature Banner Images (1920x1080)
echo "Creating feature banners..."
convert -size 1920x1080 xc:"$PURPLE_DARK" -gravity center -pointsize 72 -fill white -annotate +0+0 "Exclusive Collectibles\n1920x1080px" public/featured/collectibles.jpg
convert -size 1920x1080 xc:"$PURPLE_MEDIUM" -gravity center -pointsize 72 -fill white -annotate +0+0 "Magical Apparel\n1920x1080px" public/featured/apparel.jpg

echo "Placeholder images generated successfully!"
echo "Remember to replace these with actual images before production."

