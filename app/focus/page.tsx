import type { Metadata } from 'next';
import { FocusWorkspace } from '@/components/focus-workspace';

export const metadata: Metadata = {
  title: 'Focus room · mono',
  description: 'A quiet pomodoro timer with an ambient paper backdrop.',
};

export default function FocusPage() {
  return <FocusWorkspace />;
}
