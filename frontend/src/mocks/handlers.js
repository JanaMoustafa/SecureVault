import { http, HttpResponse } from 'msw';

const API = '/api';

export const handlers = [
  // Health
  http.get(`${API}/health`, () =>
    HttpResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
  ),

  // Auth — register
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = await request.json();
    if (!body.email || !body.password || !body.username) {
      return HttpResponse.json(
        { success: false, message: 'Validation failed.' },
        { status: 422 }
      );
    }
    return HttpResponse.json(
      {
        success: true,
        data: {
          user:         { _id: 'mock-user-id', username: body.username, email: body.email, role: 'user' },
          accessToken:  'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      },
      { status: 201 }
    );
  }),

  // Auth — login
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { success: false, message: 'Validation failed.' },
        { status: 422 }
      );
    }
    // Simulate wrong credentials
    if (body.password === 'wrong') {
      return HttpResponse.json(
        { success: false, message: 'Invalid credentials.' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        user:         { _id: 'mock-user-id', username: 'testuser', email: body.email, role: 'user' },
        accessToken:  'mock-access-token',
        refreshToken: 'mock-refresh-token',
      },
    });
  }),

  // Auth — logout
  http.post(`${API}/auth/logout`, () =>
    HttpResponse.json({ success: true, message: 'Logged out.' })
  ),

  // Auth — me
  http.get(`${API}/auth/me`, ({ request }) => {
    const auth = request.headers.get('authorization');
    if (!auth) {
      return HttpResponse.json(
        { success: false, message: 'No authentication token provided.' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: { user: { _id: 'mock-user-id', username: 'testuser', email: 'test@test.com', role: 'user' } },
    });
  }),

  // Files — list
  http.get(`${API}/files`, ({ request }) => {
    const auth = request.headers.get('authorization');
    if (!auth) {
      return HttpResponse.json(
        { success: false, message: 'No authentication token provided.' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: { files: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
    });
  }),

  // Files — upload
  http.post(`${API}/files/upload`, ({ request }) => {
    const auth = request.headers.get('authorization');
    if (!auth) {
      return HttpResponse.json(
        { success: false, message: 'No authentication token provided.' },
        { status: 401 }
      );
    }
    return HttpResponse.json(
      {
        success: true,
        data: {
          file: {
            _id:          'mock-file-id',
            originalName: 'test-file.txt',
            size:         1024,
            createdAt:    new Date().toISOString(),
          },
        },
      },
      { status: 201 }
    );
  }),
];
