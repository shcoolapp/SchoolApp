import { useSettings } from '../context/SettingsContext';

const translations = {
  en: {
    appName: 'School Portal',
    signInToContinue: 'Sign in to continue',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',

    todoList: 'To do list',
    calendar: 'Calendar',
    homework: 'Homework',
    subjects: 'Subjects',
    settings: 'Settings',
    account: 'Account',

    noActivitiesYet: 'No activities yet.',
    add: 'Add',
    selectSubject: 'Select subject',
    whatsTheActivity: "What's the activity?",
    remove: 'Remove',

    exam: 'Exam',
    homeworkDue: 'Homework due',
    weekendHoliday: 'Weekend / holiday',

    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    fontSize: 'Font size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',

    name: 'Name',
    role: 'Role',
    teacher: 'Teacher',
    student: 'Student',

    loading: 'Loading...',
    noHomeworkYet: 'No homework yet.',
    due: 'due',

    onlyTeachersManageSubjects: 'Only teachers can manage subjects.',
    subjectNamePlaceholder: 'Subject name (e.g. Math)',
    gradePlaceholder: 'Grade (e.g. 1 Mid)',
    classroomPlaceholder: 'Classroom (e.g. B)',
    gradeOptionalPlaceholder: 'Grade (optional, e.g. 1 Mid)',
    classroomOptionalPlaceholder: 'Classroom (optional, e.g. B)',
    addSubject: 'Add subject',
    noSubjectsYet: 'No subjects yet.',
    grade: 'Grade',
    fillSubjectFields: 'Fill in subject name, grade, and classroom section',

    bulkImportTitle: 'Bulk import students/teachers',
    bulkImportColumns: 'Excel columns: name | email | role | password | grade | classroomSection',
    bulkImportExplain:
      'Teachers: email + password required. Students: leave email/password blank — a username and simple password are generated automatically, and a login sheet downloads after import.',
    importing: 'Importing...',
    created: 'Created',
    skipped: 'skipped',
    alreadyExisted: 'already existed',
    enrolled: 'enrolled',
    loginSheetDownloaded: 'Student login sheet downloaded.',
    rowsHadErrors: 'row(s) had errors — check spreadsheet formatting.',

    redownloadTitle: 'Re-download student logins',
    redownloadExplain: 'Get an Excel sheet of student usernames/passwords anytime — not just right after import.',
    downloadLogins: 'Download student logins (.xlsx)'
  },
  ar: {
    appName: 'بوابة المدرسة',
    signInToContinue: 'سجّل الدخول للمتابعة',
    username: 'اسم المستخدم',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    signingIn: 'جارٍ تسجيل الدخول...',
    signOut: 'تسجيل الخروج',
    signedInAs: 'مسجّل الدخول باسم',

    todoList: 'قائمة المهام',
    calendar: 'التقويم',
    homework: 'الواجبات',
    subjects: 'المواد',
    settings: 'الإعدادات',
    account: 'الحساب',

    noActivitiesYet: 'لا توجد أنشطة بعد.',
    add: 'إضافة',
    selectSubject: 'اختر المادة',
    whatsTheActivity: 'ما هو النشاط؟',
    remove: 'إزالة',

    exam: 'امتحان',
    homeworkDue: 'موعد تسليم الواجب',
    weekendHoliday: 'عطلة نهاية الأسبوع / عطلة رسمية',

    theme: 'المظهر',
    dark: 'داكن',
    light: 'فاتح',
    language: 'اللغة',
    fontSize: 'حجم الخط',
    small: 'صغير',
    medium: 'متوسط',
    large: 'كبير',

    name: 'الاسم',
    role: 'الدور',
    teacher: 'معلم',
    student: 'طالب',

    loading: 'جارٍ التحميل...',
    noHomeworkYet: 'لا توجد واجبات بعد.',
    due: 'الموعد',

    onlyTeachersManageSubjects: 'يمكن للمعلمين فقط إدارة المواد.',
    subjectNamePlaceholder: 'اسم المادة (مثل: رياضيات)',
    gradePlaceholder: 'الصف (مثل: أول متوسط)',
    classroomPlaceholder: 'الشعبة (مثل: ب)',
    gradeOptionalPlaceholder: 'الصف (اختياري، مثل: أول متوسط)',
    classroomOptionalPlaceholder: 'الشعبة (اختياري، مثل: ب)',
    addSubject: 'إضافة مادة',
    noSubjectsYet: 'لا توجد مواد بعد.',
    grade: 'الصف',
    fillSubjectFields: 'أدخل اسم المادة والصف والشعبة',

    bulkImportTitle: 'استيراد جماعي للطلاب/المعلمين',
    bulkImportColumns: 'أعمدة الإكسل: name | email | role | password | grade | classroomSection',
    bulkImportExplain:
      'المعلمون: يلزم البريد الإلكتروني وكلمة المرور. الطلاب: اتركوا حقلي البريد وكلمة المرور فارغين — سيتم توليد اسم مستخدم وكلمة مرور بسيطة تلقائيًا، وتنزيل ملف تسجيل الدخول بعد الاستيراد.',
    importing: 'جارٍ الاستيراد...',
    created: 'تم إنشاء',
    skipped: 'تم تخطي',
    alreadyExisted: 'موجود مسبقًا',
    enrolled: 'تم تسجيل',
    loginSheetDownloaded: 'تم تنزيل ملف تسجيل دخول الطلاب.',
    rowsHadErrors: 'صف/صفوف بها أخطاء — تحقق من تنسيق الجدول.',

    redownloadTitle: 'إعادة تنزيل بيانات دخول الطلاب',
    redownloadExplain: 'احصل على ملف إكسل بأسماء مستخدمي وكلمات مرور الطلاب في أي وقت — وليس فقط بعد الاستيراد مباشرة.',
    downloadLogins: 'تنزيل بيانات دخول الطلاب (.xlsx)'
  }
};

export function useTranslation() {
  const { settings } = useSettings();
  const dict = translations[settings.language] || translations.en;
  return (key) => dict[key] || key;
}
