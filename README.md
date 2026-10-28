# 👑 Zoe's Starlight Quest

A gentle, playful 3D learning adventure web application built with **React**, **TypeScript**, **Vite**, and **Three.js** for 6-year-old first graders.

Players explore a warm, pastel low-poly kingdom as **Princess Zoe**, talk to 10 friendly princesses, and complete standards-based quests with zero fail states, positive reinforcement, and gentle hints.

## 🌟 The 10 Princesses & Quests (California Grade 1 Standards)

1. **Belle — Whispering Library — "The Torn Storybook"**
   - *Skill:* ELA Reading Foundations (CCSS RF.1.3 / RF.1.4): Sight words, short vowels, CVC blending, letter tiles.
2. **Elsa — Frostfall Peaks — "The Frozen Bridge"**
   - *Skill:* Math Operations within 20 (CCSS 1.OA, 1.OA.5/6): Counting on, doubles, ten-frames, countable snowflakes.
3. **Rapunzel — Sunflower Meadows — "The Sleepy Garden"**
   - *Skill:* Science & Measurement (NGSS 1-LS1, CCSS 1.MD.1–2): Plant needs, living vs nonliving, flower height comparisons.
4. **Cinderella — Glass Slipper Village — "The Midnight Clock"**
   - *Skill:* Math Time (CCSS 1.MD.3): Telling time to the hour and half-hour with analog clock faces.
5. **Ariel — Seashell Cove — "The Seashell Songs"**
   - *Skill:* ELA Reading Foundations (CCSS RF.1.2 / RF.1.3): Rhyming words, auditory word families.
6. **Moana — Wayfinder Isle — "The Shape Stones"**
   - *Skill:* Math Geometry (CCSS 1.G.A.1 / 1.G.A.2): 2D & 3D shapes, counting sides and corners.
7. **Jasmine — Moonlit Palace Garden — "The Story Lanterns"**
   - *Skill:* ELA Literature (CCSS RL.1.2 / RL.1.3): Story order (first, next, last) with sequence cards.
8. **Anna — Sunny Fjord Harbor — "The Harbor Signs"**
   - *Skill:* ELA Language (CCSS L.1.2): Capital letters in names and sentences, end punctuation marks (`.`, `?`, `!`).
9. **Tiana — Firefly Bayou — "The Tally Stand"**
   - *Skill:* Math Measurement & Data (CCSS 1.MD.C.4): Tally marks (groups of 5 with red slash + singles), vegetable stand charts.
10. **Aurora — Rosewood Glen — "The Word Garden"**
    - *Skill:* ELA Grammar (CCSS L.1.1): Naming words vs. action words, sorting bins.

## ✨ Systems & Highlights

- **Adaptive Ladder:** Difficulty adapts to first-try vs. hinted answers; missed questions come back for review later without penalties.
- **Spoken Audio:** Integrated speech synthesis with distinct pitch and rate per princess, plus gentle procedural WebAudio chimes and fanfares.
- **Star Milestones & Wardrobe:** Earn stars to unlock Zoe's sparkle trails (10 ⭐), tiara gems (25 ⭐), royal skirts (50 ⭐), and a butterfly companion (100 ⭐).
- **Daily Treasures & Secret Stickers:** 5 hidden treasures per land (50 daily total) and collectible stickers stored in the Treasure Book.
- **Parent Corner:** Protected by a simple grown-up math challenge, detailing learning standards and allowing custom classroom sight words.
- **Starlight Crown Finale:** Restores the 10-point Starlight Crown on the castle in a grand celebration when all lands glow.
- **Multi-Device Input:** Keyboard (WASD / Arrow keys), on-screen virtual touch joystick, and gamepad support.
- **Local Persistence:** Progress is saved automatically in the browser (`localStorage`).

## 🛠️ Development

- `npm run dev` — Starts the Vite development server on port 3000.
- `npm run build` — Compiles the application for production.
