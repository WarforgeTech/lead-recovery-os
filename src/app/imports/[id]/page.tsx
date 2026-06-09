import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function ImportDetailRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("imports").select("workflow_status").eq("id", id).single();
  if (data?.workflow_status === "ready_for_review") redirect(`/imports/${id}/review`);
  if (data?.workflow_status === "accepted") redirect("/dashboard");
  redirect(`/imports/${id}/processing`);
}
