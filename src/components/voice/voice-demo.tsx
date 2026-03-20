"use client";

/**
 * Voice Feature Demo Component
 * Example usage of voice input/output features
 */

import React, { useState } from 'react';
import { Mic, Settings, Command } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoiceInputButton, VoiceInputPanel } from './voice-input-button';
import { SpeakButton } from './speak-button';
import { VoiceSettingsPanel } from './voice-settings';
// import { VoiceTranscriptPanel } from './voice-transcript-panel';
import { VoiceWaveform } from './voice-waveform';
import { useVoiceInput, useVoiceOutput, useVoiceCommands } from '@/hooks/use-voice';
import { checkBrowserSupport } from '@/lib/voice';

export function VoiceDemo() {
  const [activeTab, setActiveTab] = useState('input');
  const [demoText, setDemoText] = useState('Hello! This is a demonstration of the voice features.');
  const [receivedTranscript, setReceivedTranscript] = useState('');
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  
  // Check browser support
  const support = checkBrowserSupport();

  // Voice input demo
  const {
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    error,
  } = useVoiceInput({
    language: 'en-US',
    interimResults: true,
    onFinalResult: (text) => setReceivedTranscript(text),
  });

  // Voice output demo
  const {
    voices,
    cancel,
  } = useVoiceOutput();

  // Voice commands demo
  const { commands, lastCommand, registerCommand } = useVoiceCommands({
    enabled: true,
    initialCommands: [
      {
        id: 'greet',
        phrases: ['hello', 'hi there', 'greetings'],
        description: 'Greeting command',
        handler: () => alert('Hello! 👋'),
      },
    ],
  });

  const addTestCommand = () => {
    const id = `cmd-${Date.now()}`;
    registerCommand({
      id,
      phrases: [`test command ${id.slice(-4)}`],
      description: `Test command ${id.slice(-4)}`,
      handler: () => alert(`Command ${id.slice(-4)} executed!`),
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Features Demo
            </CardTitle>
            <CardDescription>
              Test speech-to-text, text-to-speech, and voice commands
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={support.supportLevel === 'full' ? 'default' : 'secondary'}>
              {support.supportLevel === 'full' ? 'Full Support' : 'Limited Support'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Voice Input Tab */}
          <TabsContent value="input" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Speech to Text</h3>
              <VoiceInputButton
                onTranscript={setReceivedTranscript}
                showTranscript={false}
              />
            </div>

            {support.speechRecognition || support.webkitSpeechRecognition ? (
              <>
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm font-medium mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    {isListening ? (
                      <>
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-sm">Listening...</span>
                      </>
                    ) : (
                      <>
                        <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                        <span className="text-sm">Click microphone to start</span>
                      </>
                    )}
                  </div>
                </div>

                {isListening && (
                  <VoiceWaveform isActive={true} barCount={20} height={40} />
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Transcript</p>
                  <div className="min-h-[100px] p-3 rounded-md border bg-background">
                    {fullTranscript ? (
                      <p className="text-sm">
                        {transcript && <span>{transcript}</span>}
                        {interimTranscript && (
                          <span className="text-muted-foreground">{interimTranscript}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {isListening ? 'Speak now...' : 'Transcript will appear here'}
                      </p>
                    )}
                  </div>
                </div>

                {receivedTranscript && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Received:</strong> {receivedTranscript}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200">
                    <p className="text-sm text-red-800">{error.message}</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVoicePanelOpen(true)}
                >
                  Open Full Voice Panel
                </Button>
              </>
            ) : (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Speech recognition is not supported in your browser.
                  Try using Chrome, Edge, or Safari.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Voice Output Tab */}
          <TabsContent value="output" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Text to Speech</h3>
              <SpeakButton text={demoText} />
            </div>

            {support.speechSynthesis ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Text to Speak</p>
                  <textarea
                    value={demoText}
                    onChange={(e) => setDemoText(e.target.value)}
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <SpeakButton 
                    text={demoText} 
                    label="Speak"
                    iconOnly={false}
                    allowPause={true}
                  />
                  <Button 
                    variant="outline" 
                    onClick={cancel}
                    disabled={!isSpeaking}
                  >
                    Stop
                  </Button>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm font-medium mb-2">Available Voices ({voices.length})</p>
                  <div className="max-h-[150px] overflow-y-auto text-xs space-y-1">
                    {voices.slice(0, 10).map((voice) => (
                      <div key={voice.voiceURI} className="flex justify-between">
                        <span className="truncate">{voice.name}</span>
                        <span className="text-muted-foreground">{voice.lang}</span>
                      </div>
                    ))}
                    {voices.length > 10 && (
                      <p className="text-muted-foreground">...and {voices.length - 10} more</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Text-to-speech is not supported in your browser.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Voice Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Voice Commands</h3>
              <Badge variant="secondary">{commands.length} registered</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Say one of the following commands while voice input is active:
              </p>
              
              <div className="space-y-2">
                {commands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className={`p-3 rounded-md border transition-colors ${
                      lastCommand === cmd.id ? 'bg-primary/10 border-primary' : 'bg-background'
                    }`}
                  >
                    <p className="font-medium text-sm">{cmd.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Say: {cmd.phrases.map(p => `"${p}"`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addTestCommand}>
                <Command className="h-4 w-4 mr-2" />
                Add Test Command
              </Button>
            </div>

            {lastCommand && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800">
                  Last command: <strong>{lastCommand}</strong>
                </p>
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <VoiceSettingsPanel>
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Open Voice Settings
              </Button>
            </VoiceSettingsPanel>

            <div className="p-4 rounded-lg border bg-muted/50">
              <p className="text-sm font-medium mb-2">Browser Support</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Browser</span>
                  <span className="font-medium">{support.browserName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Speech Recognition</span>
                  <Badge variant={support.speechRecognition || support.webkitSpeechRecognition ? 'default' : 'secondary'}>
                    {support.speechRecognition || support.webkitSpeechRecognition ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Speech Synthesis</span>
                  <Badge variant={support.speechSynthesis ? 'default' : 'secondary'}>
                    {support.speechSynthesis ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Continuous Mode</span>
                  <Badge variant={support.continuous ? 'default' : 'secondary'}>
                    {support.continuous ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Recommended Fallback</span>
                  <span className="font-medium capitalize">{support.recommendedFallback}</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <VoiceInputPanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        onTranscript={setReceivedTranscript}
      />
    </Card>
  );
}
