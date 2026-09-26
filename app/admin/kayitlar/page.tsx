import Admin from "@/components/product/admin";
import AdminManualAccess from "@/components/product/admin-manual-access";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <Admin initialView="users" />
      <div className="neta-container">
        <AdminManualAccess />
      </div>
    </>
  );
}
