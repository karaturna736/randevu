import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  redirect("/panel?demo=1");
}
