import type { DrawingView, GraphicProfile, SemanticScene } from './scene.js';
import {
  renderSemanticSceneToSvg,
  type SvgStyleCatalog,
} from './svg-renderer.js';

export interface SvgExportMetadata {
  readonly title: string;
  readonly creator?: string;
  readonly projectId?: string;
  readonly revision?: string;
  /** Caller-supplied ISO timestamp; omitted rather than invented. */
  readonly createdAt?: string;
}

export interface SvgExportRequest {
  readonly scene: SemanticScene;
  readonly view: DrawingView;
  readonly profile: GraphicProfile;
  readonly styles: SvgStyleCatalog;
  readonly fileName: string;
  readonly metadata: SvgExportMetadata;
}

export interface SvgExportArtifact {
  readonly fileName: string;
  readonly mediaType: 'image/svg+xml';
  readonly content: string;
  readonly byteLength: number;
  /** Stable non-cryptographic fingerprint for change detection. */
  readonly fingerprint: string;
}

export function exportSemanticSceneToSvg(
  request: SvgExportRequest,
): SvgExportArtifact {
  const fileName = normalizeSvgFileName(request.fileName);
  validateMetadata(request.metadata);
  const documentMetadata: Record<string, string> = {
    title: request.metadata.title,
    profileId: request.profile.id,
    viewId: request.view.id,
    ...(request.metadata.creator === undefined
      ? {}
      : { creator: request.metadata.creator }),
    ...(request.metadata.projectId === undefined
      ? {}
      : { projectId: request.metadata.projectId }),
    ...(request.metadata.revision === undefined
      ? {}
      : { revision: request.metadata.revision }),
    ...(request.metadata.createdAt === undefined
      ? {}
      : { createdAt: request.metadata.createdAt }),
  };
  const content = renderSemanticSceneToSvg(
    request.scene,
    request.view,
    request.profile,
    request.styles,
    {
      includeXmlDeclaration: true,
      includeSemanticGroups: true,
      documentMetadata,
    },
  );
  return {
    fileName,
    mediaType: 'image/svg+xml',
    content,
    byteLength: new TextEncoder().encode(content).byteLength,
    fingerprint: fnv1a(content),
  };
}

function normalizeSvgFileName(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new TypeError('SVG file name must not be empty.');
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0'))
    throw new TypeError('SVG file name must not contain a path.');
  const withExtension = trimmed.toLowerCase().endsWith('.svg')
    ? trimmed
    : `${trimmed}.svg`;
  if (!/^[\p{L}\p{N}._() -]+\.svg$/u.test(withExtension))
    throw new TypeError('SVG file name contains unsupported characters.');
  return withExtension;
}

function validateMetadata(metadata: SvgExportMetadata): void {
  if (metadata.title.trim() === '')
    throw new TypeError('SVG export title must not be empty.');
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' && value.includes('\0'))
      throw new TypeError(`SVG metadata ${key} contains a null character.`);
  }
  if (
    metadata.createdAt !== undefined &&
    (!Number.isFinite(Date.parse(metadata.createdAt)) ||
      !/^\d{4}-\d{2}-\d{2}T/u.test(metadata.createdAt))
  )
    throw new TypeError('SVG creation date must be an ISO date-time.');
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
