import { z } from 'zod';
export const agentObservationMetrics = z.object({
  mood: z.enum(['', 'спокойное', 'радостное', 'тревожное', 'вялое']),
  appetite: z.enum(['', 'обычный', 'ниже обычного', 'выше обычного', 'не ела']),
  stool: z.enum(['', 'обычный', 'мягкий', 'твёрдый', 'не было']),
  energy: z.enum(['', 'обычная', 'ниже обычного', 'выше обычного', 'нет сил']),
});
export const reviewedObservation = z.object({
  note: z.string().trim().min(1).max(8000),
  observedAt: z.iso.datetime({offset: true}),
  metrics: agentObservationMetrics,
});
export type ReviewedObservation = z.infer<typeof reviewedObservation>;
export type AgentObservationDraft = {
  id: string; run_id: string; pet_id: string; source_text: string;
  metrics: ReviewedObservation['metrics']; observed_at: string;
  status: 'draft' | 'saved' | 'discarded'; observation_id: string | null;
};
export type AgentObservationRecord = {
  id: string; pet_id: string; note: string; value: string; observed_at: string;
  created_at: string; metadata: Record<string, string>; source: string;
};
