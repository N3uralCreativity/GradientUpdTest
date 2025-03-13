# RoGradient - Site
# Roblox Gradient Export Viewer

This repository hosts a **GitHub Pages** site that displays Roblox‐exported gradient data, along with a basic “Is this you?” identity check using a stored player name and user ID. The gradient data is stored in [JSONbin.io](https://jsonbin.io) by a Roblox server script, and retrieved here via an ID.

## How It Works

1. **Roblox Side**  
   - When a player exports their gradient, the server script sends a POST request to JSONbin.io, creating a bin with the following fields:
     ```json
     {
       "playerName": "<Roblox Player.Name>",
       "playerId": <Roblox Player.UserId>,
       "gradientData": "<some data...>"
     }
     ```
   - JSONbin.io returns a **bin ID**, which is provided to the user in‐game.

2. **GitHub Pages Site**  
   - The user visits this site and enters the **bin ID** they received.
   - The site fetches the bin’s data from JSONbin.io.
   - It displays the **playerName** and **playerId**, asking **“Is this you?”**  
   - If the user confirms, it reveals the **gradientData** field.

## Files in This Repo

- **`index.html`**  
  Contains the main HTML structure with an input for the bin ID, a “Retrieve” button, and containers for messages, user confirmation, and final gradient data.

- **`styles.css`**  
  Defines a stylish animated background, button hover effects, layout, and theming for success/error messages.

- **`script.js`**  
  Houses the JavaScript logic:
  - Takes the bin ID from the user.
  - Fetches the record from JSONbin.io.
  - Extracts `playerName`, `playerId`, and `gradientData`.
  - Displays a prompt **“Is this you?”** if valid data is found.
  - Shows the gradient data if the user confirms.

- **`README.md`**  
  This file, describing the purpose and usage of the repository.

## Usage

1. **In Roblox**, ensure your **server script** creates a JSONbin record containing:
   ```lua
   local bodyTable = {
       playerName = player.Name,
       playerId = player.UserId,
       gradientData = someJsonString
   }
   -- Then post this table to JSONbin
