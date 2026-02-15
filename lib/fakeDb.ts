/* ========================================================= */
/* ===================== GLOBAL TYPES ====================== */
/* ========================================================= */

export type UserRole = "superadmin" | "admin" | "student";
export type UniversityStatus = "active" | "inactive";

/* ========================================================= */
/* ====================== STUDENTS ========================= */
/* ========================================================= */

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  faculty: string;
  program: string;
  semester: string;
  courses: string[];
  password: string;
  universityId: string;
  role: "student";
};

declare global {
  var _students: Student[] | undefined;
}

if (!global._students) {
  global._students = [];
}

export const students: Student[] = global._students;

/* ========================================================= */
/* ======================== USERS ========================== */
/* ========================================================= */

export type User = {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  universityId?: string;
};

declare global {
  var _users: User[] | undefined;
}

if (!global._users) {
  global._users = [
    {
      id: "1",
      email: "superadmin@oca.com",
      password: "admin123",
      role: "superadmin",
    },
  ];
}

export const users: User[] = global._users;

/* ========================================================= */
/* ===================== UNIVERSITIES ====================== */
/* ========================================================= */

export type UniversityStatus = "active" | "inactive";

export type University = {
  id: string;
  name: string;
  adminEmail: string;
  status: UniversityStatus;
};

declare global {
  var _universities: University[] | undefined;
}

if (!global._universities) {
  global._universities = [];
}

export const universities: University[] = global._universities;

