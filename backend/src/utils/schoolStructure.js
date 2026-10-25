// Canonical grade and classroom values — the single source of truth for
// what counts as a valid grade/classroom across the whole app. Using a fixed
// list instead of free text eliminates the class of bugs where a typo
// ("1 mid" vs "1 Mid") silently breaks student-subject matching, since
// enrollment is based on exact string equality.
const GRADES = ['الاول متوسط', 'الثاني متوسط', 'الثالث متوسط', 'رابع اعدادي', 'خامس اعدادي', 'سادس اعدادي'];
const CLASSROOMS = ['A', 'B', 'C', 'D'];

function isValidGrade(grade) {
  return GRADES.includes(grade);
}

function isValidClassroom(section) {
  return CLASSROOMS.includes(section);
}

module.exports = { GRADES, CLASSROOMS, isValidGrade, isValidClassroom };
