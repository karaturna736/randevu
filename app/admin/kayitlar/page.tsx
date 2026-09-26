import Admin from "@/components/product/admin";
import ManualPanelGrants from "@/components/product/manual-panel-grants";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <ManualPanelGrants />
      <Admin initialView="users" />
    </>
  );
}
