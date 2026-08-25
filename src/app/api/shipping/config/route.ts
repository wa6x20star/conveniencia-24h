import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORE_SLUG, hasServerSupabaseEnv } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(){
  if(!hasServerSupabaseEnv()) return NextResponse.json({freeDeliveryEnabled:true,freeDeliveryFrom:50},{headers:{"Cache-Control":"no-store"}});
  try{
    const supabase=createAdminClient();
    const {data:store}=await supabase.from("stores").select("id").eq("slug",STORE_SLUG).single();
    if(!store) throw new Error("store_not_found");
    const {data:settings}=await supabase.from("delivery_settings").select("free_delivery_enabled,free_delivery_from").eq("store_id",store.id).maybeSingle();
    return NextResponse.json({freeDeliveryEnabled:settings?.free_delivery_enabled!==false,freeDeliveryFrom:Number(settings?.free_delivery_from??50)},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({freeDeliveryEnabled:true,freeDeliveryFrom:50},{headers:{"Cache-Control":"no-store"}});
  }
}
