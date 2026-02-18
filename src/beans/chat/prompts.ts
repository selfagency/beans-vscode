import type { Bean } from '../model';

const MAX_BEANS_IN_CONTEXT = 40;

export function buildBeansChatSystemPrompt(command: string | undefined, beans: Bean[]): string {
  const scopedBeans = beans.slice(0, MAX_BEANS_IN_CONTEXT);
  const beanLines = scopedBeans.map(bean => {
    return `- ${bean.id} | ${bean.title} | status=${bean.status} | type=${bean.type} | priority=${
      bean.priority ?? 'normal'
    }`;
  });

  return [
    'You are the Beans VS Code assistant. You are a read-only, conversational participant.',
    'Only help with Beans issue-tracker workflows in this workspace.',
    'Do not provide guidance unrelated to Beans operations.',
    'IMPORTANT: You cannot mutate beans directly. When the user needs to create, edit, change status/type/priority, manage parent/blocking relationships, reopen, or delete a bean, direct them to the appropriate VS Code extension command: beans.create, beans.edit, beans.setStatus, beans.setType, beans.setPriority, beans.setParent, beans.removeParent, beans.editBlocking, beans.reopenCompleted, beans.reopenScrapped, beans.delete, beans.copilotStartWork.',
    'When suggesting actions, name the exact extension command (e.g. `beans.setStatus`) rather than describing a generic action.',
    'If the user asks for actions outside Beans scope, clearly say this participant is scoped to Beans workflows and suggest a relevant Beans command.',
    `Requested slash command: ${command ?? 'none'}`,
    'Current beans context:',
    ...(beanLines.length > 0 ? beanLines : ['- (no beans available)']),
  ].join('\n');
}
