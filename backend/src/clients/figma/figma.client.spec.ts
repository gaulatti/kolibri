import { FigmaClient, FigmaRequestError } from './figma.client';

describe('FigmaClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('preserves useful status context when an error response has no body', async () => {
    expect(new FigmaRequestError(403).message).toBe(
      'GET Figma file failed with HTTP 403',
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response('', { status: 403, statusText: 'Forbidden' }),
      )
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(
      new FigmaClient().loadFile('fixture', 'fixture-token'),
    ).rejects.toMatchObject({ statusCode: 403, stderr: 'Forbidden' });
    await expect(
      new FigmaClient().loadFile('fixture', 'fixture-token'),
    ).rejects.toMatchObject({ statusCode: 403, stderr: undefined });
  });

  it('requests vector geometry paths with the file snapshot', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ document: {} })));

    await new FigmaClient().loadFile('file/key', 'figma-token');

    expect(request).toHaveBeenCalledWith(
      'https://api.figma.com/v1/files/file%2Fkey?geometry=paths',
      { headers: { 'X-Figma-Token': 'figma-token' } },
    );
  });

  it('preserves sanitized HTTP failure context', async () => {
    const token = 'figd_sensitive-token-value-123456';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: `denied ${token}` }), {
        status: 403,
      }),
    );

    let failure: unknown;
    try {
      await new FigmaClient().loadFile('file-key', token);
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'FigmaRequestError',
      statusCode: 403,
      command: 'GET Figma file',
    });
    expect(JSON.stringify(failure)).toContain('denied');
    expect(JSON.stringify(failure)).not.toContain(token);
  });

  it('retries transient image requests', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            meta: { images: { imageRef: 'https://images.example/asset' } },
          }),
        ),
      )
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));

    await expect(
      new FigmaClient().loadImageAssets('file-key', 'figma-token', [
        'imageRef',
      ]),
    ).resolves.toEqual([{ imageRef: 'imageRef', contentBase64: 'AQID' }]);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('returns no images without a network request', async () => {
    const request = jest.spyOn(global, 'fetch');
    await expect(
      new FigmaClient().loadImageAssets('file', 'token', []),
    ).resolves.toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [
      new Response('manifest denied', { status: 403 }),
      'GET Figma image manifest',
    ],
    [new Response('server error', { status: 500 }), 'GET Figma image manifest'],
  ])('reports image manifest failures', async (response, command) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response);
    await expect(
      new FigmaClient().loadImageAssets('file', 'token', ['ref']),
    ).rejects.toMatchObject({ command });
  });

  it('reports missing image references and failed asset downloads', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ meta: { images: {} } })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ meta: { images: { ref: 'https://asset.test' } } }),
        ),
      )
      .mockResolvedValueOnce(new Response('asset denied', { status: 404 }));
    const client = new FigmaClient();
    await expect(
      client.loadImageAssets('file', 'token', ['ref']),
    ).rejects.toThrow('unavailable');
    await expect(
      client.loadImageAssets('file', 'token', ['ref']),
    ).rejects.toMatchObject({ command: 'GET Figma image asset ref' });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('throws the final network error after all retry attempts', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('offline'));
    const pending = new FigmaClient().loadImageAssets('file', 'token', ['ref']);
    const rejection = expect(pending).rejects.toThrow('offline');
    await jest.runAllTimersAsync();
    await rejection;
    jest.useRealTimers();
  });

  it('loads a local JSON fixture', async () => {
    await expect(
      new FigmaClient().loadFixture('package.json'),
    ).resolves.toMatchObject({ name: 'backend' });
  });
});
