'use client';

/**
 * Voice Settings Component
 * Settings panel for voice preferences
 */

import { Activity, Globe, Mic, Settings2, Volume2, Zap } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useVoiceOutput } from '@/hooks/use-voice';
import { cn } from '@/lib/utils';
import {
  DEFAULT_VOICE_SETTINGS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type VoiceSettings,
} from '@/lib/voice';

interface VoiceSettingsPanelProps {
  /** Current settings */
  settings?: Partial<VoiceSettings>;
  /** Callback when settings change */
  onSettingsChange?: (settings: VoiceSettings) => void;
  /** Trigger element */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function VoiceSettingsPanel({
  settings: initialSettings,
  onSettingsChange,
  children,
  className,
}: VoiceSettingsPanelProps) {
  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
    ...initialSettings,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [testVoiceText] = useState('Hello! This is a test of the voice settings.');

  const { voices, speak, isSpeaking, setVoice, setRate, setPitch } = useVoiceOutput();

  // Filter voices by selected language
  const availableVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(settings.synthesisLanguage.toLowerCase())
  );

  // Update settings
  const updateSetting = useCallback(
    <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
      setSettings((prev) => {
        const updated = { ...prev, [key]: value };
        onSettingsChange?.(updated);
        return updated;
      });
    },
    [onSettingsChange]
  );

  // Handle test voice
  const handleTestVoice = useCallback(() => {
    speak(testVoiceText, {
      lang: settings.synthesisLanguage,
      rate: settings.speechRate,
      pitch: settings.speechPitch,
    });
  }, [speak, testVoiceText, settings]);

  // Group voices by gender/category
  const groupedVoices = {
    female: availableVoices.filter((v) => v.gender === 'female'),
    male: availableVoices.filter((v) => v.gender === 'male'),
    other: availableVoices.filter((v) => v.gender === 'neutral' || !v.gender),
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className={className}>
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Voice Settings
          </DialogTitle>
          <DialogDescription>Customize your voice input and output preferences</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="input" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="input" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Input</span>
            </TabsTrigger>
            <TabsTrigger value="output" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span className="hidden sm:inline">Output</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          </TabsList>

          {/* Input Settings */}
          <TabsContent value="input" className="space-y-6">
            {/* Input Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Input Mode
                </Label>
                <Badge variant={settings.inputMode === 'continuous' ? 'default' : 'secondary'}>
                  {settings.inputMode === 'continuous' ? 'Continuous' : 'Push-to-Talk'}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="continuous-mode">Continuous Listening</Label>
                  <p className="text-xs text-muted-foreground">
                    Keep listening until you stop speaking
                  </p>
                </div>
                <Switch
                  id="continuous-mode"
                  checked={settings.inputMode === 'continuous'}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    updateSetting('inputMode', checked === true ? 'continuous' : 'push-to-talk')
                  }
                />
              </div>
            </div>

            {/* Recognition Language */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Recognition Language
              </Label>
              <Select
                value={settings.recognitionLanguage}
                onValueChange={(value) =>
                  updateSetting('recognitionLanguage', value as SupportedLanguage)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="mr-2">{lang.flag}</span>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Output Settings */}
          <TabsContent value="output" className="space-y-6">
            {/* Synthesis Language */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Speech Language
              </Label>
              <Select
                value={settings.synthesisLanguage}
                onValueChange={(value) => {
                  updateSetting('synthesisLanguage', value as SupportedLanguage);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="mr-2">{lang.flag}</span>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voice Selection */}
            <div className="space-y-3">
              <Label>Voice</Label>
              <Select
                value={settings.preferredVoiceURI}
                onValueChange={(value) => {
                  updateSetting('preferredVoiceURI', value);
                  setVoice(value);
                }}
                disabled={availableVoices.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableVoices.length === 0 ? 'No voices available' : 'Select voice'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {groupedVoices.female.length > 0 && (
                    <>
                      <SelectItem value="female-header" disabled className="font-semibold text-xs">
                        Female Voices
                      </SelectItem>
                      {groupedVoices.female.map((voice) => (
                        <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name}
                          {voice.localService && (
                            <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                          )}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {groupedVoices.male.length > 0 && (
                    <>
                      <SelectItem value="male-header" disabled className="font-semibold text-xs">
                        Male Voices
                      </SelectItem>
                      {groupedVoices.male.map((voice) => (
                        <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name}
                          {voice.localService && (
                            <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                          )}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {groupedVoices.other.map((voice) => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name}
                      {voice.localService && (
                        <span className="ml-2 text-xs text-muted-foreground">(Local)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speech Rate */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Speech Rate</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.speechRate.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[settings.speechRate]}
                onValueChange={([value]: number[]) => {
                  updateSetting('speechRate', value);
                  setRate(value);
                }}
                min={0.5}
                max={2}
                step={0.1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow (0.5x)</span>
                <span>Normal (1x)</span>
                <span>Fast (2x)</span>
              </div>
            </div>

            {/* Speech Pitch */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Speech Pitch</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.speechPitch.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[settings.speechPitch]}
                onValueChange={([value]: number[]) => {
                  updateSetting('speechPitch', value);
                  setPitch(value);
                }}
                min={0.5}
                max={2}
                step={0.1}
              />
            </div>

            {/* Test Voice */}
            <div className="space-y-3">
              <Label>Test Voice</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestVoice}
                  disabled={isSpeaking}
                  className="flex-1"
                >
                  {isSpeaking ? 'Speaking...' : 'Test Voice'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced" className="space-y-6">
            {/* Auto-play Assistant */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-play">Auto-play Assistant Messages</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically read assistant responses aloud
                </p>
              </div>
              <Switch
                id="auto-play"
                checked={settings.autoPlayAssistant}
                onCheckedChange={(checked: boolean | 'indeterminate') =>
                  updateSetting('autoPlayAssistant', checked === true)
                }
              />
            </div>

            {/* Voice Commands */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="voice-commands">Voice Commands</Label>
                <p className="text-xs text-muted-foreground">
                  Enable voice commands like "New chat" and "Send message"
                </p>
              </div>
              <Switch
                id="voice-commands"
                checked={settings.enableVoiceCommands}
                onCheckedChange={(checked: boolean | 'indeterminate') =>
                  updateSetting('enableVoiceCommands', checked === true)
                }
              />
            </div>

            {/* Show Confidence */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="show-confidence">Show Confidence Scores</Label>
                <p className="text-xs text-muted-foreground">
                  Display confidence level for voice input
                </p>
              </div>
              <Switch
                id="show-confidence"
                checked={settings.showConfidenceScores}
                onCheckedChange={(checked: boolean | 'indeterminate') =>
                  updateSetting('showConfidenceScores', checked === true)
                }
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setSettings(DEFAULT_VOICE_SETTINGS);
              onSettingsChange?.(DEFAULT_VOICE_SETTINGS);
            }}
          >
            Reset to Default
          </Button>
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Compact Voice Settings (Dropdown version)
// =============================================================================

interface CompactVoiceSettingsProps {
  settings?: Partial<VoiceSettings>;
  onSettingsChange?: (settings: VoiceSettings) => void;
  className?: string;
}

export function CompactVoiceSettings({
  settings: initialSettings,
  onSettingsChange,
  className,
}: CompactVoiceSettingsProps) {
  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_VOICE_SETTINGS,
    ...initialSettings,
  });

  const updateSetting = useCallback(
    <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
      setSettings((prev) => {
        const updated = { ...prev, [key]: value };
        onSettingsChange?.(updated);
        return updated;
      });
    },
    [onSettingsChange]
  );

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">
          Recognition Language
        </Label>
        <Select
          value={settings.recognitionLanguage}
          onValueChange={(value) =>
            updateSetting('recognitionLanguage', value as SupportedLanguage)
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="mr-2">{lang.flag}</span>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">
            Speech Rate
          </Label>
          <span className="text-xs text-muted-foreground">{settings.speechRate.toFixed(1)}x</span>
        </div>
        <Slider
          value={[settings.speechRate]}
          onValueChange={([value]: number[]) => updateSetting('speechRate', value)}
          min={0.5}
          max={2}
          step={0.1}
          className="py-2"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">Auto-play</Label>
        <Switch
          checked={settings.autoPlayAssistant}
          onCheckedChange={(checked: boolean | 'indeterminate') =>
            updateSetting('autoPlayAssistant', checked === true)
          }
        />
      </div>
    </div>
  );
}
