const request = require('supertest');
const app = require('../../../src/app');

describe('Calls API', () => {
  test('GET /api/calls should return 200', async () => {
    const response = await request(app)
      .get('/api/calls')
      .expect(200);
    
    expect(response.body).toHaveProperty('message');
  });
});
