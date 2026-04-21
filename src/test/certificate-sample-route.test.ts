/** @jest-environment node */

describe('certificate sample route', () => {
  async function callRoute() {
    const { GET } = await import('../app/api/certificates/sample/route');

    const request = {
      url: 'https://example.test/api/certificates/sample',
    } as unknown as Request;

    return GET(request as never);
  }

  it('returns a visual HTML preview for sample certificate data', async () => {
    const response = await callRoute();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Sample IELTS Certificate Preview');
    expect(html).toContain('CERT-SAMPLE-20260419-0001');
    expect(html).toContain('/api/certificates/verify/CERT-SAMPLE-20260419-0001');
    expect(html).toContain('Sample Preview');
  });
});