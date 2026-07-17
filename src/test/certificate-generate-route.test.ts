/** @jest-environment node */

describe('certificate generate route', () => {
  async function callRoute(body: unknown) {
    const { POST } = await import('../app/api/certificates/generate/route');

    const request = {
      json: async () => body,
    } as unknown as Request;

    return POST(request as never);
  }

  it('returns 410 because local certificate generation is deprecated', async () => {
    const response = await callRoute({
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
    });

    const json = await response.json();

    expect(response.status).toBe(410);
    expect(json.error).toBe('DEPRECATED_ENDPOINT');
    expect(json.message).toContain('/api/certificates/issue');
  });
});
