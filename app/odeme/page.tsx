import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "İşletme kurulumu · Neta" };

export default function Page() {
  redirect("/kurulum");
}
