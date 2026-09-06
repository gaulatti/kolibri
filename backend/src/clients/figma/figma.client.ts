import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { sanitizeLogText } from '../../observability/safe-error';
import type { FigmaFile, FigmaImageAsset } from './figma.types';

export class FigmaRequestError extends Error {
  override readonly name = 'FigmaRequestError';

  constructor(
    readonly statusCode: number,
    readonly command = 'GET Figma file',
    readonly stderr?: string,
  ) {
    super(`${command} failed with HTTP ${statusCode}`);
  }
}

@Injectable()
export class FigmaClient {
  async loadFile(fileKey: string, token: string): Promise<FigmaFile> {
    const response = await fetch(
      `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}?geometry=paths`,
      {
        headers: { 'X-Figma-Token': token },
      },
    );

    if (!response.ok) {
      throw await figmaResponseError(response, 'GET Figma file', token);
    }

    return (await response.json()) as FigmaFile;
  }

  async loadImageAssets(
    fileKey: string,
    token: string,
    imageReferences: string[],
  ): Promise<FigmaImageAsset[]> {
    if (!imageReferences.length) return [];
    const response = await this.fetchWithRetry(
      `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/images`,
      { headers: { 'X-Figma-Token': token } },
    );
    if (!response.ok) {
      throw await figmaResponseError(
        response,
        'GET Figma image manifest',
        token,
      );
    }
    const result = (await response.json()) as {
      meta?: { images?: Record<string, string | null> };
    };
    return Promise.all(
      imageReferences.map(async (imageRef) => {
        const url = result.meta?.images?.[imageRef];
        if (!url) {
          throw new Error(
            `Figma image asset is unavailable for reference ${imageRef}`,
          );
        }
        const image = await this.fetchWithRetry(url);
        if (!image.ok) {
          throw await figmaResponseError(
            image,
            `GET Figma image asset ${imageRef}`,
            token,
          );
        }
        return {
          imageRef,
          contentBase64: Buffer.from(await image.arrayBuffer()).toString(
            'base64',
          ),
        };
      }),
    );
  }

  private async fetchWithRetry(
    input: string,
    init?: RequestInit,
  ): Promise<Response> {
    const attempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetch(input, init);
        if (
          attempt === attempts ||
          (response.status !== 429 && response.status < 500)
        ) {
          return response;
        }
      } catch (error) {
        if (attempt === attempts) throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 100 * 2 ** (attempt - 1)),
      );
    }
  }

  async loadFixture(filePath: string): Promise<FigmaFile> {
    const json = await readFile(filePath, 'utf8');
    return JSON.parse(json) as FigmaFile;
  }
}

async function figmaResponseError(
  response: Response,
  command: string,
  token: string,
): Promise<FigmaRequestError> {
  const body = sanitizeLogText(await response.text(), [token]);
  return new FigmaRequestError(
    response.status,
    command,
    body || response.statusText || undefined,
  );
}
