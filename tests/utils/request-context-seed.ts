import { Role } from '@a2a-js/sdk';
import { RequestContext, ServerCallContext } from '@a2a-js/sdk/server';

/** The context the request handler gives the executor for one user text message. */
export function requestContext(text: string, ids: { taskId: string; contextId: string }): RequestContext {
  const message = {
    messageId: `message-${ids.taskId}-${text.length.toString()}`,
    contextId: ids.contextId,
    taskId: '',
    role: Role.ROLE_USER,
    parts: [{ content: { $case: 'text' as const, value: text }, metadata: undefined, filename: '', mediaType: 'text/plain' }],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: []
  };
  return new RequestContext(
    { tenant: '', message, configuration: undefined, metadata: undefined },
    ids.taskId,
    ids.contextId,
    new ServerCallContext()
  );
}
