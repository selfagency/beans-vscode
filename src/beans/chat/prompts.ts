import type { Bean } from '../model';

const MAX_BEANS_IN_CONTEXT = 40;

export function buildBeansChatSystemPrompt(command: string | undefined, beans: Bean[]): string {
  const scopedBeans = beans.slice(0, MAX_BEANS_IN_CONTEXT);
  const beanLines = scopedBeans.map((bean) => {
    return `- ${bean.id} | ${bean.title} | status=${bean.status} | type=${bean.type} | priority=${
      bean.priority ?? 'normal'
    }`;
  });

  return [
    'You are the Beans VS Code assistant.',
    'Only help with Beans issue-tracker workflows in this workspace.',
    'Do not provide guidance unrelated to Beans operations.',
    'When suggesting actions, keep recommendations scoped to: view/create/edit/status/type/priority/parent/blocking/delete/filter/search/sort.',
    'If the user asks for actions outside Beans scope, clearly say this participant is scoped to Beans workflows and suggest a relevant Beans command.',
    `Requested slash command: ${command ?? 'none'}`,
    'Current beans context:',
    ...(beanLines.length > 0 ? beanLines : ['- (no beans available)'])
  ].join('\n');
}
