const tag = require('..').templateTags[0];

describe('Response tag', () => {
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
    const result = await tag.run(context, 'req_1', '', '', 'JSON.parse(body).foo');
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
    const result = await tag.run(context, 'req_1', '', '', '');
    expect(result).toBe('{"foo": "bar"}');
  })
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
    context: {
      getEnvironmentId() {
        return 0
      },
      getExtraInfo() {
        return []
      },
    },
    util: {
      models: {
        request: {
          getById(requestId) {
            return requests.find(r => r._id === requestId) || null;
          }
        },
        response: {
          getLatestForRequestId(requestId, _) {
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
