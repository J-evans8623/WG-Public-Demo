// components/layout/Sidebar/NavItems.tsx
import { Home, Map, BookOpen, HelpCircle, User } from 'lucide-react';

export const navItems = [
  { icon: Home, label: 'Home', view: 'home' as const },
  { icon: Map, label: 'ConceptMap', view: 'map' as const },
  { icon: BookOpen, label: 'Tutorial' },
  { icon: HelpCircle, label: 'Help' },
  { icon: User, label: 'User Info' },
];

export type ViewType = 'home' | 'map';