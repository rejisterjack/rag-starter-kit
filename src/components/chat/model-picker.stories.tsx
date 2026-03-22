import type { Meta, StoryObj } from '@storybook/react';
import { ModelPicker } from './model-picker';
import { useState } from 'react';

/**
 * ModelPicker component allows users to select from available AI models.
 * Supports both cloud (OpenRouter) and local (Ollama) models.
 */
const meta: Meta<typeof ModelPicker> = {
  title: 'Chat/ModelPicker',
  component: ModelPicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Interactive wrapper for the ModelPicker.
 */
function ModelPickerDemo(props: { disabled?: boolean }) {
  const [model, setModel] = useState('deepseek/deepseek-chat:free');
  return (
    <ModelPicker
      selectedModel={model}
      onModelChange={setModel}
      disabled={props.disabled}
    />
  );
}

/**
 * Default state with DeepSeek selected.
 */
export const Default: Story = {
  render: () => <ModelPickerDemo />,
};

/**
 * Disabled state during streaming.
 */
export const Disabled: Story = {
  render: () => <ModelPickerDemo disabled />,
};

/**
 * ModelPicker with local model selected.
 */
export const LocalModel: Story = {
  render: () => {
    const [model, setModel] = useState('llama3.2');
    return (
      <ModelPicker
        selectedModel={model}
        onModelChange={setModel}
      />
    );
  },
};

/**
 * Multiple model pickers showing different states.
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground w-20">Active:</span>
        <ModelPickerDemo />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground w-20">Disabled:</span>
        <ModelPickerDemo disabled />
      </div>
    </div>
  ),
};
