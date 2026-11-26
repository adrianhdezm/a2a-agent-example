import { describe, expect, it } from 'vitest';
import { tripPlannerInstructions } from '../../../../../src/agents/trip-planner/prompts/trip-planner.prompt.ts';

describe('trip-planner.prompt', () => {
  it('dates the instructions, so "this weekend" means something', () => {
    expect(tripPlannerInstructions(new Date('2026-11-24T10:00:00Z'))).toContain('Today is 2026-11-24 (UTC)');
  });

  it('sends the model to the Weather Agent for forecasts, through its tool', () => {
    expect(tripPlannerInstructions(new Date())).toContain('call ask_weather_agent');
  });
});
