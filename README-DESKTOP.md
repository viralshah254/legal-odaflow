# Desktop App Build Instructions

This application can be built as a desktop app for Windows, macOS, and Linux using Electron.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- For Windows builds: Windows 10/11
- For macOS builds: macOS 10.15+ (for code signing, you'll need a Developer ID)
- For Linux builds: Any modern Linux distribution

## Development

### Run in Development Mode

```bash
# Install dependencies
npm install

# Run Next.js dev server and Electron together
npm run electron:dev
```

This will:
1. Start the Next.js development server on `http://localhost:3000`
2. Launch Electron when the server is ready
3. Open DevTools automatically

### Run Electron Only (after starting dev server separately)

```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Run Electron
npm run electron
```

## Building Desktop Apps

### Build for Windows

```bash
npm run electron:build:win
```

This creates:
- **NSIS Installer** (`dist/Legal by OdaFlow Setup x.x.x.exe`) - Full installer with options
- **Portable** (`dist/Legal by OdaFlow-x.x.x-portable.exe`) - No installation required

Output location: `dist/`

### Build for macOS

```bash
npm run electron:build:mac
```

This creates:
- **DMG** (`dist/Legal by OdaFlow-x.x.x.dmg`) - Disk image for distribution
- **ZIP** (`dist/Legal by OdaFlow-x.x.x-mac.zip`) - Archive version

### Build for Linux

```bash
npm run electron:build:linux
```

This creates:
- **AppImage** (`dist/Legal by OdaFlow-x.x.x.AppImage`) - Universal Linux app
- **DEB** (`dist/Legal by OdaFlow-x.x.x.deb`) - Debian/Ubuntu package
- **RPM** (`dist/Legal by OdaFlow-x.x.x.rpm`) - Red Hat/Fedora package

### Build for All Platforms

```bash
npm run electron:build
```

## Icon Files

Place your application icons in the `build/` directory:

- **Windows**: `build/icon.ico` (256x256 or larger, multi-size ICO file)
- **macOS**: `build/icon.icns` (1024x1024 or larger, ICNS format)
- **Linux**: `build/icon.png` (512x512 or larger, PNG format)

You can generate these icons from a high-resolution source image using tools like:
- [Electron Icon Maker](https://www.electron.build/icons)
- [Icon Generator](https://icon.kitchen/)

## Code Signing (Optional but Recommended)

### Windows Code Signing

1. Obtain a code signing certificate
2. Set environment variables:
   ```bash
   export CSC_LINK=/path/to/certificate.p12
   export CSC_KEY_PASSWORD=your_password
   ```

### macOS Code Signing

1. Join Apple Developer Program
2. Set environment variables:
   ```bash
   export APPLE_ID=your@email.com
   export APPLE_ID_PASSWORD=app-specific-password
   export APPLE_TEAM_ID=your-team-id
   ```

## Distribution

### Windows

- **NSIS Installer**: Recommended for most users. Provides standard Windows installation experience.
- **Portable**: For users who prefer no installation. Can be run from USB drives.

### macOS

- **DMG**: Standard macOS distribution format. Users drag the app to Applications folder.
- **ZIP**: Alternative distribution method.

### Linux

- **AppImage**: Universal format, works on most distributions without installation.
- **DEB/RPM**: Native package formats for specific distributions.

## Troubleshooting

### Build Fails

1. Ensure all dependencies are installed: `npm install`
2. Clear build cache: Delete `dist/` and `out/` directories
3. Rebuild: `npm run build && npm run electron:build`

### App Won't Start

1. Check that Next.js build completed successfully
2. Verify `out/` directory exists after `npm run build`
3. Check Electron main process logs in terminal

### Icons Not Showing

1. Ensure icon files exist in `build/` directory
2. Verify icon file formats are correct
3. Icons should be high resolution (256x256 minimum, 512x512+ recommended)

## Configuration Files

- `electron/main.js` - Main Electron process
- `electron/preload.js` - Preload script for secure context bridge
- `electron-builder.yml` - Build configuration
- `package.json` - Build scripts and metadata
- `next.config.js` - Next.js configuration (includes Electron output mode)

## Notes

- The app runs Next.js in standalone mode when built for Electron
- All API calls and data remain frontend-only (mock data)
- The desktop app behaves identically to the web version
- Network access is required for IP-based currency detection




