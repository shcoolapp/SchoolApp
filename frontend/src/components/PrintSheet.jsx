// The paper version of a homework. Rendered off-screen by lib/printSheet.js and only visible when printing.
//   kind 'blank'  -> questions only (to answer on paper)
//   kind 'key'    -> questions with the correct answer marked (teacher)
//   kind 'graded' -> a student's attempt: their answers, the correct answers and the degrees
import { formatMark, questionWorth } from '../lib/mark';

export default function PrintSheet({ sheet, L }) {
  const { kind, templates } = sheet;
  const graded = kind === 'graded';
  const key = kind === 'key';

  return (
    <div className="print-sheet" dir={sheet.dir}>
      <div className="ps-head">
        <div className="ps-school">{L.appName}</div>
        <h1 className="ps-title">{sheet.title}</h1>
        <div className="ps-meta">
          {sheet.subjectName && <span>{L.subject}: {sheet.subjectName}</span>}
          {sheet.dueDate && <span>{L.due}: {String(sheet.dueDate).slice(0, 10)}</span>}
          {key && <span className="ps-badge">{L.answerKey}</span>}
        </div>

        {graded ? (
          <div className="ps-student">
            <span>{L.name}: <strong>{sheet.studentName}</strong></span>
            {sheet.studentGrade && <span>{L.grade}: {sheet.studentGrade} {sheet.studentSection || ''}</span>}
            <span className="ps-score">{L.mark}: {formatMark(sheet.score, sheet.total)} <span className="ps-note">({sheet.score} / {sheet.total} {L.correctWord})</span></span>
          </div>
        ) : (
          !key && (
            <div className="ps-student">
              <span>{L.name}: ______________________________</span>
              <span>{L.date}: ______________</span>
            </div>
          )
        )}
      </div>

      {templates.map((tpl) => (
        <section key={tpl.position} className="ps-template">
          {(templates.length > 1 || tpl.position) && <h2 className="ps-tpl">{L.template} {tpl.position}</h2>}
          {tpl.questions.map((q, idx) => {
            const right = graded && q.selected === q.correct;
            return (
              <div key={q.id} className="ps-q">
                <div className="ps-qhead">
                  <span>{idx + 1}. {q.text}</span>
                  {graded && (
                    <span className="ps-deg">
                      {right ? '✓' : '✗'} {right ? questionWorth(sheet.total) : 0} / {questionWorth(sheet.total)}
                    </span>
                  )}
                </div>
                {['a', 'b', 'c', 'd'].map((opt) => {
                  const isCorrect = q.correct === opt;
                  const isChosen = q.selected === opt;
                  const showCorrect = (key || graded) && isCorrect;
                  const cls = ['ps-opt', showCorrect ? 'ps-correct' : '', graded && isChosen && !isCorrect ? 'ps-wrong' : ''].join(' ');
                  const notes = [];
                  if (graded && isChosen) notes.push(L.yourAnswer);
                  if (showCorrect) notes.push(L.correctAnswer);
                  return (
                    <div key={opt} className={cls}>
                      <span className="ps-box">{showCorrect ? '✓' : graded && isChosen ? '✗' : '○'}</span>
                      <span>{opt.toUpperCase()}. {q.options[opt]}</span>
                      {notes.length > 0 && <span className="ps-note">({notes.join(' · ')})</span>}
                    </div>
                  );
                })}
                {graded && !q.selected && <div className="ps-note">{L.noAnswerGiven}</div>}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
