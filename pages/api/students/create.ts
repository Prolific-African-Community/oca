import type { NextApiRequest, NextApiResponse } from "next";
import type { students, users } from "../../../lib/fakeDb";

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

  if (!firstName || !lastName || !email || !password || !universityId) {
    return res.status(400).json({ message: "Champs manquants" });
  }

  // Vérifier si email existe déjà
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).json({ message: "Email déjà utilisé" });
  }

  const newStudent = {
    id: Date.now().toString(),
    firstName,
    lastName,
    email,
    faculty,
    program,
    semester,
    courses,
    password,
    universityId,
    role: "student",
  };

  students.push(newStudent);

  // IMPORTANT → pour permettre login
  users.push({
    id: newStudent.id,
    email: newStudent.email,
    password: newStudent.password,
    role: "student",
    universityId: newStudent.universityId,
  });

  return res.status(200).json(newStudent);
}

