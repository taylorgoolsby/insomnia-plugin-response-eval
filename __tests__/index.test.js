const tag = require('..').templateTags[0];

describe('Response tag', () => {
  describe('General', () => {
    it('fails on no responses', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const context = _genTestContext(requests);

      try {
        await tag.run(context, 'raw', 'req_1', '', 'JSON.parse(output).foo');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('No responses for request');
      }
    });

    it('fails on no request', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          _body: '{"foo": "bar"}'
        }
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'raw', 'req_test', '', 'JSON.parse(output).foo');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('Could not find request req_test');
      }
    });
  });

  describe('ResponseExtension Header', async () => {
    it('renders basic response "header"', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: '',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Content-Length', value: '20' }
          ]
        }
      ];

      const context = _genTestContext(requests, responses);

      expect(await tag.run(context, 'header', 'req_1', 'content-type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'Content-Type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'CONTENT-type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'CONTENT-type    ')).toBe(
        'application/json'
      );
    });

    it('no results on missing header', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Content-Length', value: '20' }
          ]
        }
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'header', 'req_1', 'missing');
        fail('should have failed');
      } catch (err) {
        expect(err.message).toBe(
          'No header with name "missing".\n' +
            'Choices are [\n\t"Content-Type",\n\t"Content-Length"\n]'
        );
      }
    });
  });

  describe('Raw', async () => {
    it('renders basic response', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'text/plain',
          _body: 'Hello World!'
        }
      ];

      const context = _genTestContext(requests, responses);

      expect(await tag.run(context, 'raw', 'req_1')).toBe('Hello World!');
    });

    it('basic query eval', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "bar"}'
        }
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'raw', 'req_1', '', 'JSON.parse(output).foo');

      expect(result).toBe('bar');
    })

    it('basic query eval empty', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "bar"}'
        }
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'raw', 'req_1', '', '');

      expect(result).toBe('{"foo": "bar"}');
    })
  });
});

function _genTestContext(requests, responses) {
  requests = requests || [];
  responses = responses || [];
  const bodies = {};
  for (const res of responses) {
    bodies[res._id] = res._body || null;
    delete res._body;
  }
  return {
    util: {
      models: {
        request: {
          getById(requestId) {
            return requests.find(r => r._id === requestId) || null;
          }
        },
        response: {
          getLatestForRequestId(requestId) {
            return responses.find(r => r.parentId === requestId) || null;
          },
          getBodyBuffer(response) {
            const strOrBuffer = bodies[response._id];

            if (typeof strOrBuffer === 'string') {
              return Buffer.from(strOrBuffer);
            }

            if (!strOrBuffer) {
              return null;
            }

            return strOrBuffer;
          }
        }
      }
    }
  };
}
