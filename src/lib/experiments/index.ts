/**
 * Experiments Module
 *
 * A/B Testing for prompts and other experiments.
 */

export {
  DEFAULT_EXPERIMENTS,
  type Experiment,
  type ExperimentMetrics,
  type ExperimentResult,
  getExperimentManager,
  getPromptVariant,
  PromptExperimentManager,
  type PromptVersion,
  trackExperimentResult,
} from './prompt-experiments';
