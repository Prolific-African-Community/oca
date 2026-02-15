// ===== STUDENTS =====

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  faculty: string;
  program: string;
  semester: string;
  courses: string[];
  password: string;
};

// @ts-ignore
if (!globalThis._students) {
  // @ts-ignore
  globalThis._students = [];
}

// @ts-ignore
export const students: Student[] = globalThis._students;

// ===== USERS =====

type User = {
  id: string;
  email: string;
  password: string;
  role: "superadmin" | "admin" | "student";
  universityId?: string;
};

// @ts-ignore
if (!globalThis._users) {
  // @ts-ignore
  globalThis._users = [
    {
      id: "1",
      email: "superadmin@oca.com",
      password: "admin123",
      role: "superadmin",
    },
  ];
}

// @ts-ignore
export const users: User[] = globalThis._users;

// ===== UNIVERSITIES =====

type University = {
  id: string;
  name: string;
  adminEmail: string;
  status: "active" | "inactive";
};

// @ts-ignore
if (!globalThis._universities) {
  // @ts-ignore
  globalThis._universities = [];
}

// @ts-ignore
export const universities: University[] = globalThis._universities;
