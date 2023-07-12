const iconv = require('iconv-lite');

const defaultTriggerBehaviour = 'never';

module.exports.templateTags = [
  {
    name: 'ResponseEval',
    displayName: 'Response Eval',
    description: "reference values from other request's responses and then run JS on the output.",
    args: [
      {
        displayName: 'Attribute',
        type: 'enum',
        options: [
          {
            displayName: 'Raw Body',
            description: 'entire response body',
            value: 'raw'
          },
          {
            displayName: 'Header',
            description: 'value of response header',
            value: 'header'
          }
        ]
      },
      {
        displayName: 'Request',
        type: 'model',
        model: 'Request'
      },
      {
        displayName: 'Trigger Behavior',
        help: 'Configure when to resend the dependent request',
        type: 'enum',
        defaultValue: defaultTriggerBehaviour,
        options: [
          {
            displayName: 'Never',
            description: 'never resend request',
            value: 'never',
          },
          {
            displayName: 'No History',
            description: 'resend when no responses present',
            value: 'no-history',
          },
          {
            displayName: 'When Expired',
            description: 'resend when existing response has expired',
            value: 'when-expired',
          },
          {
            displayName: 'Always',
            description: 'resend request when needed',
            value: 'always',
          },
        ],
      },
      {
        type: 'string',
        hide: args => args[0].value !== 'header',
        displayName: 'Header Name'
      },
      {
        type: 'string',
        encoding: 'base64',
        displayName: 'JavaScript Code',
        description: 'The variable named `output` contains the output of the original response template tag.',
        placeholder: 'output'
      }
    ],

    async run(context, field, id, filter, resendBehavior, js) {
      filter = filter || '';
      resendBehavior = (resendBehavior || defaultTriggerBehaviour).toLowerCase();

      if (!['header', 'raw'].includes(field)) {
        throw new Error(`Invalid response field ${field}`);
      }

      if (!id) {
        throw new Error('No request specified');
      }

      const request = await context.util.models.request.getById(id);
      if (!request) {
        throw new Error(`Could not find request ${id}`);
      }

      let shouldResend = false;
      switch (resendBehavior) {
        case 'no-history':
          shouldResend = !response;
          break;

        case 'when-expired':
          if (!response) {
            shouldResend = true;
          } else {
            const ageSeconds = (Date.now() - response.created) / 1000;
            shouldResend = ageSeconds > maxAgeSeconds;
          }
          break;

        case 'always':
          shouldResend = true;
          break;

        case 'never':
        default:
          shouldResend = false;
          break;

      }

      if (shouldResend && context.renderPurpose === 'send') {
        console.log('[response eval] Resending dependency');
        response = await context.network.sendRequest(request);
      }

      const response = await context.util.models.response.getLatestForRequestId(id);

      if (!response) {
        throw new Error('No responses for request');
      }

      if (!response.statusCode) {
        throw new Error('No successful responses for request');
      }

      const sanitizedFilter = filter.trim();

      if (field === 'header' && !sanitizedFilter) {
        throw new Error(`No ${field} filter specified`);
      }

      let output = ''
      if (field === 'header') {
        output = matchHeader(response.headers, sanitizedFilter);
      } else if (field === 'raw') {
        const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
        const match = response.contentType.match(/charset=([\w-]+)/);
        const charset = match && match.length >= 2 ? match[1] : 'utf-8';

        // Sometimes iconv conversion fails so fallback to regular buffer
        try {
          output = iconv.decode(bodyBuffer, charset);
        } catch (err) {
          console.warn('[response eval] Failed to decode body', err);
          output = bodyBuffer.toString();
        }
      } else {
        throw new Error(`Unknown field ${field}`);
      }

      let r = output
      if (js) {
        try {
          r = await eval(`(async () => { return ${js} })`)();
        } catch (err) {
          throw new Error(`Cannot eval: ${err.message}`);
        }
      }

      return r
    }
  }
];

function matchHeader(headers, name) {
  if (!headers.length) {
    throw new Error(`No headers available`);
  }

  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());

  if (!header) {
    const names = headers.map(c => `"${c.name}"`).join(',\n\t');
    throw new Error(`No header with name "${name}".\nChoices are [\n\t${names}\n]`);
  }

  return header.value;
}
