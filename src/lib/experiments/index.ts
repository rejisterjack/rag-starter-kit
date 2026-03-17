/**
 * Experiments Module
 * 
 * A/B Testing for prompts and other experiments.
 */

export {
  PromptExperimentManager,
  getExperimentManager,
  getPromptVariant,
  trackExperimentResult,
  DEFAULT_EXPERIMENTS,
  type PromptVersion,
  type Experiment,
  type ExperimentMetrics,
  type ExperimentResult,
} from './prompt-experiments';
