import type { Metadata } from "next";
import { SelectedBusinessBooking } from "@/components/product/selected-business-booking";
import { publicBusiness } from "@/lib/booking";
import { publicWebsite } from "@/lib/plus-platform";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const business = await publicBusiness(slug);
    const site = await publicWebsite(business.id);
    return {
      title: site?.seo_title || `${business.name} | Online Randevu`,
      description: site?.seo_description || business.description || `${business.name} için online randevu alın.`,
    };
  } catch {
    return { title: "Online Randevu | Neta" };
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ branch?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const branch = Array.isArray(query.branch) ? query.branch[0] : query.branch || "";
  return <SelectedBusinessBooking slug={slug} branchId={branch} />;
}
