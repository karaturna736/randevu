import AdminRegistrations from "@/components/product/admin-registrations";
import AdminManualAccess from "@/components/product/admin-manual-access";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <AdminRegistrations />
      <div className="neta-container">
        <AdminManualAccess />
      </div>
    </>
  );
}
