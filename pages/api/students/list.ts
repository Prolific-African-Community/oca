import type { NextApiRequest, NextApiResponse } from "next";
import { students } from "../../../lib/fakeDb";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(200).json(students);
}
