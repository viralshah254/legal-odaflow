import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
  IsEnum,
  MaxLength,
} from 'class-validator';

export type AnnotationType = 'highlight' | 'note' | 'excerpt' | 'ink';
export type CanvasNodeType = 'note' | 'excerpt_card' | 'timeline' | 'image' | 'research_result';
export type LinkEndType = 'annotation' | 'canvas_node';

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  matterId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

export class UpdateLayoutDto {
  @IsObject()
  layoutJson: Record<string, unknown>;
}

export class AddDocumentDto {
  @IsString()
  documentId: string;

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

export class UpdatePaneStateDto {
  @IsObject()
  paneState: Record<string, unknown>;
}

export class CreateAnnotationDto {
  @IsString()
  documentId: string;

  @IsEnum(['highlight', 'note', 'excerpt', 'ink'])
  type: AnnotationType;

  @IsObject()
  anchor: {
    startOffset: number;
    endOffset: number;
    page?: number;
    bbox?: { x: number; y: number; width: number; height: number };
    quote: string;
  };

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateAnnotationDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsObject()
  aiMetadata?: Record<string, unknown>;
}

export class CreateLinkDto {
  @IsEnum(['annotation', 'canvas_node'])
  sourceType: LinkEndType;

  @IsString()
  sourceId: string;

  @IsEnum(['annotation', 'canvas_node'])
  targetType: LinkEndType;

  @IsString()
  targetId: string;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;
}

export class CreateCanvasNodeDto {
  @IsEnum(['note', 'excerpt_card', 'timeline', 'image', 'research_result'])
  type: CanvasNodeType;

  @IsNumber()
  positionX: number;

  @IsNumber()
  positionY: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsObject()
  content: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  linkedAnnotationIds?: string[];
}

export class UpdateCanvasNodeDto {
  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  linkedAnnotationIds?: string[];
}

export class ExtractToCanvasDto {
  @IsString()
  annotationId: string;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;
}
