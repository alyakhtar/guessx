# GuessX

A real-time multiplayer number guessing game built with Next.js and Socket.io. Players can join rooms, guess numbers, and compete in exciting guessing challenges!

## Features

- Real-time multiplayer gameplay using Socket.io
- **Single-player mode**: Play against AI opponents with varying difficulty levels
- **Admin panel**: Comprehensive game configuration management for administrators
- Dynamic game rooms with unique IDs
- Player management and lobby system
- Spectator mode: Watch games in read-only mode
- Celebration animations: Epic win/loss effects with falling animated emojis
- Responsive UI with Tailwind CSS and Bootstrap
- Server-side logic for fair and secure gaming
- Keyboard shortcuts for desktop users (Enter to submit)
- Individual digit input with auto-focus navigation
- Internationalization support (English/French)
- Dark/Light mode toggle

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd GuessX
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Development

To start the development server:
```bash
npm run dev
```
This will run the server at `http://localhost:3000` (or configured port).

### Production Build

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```
   This runs the server in production mode (default port 8082, configurable with PORT environment variable).

### Environment Variables

- `NODE_ENV`: Set to `production` for production builds
- `PORT`: Server port (default: 8082 for production, 3000 for dev)

## Spectator Mode

GuessX supports spectator mode, allowing players to watch ongoing games in read-only mode.

### Enabling Spectator Mode

When creating a new game room, you can enable spectator mode by toggling "Enable Spectator Mode" in the room creation form. This feature is disabled by default.

### Spectating a Game

- Rooms with two active players and spectator mode enabled will show a "👁️ Spectate" button in the lobby instead of "Join"
- Clicking "Spectate" takes you to a dedicated spectator view
- Spectators can watch:
  - Real-time game progress
  - Correctly guessed digits revealed in secret number boxes
  - Player guess history
  - Game status and turn indicators

### Security

- Spectator mode can only be accessed if enabled during room creation
- Direct URL access is blocked if spectator mode is not enabled for that room
- Spectators have no ability to interact with the game

## Single-Player Mode

GuessX offers an exciting single-player mode where you can challenge AI opponents with varying levels of difficulty.

### Enabling Single-Player Mode

When creating a new game room, select the "Single Player vs Bot" option in the room creation form.

### Bot Difficulty Levels

Choose from three difficulty levels:

- **Easy**: Bot uses random guessing with some basic logic
- **Medium**: Bot employs elimination strategies and learns from previous guesses
- **Hard**: Bot uses advanced algorithms that simulate optimal guessing patterns

### How It Works

- You set your secret number first (same as multiplayer mode)
- The bot automatically sets its secret number
- Take turns guessing against an opponent who never gets tired!
- Bot behavior adapts based on the difficulty level you selected
- Games continue until someone correctly guesses the opponent's number

### Difficulty Configuration

Administrators can fine-tune bot difficulty settings through the admin panel, adjusting parameters like:
- Minimum and maximum number of guesses for win conditions
- Guess range and elimination strategies
- Algorithm complexity for each difficulty level

## Admin Panel

The admin panel provides comprehensive game configuration management for server administrators.

### Accessing the Admin Panel

Navigate to `/admin` (e.g., `http://localhost:3000/en/admin`) or click the admin link when available.

### Configuration Management

#### Game Length Selection
- Configure difficulty settings for 4-digit, 5-digit, and 6-digit games
- Each digit length has separate difficulty configurations
- Settings are automatically saved and applied server-wide

#### Difficulty Settings (Per Digit Length)
For each game length and difficulty level (Easy, Medium, Hard), administrators can set:
- **Minimum Guesses**: The lowest number of guesses for perfect play
- **Maximum Guesses**: The highest number of guesses allowed before the bot gives up

#### Example Configuration
```
4-Digit Games:
- Easy: Min 11, Max 13 guesses
- Medium: Min 8, Max 10 guesses
- Hard: Min 6, Max 7 guesses
```

### Persistence

- Configurations are stored in a dedicated database collection
- Settings persist across server restarts
- Changes take effect immediately for new games
- Dark/light mode toggle for admin interface comfort

### Security & Access

- Admin panel is accessible via direct URL navigation
- No additional authentication required (intended for private deployments)
- All configuration changes are logged for auditing

## Deployment as Systemd Service (Linux)

To run GuessX as a system service on a Linux machine, create the following systemd service file:

**Location:** `/etc/systemd/system/guessx.service`

```ini
[Unit]
Description=GuessX Number Guessing Game
After=network.target

[Service]
Type=simple
User=<your-user>
WorkingDirectory=<path-to-GuessX>
Environment=NODE_ENV=production
Environment=PORT=8082
ExecStart=<path-to-node> <path-to-server.js>
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Replace the placeholders:
- `<your-user>`: Your system username
- `<path-to-GuessX>`: Absolute path to your GuessX directory (e.g., `/home/<user>/GuessX`)
- `<path-to-node>`: Path to your Node.js binary (e.g., `/home/<user>/.nvm/versions/node/v25.2.1/bin/node`)
- `<path-to-server.js>`: Path to `server.js` 

### Service Management Commands

- **Start service:**
  ```bash
  sudo systemctl start guessx
  ```

- **Stop service:**
  ```bash
  sudo systemctl stop guessx
  ```

- **Restart service:**
  ```bash
  sudo systemctl restart guessx
  ```

- **Check status:**
  ```bash
  sudo systemctl status guessx
  ```

- **View logs:**
  ```bash
  sudo journalctl -u guessx -f
  ```

- **Enable on boot:**
  ```bash
  sudo systemctl enable guessx
  ```

- **Disable on boot:**
  ```bash
  sudo systemctl disable guessx
  ```

## Project Structure

- `app/`: Next.js app directory with pages and layout
- `components/`: React components for the game UI
- `server/`: Socket.io server logic
- `lib/`: Utility functions and game logic
- `types/`: TypeScript type definitions

## Dependencies

- Next.js: React framework
- Socket.io: Real-time communication
- Bootstrap & Tailwind CSS: Styling
- TypeScript: Type safety

## License

This project is licensed under the MIT License.
