import type { NextApiRequest, NextApiResponse } from "next";
import type { University } from "../../../lib/fakeDb";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, adminEmail, adminPassword } = req.body;

  if (!name || !adminEmail || !adminPassword) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // Vérifier si email déjà utilisé
  const existingUser = users.find((u) => u.email === adminEmail);
  if (existingUser) {
    return res.status(400).json({ message: "Email already used" });
  }

  const newUniversity = {
    id: Date.now().toString(),
    name,
    adminEmail,
    status: "active",
  };

  universities.push(newUniversity);

  // Création du user admin lié
  const newAdminUser = {
    id: Date.now().toString() + "_admin",
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    universityId: newUniversity.id,
  };

  users.push(newAdminUser);

  return res.status(200).json({
    university: newUniversity,
    admin: newAdminUser,
  });
}

