# GuessX

A real-time multiplayer number guessing game built with Next.js and Socket.io. Players can join rooms, guess numbers, and compete in exciting guessing challenges!

## Features

- Real-time multiplayer gameplay using Socket.io
- Dynamic game rooms with unique IDs
- Player management and lobby system
- Responsive UI with Tailwind CSS and Bootstrap
- Server-side logic for fair and secure gaming

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
