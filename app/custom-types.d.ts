import { BaseEditor } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';
import { Descendant } from 'slate';

// Extend CustomText to include underline and highlight
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;  
  highlight?: boolean;  
};

// Define additional elements for lists
export type ParagraphElement = {
  type: 'paragraph';
  children: Descendant[]; // Change to Descendant[] for consistency
};

export type BulletedListElement = {
  type: 'bulleted-list';
  children: Descendant[]; 
};

export type NumberedListElement = {
  type: 'numbered-list';
  children: Descendant[];
};

export type ListItemElement = {
  type: 'list-item';
  children: Descendant[];
};

// Union all element types
export type CustomElement =
  | ParagraphElement
  | BulletedListElement
  | NumberedListElement
  | ListItemElement;

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
