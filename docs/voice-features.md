# Voice Input/Output Features

This document describes the Voice Input/Output (STT/TTS) features implemented for the RAG Starter Kit.

## Overview

The voice features provide:

- **Speech-to-Text (STT)**: Convert spoken words to text using Web Speech API or OpenAI Whisper API
- **Text-to-Speech (TTS)**: Read messages aloud using the browser's speech synthesis
- **Voice Commands**: Hands-free control of the chat interface
- **Audio Visualization**: Real-time waveform display during voice input

## Browser Support

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Speech Recognition | ✅ | ✅ | ✅* | ❌ |
| Speech Synthesis | ✅ | ✅ | ✅ | ✅ |

*Safari requires user interaction to start speech recognition

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ VoiceInputButton│  │ SpeakButton     │  │ VoiceSettings│ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    React Hooks Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ useVoiceInput   │  │ useVoiceOutput  │  │ useVoiceCmds │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Service Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ SpeechService   │  │ Browser Support │                   │
│  │ (Web Speech API)│  │ Detection       │                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐                                        │
│  │ Whisper API     │  (Fallback for unsupported browsers)   │
│  │ (Server-side)   │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Using Voice Input in Your Component

```tsx
import { useVoiceInput } from '@/hooks/use-voice';
import { VoiceInputButton } from '@/components/voice/voice-input-button';

function MyComponent() {
  const [text, setText] = useState('');

  const handleTranscript = (transcript: string) => {
    setText(prev => prev + ' ' + transcript);
  };

  return (
    <div>
      <VoiceInputButton 
        onTranscript={handleTranscript}
        language="en-US"
        continuous={false}
      />
      <p>{text}</p>
    </div>
  );
}
```

### Using Voice Output

```tsx
import { SpeakButton } from '@/components/voice/speak-button';

function Message({ content }: { content: string }) {
  return (
    <div>
      <p>{content}</p>
      <SpeakButton 
        text={content}
        rate={1.2}
        pitch={1}
        autoPlay={false}
      />
    </div>
  );
}
```

### Using Voice Commands

```tsx
import { useVoiceCommands } from '@/hooks/use-voice';

function ChatComponent() {
  const { registerCommand } = useVoiceCommands({
    enabled: true,
    initialCommands: [
      {
        id: 'send-message',
        phrases: ['send message', 'send', 'submit'],
        description: 'Send the current message',
        handler: () => handleSend(),
      },
      {
        id: 'clear-chat',
        phrases: ['clear chat', 'clear', 'new chat'],
        description: 'Clear the chat',
        handler: () => setMessages([]),
      },
    ],
  });

  // Register additional commands dynamically
  useEffect(() => {
    registerCommand({
      id: 'custom-cmd',
      phrases: ['custom command'],
      description: 'Custom command',
      handler: (args) => console.log('Command with args:', args),
    });
  }, [registerCommand]);

  return <div>...</div>;
}
```

## Components

### VoiceInputButton

A microphone button that activates speech recognition.

**Props:**
- `onTranscript`: Callback when transcript is finalized
- `language`: Language code (e.g., 'en-US')
- `continuous`: Enable continuous listening
- `showTranscript`: Show transcript preview

### SpeakButton

A speaker button that reads text aloud.

**Props:**
- `text`: Text to speak
- `language`: Language for synthesis
- `rate`: Speech rate (0.5 - 2)
- `pitch`: Speech pitch (0 - 2)
- `autoPlay`: Auto-play on mount

### VoiceSettingsPanel

A dialog for configuring voice preferences.

**Props:**
- `settings`: Current settings
- `onSettingsChange`: Callback when settings change

### VoiceWaveform

Audio visualization component.

**Props:**
- `isActive`: Whether to show animation
- `barCount`: Number of bars
- `height`: Height in pixels
- `variant`: Color theme

## Hooks

### useVoiceInput

Manages speech recognition state.

```typescript
const {
  isListening,
  transcript,
  interimTranscript,
  fullTranscript,
  error,
  confidence,
  isSupported,
  startListening,
  stopListening,
  toggleListening,
  reset,
} = useVoiceInput(options);
```

### useVoiceOutput

Manages speech synthesis.

```typescript
const {
  isSpeaking,
  isPaused,
  voices,
  currentVoice,
  isSupported,
  speak,
  cancel,
  pause,
  resume,
  setVoice,
  setRate,
  setPitch,
} = useVoiceOutput(options);
```

### useVoiceCommands

Manages voice command registration.

```typescript
const {
  commands,
  lastCommand,
  isEnabled,
  registerCommand,
  unregisterCommand,
  setEnabled,
  getHelpText,
} = useVoiceCommands(options);
```

## Voice Settings

Settings are persisted in the component state and can be synced to a backend.

```typescript
interface VoiceSettings {
  inputMode: 'push-to-talk' | 'continuous';
  recognitionLanguage: SupportedLanguage;
  synthesisLanguage: SupportedLanguage;
  speechRate: number;
  speechPitch: number;
  preferredVoiceURI?: string;
  autoPlayAssistant: boolean;
  enableVoiceCommands: boolean;
  showConfidenceScores: boolean;
}
```

## API Route

### POST /api/voice/transcribe

Transcribes audio using OpenAI Whisper API.

**Request:**
```http
POST /api/voice/transcribe
Content-Type: multipart/form-data

audio: <audio file>
language: en (optional)
prompt: context prompt (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Transcribed text",
    "language": "en",
    "duration": 5.2
  }
}
```

**Supported Formats:**
- flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm

**Rate Limit:** 30 requests/hour

## Browser Support Detection

```typescript
import { checkBrowserSupport } from '@/lib/voice';

const support = checkBrowserSupport();

console.log(support.supportLevel); // 'full' | 'partial' | 'none'
console.log(support.browserName);  // 'Chrome' | 'Safari' | etc.
console.log(support.recommendedFallback); // 'web-api' | 'whisper-api' | 'none'
```

## Error Handling

The voice features handle various error scenarios:

- **Not Supported**: Browser doesn't support Web Speech API
- **Permission Denied**: Microphone access denied
- **No Speech**: No speech detected during listening
- **Network Error**: Connection issues with Whisper API
- **Language Not Supported**: Selected language unavailable

## Accessibility

All voice components include:
- ARIA labels for screen readers
- Keyboard navigation support
- Visual indicators for active states
- Error messages with clear instructions

## Integration with Chat

The enhanced chat components support voice features out of the box:

```tsx
import { MessageInputVoice } from '@/components/chat/message-input-voice';
import { VoiceMessageItem } from '@/components/chat/voice-message-item';

function Chat() {
  return (
    <div>
      <VoiceMessageItem 
        message={message}
        autoPlay={true}
        voiceSettings={settings}
      />
      <MessageInputVoice 
        onSend={handleSend}
        enableVoiceCommands={true}
      />
    </div>
  );
}
```

## Demo

See `src/components/voice/voice-demo.tsx` for a complete demonstration of all voice features.

## Troubleshooting

### Microphone not working
1. Check browser permissions
2. Ensure HTTPS in production
3. Try a different browser (Chrome recommended)

### Speech recognition not accurate
1. Speak clearly and at moderate pace
2. Check microphone quality
3. Select correct language
4. Use the Whisper API fallback for better accuracy

### Text-to-speech not working
1. Check if voices are loaded (some load asynchronously)
2. Try different voice/region settings
3. Check system volume

## Future Enhancements

- [ ] Real-time streaming transcription
- [ ] Custom wake words
- [ ] Speaker diarization
- [ ] Voice activity detection (VAD)
- [ ] Local Whisper model support
- [ ] Voice cloning integration
