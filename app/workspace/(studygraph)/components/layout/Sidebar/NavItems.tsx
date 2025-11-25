// NavItems.tsx
import { Home, Map, BookOpen, HelpCircle, User } from 'lucide-react';

export const navItems = [
  { icon: Home, label: 'Home', view: 'home' as const },
  { icon: Map, label: 'ConceptMap', view: 'map' as const },
  { icon: BookOpen, label: 'Tutorial' },
  { icon: HelpCircle, label: 'Help' },
  // Updated User Info item to include a view identifier:
  { icon: User, label: 'User Info', view: 'user' as const },
];

export type ViewType = 'home' | 'map' | 'user';
