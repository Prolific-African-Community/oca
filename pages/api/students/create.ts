import type { NextApiRequest, NextApiResponse } from "next";
import { students, users } from "../../../lib/fakeDb";
import type { Student, User } from "../../../lib/fakeDb";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Méthode non autorisée" });
  }

  const {
    firstName,
    lastName,
    email,
    faculty,
    program,
    semester,
    courses,
    password,
    universityId,
  } = req.body;

  // Validation minimale
  if (!firstName || !lastName || !email || !password || !universityId) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Vérifier si email existe déjà
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "Email déjà utilisé" });
  }

  // Création Student typée strictement
  const newStudent: Student = {
    id: Date.now().toString(),
    firstName,
    lastName,
    email,
    faculty: faculty || "",
    program: program || "",
    semester: semester || "",
    courses: courses || [],
    password,
    universityId,
    role: "student",
  };

  students.push(newStudent);

  // Création User typé strictement
  const newUser: User = {
    id: newStudent.id,
    email: newStudent.email,
    password: newStudent.password,
    role: "student",
    universityId: newStudent.universityId,
  };

  users.push(newUser);

  return res.status(200).json(newStudent);
}
