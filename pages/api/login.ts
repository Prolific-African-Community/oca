import type { NextApiRequest, NextApiResponse } from "next";
import { users } from "../../lib/fakeDb";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { email, password } = req.body;

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  return res.status(200).json(user);
}

