import { Transition } from 'motion/react';

export const springTactile = {
  snappy: {
    type: 'spring',
    stiffness: 420,
    damping: 28,
    mass: 0.8
  } as Transition,

  squishy: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
    mass: 1
  } as Transition,

  gentle: {
    type: 'spring',
    stiffness: 180,
    damping: 24,
    mass: 1.2
  } as Transition
};
