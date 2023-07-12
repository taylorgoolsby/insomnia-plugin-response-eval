const iconv = require('iconv-lite');

const defaultTriggerBehaviour = 'never';

module.exports.templateTags = [
  {
    name: 'ResponseEval',
    displayName: 'Response Eval',
    description: "reference values from other request's responses and then run JS on the output.",
    args: [
      {
        displayName: 'Request',
        type: 'model',
        model: 'Request',
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
        displayName: 'Max age (seconds)',
        help: 'The maximum age of a response to use before it expires',
        type: 'number',
        hide: args => {
          const triggerBehavior = (args[3] && args[3].value) || defaultTriggerBehaviour;
          return triggerBehavior !== 'when-expired';
        },
        defaultValue: 60,
      },
      {
        type: 'string',
        encoding: 'base64',
        displayName: 'JavaScript Code',
        description: 'The variable named `output` contains the output of the original response template tag.',
        placeholder: 'output'
      }
    ],

    async run(context, id, resendBehavior, maxAgeSeconds, js) {
      resendBehavior = (resendBehavior || defaultTriggerBehaviour).toLowerCase();

      if (!id) {
        throw new Error('No request specified');
      }

      const request = await context.util.models.request.getById(id);
      if (!request) {
        throw new Error(`Could not find request ${id}`);
      }

      const environmentId = context.context.getEnvironmentId();
      let response = await context.util.models.response.getLatestForRequestId(id, environmentId);

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

      // Make sure we only send the request once per render so we don't have infinite recursion
      const requestChain = context.context.getExtraInfo('requestChain') || [];
      if (requestChain.some(id => id === request._id)) {
        console.log('[response eval] Preventing recursive render');
        shouldResend = false;
      }

      if (shouldResend && context.renderPurpose === 'send') {
        console.log('[response eval] Resending dependency');
        requestChain.push(request._id)
        response = await context.network.sendRequest(request, [
          { name: 'requestChain', value: requestChain }
        ]);
      }

      if (!response) {
        console.log('[response eval] No response found');
        throw new Error('No responses for request');
      }

      if (response.error) {
        console.log('[response eval] Response error ' + response.error);
        throw new Error('Failed to send dependent request ' + response.error);
      }

      if (!response.statusCode) {
        console.log('[response eval] Invalid status code ' + response.statusCode);
        throw new Error('No successful responses for request');
      }

      const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
      const match = response.contentType && response.contentType.match(/charset=([\w-]+)/);
      const charset = match && match.length >= 2 ? match[1] : 'utf-8';

      let body;
      try {
        body = iconv.decode(bodyBuffer, charset);
      } catch (err) {
        console.warn('[response eval] Failed to decode body', err);
        body = bodyBuffer.toString();
      }

      let r = body;
      if (js) {
        try {
          r = await eval(`(async () => { return ${js} })`)();
        } catch (err) {
          throw new Error(`Cannot eval: ${err.message}`);
        }
      }

      return r;
    },
  },
];