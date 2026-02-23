# AI.Opensubtitles.com Web Client

A web-based application for AI-powered transcription and translation services using the OpenSubtitles AI API. This is the web port of the [desktop client](https://github.com/iceman1010/ai-opensubtitles-desktop-client).

# Live Version: https://ai.opensubtitles.com/ai-web/

## Features

### Core Functionality

- **Audio/Video Transcription** - Convert speech in media files to text subtitles using multiple AI models
- **Subtitle Translation** - Translate existing subtitle files between 100+ languages
- **Batch Processing** - Process multiple files simultaneously with queue management
- **Language Detection** - Automatic detection of spoken language in audio files
- **Multi-format Support** - Handle various audio, video, and subtitle formats

### Supported File Formats

- **Video**: MP4, MKV, AVI, MOV, WMV, WebM, FLV, 3GP, and more
- **Audio**: MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, and more
- **Subtitles**: SRT, VTT with full Unicode support

### AI Models & Languages

- **Transcription Models**: Multiple AI models with quality/speed options
- **Translation Models**: DeepL and other specialized translation models
- **100+ Languages**: Support for major world languages with regional variants
- **Auto-Detection**: Intelligent language detection for unknown content

### Advanced Features

- **FFmpeg Integration** (WebAssembly) - Automatic audio extraction, format conversion, and optimization
- **Smart File Analysis** - Automatic detection of file type, duration, and processing requirements
- **Intelligent Retry System** - Network error recovery with exponential backoff
- **Credit Management** - Real-time credit balance monitoring and usage tracking
- **Drag & Drop Interface** - Intuitive file selection with multi-file support

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- An OpenSubtitles.com account with API access

### Setup

1. **Access the Web App**: Open the web client in your browser
2. **Login**: Enter your OpenSubtitles.com username and password
3. **Start Processing**: Select files and choose transcription or translation options

## Usage

### Single File Processing

#### Transcription (Audio/Video → Subtitles)

1. **Select File**: Drag & drop or click to select an audio/video file
2. **Language Detection**: Optionally use automatic language detection
3. **Configure Options**:
   - Choose target language (or auto-detect)
   - Select AI transcription model
   - Set output format (SRT/VTT)
4. **Process**: Click "Start Transcription"
5. **Monitor**: Watch progress in status bar
6. **Review**: Preview generated subtitles
7. **Save**: Download to your device

#### Translation (Subtitles → Subtitles)

1. **Select File**: Choose an existing subtitle file (SRT/VTT)
2. **Configure Languages**:
   - Set source language (or auto-detect)
   - Choose target language from 100+ options
   - Select AI translation model
3. **Process**: Click "Start Translation"
4. **Monitor**: Track progress with live credit updates
5. **Review**: Preview translated content
6. **Save**: Download translated subtitles

### Batch Processing

1. **Access**: Navigate to "Batch" screen
2. **Add Files**: Drag & drop multiple files or use file selector
3. **Configure**: Set global processing options
4. **Queue Management**: Reorder, remove, or modify individual items
5. **Process**: Start batch operation with progress tracking
6. **Results**: Review and save all processed files

## What's Different From the Desktop App

This web version provides most features of the desktop client with the following differences:

| Feature | Desktop App | Web App |
|---------|-------------|---------|
| Transcription & Translation | ✓ | ✓ |
| Batch Processing | ✓ | ✓ |
| Language Detection | ✓ | ✓ |
| FFmpeg Integration | ✓ (native) | ✓ (WebAssembly) |
| File Associations | ✓ | - |
| Auto-updater | ✓ | - |
| Offline Mode | ✓ | - |
| Desktop Notifications | ✓ | Limited |

## Technology Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **Testing**: Vitest
- **Media Processing**: FFmpeg (WebAssembly)
- **API**: OpenSubtitles.com AI API

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/iceman1010/ai-opensubtitles-web-client.git
cd ai-opensubtitles-web-client
npm install
```

### Development Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testing

```bash
npm run test             # Run all tests
npm run test:watch      # Watch mode
npm run test:ui         # UI mode
```

## Credits & Pricing

The application uses a credit-based system. Pricing varies by AI model and content length. Check the "Info" section in the app for current pricing details.

Please use an Opensubtitles.com (not .org) account when buying credits at [https://ai.opensubtitles.com](https://ai.opensubtitles.com).

## Support

For issues and feature requests, please visit the [GitHub Issues page](https://github.com/iceman1010/ai-opensubtitles-web-client/issues).

## License

This project is open source and available for anyone to edit, modify, and contribute to. Feel free to fork, improve, and share your modifications.

## Related Projects

- [AI.Opensubtitles Desktop Client](https://github.com/iceman1010/ai-opensubtitles-desktop-client) - The original Electron-based desktop application
