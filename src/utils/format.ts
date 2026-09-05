export const formatPoints = (points: number) => `${points} pts`;

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
