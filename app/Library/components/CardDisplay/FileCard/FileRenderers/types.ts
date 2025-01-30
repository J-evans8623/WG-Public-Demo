// types.ts
export interface RendererBaseProps {
  onError: (error: Error) => void;
}

export interface PDFRendererProps extends RendererBaseProps {
  fileUrl: string;
  scale?: number;
}

export interface DocRendererProps extends RendererBaseProps {
  fileUrl: string;
}

export interface TextRendererProps extends RendererBaseProps {
  textContent: string;
}

export type RendererProps = PDFRendererProps | DocRendererProps | TextRendererProps;