import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import PrintSheet from '../components/PrintSheet';

let mounted = null; // { root, node }

function cleanup() {
  document.body.classList.remove('printing-sheet');
  if (mounted) {
    mounted.root.unmount();
    mounted.node.remove();
    mounted = null;
  }
}

// Builds the printable sheet and opens the print dialog.
// sheet: { kind, title, subjectName, dueDate, templates: [{ position, questions: [...] }], ...student fields }
// t: the translation function (the sheet is rendered outside the app, so it gets plain labels).
export function printSheet(sheet, t) {
  cleanup();
  const L = {
    appName: t('appName'), subject: t('subjectLabel'), due: t('due'), answerKey: t('answerKey'), name: t('name'),
    date: t('dateLabel'), grade: t('grade'), mark: t('markLabel'), template: t('templateLabel'),
    yourAnswer: sheet.kind === 'graded' && sheet.whose === 'student' ? t('studentAnswer') : t('yourAnswer'),
    correctAnswer: t('correctAnswer'), correctWord: t('correctWord'), noAnswerGiven: t('noAnswerGiven')
  };
  const node = document.createElement('div');
  document.body.appendChild(node);
  const root = createRoot(node);
  mounted = { root, node };
  root.render(createElement(PrintSheet, { sheet: { ...sheet, dir: document.documentElement.dir || 'ltr' }, L }));

  // wait for React to paint the sheet, then print; clean up when the dialog closes
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('printing-sheet');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }));
}
